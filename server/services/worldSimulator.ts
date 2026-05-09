// ---------------------------------------------------------------------------
// World Simulator — listens to agent/task changes, broadcasts world actions
// ---------------------------------------------------------------------------

import * as worldStore from "../store/worldStore.js";
import * as agentStore from "../store/agentStore.js";
import * as taskStore from "../store/taskStore.js";
import { broadcast } from "./wsBroadcaster.js";
import type { Agent, Task, AgentWorldState } from "../store/types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorldAction {
  type:
    | "spawn"
    | "move_to_area"
    | "update_visual"
    | "show_bubble"
    | "celebrate"
    | "despawn";
  agentId: string;
  payload?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// WorldSimulator
// ---------------------------------------------------------------------------

class WorldSimulator {
  private initialized = false;

  /**
   * Initialise the world simulator.
   * Syncs all existing agents into the world state.
   */
  init(): void {
    if (this.initialized) return;

    // Sync existing agents into world state
    const agents = agentStore.getAllAgents();
    for (const agent of agents) {
      const existingState = worldStore.getAgentState(agent.id);
      if (!existingState) {
        this.spawnAgent(agent);
      } else {
        // Ensure visual state matches current agent status
        this.syncVisualState(agent);
      }
    }

    this.initialized = true;
    console.log(`[WorldSimulator] Initialized with ${agents.length} agent(s)`);
  }

  /**
   * Called when an agent is created or updated.
   */
  async onAgentUpdate(agent: Agent, changes?: Partial<Agent>): Promise<void> {
    let state = worldStore.getAgentState(agent.id);

    // If agent has no world state yet, spawn them
    if (!state) {
      this.spawnAgent(agent);
      return;
    }

    // Handle status changes
    if (changes?.status !== undefined) {
      switch (changes.status) {
        case "idle":
          await this.moveToArea(agent.id, "lobby", "idle");
          break;
        case "working": {
          // Find the active task to determine which area to go to
          const activeTask = taskStore.getActiveTaskForAgent(agent.id);
          const areaId = activeTask
            ? worldStore.getAreaForTask(activeTask.tags)
            : "workstation";
          await this.moveToArea(agent.id, areaId, "working");
          break;
        }
        case "stuck":
          await this.updateVisual(agent.id, "stuck", "...");
          break;
        case "offline":
          await this.updateVisual(agent.id, "offline", null);
          break;
      }
    }

    // Handle isEnabled change
    if (changes?.isEnabled === false) {
      await this.updateVisual(agent.id, "offline", null);
    } else if (changes?.isEnabled === true && agent.status === "idle") {
      state = worldStore.getAgentState(agent.id);
      if (state?.visualState === "offline") {
        await this.moveToArea(agent.id, "lobby", "idle");
      }
    }
  }

  /**
   * Called when a task is created or updated.
   */
  async onTaskUpdate(task: Task, changes?: Partial<Task>): Promise<void> {
    // Task started running — move agent to the correct area
    if (changes?.status === "Running" && task.agentId) {
      const areaId = worldStore.getAreaForTask(task.tags);
      await this.moveToArea(task.agentId, areaId, "working", task.title);
    }

    // Task completed successfully — celebrate, then return to lobby
    if (changes?.status === "Done" && task.agentId) {
      await this.celebrateAndReturn(task.agentId);
    }

    // Task stuck — show stuck animation
    if (changes?.status === "Stuck" && task.agentId) {
      await this.updateVisual(
        task.agentId,
        "stuck",
        task.stuckReason ?? "Stuck",
      );
    }

    // Task cancelled — return agent to idle
    if (changes?.status === "Cancelled" && task.agentId) {
      const agent = agentStore.getAgentById(task.agentId);
      if (agent && agent.status === "idle") {
        await this.moveToArea(task.agentId, "lobby", "idle");
      }
    }
  }

  /**
   * Called when a tool event occurs (PreToolUse / PostToolUse).
   * Shows a brief bubble with the tool name.
   */
  onToolEvent(taskId: string, toolName: string): void {
    const task = taskStore.getTaskById(taskId);
    if (!task?.agentId) return;

    this.emitAction({
      type: "show_bubble",
      agentId: task.agentId,
      payload: { text: toolName, duration: 3000 },
    });
  }

  /**
   * Called when an agent is removed from the system.
   */
  async onAgentRemove(agentId: string): Promise<void> {
    this.emitAction({ type: "despawn", agentId });
    await worldStore.removeAgentState(agentId);
  }

  /**
   * Get an agent's current world state.
   */
  getAgentWorldState(agentId: string): AgentWorldState | undefined {
    return worldStore.getAgentState(agentId);
  }

  /**
   * Get all agent world states.
   */
  getAllStates(): AgentWorldState[] {
    return worldStore.getAllAgentStates();
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private spawnAgent(agent: Agent): void {
    const slot = worldStore.findAvailableSlot("lobby");
    const config = worldStore.getConfig();
    const lobby = config.areas.find((a) => a.id === "lobby") ?? config.areas[0];
    const position = slot ?? { x: lobby.x + 32, y: lobby.y + 32 };

    // Fire-and-forget — updateAgentState is async but we emit the action
    // immediately for responsive UI
    worldStore.updateAgentState(agent.id, {
      currentAreaId: "lobby",
      position,
      facing: "down",
      visualState: agent.isEnabled ? "idle" : "offline",
    });

    this.emitAction({
      type: "spawn",
      agentId: agent.id,
      payload: {
        position,
        facing: "down",
        visualState: agent.isEnabled ? "idle" : "offline",
      },
    });
  }

  private async moveToArea(
    agentId: string,
    areaId: string,
    visualState: AgentWorldState["visualState"],
    actionLabel?: string | null,
  ): Promise<void> {
    const slot = worldStore.findAvailableSlot(areaId);
    const config = worldStore.getConfig();
    const area = config.areas.find((a) => a.id === areaId);
    const position = slot ?? (area ? { x: area.x + 32, y: area.y + 32 } : { x: 0, y: 0 });

    await worldStore.updateAgentState(agentId, {
      currentAreaId: areaId,
      position,
      visualState,
      actionLabel: actionLabel ?? null,
    });

    this.emitAction({
      type: "move_to_area",
      agentId,
      payload: { areaId, position, visualState, actionLabel },
    });
  }

  private async updateVisual(
    agentId: string,
    visualState: AgentWorldState["visualState"],
    actionLabel: string | null,
  ): Promise<void> {
    await worldStore.updateAgentState(agentId, {
      visualState,
      actionLabel,
    });

    this.emitAction({
      type: "update_visual",
      agentId,
      payload: { visualState, actionLabel },
    });
  }

  private async celebrateAndReturn(agentId: string): Promise<void> {
    // Show celebrate animation
    await worldStore.updateAgentState(agentId, {
      visualState: "celebrate",
      actionLabel: "Done!",
    });

    this.emitAction({
      type: "celebrate",
      agentId,
      payload: { duration: 3000 },
    });

    // After a delay, move back to lobby
    setTimeout(() => {
      const agent = agentStore.getAgentById(agentId);
      if (agent && agent.status === "idle") {
        this.moveToArea(agentId, "lobby", "idle");
      }
    }, 4000);
  }

  private syncVisualState(agent: Agent): void {
    const state = worldStore.getAgentState(agent.id);
    if (!state) return;

    const expectedVisual = this.agentStatusToVisual(agent.status, agent.isEnabled);
    if (state.visualState !== expectedVisual) {
      worldStore.updateAgentState(agent.id, {
        visualState: expectedVisual,
      });
    }
  }

  private agentStatusToVisual(
    status: Agent["status"],
    isEnabled: boolean,
  ): AgentWorldState["visualState"] {
    if (!isEnabled) return "offline";
    switch (status) {
      case "working":
        return "working";
      case "stuck":
        return "stuck";
      case "idle":
      default:
        return "idle";
    }
  }

  private emitAction(action: WorldAction): void {
    broadcast("world:action", action);
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const worldSimulator = new WorldSimulator();

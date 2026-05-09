import { useEffect, useRef } from "react";
import { createPixelGame } from "../pixel/main";
import { worldEventBus } from "../pixel/systems/WorldEventBus";
import type { Agent, Task, AgentStatus } from "../types";
import type { AgentVisualState } from "../pixel/types";

interface Props {
  agents: Agent[];
  tasks: Task[];
  selectedAgentId: string | null;
  selectedTaskId: string | null;
  onSelectAgent: (id: string) => void;
  onSelectTask: (id: string) => void;
}

/** Map Agent status + task context to a visual state for the pixel world. */
function deriveVisualState(agent: Agent, tasks: Task[]): AgentVisualState {
  if (!agent.isEnabled) return "offline";
  if (agent.status === "stuck") return "stuck";

  // Check if agent has a running task
  const runningTask = tasks.find(
    t => t.agentId === agent.id && t.status === "Running"
  );
  if (runningTask) return "working";

  // Check if agent just completed a task
  const recentDone = tasks.find(
    t =>
      t.agentId === agent.id &&
      t.status === "Done" &&
      t.completedAt &&
      Date.now() - t.completedAt < 3000
  );
  if (recentDone) return "celebrating";

  return "idle";
}

/** Get the sprite key for an agent. */
function getSpriteKey(agent: Agent): string {
  // Extract short ID suffix for sprite mapping
  const shortId = agent.id.slice(-3);
  if (["001", "002"].includes(shortId)) return `character-${shortId}`;
  return "character-default";
}

/** Determine the area ID and target position for an agent. */
function getAgentTarget(
  agent: Agent,
  tasks: Task[],
  config: {
    tagAreaMapping: Record<string, string>;
    agentSlots: Record<string, { x: number; y: number }[]>;
  } | null
): { areaId: string; x: number; y: number } {
  if (!config) return { areaId: "lobby", x: 200, y: 300 };

  const runningTask = tasks.find(
    t => t.agentId === agent.id && t.status === "Running"
  );

  if (runningTask && runningTask.tags.length > 0) {
    const tag = runningTask.tags[0];
    const areaId =
      config.tagAreaMapping[tag] ||
      config.tagAreaMapping["_default"] ||
      "workstation";
    const slots = config.agentSlots[areaId];
    if (slots && slots.length > 0) {
      // Find a slot index based on some deterministic logic
      const slotIdx =
        tasks.filter(t => t.agentId === agent.id).length % slots.length;
      return { areaId, x: slots[slotIdx].x, y: slots[slotIdx].y };
    }
    return { areaId, x: 200, y: 300 };
  }

  // Default: lobby
  const lobbySlots = config.agentSlots["lobby"];
  if (lobbySlots && lobbySlots.length > 0) {
    const slotIdx = agent.id.charCodeAt(0) % lobbySlots.length;
    return {
      areaId: "lobby",
      x: lobbySlots[slotIdx].x,
      y: lobbySlots[slotIdx].y,
    };
  }
  return { areaId: "lobby", x: 200, y: 300 };
}

export default function PixelWorldView({
  agents,
  tasks,
  selectedAgentId,
  onSelectAgent,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<ReturnType<typeof createPixelGame> | null>(null);
  const prevAgentIdsRef = useRef<Set<string>>(new Set());
  const worldConfigRef = useRef<Record<
    string,
    { x: number; y: number }[]
  > | null>(null);

  // Create Phaser game
  useEffect(() => {
    if (!containerRef.current) return;

    const game = createPixelGame(containerRef.current);
    gameRef.current = game;

    // Listen for scene ready to fetch config
    const unsubReady = worldEventBus.on("scene:ready", () => {
      // Config is loaded inside Phaser; we also need it in React for position calculations
      fetch("/assets/world/config.json")
        .then(r => r.json())
        .then(cfg => {
          worldConfigRef.current = cfg.agentSlots;
        })
        .catch(() => {});
    });

    // Listen for agent clicks from Phaser
    const unsubClick = worldEventBus.on("agent:clicked", (agentId: string) => {
      onSelectAgent(agentId);
    });

    return () => {
      unsubReady();
      unsubClick();
      worldEventBus.removeAll();
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync agents to Phaser
  useEffect(() => {
    const prevIds = prevAgentIdsRef.current;
    const currentIds = new Set(agents.map(a => a.id));

    // Added agents
    for (const agent of agents) {
      if (!prevIds.has(agent.id)) {
        const visualState = deriveVisualState(agent, tasks);
        const { areaId, x, y } = getAgentTarget(
          agent,
          tasks,
          worldConfigRef.current
            ? { tagAreaMapping: {}, agentSlots: worldConfigRef.current }
            : null
        );
        worldEventBus.emit("agent:added", {
          agentId: agent.id,
          agentName: agent.name,
          status: agent.status,
          visualState,
          spriteKey: getSpriteKey(agent),
          x,
          y,
          targetX: x,
          targetY: y,
          areaId,
          facing: "down" as const,
        });
      } else {
        // Updated agents
        const visualState = deriveVisualState(agent, tasks);
        const { areaId, x, y } = getAgentTarget(
          agent,
          tasks,
          worldConfigRef.current
            ? { tagAreaMapping: {}, agentSlots: worldConfigRef.current }
            : null
        );
        worldEventBus.emit("agent:updated", {
          agentId: agent.id,
          agentName: agent.name,
          status: agent.status,
          visualState,
          spriteKey: getSpriteKey(agent),
          x,
          y,
          targetX: x,
          targetY: y,
          areaId,
          facing: "down" as const,
        });
      }
    }

    // Removed agents
    for (const prevId of prevIds) {
      if (!currentIds.has(prevId)) {
        worldEventBus.emit("agent:removed", prevId);
      }
    }

    prevAgentIdsRef.current = currentIds;
  }, [agents, tasks]);

  // Focus on selected agent
  useEffect(() => {
    if (selectedAgentId) {
      worldEventBus.emit("select:agent", selectedAgentId);
    }
  }, [selectedAgentId]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ background: "#1a1a2e" }}
    />
  );
}

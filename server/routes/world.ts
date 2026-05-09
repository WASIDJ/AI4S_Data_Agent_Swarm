// ---------------------------------------------------------------------------
// World API routes — world config, agent states, manual movement
// ---------------------------------------------------------------------------

import { Router } from "express";
import * as worldStore from "../store/worldStore.js";
import * as agentStore from "../store/agentStore.js";
import { broadcast } from "../services/wsBroadcaster.js";

export const worldRouter = Router();

// GET /api/world/config — return world configuration
worldRouter.get("/config", (_req, res) => {
  try {
    const config = worldStore.getConfig();
    res.json({ config });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({
      error: { code: "WORLD_CONFIG_ERROR", message: `Failed to load world config: ${message}` },
    });
  }
});

// GET /api/world/agents — return all agent world states
worldRouter.get("/agents", (_req, res) => {
  const states = worldStore.getAllAgentStates();
  res.json({ agents: states });
});

// GET /api/world/agent/:id — return a single agent's world state
worldRouter.get("/agent/:id", (req, res) => {
  const state = worldStore.getAgentState(req.params.id);
  if (!state) {
    return res.status(404).json({
      error: { code: "AGENT_STATE_NOT_FOUND", message: "Agent world state not found" },
    });
  }
  res.json({ agent: state });
});

// POST /api/world/agent/:id/move — manually move an agent to a specified area
worldRouter.post("/agent/:id/move", async (req, res) => {
  const { areaId } = req.body;
  if (!areaId || typeof areaId !== "string") {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "areaId is required and must be a string" },
    });
  }

  // Verify the agent exists
  const agent = agentStore.getAgentById(req.params.id);
  if (!agent) {
    return res.status(404).json({
      error: { code: "AGENT_NOT_FOUND", message: "Agent not found" },
    });
  }

  // Verify the area exists in config
  const config = worldStore.getConfig();
  const area = config.areas.find((a) => a.id === areaId);
  if (!area) {
    return res.status(400).json({
      error: { code: "INVALID_AREA", message: `Area "${areaId}" does not exist in world config` },
    });
  }

  // Find an available slot in the target area
  const slot = worldStore.findAvailableSlot(areaId);
  const position = slot ?? { x: area.x + 32, y: area.y + 32 };

  const updatedState = await worldStore.updateAgentState(req.params.id, {
    currentAreaId: areaId,
    position,
    visualState: agent.status === "working" ? "working" : "idle",
  });

  // Broadcast the movement via WebSocket
  broadcast("world:action", {
    type: "move_to_area",
    agentId: req.params.id,
    payload: {
      areaId,
      position,
      visualState: updatedState.visualState,
    },
  });

  res.json({ agent: updatedState });
});

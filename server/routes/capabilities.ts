import { Router } from "express";
import * as agentStore from "../store/agentStore.js";
import * as capabilityStore from "../store/capabilityStore.js";

export const capabilitiesRouter = Router();

capabilitiesRouter.get("/bindings", (_req, res) => {
  res.json({ bindings: capabilityStore.getAllCapabilityBindings() });
});

capabilitiesRouter.get("/agents/:agentId/bindings", (req, res) => {
  const agent = agentStore.getAgentById(req.params.agentId);
  if (!agent) {
    return res.status(404).json({
      error: { code: "AGENT_NOT_FOUND", message: "Agent not found" },
    });
  }

  res.json({
    bindings: capabilityStore.getCapabilityBindingsForAgent(req.params.agentId),
  });
});

capabilitiesRouter.put("/agents/:agentId/bindings/:capabilityId", (req, res) => {
  const agent = agentStore.getAgentById(req.params.agentId);
  if (!agent) {
    return res.status(404).json({
      error: { code: "AGENT_NOT_FOUND", message: "Agent not found" },
    });
  }

  const enabled = req.body?.enabled === true;
  const binding = capabilityStore.setCapabilityBinding(
    req.params.agentId,
    req.params.capabilityId,
    enabled,
  );
  res.json({ binding });
});

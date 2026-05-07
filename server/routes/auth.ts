import { Router } from "express";
import crypto from "node:crypto";
import * as userStore from "../store/userStore.js";
import { signToken, type JwtPayload } from "../middleware/auth.js";

export const authRouter = Router();

// POST /api/auth/register
authRouter.post("/register", (req, res) => {
  const { name, email, password } = req.body;

  if (!email || typeof email !== "string" || email.length === 0) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "email is required" } });
  }
  if (!password || typeof password !== "string" || password.length < 6) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "password must be at least 6 characters" } });
  }

  const existing = userStore.getUserByEmail(email);
  if (existing) {
    return res.status(409).json({ error: { code: "USER_EXISTS", message: "Email already registered" } });
  }

  const now = Date.now();
  const passwordHash = crypto.createHash("sha256").update(password).digest("hex");
  const displayName = name || email.split("@")[0];

  const user = userStore.createUser({
    id: crypto.randomUUID(),
    name: displayName,
    email,
    passwordHash,
    role: "user",
    createdAt: now,
    updatedAt: now,
  });

  const payload: JwtPayload = { userId: user.id, email: user.email, role: user.role };
  const token = signToken(payload);

  res.status(201).json({
    code: 0,
    data: {
      token,
      user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar, role: user.role, createdAt: user.createdAt },
    },
    message: "ok",
    timestamp: now,
  });
});

// POST /api/auth/login
authRouter.post("/login", (req, res) => {
  const { account, password } = req.body;

  if (!account || !password) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "account and password are required" } });
  }

  const user = userStore.getUserByEmail(account);
  if (!user) {
    return res.status(401).json({ error: { code: "AUTH_FAILED", message: "Invalid email or password" } });
  }

  const passwordHash = crypto.createHash("sha256").update(password).digest("hex");
  if (user.passwordHash !== passwordHash) {
    return res.status(401).json({ error: { code: "AUTH_FAILED", message: "Invalid email or password" } });
  }

  const payload: JwtPayload = { userId: user.id, email: user.email, role: user.role };
  const token = signToken(payload);

  res.json({
    code: 0,
    data: {
      token,
      user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar, role: user.role, createdAt: user.createdAt },
    },
    message: "ok",
    timestamp: Date.now(),
  });
});

// POST /api/auth/logout
authRouter.post("/logout", (_req, res) => {
  res.json({ code: 0, data: null, message: "ok", timestamp: Date.now() });
});

// Export a separate router for /api/user
export const userRouter = Router();

userRouter.get("/profile", (req, res) => {
  const user = req.user ? userStore.getUserById(req.user.userId) : null;
  if (!user) {
    // Return default user for unauthenticated access (local app)
    return res.json({
      code: 0,
      data: {
        id: "default",
        name: "指挥员",
        email: "commander@ai4s.swarm",
        avatar: "/images/avatar-default.png",
        role: "系统管理员",
        createdAt: Date.now(),
      },
      message: "ok",
      timestamp: Date.now(),
    });
  }
  res.json({
    code: 0,
    data: { id: user.id, name: user.name, email: user.email, avatar: user.avatar, role: user.role, createdAt: user.createdAt },
    message: "ok",
    timestamp: Date.now(),
  });
});

userRouter.put("/profile", (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Login required" } });
  }
  const user = userStore.getUserById(req.user.userId);
  if (!user) {
    return res.status(404).json({ error: { code: "USER_NOT_FOUND", message: "User not found" } });
  }
  const { name, avatar } = req.body;
  const patch: Record<string, unknown> = {};
  if (name) patch.name = name;
  if (avatar) patch.avatar = avatar;
  const updated = userStore.updateUser(user.id, patch);
  res.json({
    code: 0,
    data: { id: updated!.id, name: updated!.name, email: updated!.email, avatar: updated!.avatar, role: updated!.role, createdAt: updated!.createdAt },
    message: "ok",
    timestamp: Date.now(),
  });
});

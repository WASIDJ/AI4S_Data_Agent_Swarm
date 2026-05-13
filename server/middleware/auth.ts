import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "ai4s-swarm-local-dev-secret-2026";

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * 可选认证中间件（用于公开接口，尝试解析 Token 但不强制）
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace("Bearer ", "");
  if (token) {
    try {
      req.user = jwt.verify(token, JWT_SECRET) as JwtPayload;
    } catch {
      // Invalid token — proceed without user context
    }
  }
  next();
}

/**
 * 强制认证中间件（用于业务接口，必须有有效 Token）
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace("Bearer ", "");

  if (!token) {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "请先登录" }
    });
    return;
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET) as JwtPayload;
    next();
  } catch {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Token 无效或已过期" }
    });
    return;
  }
}

/**
 * 管理员权限中间件
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "请先登录" } });
    return;
  }
  if (req.user.role !== "admin") {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "需要管理员权限" } });
    return;
  }
  next();
}

/**
 * Token 签发
 */
export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

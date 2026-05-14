/**
 * 资源归属映射表 Store
 * 用于实现数据隔离，不修改原有数据模型
 */

import crypto from "node:crypto";
import type { ResourceOwnership } from "./types.js";
import { ownershipsStore } from "./index.js";

// ---------------------------------------------------------------------------
// In-memory state
// ---------------------------------------------------------------------------

const ownerships = new Map<string, ResourceOwnership>();

// ---------------------------------------------------------------------------
// Persist helper
// ---------------------------------------------------------------------------

function persist(): void {
  ownershipsStore.save({
    _schema_version: 1,
    ownerships: Array.from(ownerships.values()),
  });
}

// ---------------------------------------------------------------------------
// CRUD operations
// ---------------------------------------------------------------------------

/**
 * 创建归属关系
 */
export function grantOwnership(
  userId: string,
  resourceType: "project" | "agent" | "task",
  resourceId: string,
): ResourceOwnership {
  // 检查是否已存在
  const existing = findOwnership(resourceType, resourceId);
  if (existing) {
    return existing;
  }

  const ownership: ResourceOwnership = {
    id: crypto.randomUUID(),
    userId,
    resourceType,
    resourceId,
    createdAt: Date.now(),
  };
  ownerships.set(ownership.id, ownership);
  persist();
  return ownership;
}

/**
 * 查询用户的资源 ID 列表
 */
export function getUserResourceIds(
  userId: string,
  resourceType: "project" | "agent" | "task",
): string[] {
  return Array.from(ownerships.values())
    .filter(o => o.userId === userId && o.resourceType === resourceType)
    .map(o => o.resourceId);
}

/**
 * 查询资源的归属记录
 */
export function findOwnership(
  resourceType: "project" | "agent" | "task",
  resourceId: string,
): ResourceOwnership | undefined {
  return Array.from(ownerships.values())
    .find(o => o.resourceType === resourceType && o.resourceId === resourceId);
}

/**
 * 查询资源的归属用户 ID
 */
export function getResourceOwner(
  resourceType: "project" | "agent" | "task",
  resourceId: string,
): string | undefined {
  const ownership = findOwnership(resourceType, resourceId);
  return ownership?.userId;
}

/**
 * 检查用户是否有权访问资源
 */
export function hasAccess(
  userId: string,
  resourceType: "project" | "agent" | "task",
  resourceId: string,
): boolean {
  return Array.from(ownerships.values())
    .some(o =>
      o.userId === userId &&
      o.resourceType === resourceType &&
      o.resourceId === resourceId
    );
}

/**
 * 删除资源的归属关系
 */
export function revokeOwnership(
  resourceType: "project" | "agent" | "task",
  resourceId: string,
): void {
  const keysToDelete: string[] = [];
  for (const [id, o] of ownerships) {
    if (o.resourceType === resourceType && o.resourceId === resourceId) {
      keysToDelete.push(id);
    }
  }
  for (const key of keysToDelete) {
    ownerships.delete(key);
  }
  if (keysToDelete.length > 0) {
    persist();
  }
}

/**
 * 删除用户的所有归属关系
 */
export function revokeUserOwnerships(userId: string): void {
  const keysToDelete: string[] = [];
  for (const [id, o] of ownerships) {
    if (o.userId === userId) {
      keysToDelete.push(id);
    }
  }
  for (const key of keysToDelete) {
    ownerships.delete(key);
  }
  if (keysToDelete.length > 0) {
    persist();
  }
}

/**
 * 获取所有归属关系（用于调试）
 */
export function getAllOwnerships(): ResourceOwnership[] {
  return Array.from(ownerships.values());
}

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

/**
 * 从磁盘加载归属关系到内存。启动时调用一次。
 */
export function loadOwnerships(): void {
  const data = ownershipsStore.getData();
  const list = (data.ownerships as ResourceOwnership[]) ?? [];
  ownerships.clear();
  for (const o of list) {
    ownerships.set(o.id, o);
  }
}

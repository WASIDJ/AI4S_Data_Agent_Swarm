# Pixel World — 后端扩展设计

> 版本: v0.1 | 日期: 2026-05-08

---

## 1. 设计原则

**最小侵入：** 尽可能复用现有事件流和 WebSocket 通道，不修改核心任务管理逻辑。后端只增加一个"世界状态映射层"，将已有的 Agent/Task/Event 数据转化为世界坐标和动作指令。

---

## 2. 新增文件

```
server/
├── routes/
│   └── world.ts                  # 新增：世界配置 API
├── services/
│   └── worldSimulator.ts         # 新增：事件→世界动作映射
└── store/
    └── worldStore.ts             # 新增：世界状态持久化
```

---

## 3. 数据模型

### 3.1 WorldConfig — 世界配置（持久化）

```typescript
// server/store/worldStore.ts

interface WorldConfig {
  _schema_version: number;

  /** 地图元信息 */
  map: {
    tmjFile: string;              // Tiled 地图文件名（如 "workspace.tmj"）
    widthTiles: number;           // 地图宽度（tile 数）
    heightTiles: number;          // 地图高度（tile 数）
    tileSize: number;             // 单 tile 像素（默认 32）
  };

  /** 区域定义 — 与 Tiled regions 图层对应 */
  areas: WorldArea[];

  /** 默认角色配置 */
  defaultCharacter: {
    spritesheetKey: string;       // 默认精灵图 ID
    frameConfig: {
      frameWidth: number;
      frameHeight: number;
    };
  };

  /** 角色精灵图映射 */
  characterOverrides: Record<string, {
    spritesheetKey: string;       // agentId → 自定义精灵图
  }>;
}

interface WorldArea {
  id: string;                     // 如 "lobby", "workstation-1"
  name: string;                   // 显示名称
  type: "workstation" | "common" | "meeting" | "server" | "library" | "rest";
  capacity: number;               // 最大容纳角色数
  /** 区域内用于放置角色的锚点（tile 坐标） */
  slots: { x: number; y: number }[];
}
```

### 3.2 AgentWorldState — Agent 世界状态（运行时）

```typescript
interface AgentWorldState {
  agentId: string;

  /** 当前在哪个区域 */
  currentAreaId: string;

  /** 当前像素位置（世界坐标） */
  position: { x: number; y: number };

  /** 朝向 */
  facing: "left" | "right" | "up" | "down";

  /** 当前视觉状态 */
  visualState: AgentVisualState;

  /** 分配的工位（如果 working） */
  assignedSlotId: string | null;

  /** 活动气泡内容 */
  actionLabel: string | null;

  /** 最后更新时间 */
  updatedAt: number;
}

type AgentVisualState = "idle" | "working" | "stuck" | "offline" | "celebrate";
```

### 3.3 WorldAction — 世界动作指令

```typescript
/** 后端发给前端的世界动作 */
interface WorldAction {
  type: "move_to_area"
       | "set_animation"
       | "show_bubble"
       | "clear_bubble"
       | "celebrate"
       | "set_alpha";

  agentId: string;
  payload: Record<string, unknown>;
}

// 示例：
// { type: "move_to_area", agentId: "a1", payload: { areaId: "workstation-3", slotIndex: 0 } }
// { type: "set_animation", agentId: "a1", payload: { state: "working" } }
// { type: "show_bubble", agentId: "a1", payload: { text: "正在执行 Bash..." } }
```

---

## 4. WorldStore — 持久化层

```typescript
// server/store/worldStore.ts

/**
 * 管理 world.json 的读写
 * 文件路径: data/world.json
 */
export const WorldStore = {
  /** 读取世界配置 */
  getConfig(): WorldConfig;

  /** 更新世界配置（管理员操作） */
  updateConfig(patch: Partial<WorldConfig>): WorldConfig;

  /** 读取所有 Agent 的世界状态 */
  getAgentStates(): Map<string, AgentWorldState>;

  /** 更新单个 Agent 的世界状态 */
  updateAgentState(agentId: string, patch: Partial<AgentWorldState>): void;

  /** 移除 Agent 的世界状态 */
  removeAgentState(agentId: string): void;

  /** 获取区域中空闲的 slot */
  findAvailableSlot(areaId: string): { slotId: string; x: number; y: number } | null;

  /** 释放 slot */
  releaseSlot(areaId: string, slotId: string): void;
};
```

**存储文件：** `data/world.json`

```json
{
  "_schema_version": 1,
  "map": {
    "tmjFile": "workspace.tmj",
    "widthTiles": 64,
    "heightTiles": 40,
    "tileSize": 32
  },
  "areas": [
    {
      "id": "lobby",
      "name": "大厅",
      "type": "common",
      "capacity": 20,
      "slots": [
        { "x": 10, "y": 20 },
        { "x": 12, "y": 20 },
        { "x": 14, "y": 20 }
      ]
    },
    {
      "id": "workstation-1",
      "name": "工位 1",
      "type": "workstation",
      "capacity": 1,
      "slots": [{ "x": 25, "y": 15 }]
    }
  ],
  "defaultCharacter": {
    "spritesheetKey": "character-default",
    "frameConfig": { "frameWidth": 170, "frameHeight": 204 }
  },
  "characterOverrides": {}
}
```

---

## 5. WorldSimulator — 状态映射服务

### 5.1 职责

WorldSimulator 监听现有的 Agent/Task/Event 变更，计算对应的世界动作，然后通过 WebSocket 广播给前端。

**核心逻辑：不新增任何 Agent/Task/Event 数据，只做现有状态的视觉映射。**

### 5.2 事件监听

```typescript
// server/services/worldSimulator.ts

export class WorldSimulator {
  private agentStates: Map<string, AgentWorldState> = new Map();
  private areaSlots: Map<string, Set<string>> = new Map();  // areaId → 已占用的 slotId 集合

  /**
   * 初始化：加载世界配置，为所有已有 Agent 分配初始状态
   */
  init(config: WorldConfig, agents: Agent[]): void;

  /**
   * Agent 创建/更新时调用
   * 由现有 agents.ts 路由中的 broadcast 触发
   */
  onAgentUpdate(agent: Agent, changes?: Partial<Agent>): WorldAction[] {
    const state = this.agentStates.get(agent.id);
    const actions: WorldAction[] = [];

    if (!state) {
      // 新 Agent → 在大厅生成
      const slot = this.findAvailableSlot("lobby");
      const newState: AgentWorldState = {
        agentId: agent.id,
        currentAreaId: "lobby",
        position: { x: slot.x, y: slot.y },
        facing: "down",
        visualState: agent.isEnabled ? "idle" : "offline",
        assignedSlotId: slot.id,
        actionLabel: null,
        updatedAt: Date.now(),
      };
      this.agentStates.set(agent.id, newState);
      actions.push({ type: "set_animation", agentId: agent.id, payload: { state: newState.visualState } });
      return actions;
    }

    // 状态变化 → 视觉动作
    if (changes?.status) {
      const action = this.mapStatusToAction(agent.id, changes.status);
      if (action) actions.push(action);
    }

    return actions;
  }

  /**
   * Task 状态变化时调用
   */
  onTaskUpdate(task: Task, changes?: Partial<Task>): WorldAction[] {
    if (!task.agentId) return [];
    const actions: WorldAction[] = [];

    // Task 开始 → Agent 走向工位
    if (changes?.status === "Running") {
      const area = this.selectAreaForTask(task);
      const slot = this.findAvailableSlot(area);
      if (slot) {
        actions.push({
          type: "move_to_area",
          agentId: task.agentId,
          payload: { areaId: area, slotIndex: slot.index },
        });
        actions.push({
          type: "set_animation",
          agentId: task.agentId,
          payload: { state: "working" },
        });
      }
    }

    // Task 完成 → 庆祝后回到大厅
    if (changes?.status === "Done" || changes?.status === "Cancelled") {
      actions.push({
        type: "celebrate",
        agentId: task.agentId,
        payload: { duration: 2000 },
      });
      // 延迟回到大厅（前端处理延时）
      actions.push({
        type: "move_to_area",
        agentId: task.agentId,
        payload: { areaId: "lobby", delayed: true, delayMs: 2500 },
      });
      actions.push({
        type: "set_animation",
        agentId: task.agentId,
        payload: { state: "idle", delayed: true, delayMs: 2500 },
      });
    }

    return actions;
  }

  /**
   * 工具调用事件 → 显示气泡
   */
  onToolEvent(taskId: string, toolName: string): WorldAction[] {
    const task = TaskStore.getById(taskId);
    if (!task?.agentId) return [];
    const label = TOOL_LABELS[toolName] || toolName;
    return [{
      type: "show_bubble",
      agentId: task.agentId,
      payload: { text: `正在${label}...` },
    }];
  }

  /**
   * Agent 删除 → 从世界移除
   */
  onAgentRemove(agentId: string): WorldAction[] {
    this.releaseSlotsForAgent(agentId);
    this.agentStates.delete(agentId);
    return [{
      type: "set_alpha",
      agentId,
      payload: { alpha: 0, duration: 500 },  // 淡出
    }];
  }

  // ========== 内部方法 ==========

  private selectAreaForTask(task: Task): string {
    // 根据任务标签选择区域
    const tag = task.tags?.[0] || "default";
    const mapping = TAG_TO_AREA[tag] || TAG_TO_AREA["default"];

    if (mapping.includes("{n}")) {
      // 查找空闲工位
      return this.findAvailableWorkstation(mapping.replace("-{n}", ""));
    }
    return mapping;
  }

  private findAvailableWorkstation(prefix: string): string {
    // 遍历 workstation-1, workstation-2, ... 找空闲的
    const config = WorldStore.getConfig();
    for (const area of config.areas) {
      if (area.id.startsWith(prefix) && this.hasAvailableSlot(area.id)) {
        return area.id;
      }
    }
    return "lobby";  // 没有空位就回大厅
  }
}
```

### 5.3 集成方式

在现有服务中注入 WorldSimulator 调用：

```typescript
// server/services/taskManager.ts 中（修改）
// 在 completeTask() 末尾添加：
if (this.worldSimulator) {
  const actions = this.worldSimulator.onTaskUpdate(task, { status: "Done" });
  this.broadcastWorldActions(actions);
}
```

```typescript
// server/services/wsBroadcaster.ts 中（新增方法）
broadcastWorldAction(action: WorldAction): void {
  this.broadcast({
    type: "world:action",
    data: action,
  });
}
```

---

## 6. API 端点

### 6.1 新增路由

```typescript
// server/routes/world.ts

/**
 * GET /api/world/config
 * 获取世界配置（地图信息、区域定义、角色映射）
 */
router.get("/config", (req, res) => { ... });

/**
 * PUT /api/world/config
 * 更新世界配置（管理员操作）
 */
router.put("/config", (req, res) => { ... });

/**
 * GET /api/world/agents
 * 获取所有 Agent 的世界状态（位置、区域、动画状态）
 */
router.get("/agents", (req, res) => { ... });

/**
 * GET /api/world/agent/:id
 * 获取单个 Agent 的世界状态
 */
router.get("/agent/:id", (req, res) => { ... });

/**
 * POST /api/world/agent/:id/move
 * 手动移动 Agent 到指定区域（调试/演示用）
 */
router.post("/agent/:id/move", (req, res) => {
  const { areaId } = req.body;
  // ...
});
```

### 6.2 WebSocket 扩展

在现有 WebSocket 通道中新增消息类型：

```typescript
// 新增 WS 消息类型
type WSMessageType = ExistingTypes
  | "world:action"     // 服务端 → 客户端：世界动作指令
  | "world:state";     // 客户端 → 服务端：请求完整状态同步

// world:action 消息示例
{
  type: "world:action",
  data: {
    type: "move_to_area",
    agentId: "agent-001",
    payload: { areaId: "workstation-3" }
  }
}
```

---

## 7. 启动流程

```
Server 启动
  │
  ├─ 1. 加载 world.json（不存在则创建默认配置）
  │
  ├─ 2. 初始化 WorldSimulator
  │     └─ 为所有已有 Agent 分配初始世界状态
  │
  ├─ 3. 注册 world 路由
  │
  └─ 4. 现有服务注入 worldSimulator 回调
        ├─ taskManager.onStatusChange → worldSimulator.onTaskUpdate
        ├─ agentStore.onCreate → worldSimulator.onAgentUpdate
        └─ eventProcessor.onToolEvent → worldSimulator.onToolEvent
```

### 7.1 初始世界配置

首次启动时自动生成默认配置：

```typescript
function createDefaultConfig(): WorldConfig {
  return {
    _schema_version: 1,
    map: {
      tmjFile: "workspace.tmj",
      widthTiles: 64,
      heightTiles: 40,
      tileSize: 32,
    },
    areas: [
      { id: "lobby",          name: "大厅",     type: "common",      capacity: 20, slots: generateLobbySlots() },
      { id: "workstation-1",  name: "工位 1",   type: "workstation", capacity: 1,  slots: [{ x: 20, y: 15 }] },
      { id: "workstation-2",  name: "工位 2",   type: "workstation", capacity: 1,  slots: [{ x: 30, y: 15 }] },
      { id: "workstation-3",  name: "工位 3",   type: "workstation", capacity: 1,  slots: [{ x: 40, y: 15 }] },
      { id: "workstation-4",  name: "工位 4",   type: "workstation", capacity: 1,  slots: [{ x: 50, y: 15 }] },
      { id: "workstation-5",  name: "工位 5",   type: "workstation", capacity: 1,  slots: [{ x: 20, y: 25 }] },
      { id: "workstation-6",  name: "工位 6",   type: "workstation", capacity: 1,  slots: [{ x: 30, y: 25 }] },
      { id: "workstation-7",  name: "工位 7",   type: "workstation", capacity: 1,  slots: [{ x: 40, y: 25 }] },
      { id: "workstation-8",  name: "工位 8",   type: "workstation", capacity: 1,  slots: [{ x: 50, y: 25 }] },
      { id: "meeting-room",   name: "会议室",   type: "meeting",     capacity: 6,  slots: generateMeetingSlots() },
      { id: "server-room",    name: "服务器区", type: "server",      capacity: 4,  slots: generateServerSlots() },
      { id: "library",        name: "资料室",   type: "library",     capacity: 6,  slots: generateLibrarySlots() },
    ],
    defaultCharacter: {
      spritesheetKey: "character-default",
      frameConfig: { frameWidth: 170, frameHeight: 204 },
    },
    characterOverrides: {},
  };
}
```

**注意：** `slots` 中的坐标需要与实际制作的 Tiled 地图匹配。首次启动用占位坐标，用户制作地图后更新。

---

## 8. 状态持久化策略

| 数据 | 存储方式 | 频率 |
|------|---------|------|
| WorldConfig | `data/world.json` | 仅修改时写入 |
| AgentWorldState | 内存 + `data/world-state.json` | 每次变更时写入 |
| WorldAction | 不持久化，仅通过 WebSocket 广播 | 实时 |

---

## 9. 对现有代码的改动量

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `server/app.ts` | **小改** | 注册 world 路由 |
| `server/store/types.ts` | **小改** | 新增 WorldConfig、AgentWorldState 类型 |
| `server/store/index.ts` | **小改** | 新增 WorldStore 导出 |
| `server/services/taskManager.ts` | **小改** | 状态变化时调用 worldSimulator |
| `server/services/wsBroadcaster.ts` | **小改** | 新增 broadcastWorldAction 方法 |
| `server/services/eventProcessor.ts` | **小改** | 工具事件时调用 worldSimulator |
| `server/routes/world.ts` | **新增** | 世界配置 API |
| `server/services/worldSimulator.ts` | **新增** | 核心映射逻辑 |
| `server/store/worldStore.ts` | **新增** | 世界状态存储 |

**总计：** 新增 3 个文件，小改 5 个文件。现有核心逻辑零修改。

---

> 相关文档：
> - [01-architecture-overview.md](./01-architecture-overview.md)
> - [02-frontend-design.md](./02-frontend-design.md)
> - [04-asset-specification.md](./04-asset-specification.md)

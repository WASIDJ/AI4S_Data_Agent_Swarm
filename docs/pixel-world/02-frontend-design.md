# Pixel World — 前端详细设计

> 版本: v0.1 | 日期: 2026-05-08

---

## 1. React-Phaser 集成架构

### 1.1 容器组件：PixelWorldView

```tsx
// web/src/components/PixelWorldView.tsx
// 职责：挂载 Phaser canvas，桥接 React state 和 Phaser 场景

interface PixelWorldViewProps {
  agents: Agent[];           // 当前所有 Agent
  tasks: Task[];             // 当前所有 Task
  selectedAgentId: string | null;
  selectedTaskId: string | null;
  onSelectAgent: (id: string) => void;
  onSelectTask: (id: string) => void;
}
```

**挂载方式：**

```
┌─ PixelWorldView (React div, flex-1) ──────────────────┐
│ ┌─ Phaser Container (absolute, 100%) ───────────────┐ │
│ │  <canvas> Phaser 渲染的像素世界 </canvas>          │ │
│ └───────────────────────────────────────────────────┘ │
│ ┌─ React Overlay (absolute, pointer-events:none) ──┐ │
│ │  点击穿透层（需要交互的元素单独开启 pointer-events）│ │
│ │  - 世界名称/工具栏                                │ │
│ │  - Agent 点击时的详情浮窗                          │ │
│ │  - 通知气泡                                       │ │
│ └───────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────┘
```

### 1.2 通信桥接：WorldEventBus

React 和 Phaser 通过自定义 EventBus 双向通信：

```typescript
// web/src/pixel/systems/WorldEventBus.ts

// React → Phaser
type ReactToPhaserEvent =
  | { type: "agent:added"; agent: Agent }
  | { type: "agent:updated"; agent: Agent }
  | { type: "agent:removed"; agentId: string }
  | { type: "task:updated"; task: Task }
  | { type: "event:new"; event: Event }
  | { type: "select:agent"; agentId: string | null }
  | { type: "select:task"; taskId: string | null }
  | { type: "camera:focus"; agentId: string };

// Phaser → React
type PhaserToReactEvent =
  | { type: "agent:clicked"; agentId: string }
  | { type: "position:clicked"; x: number; y: number }
  | { type: "scene:ready" }
  | { type: "agent:position"; agentId: string; x: number; y: number };
```

**更新流程：**

```
App.tsx (useState agents/tasks)
  │
  ├─ useEffect 监听 agents/tasks 变化
  │   └─ worldEventBus.emit("agent:updated", agent)
  │
  ├─ WebSocket 回调
  │   └─ setTasks() → 触发 useEffect → worldEventBus.emit("task:updated")
  │
  └─ worldEventBus.on("agent:clicked", (agentId) => {
        onSelectAgent(agentId);  // 更新 React 选中状态
      })
```

---

## 2. Phaser 场景设计

### 2.1 BootScene（资源加载）

```typescript
// web/src/pixel/scenes/BootScene.ts

export class BootScene extends Phaser.Scene {
  constructor() { super("Boot"); }

  preload() {
    // 1. 加载地图 TMJ
    this.load.tilemapTiledJSON("world-map", "assets/world/workspace.tmj");

    // 2. 加载地图图块集
    this.load.image("tiles-interior", "assets/world/tiles/interior.png");
    this.load.image("tiles-exterior", "assets/world/tiles/exterior.png");

    // 3. 加载角色精灵图（每个 Agent 一个 spritesheet）
    // 命名规则: character-{id}.png
    // 如果没有专属精灵图，使用默认: character-default.png
    this.load.spritesheet("character-default", "assets/world/sprites/default.png", {
      frameWidth: 170,
      frameHeight: 204,
    });

    // 4. 加载特效精灵图（可选）
    this.load.spritesheet("effects", "assets/world/sprites/effects.png", {
      frameWidth: 32,
      frameHeight: 32,
    });
  }

  create() {
    this.scene.start("World");
  }
}
```

### 2.2 WorldScene（主场景）

```typescript
// web/src/pixel/scenes/WorldScene.ts

export class WorldScene extends Phaser.Scene {
  mapManager: MapManager;
  pathfinding: PathfindingManager;
  camera: CameraController;
  actionMapper: ActionMapper;

  // Agent 字典：agentId → AgentSprite
  agentSprites: Map<string, AgentSprite>;

  create() {
    // 1. 创建 tilemap 并渲染可见图层
    this.createMap();

    // 2. 初始化系统
    this.mapManager = new MapManager(this);
    this.pathfinding = new PathfindingManager(this.mapManager);
    this.camera = new CameraController(this);
    this.actionMapper = new ActionMapper(this);

    // 3. 注册精灵动画帧
    this.createAnimations();

    // 4. 监听 WorldEventBus
    this.listenEvents();

    // 5. 通知 React 场景就绪
    WorldEventBus.emit("scene:ready");
  }
}
```

---

## 3. AgentSprite 设计

### 3.1 角色结构

每个 Agent 在世界中由一个 `AgentSprite` 实例表示：

```
┌─ AgentSprite (Phaser.Container) ───────────┐
│                                             │
│  ┌─ shadow (Ellipse) ────────────────┐      │
│  │  椭圆形阴影，增加立体感            │      │
│  └───────────────────────────────────┘      │
│                                             │
│  ┌─ body (Sprite) ──────────────────┐       │
│  │  角色精灵图                       │       │
│  │  - 4 方向行走动画                 │       │
│  │  - 闲置呼吸动画                   │       │
│  │  - 工作动画（键盘敲击）           │       │
│  │  - 困惑动画（问号）               │       │
│  │  - 庆祝动画（举手）               │       │
│  └───────────────────────────────────┘       │
│                                             │
│  ┌─ nameLabel (DOM Label) ──────────┐       │
│  │  "Agent 名字"                     │       │
│  │  + 状态小图标 (idle/working/...)  │       │
│  └───────────────────────────────────┘       │
│                                             │
│  ┌─ actionBubble (DOM Label, 可选) ─┐       │
│  │  "正在调用 Read..."              │       │
│  │  "正在使用 Grep 搜索..."         │       │
│  └───────────────────────────────────┘       │
│                                             │
└─────────────────────────────────────────────┘
```

### 3.2 精灵图帧布局（6×5 网格，170×204 每帧）

与 WorldX 保持一致的帧布局：

```
Row 0:  [0] Walk-L1  [1] Walk-L2  [2] Walk-L3  [3] Walk-L4  [4] Walk-L5  [5] Walk-L6
Row 1:  [6] Walk-D1  [7] Walk-D2  [8] Walk-D3  [9] Walk-D4  [10] Walk-D5 [11] Walk-D6
Row 2:  [12] Walk-U1 [13] Walk-U2 [14] Walk-U3 [15] Walk-U4 [16] Walk-U5 [17] Walk-U6
Row 3:  [18] Idle-D  [19] Idle-U  [20] Idle-L/R [21-23] 预留
Row 4:  [24] Work-D1 [25] Work-D2 [26] Work-D3 [27] Work-D4 [28] Work-D5 [29] Work-D6
```

**新增工作动画行 (Row 4)：** 专门用于 "working" 状态下的打字/工作循环动画。

### 3.3 状态→动画映射

```typescript
type AgentVisualState =
  | "idle"      // 闲置：呼吸动画 + 随机闲逛
  | "working"   // 工作中：工作动画 + 偶尔停顿
  | "stuck"     // 卡住：困惑动画 + 来回踱步
  | "offline"   // 离线：变灰 + 静止
  | "celebrate" // 完成：庆祝动画（短暂）
  | "moving";   // 移动中：行走动画

const STATE_ANIMATION_MAP: Record<AgentVisualState, string> = {
  idle: "idle-down",
  working: "work-down",
  stuck: "idle-left",    // 可自定义困惑动画
  offline: "idle-down",  // + alpha 0.4 + tint 灰
  celebrate: "idle-up",  // 可自定义庆祝特效
  moving: "walk-{direction}",
};
```

---

## 4. 地图区域设计

### 4.1 工作室地图区域

地图使用 Tiled 编辑器制作，定义以下区域（regions）：

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  ┌─ lobby ──────────────────────────────────────┐   │
│  │           公共大厅 / 休息区                    │   │
│  │     (idle agent 默认活动区域)                  │   │
│  │     沙发、咖啡桌、植物装饰                     │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  ┌─ workstation-1 ─┐  ┌─ workstation-2 ─┐          │
│  │  工位 1          │  │  工位 2          │          │
│  │  (桌子+电脑)     │  │  (桌子+电脑)     │   ...    │
│  └─────────────────┘  └─────────────────┘          │
│                                                     │
│  ┌─ meeting-room ───────────────────────────────┐   │
│  │           会议区                               │   │
│  │     (多 agent 协作时的聚集区域)                │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  ┌─ server-room ─────────────────────────────────┐  │
│  │           服务器区                              │  │
│  │     (部署/运维类任务的区域)                     │  │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  ┌─ library ─────────────────────────────────────┐  │
│  │           文档区/资料室                         │  │
│  │     (阅读/文档类任务的区域)                     │  │
│  └──────────────────────────────────────────────┘   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 4.2 区域分配规则

```typescript
// 任务类型/标签 → 区域映射
const TAG_TO_AREA: Record<string, string> = {
  "coding":    "workstation-{n}",   // 编码任务 → 工位
  "review":    "meeting-room",      // 审查任务 → 会议区
  "docs":      "library",          // 文档任务 → 资料室
  "deploy":    "server-room",      // 部署任务 → 服务器区
  "data":      "workstation-{n}",  // 数据任务 → 工位
  "test":      "workstation-{n}",  // 测试任务 → 工位
  "default":   "workstation-{n}",  // 默认 → 空闲工位
};

// 无任务 → 大厅
const IDLE_AREA = "lobby";
```

### 4.3 Tiled JSON 结构要求

地图文件 `workspace.tmj` 需包含以下图层：

| 图层名 | 类型 | 用途 |
|--------|------|------|
| `background` | tilelayer | 地面/墙壁等静态背景 |
| `furniture` | tilelayer | 家具、装饰物 |
| `collision` | tilelayer | 碰撞网格（0=可通行, 1=障碍） |
| `regions` | objectgroup | 区域定义矩形（name, x, y, width, height） |
| `interactive_objects` | objectgroup | 交互点（工位位置、椅子位置等） |
| `foreground` | tilelayer | 前景遮挡层（可选，用于遮挡角色） |

---

## 5. 事件→动作映射（ActionMapper）

### 5.1 映射规则

```typescript
// web/src/pixel/systems/ActionMapper.ts

class ActionMapper {
  /**
   * 根据后端 WebSocket 事件，生成世界内的角色动作
   */
  handleEvent(event: WSMessage): void {
    switch (event.type) {

      case "agent:update": {
        const { id, status } = event.data;
        const sprite = this.getSprite(id);
        if (!sprite) return;

        switch (status) {
          case "idle":
            // 角色走向大厅，开始闲逛
            sprite.moveToArea("lobby");
            sprite.setAnimation("idle");
            break;
          case "working":
            // 角色走向分配的工位
            sprite.moveToArea(sprite.assignedWorkstation);
            sprite.setAnimation("working");
            break;
          case "stuck":
            // 角色在原地开始困惑动画
            sprite.setAnimation("stuck");
            // 来回踱步
            sprite.pace();
            break;
          case "offline":
            // 角色变灰静止
            sprite.setAnimation("offline");
            break;
        }
        break;
      }

      case "task:update": {
        const { agentId, status } = event.data;
        const sprite = this.getSprite(agentId);
        if (!sprite) return;

        if (status === "Done") {
          // 短暂庆祝动画
          sprite.celebrate(2000);
          // 之后自动回到 idle 状态
        }
        break;
      }

      case "event:new": {
        const { agentId, eventType, toolName } = event.data;
        const sprite = this.getSprite(agentId);
        if (!sprite) return;

        // 工具调用 → 显示气泡
        if (eventType === "PostToolUse" && toolName) {
          sprite.showActionBubble(this.getToolLabel(toolName));
        }

        // 助手消息 → 小型动画反馈
        if (eventType === "SDKAssistant") {
          sprite.thinkingPulse();
        }
        break;
      }
    }
  }
}
```

### 5.2 工具名称→中文标签映射

```typescript
const TOOL_LABELS: Record<string, string> = {
  "Read":    "阅读文件",
  "Write":   "编写文件",
  "Edit":    "编辑代码",
  "Bash":    "执行命令",
  "Grep":    "搜索内容",
  "Glob":    "查找文件",
  "WebSearch": "搜索网络",
  "Task":    "委派任务",
};
```

---

## 6. 相机系统

### 6.1 交互方式

| 操作 | 行为 |
|------|------|
| **鼠标拖拽** | 平移地图 |
| **滚轮** | 缩放 (0.3x ~ 2.0x) |
| **点击 Agent** | 选中 Agent，相机缓动跟随 |
| **双击空白** | 回到默认全景视角 |
| **WASD / 方向键** | 键盘平移 |

### 6.2 初始视角

加载时自动适配地图到视口：

```typescript
// 初始：显示完整地图，类似"封面视角"
this.camera.fitMapToViewport(padding: 20);
```

### 6.3 Agent 跟随模式

选中 Agent 后，相机平滑跟随：

```typescript
followAgent(agentId: string): void {
  const sprite = this.agentSprites.get(agentId);
  this.cameras.main.startFollow(sprite, true, 0.08, 0.08);
  this.cameras.main.setZoom(1.2);  // 跟随时稍微放大
}

stopFollow(): void {
  this.cameras.main.stopFollow();
  this.cameras.main.setZoom(1.0);
}
```

---

## 7. 视图切换

### 7.1 双视图模式

中间区域支持两种视图：

```tsx
// Dashboard.tsx 修改
const [viewMode, setViewMode] = useState<"kanban" | "world">("world");

<div className="flex-1 relative">
  {viewMode === "kanban" ? (
    <KanbanBoard tasks={tasks} ... />
  ) : (
    <PixelWorldView agents={agents} tasks={tasks} ... />
  )}

  {/* 视图切换按钮 */}
  <button
    className="absolute top-2 right-2 z-10"
    onClick={() => setViewMode(viewMode === "kanban" ? "world" : "kanban")}
  >
    {viewMode === "kanban" ? "🗺 世界视图" : "📋 看板视图"}
  </button>
</div>
```

### 7.2 键盘快捷键

- `Tab` — 切换视图
- `Esc` — 取消跟随，回到全景

---

## 8. 素材加载策略

### 8.1 资源目录结构

```
web/public/assets/world/
├── workspace.tmj                  # Tiled 地图文件
├── tiles/                         # 图块集
│   ├── interior.png               # 室内图块
│   └── exterior.png               # 室外图块（可选）
├── sprites/                       # 角色精灵图
│   ├── default.png                # 默认角色
│   ├── character-{agentId}.png    # Agent 专属角色（可选）
│   └── effects.png                # 特效精灵图
└── config.json                    # 世界配置（区域映射等）
```

### 8.2 动态角色加载

Agent 创建时可指定专属精灵图，如未指定则使用 default：

```typescript
preload() {
  // 加载所有已知 Agent 的精灵图
  const agents = this.registry.get("agents") as Agent[];
  for (const agent of agents) {
    const spritePath = `assets/world/sprites/character-${agent.id}.png`;
    if (this.exists(spritePath)) {
      this.load.spritesheet(`character-${agent.id}`, spritePath, FRAME_CONFIG);
    }
  }
}
```

### 8.3 资源热更新

新增 Agent 或更换精灵图后，可通过场景重启加载新资源：

```typescript
reloadAssets(): void {
  this.scene.restart("Boot");
  // BootScene 完成后自动进入 WorldScene
  // WorldScene 从 WorldEventBus 恢复所有 Agent 状态
}
```

---

## 9. 性能考量

| 场景 | 策略 |
|------|------|
| **大量 Agent (>20)** | 只渲染视口内的角色，超出范围的停止动画 |
| **复杂地图** | 使用 Tilemap 的 culling 机制，只渲染可见 tile |
| **DOM 标签** | 使用对象池复用 DOM 元素，避免频繁创建销毁 |
| **空闲 Agent** | 降低闲逛动画的帧率，减少 CPU 占用 |
| **Phaser 实例** | 视图切换到 Kanban 时暂停 Phaser 的 update loop |

```typescript
// 暂停/恢复 Phaser
pauseWorld(): void {
  this.game.loop.sleep();
}
resumeWorld(): void {
  this.game.loop.wake();
}
```

---

> 相关文档：
> - [01-architecture-overview.md](./01-architecture-overview.md)
> - [03-backend-design.md](./03-backend-design.md)
> - [04-asset-specification.md](./04-asset-specification.md)

# Pixel World — 素材规格说明

> 版本: v0.1 | 日期: 2026-05-08

本文档定义像素世界所需的全部素材规格。用户需要按此规格制作素材，系统才能正确渲染。

---

## 1. 地图素材

### 1.1 Tiled 地图文件

| 属性 | 要求 |
|------|------|
| **格式** | Tiled Map Editor 导出的 JSON (`.tmj`) |
| **方向** | 正交 (Orthogonal) |
| **Tile 尺寸** | 32×32 像素（推荐） |
| **推荐地图尺寸** | 64×40 tiles (2048×1280 像素) 或更大 |
| **图层压缩** | Base64（推荐）或 CSV |

### 1.2 必需图层

| 图层名 | 类型 | 说明 |
|--------|------|------|
| `background` | tilelayer | 地面、墙壁、天花板 |
| `furniture` | tilelayer | 桌子、椅子、装饰物（与角色同层或下层） |
| `collision` | tilelayer | 碰撞层：0=可通行，1=障碍。**必须存在** |
| `regions` | objectgroup | 区域矩形定义，每个对象的 `name` 属性对应区域 ID |
| `interactive_objects` | objectgroup | 可交互物体的位置（工位椅子、书架等） |
| `foreground` | tilelayer（可选） | 前景遮挡层，角色走过后会被遮挡（如门框、柱子） |

### 1.3 区域定义示例（Tiled 中）

在 Tiled 中创建 objectgroup 图层 `regions`，添加矩形对象：

```
名称: lobby
位置: (0, 640)    → tile坐标 (0, 20)
大小: (640, 320)  → 20×10 tiles

名称: workstation-1
位置: (640, 480)  → tile坐标 (20, 15)
大小: (192, 96)   → 6×3 tiles

... 其他区域 ...
```

### 1.4 图块集 (Tileset)

| 属性 | 要求 |
|------|------|
| **格式** | PNG（带透明通道） |
| **推荐尺寸** | 单个图块集不超过 512×512 像素 |
| **风格** | 像素风，与角色精灵风格统一 |
| **内容** | 地板、墙壁、门窗、桌椅、电脑、书架、植物、装饰物 |

推荐的图块集分类：

- **`interior.png`** — 室内地板、墙壁、家具、电子设备
- **`exterior.png`** — 室外地面、道路、装饰（如果地图有室外区域）

---

## 2. 角色精灵图 (Character Spritesheet)

### 2.1 帧布局（6 列 × 5 行 = 30 帧）

```
     Col 0      Col 1      Col 2      Col 3      Col 4      Col 5
    ┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
R0  │ Walk-L1  │ Walk-L2  │ Walk-L3  │ Walk-L4  │ Walk-L5  │ Walk-L6  │ 向左走
    ├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
R1  │ Walk-D1  │ Walk-D2  │ Walk-D3  │ Walk-D4  │ Walk-D5  │ Walk-D6  │ 向下走
    ├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
R2  │ Walk-U1  │ Walk-U2  │ Walk-U3  │ Walk-U4  │ Walk-U5  │ Walk-U6  │ 向上走
    ├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
R3  │ Idle-D   │ Idle-U   │ Idle-L   │ Idle-R   │ 预留     │ 预留     │ 闲置
    ├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
R4  │ Work-D1  │ Work-D2  │ Work-D3  │ Work-D4  │ Work-D5  │ Work-D6  │ 工作
    └──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
```

### 2.2 帧规格

| 属性 | 要求 |
|------|------|
| **单帧尺寸** | 170 × 204 像素（与 WorldX 一致） |
| **总图尺寸** | 1020 × 1020 像素 (6×170, 5×204) |
| **格式** | PNG（带透明通道） |
| **角色锚点** | 底部中心 (0.5, 0.85)，脚底对齐地面 |
| **风格** | 像素风，32px tile 的世界中角色约 80-120px 高 |

### 2.3 动画帧说明

| 动画 | 帧 | 帧率 | 说明 |
|------|-----|------|------|
| **向左走** | Row 0 (帧 0-5) | 8 fps | 6 帧循环，右走时水平翻转 |
| **向下走** | Row 1 (帧 6-11) | 8 fps | 面朝屏幕（默认朝向） |
| **向上走** | Row 2 (帧 12-17) | 8 fps | 背朝屏幕 |
| **闲置-D** | 帧 18 | 静态 + 呼吸 tween | 默认闲置，面朝屏幕 |
| **闲置-U** | 帧 19 | 静态 | 背朝屏幕闲置 |
| **闲置-L** | 帧 20 | 静态 | 朝左闲置（朝右翻转） |
| **闲置-R** | 帧 21 | 静态 | 朝右闲置 |
| **工作** | Row 4 (帧 24-29) | 6 fps | 坐在电脑前打字循环 |

### 2.4 文件命名

```
web/public/assets/world/sprites/
├── default.png                      # 默认角色（所有未指定专属角色的 Agent）
├── character-{agentId}.png          # Agent 专属角色（可选）
└── effects.png                      # 特效精灵图（可选）
```

**示例：**
- `default.png` — 默认蓝衣服角色
- `character-agent-001.png` — Agent "小明" 的专属角色
- `character-agent-002.png` — Agent "小红" 的专属角色

### 2.5 角色差异化建议

如果不想为每个 Agent 制作独立精灵图，可以通过代码层实现简单差异化：

```typescript
// 通过 tint 颜色区分角色（同一精灵图不同色调）
const AGENT_COLORS: Record<string, number> = {
  "agent-001": 0xff9999,  // 红色调
  "agent-002": 0x9999ff,  // 蓝色调
  "agent-003": 0x99ff99,  // 绿色调
};

// 在 AgentSprite 中
this.bodySprite.setTint(AGENT_COLORS[agentId] || 0xffffff);
```

---

## 3. 特效精灵图（可选）

| 属性 | 要求 |
|------|------|
| **单帧尺寸** | 32 × 32 像素 |
| **内容** | 问号（stuck 状态）、感叹号（事件触发）、星星（完成庆祝） |
| **格式** | PNG（带透明通道） |

```
effects.png (3 列 × 1 行):
┌──────────┬──────────┬──────────┐
│  问号    │  感叹号  │  星星    │
│  (stuck) │  (event) │  (done)  │
└──────────┴──────────┴──────────┘
```

---

## 4. 世界配置文件

### 4.1 config.json

```json
{
  "mapFile": "workspace.tmj",
  "tilesets": [
    { "name": "interior", "image": "tiles/interior.png" }
  ],
  "defaultSpritesheet": "sprites/default.png",
  "areas": [
    {
      "id": "lobby",
      "name": "大厅",
      "description": "Agent 闲置时的活动区域",
      "type": "common"
    },
    {
      "id": "workstation-1",
      "name": "工位 1",
      "description": "编码/数据处理工位",
      "type": "workstation"
    }
  ],
  "tagAreaMapping": {
    "coding": "workstation",
    "review": "meeting-room",
    "docs": "library",
    "deploy": "server-room",
    "data": "workstation",
    "test": "workstation",
    "_default": "workstation"
  }
}
```

### 4.2 坐标校准

Tiled 中的像素坐标与世界坐标的换算：

```
世界像素坐标 = Tile坐标 × tileSize
Tile坐标 = Math.floor(世界像素坐标 / tileSize)
```

**区域 slots 的坐标必须使用像素坐标**（非 tile 坐标），与 Tiled 导出的 object 坐标一致。

---

## 5. 素材制作工具推荐

| 工具 | 用途 | 链接 |
|------|------|------|
| **Tiled** | 地图编辑器 | https://www.mapeditor.org/ |
| **Aseprite** | 像素画精灵图制作 | https://www.aseprite.org/ |
| **Piskel** | 免费在线像素画工具 | https://www.piskelapp.com/ |
| **LibreSprite** | Aseprite 的免费分支 | https://github.com/LibreSprite/LibreSprite |
| **Tilemap Plus** (Phaser 插件) | 高级 tilemap 功能 | 可选 |

---

## 6. 快速启动素材集（临时方案）

在正式素材制作完成前，可以使用以下临时方案：

### 6.1 临时地图

使用纯色 tileset 生成简易地图：

```
- 绿色 tile = 地面（可通行）
- 深灰 tile = 墙壁（障碍）
- 棕色 tile = 桌子（障碍，周围是工位区域）
- 浅蓝 tile = 区域标记（视觉提示，可通行）
```

### 6.2 临时角色

使用圆形（Circle Fallback）代替精灵图：

```typescript
// 如果没有 spritesheet，自动使用圆形
if (!this.textures.exists(`character-${agentId}`)) {
  sprite.createCircleBody(AGENT_COLORS[agentId] || 0x4488ff);
}
```

圆形模式包含：
- 彩色圆形主体
- 白色描边
- 呼吸动画（缩放 tween）
- 名字标签
- 状态气泡

---

## 7. 素材质量检查清单

制作完成后，确认以下项目：

- [ ] 地图文件是 `.tmj` 格式（非 `.tmx`）
- [ ] 地图包含 `collision` 图层，且碰撞正确
- [ ] 地图包含 `regions` objectgroup，区域名称与配置匹配
- [ ] 精灵图尺寸为 1020×1020 像素（170×204 × 6×5）
- [ ] 精灵图有透明通道（PNG-24/32）
- [ ] 角色脚底在帧的 85% 高度位置（锚点 0.5, 0.85）
- [ ] 行走动画 6 帧循环流畅
- [ ] 工作动画 6 帧循环流畅
- [ ] 闲置帧在帧 18-21
- [ ] 所有素材文件名不含中文和空格
- [ ] 图块集的 tile 尺寸与地图设置一致（32×32）

---

> 相关文档：
> - [01-architecture-overview.md](./01-architecture-overview.md)
> - [02-frontend-design.md](./02-frontend-design.md)
> - [03-backend-design.md](./03-backend-design.md)

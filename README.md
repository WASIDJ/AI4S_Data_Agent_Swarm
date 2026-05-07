<h1 align="center">AI4S Data Agent Swarm</h1>

<p align="center">
  AI for Science 数据合成 · 多 Agent 协同编排平台
</p>

<p align="center">
  <img src="screenshots/00-landing-page.png" width="600" />
</p>

---

## 快速开始

```bash
git clone https://github.com/GitHub-Ninghai/AI4S_Data_Agent_Swarm.git
cd AI4S_Data_Agent_Swarm

# 安装依赖
cd server && npm install && cd ..
cd web && npm install && cd ..

# 配置环境变量
cp .env.example .env

# 启动
node start.js
```

访问 http://localhost:5173，默认账号 `admin` / `admin123`

Windows 用户需在 `.env` 中配置 `CLAUDE_CODE_GIT_BASH_PATH=D:\Git\bin\bash.exe`

## Docker 部署

```bash
cp .env.example .env
mkdir -p workspace
docker compose up --build -d
```

访问 `http://localhost:3456`

评测部署、验证步骤、日志和 API 说明见 [docs/系统部署与运行说明.md](/home/ryou/myworkspace/develop/PROJECT/competiton/AI4S_Data_Agent_Swarm/docs/系统部署与运行说明.md)。

---

## 系统要求

| 依赖 | 说明 |
|------|------|
| Node.js >= 18 | 后端运行时 |
| Claude Code CLI | AI 执行引擎（[安装指南](https://docs.anthropic.com/en/docs/claude-code/overview)） |
| Git Bash | Windows 用户必需 |

---

## 预置 Agent

| Agent | 职能 |
|-------|------|
| 论文爬取专家 | 从 arXiv / Semantic Scholar 检索论文 |
| PDF 解析专家 | MinerU 解析 PDF，提取结构化内容 |
| 数据合成专家 | 生成 Q&A 对、知识图谱数据 |
| 质检专家 | 数据质量审核：准确性、完整性、去重 |
| 流程编排专家 | 编排流水线，协调多 Agent 执行 |
| Sci-Evo 生成专家 | 科学演化数据生成 |

---

## 主界面

![Homepage](screenshots/01-homepage.png)

三栏布局：**Agent 面板**（左） · **任务看板**（中） · **详情面板**（右）

- **Landing Page** — 项目介绍与登录入口
- **登录/注册** — JWT 认证，支持账号密码登录
- **项目切换** — 顶部项目下拉菜单，支持新建项目
- **看板视图** — Todo / Running / Done / Stuck 四列拖拽
- **实时更新** — WebSocket 推送任务状态变更
- **Copilot 助手** — 右侧 AI 对话面板

---

## 技术栈

| 层 | 技术 |
|----|------|
| 后端 | Express 4 + ws 8 + @anthropic-ai/claude-agent-sdk |
| 前端 | React 19 + Vite 6 + TypeScript 5.7 + Tailwind CSS |
| 认证 | JWT（登录/注册/个人资料） |
| UI 组件 | shadcn/ui + Radix UI + Lucide Icons |
| 存储 | JSON 文件（无数据库） |
| 测试 | Vitest（249 个用例） |

---

## 项目结构

```
server/
  routes/          # REST API 路由（agents, tasks, projects, auth, events）
  services/        # 业务逻辑（wsBroadcaster, sdkSessionManager）
  sdk/             # Claude Agent SDK 封装
  store/           # JSON 持久化层
  middleware/       # JWT 认证中间件
web/
  src/components/  # UI 组件（Dashboard, TopBar, KanbanBoard, AgentPanel...）
  src/components/ui/    # shadcn/ui 基础组件
  src/components/modals/ # 弹窗（AgentForm, TaskForm, UserProfile）
  src/api/         # REST + WebSocket 适配层
  src/hooks/       # React hooks
data/              # JSON 数据存储
```

---

## 开发命令

```bash
node start.js              # 启动开发模式
node stop.js               # 停止
cd server && npx vitest    # 运行测试
```

---

## 近期更新

- **前端重构** — 替换为 shadcn/ui 组件库，统一设计语言
- **认证系统** — 新增 JWT 登录/注册，支持用户个人资料管理
- **Landing Page** — 项目介绍页，含动态入口
- **项目清理** — 清除测试数据，默认保留一个项目含 5 个预置 Agent
- **WebSocket 优化** — 消除控制台噪音，改进重连稳定性
- **新建项目修复** — 右上角新建项目按钮恢复正常

---

## License

MIT

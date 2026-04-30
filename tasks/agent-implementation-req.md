# 需求：完善 AI4S 数据合成流水线的 5 个智能体

## 背景

Agent Swarm 平台已开发完成，预置了 6 个 AI4S 数据合成专用 Agent。目前 **Power_Agent（Markdown 信息提取）已测试验证**，其余 5 个 Agent 的 prompt 和工具配置尚未经过测试和优化。

**目标**：逐个完善 5 个 Agent，使其能可靠地独立执行任务，并最终串联为完整的 AI4S 数据合成流水线。

## 仓库

```bash
git clone https://github.com/GitHub-Ninghai/AI4S_Data_Agent_Swarm.git
cd AI4S_Data_Agent_Swarm
cd server && npm install && cd ..
cd web && npm install && cd ..
# 配置 .env（Windows 必须设置 CLAUDE_CODE_GIT_BASH_PATH）
cp .env.example .env
```

## Agent 概览

| # | Agent | 头像 | Agent ID | 当前状态 |
|---|-------|------|----------|----------|
| 1 | 论文爬取专家 | 🔍 | `621d2301-5a9a-4fe3-b330-57b1a00f9150` | **未测试** |
| 2 | PDF 解析专家 | 📚 | `c3fab86a-cac2-4898-a1e6-66336fec9bec` | **未测试** |
| 3 | 数据合成专家 | 🎯 | `682b0b56-1af8-44cd-ac66-d9391c166cb7` | **未测试** |
| 4 | 质检专家 | 🔬 | `5d156d10-9e5b-4efc-ae21-60c87555b9da` | **未测试** |
| 5 | 流程编排专家 | 🛠️ | `87e0b270-4d5d-4f4e-94f8-b85b7319518e` | **未测试** |

> Power_Agent（`bcb38451-a9b6-4b03-8359-4d488af696ce`）已完成 Markdown 信息提取的验证，不在本次范围内。

---

## Agent 1: 论文爬取专家 🔍

**职责**：根据关键词在学术搜索引擎搜索论文，收集元数据，下载 PDF。

### 需要做的事

**1. 测试现有 prompt**

创建一个任务，让 Agent 搜索 2-3 篇能源电力领域的论文（关键词如 `smart grid`、`virtual power plant`），验证：

- 能否通过 Bash 工具调用 `curl` 访问学术 API
- 能否正确解析 API 返回的 JSON/XML 数据
- 能否生成有效的 `papers.json`

**2. 调优 prompt**

根据测试结果修改 `data/agents.json` 中该 Agent 的 `prompt` 字段：

- 明确指定 API 端点：
  - arXiv API：`http://export.arxiv.org/api/query?search_query=KEYWORD&max_results=N&sortBy=submittedDate`
  - Semantic Scholar API：`https://api.semanticscholar.org/graph/v1/paper/search?query=KEYWORD&limit=N&fields=title,authors,abstract,year,externalIds`
  - DBLP API：`https://dblp.org/search/publ/api?q=KEYWORD&format=json&h=N`
- 明确 `papers.json` 的输出 schema（见下方）
- 增加网络错误处理和 API 限流的应对策略
- 增加去重逻辑（基于 DOI 或 arXiv ID）

**3. 调整工具配置**

- `allowedTools`：确保包含 `Bash`、`WebFetch`
- `maxBudgetUsd`：建议 $3（论文爬取不需要太多推理）
- `maxTurns`：建议 100-150

### 输出文件格式

```json
// papers.json
{
  "query": "smart grid",
  "total_results": 3,
  "papers": [
    {
      "title": "...",
      "authors": ["Author A", "Author B"],
      "abstract": "...",
      "year": 2024,
      "doi": "10.xxxx/xxxx",
      "arxiv_id": "2401.xxxxx",
      "pdf_url": "https://arxiv.org/pdf/2401.xxxxx",
      "local_path": "papers/2401_xxxxx.pdf",
      "citation_count": 42,
      "source": "arxiv"
    }
  ]
}
```

### 验收标准

- [ ] 搜索指定关键词，成功生成 `papers.json`
- [ ] `papers.json` 字段完整（标题、作者、摘要、年份、DOI）
- [ ] 至少成功获取 2 篇论文的元数据
- [ ] 论文之间无重复（基于 DOI/arXiv ID 去重）
- [ ] prompt 经过至少 1 轮调优，记录变更内容

---

## Agent 2: PDF 解析专家 📚

**职责**：使用 MinerU 解析学术论文 PDF，提取标题、摘要、章节、公式、表格等结构化内容。

### 核心工具：MinerU

本 Agent 的核心是 **MinerU**（OpenDataLab 开源文档解析引擎），而非 pdfplumber。MinerU 的优势：

- 自动识别论文布局（单栏/双栏）
- 公式自动转为 LaTeX 格式
- 表格保留结构，输出 HTML
- 支持扫描版 PDF（内置 OCR，支持 109 种语言）
- 输出 Markdown + JSON 双格式

### MinerU 环境安装

```bash
# 安装 MinerU（推荐使用 pip）
pip install mineru

# 下载模型（首次使用必须执行）
mineru-models-download

# 验证安装
mineru --version
```

系统要求：
- Python >= 3.10
- 推荐 GPU（CUDA），支持 CPU 模式但速度较慢
- GPU VRAM 建议 8GB+，峰值约 25GB

### MinerU 使用方式

Agent 应通过 Bash 工具调用 MinerU CLI 或 API：

**方式一：CLI 直接调用（推荐）**

```bash
# 基础用法 — 解析单个 PDF
mineru -p paper.pdf -o ./output

# 解析目录下所有 PDF
mineru -p ./papers/ -o ./parsed/

# 指定页面范围（0-based）
mineru -p paper.pdf -o ./output -s 0 -e 10

# 使用 pipeline 后端（兼容性好，支持 109 种语言 OCR）
mineru -p paper.pdf -o ./output -b pipeline -l ch

# 使用 hybrid 后端（推荐，精度最高）
mineru -p paper.pdf -o ./output -b hybrid-auto-engine

# 关闭公式识别（加速处理）
mineru -p paper.pdf -o ./output -f false

# 关闭表格识别（加速处理）
mineru -p paper.pdf -o ./output -t false
```

**方式二：API 调用**

```bash
# 启动 API 服务
mineru-api --host 127.0.0.1 --port 8000

# 调用解析
curl -X POST "http://127.0.0.1:8000/file_parse" \
  -F "files=@paper.pdf" \
  -F "backend=hybrid-auto-engine" \
  -F "return_md=true"
```

### MinerU 输出文件结构

解析完成后，输出目录结构如下：

```
output/
└── paper/
    └── auto/                    # 或 hybrid_auto/、vlm/
        ├── paper.md             # ★ 主 Markdown 输出
        ├── paper_content_list.json  # ★ 简化的内容块列表
        ├── paper_middle.json    # ★ 详细解析 JSON
        ├── paper_layout.pdf     # 布局可视化
        ├── paper_model.json     # 原始模型推理结果
        └── images/              # 提取的图片
```

Agent 应重点读取以下文件：

**`*_content_list.json`** — 按阅读顺序排列的内容块：

```python
# 每个块的类型：
# text      — 正文/标题（text_level: 0=正文, 1=h1, 2=h2...）
# table     — 表格（table_body 为 HTML）
# equation  — 公式（text 为 LaTeX）
# image     — 图片（img_path 为路径）

{
  "type": "text",
  "text": "Abstract: ...",
  "page_idx": 0,
  "bbox": [x0, y0, x1, y1],
  "text_level": 0
}

{
  "type": "table",
  "table_body": "<html><table>...</table></html>",
  "table_caption": ["Table 1: ..."],
  "page_idx": 2
}

{
  "type": "equation",
  "text": "E = mc^2",
  "page_idx": 3
}
```

**`*_middle.json`** — 更详细的解析结果，包含页级信息。

### 需要做的事

**1. 安装并验证 MinerU**

```bash
pip install mineru
mineru-models-download
mineru -p test.pdf -o ./test_output   # 用任意 PDF 测试
```

**2. 测试现有 prompt**

准备一个示例论文 PDF（从 arXiv 下载一篇能源电力领域论文），创建任务让 Agent：

- 通过 Bash 调用 `mineru -p <file> -o <output>` 解析 PDF
- 读取 `*_content_list.json`，提取结构化信息
- 转换为统一的论文 JSON 格式（见下方 schema）
- 生成 `summary.json` 统计解析成功率

**3. 调优 prompt**

重点修改：

- 明确使用 MinerU CLI 的调用方式（`mineru -p ... -o ...`）
- 明确输出 JSON 的 schema
- 处理以下特殊情况：
  - MinerU 未安装时的提示（让 Agent 先执行 `pip install mineru`）
  - 扫描版 PDF（MinerU 自动启用 OCR，无需额外处理）
  - 大文件分页处理（`-s` 和 `-e` 参数控制页面范围）
  - 双栏论文的阅读顺序（MinerU 自动处理）
- 表格从 HTML 转为结构化数组

**4. 工具配置**

- `allowedTools`：确保包含 `Bash`（执行 mineru 命令）、`Read`（读取输出 JSON）、`Write`（写入结构化结果）
- `maxBudgetUsd`：建议 $3-5
- `maxTurns`：建议 150

### 输出文件格式

```json
// parsed_papers/<paper_id>.json
{
  "paper_id": "2401.xxxxx",
  "title": "...",
  "authors": ["..."],
  "abstract": "...",
  "sections": [
    {
      "heading": "1. Introduction",
      "level": 1,
      "content": "...",
      "page_range": [1, 3]
    }
  ],
  "tables": [
    {
      "caption": "Table 1: Comparison of ...",
      "page": 4,
      "headers": ["Method", "Accuracy", "F1"],
      "rows": [["...", "...", "..."]],
      "html": "<table>...</table>"
    }
  ],
  "equations": [
    {
      "latex": "L = \\frac{1}{N} \\sum_{i=1}^{N} ...",
      "page": 5,
      "context": "损失函数定义"
    }
  ],
  "references": [
    {
      "index": 1,
      "text": "Author et al., Title, Journal, Year",
      "doi": "10.xxxx/xxxx"
    }
  ],
  "images": [
    {
      "caption": "Figure 1: ...",
      "page": 3,
      "path": "images/fig1.png"
    }
  ],
  "parse_quality": "complete",
  "source_pdf": "papers/2401_xxxxx.pdf"
}
```

### 验收标准

- [ ] MinerU 安装成功，能解析示例 PDF
- [ ] Agent 通过 Bash 调用 MinerU CLI 完成解析
- [ ] 生成的 JSON 包含标题、摘要、章节、表格、公式、参考文献
- [ ] 公式以 LaTeX 格式保留
- [ ] 表格以结构化数组 + HTML 双格式保留
- [ ] 生成 `summary.json` 统计解析成功率
- [ ] prompt 经过至少 1 轮调优

---

## Agent 3: 数据合成专家 🎯

**职责**：基于论文解析结果（JSON）生成 Q&A 对、知识三元组、摘要等训练数据。

### 需要做的事

**1. 准备测试数据**

使用 Agent 2 的输出（或手工准备一份示例 `parsed_papers/*.json`）作为输入。

参考已跑通的示例：`examples/output/` 下的文件是由流程编排专家生成的，可作为质量标杆。

**2. 测试现有 prompt**

创建任务让 Agent 读取解析结果并生成训练数据，验证：

- 能否生成不同难度的 Q&A 对
- 答案是否标注原文出处（段落/页码）
- 知识三元组格式是否正确
- JSONL 每行是否为合法 JSON

**3. 调优 prompt**

重点修改：

- 明确各类型数据的输出 schema（参考 `examples/output/` 中的文件）
- 增加"不编造论文中没有的内容"的硬约束
- 明确 Q&A 难度分级定义：
  - **简单**：事实性问答，直接从原文提取
  - **中等**：推理型问答，需要综合 2 处以上原文信息
  - **困难**：分析型问答，需要跨章节综合、计算或推理
- 增加多样性控制（问题不能都是同一类型）
- 增加输出质量控制（答案长度范围、JSON 格式校验）

### 输出文件格式

```jsonl
// qa_pairs.jsonl（每行一条）
{"id":"qa_001","type":"factual","difficulty":"simple","question":"什么是智能电网？","answer":"...","source_section":"1.1 智能电网概述"}
{"id":"qa_002","type":"reasoning","difficulty":"medium","question":"为什么AMI是实现需求响应的基础？","answer":"...","source_section":"1.2 AMI 与 3.3 需求响应"}
```

```jsonl
// knowledge_triples.jsonl（每行一条）
{"id":"triple_001","subject":"智能电网","relation":"融合技术","object":"传感/通信/信息/控制技术","confidence":0.95}
```

### 验收标准

- [ ] 从示例解析结果生成至少 15 对 Q&A（简单/中等/困难各 5 对）
- [ ] Q&A 标注了难度等级和原文出处
- [ ] 生成知识三元组至少 20 条，包含 confidence 字段
- [ ] 输出 JSONL 格式，每行一条合法 JSON
- [ ] 生成统计报告（各类型数量、难度分布）
- [ ] prompt 经过至少 1 轮调优

---

## Agent 4: 质检专家 🔬

**职责**：审核合成数据的准确性、完整性、格式规范、去重。

### 需要做的事

**1. 准备测试数据**

使用 Agent 3 的输出或 `examples/output/qa_pairs.jsonl` 作为输入。

**2. 测试现有 prompt**

创建任务让 Agent 执行质检，验证：

- 能否验证答案与原文的一致性
- 能否检查 JSONL 格式合法性
- 能否检测重复或近似样本
- 能否分类标注缺陷类型
- 能否输出 `passed.jsonl`、`flagged.jsonl`、`quality_report.json`

**3. 调优 prompt**

重点修改：

- 明确缺陷类型定义：
  - `factual_error` — 答案包含原文没有的信息
  - `format_error` — JSON 格式错误、字段缺失
  - `duplicate` — 与已有样本语义重复
  - `incomplete` — 必填字段为空
  - `label_mismatch` — 难度等级标注不合理
- 增加具体的质检步骤清单（先格式、后内容、再去重）
- 明确质检不修改原始数据，只标记问题
- 增加量化评分规则

### 输出文件格式

```jsonl
// passed.jsonl — 通过质检的样本
{"id":"qa_001","quality":"passed","score":0.95}

// flagged.jsonl — 标记问题的样本
{"id":"qa_005","quality":"flagged","defect_type":"factual_error","detail":"答案第三段与原文不符","suggestion":"修正为..."}
```

```json
// quality_report.json
{
  "total_samples": 15,
  "passed_count": 12,
  "flagged_count": 3,
  "pass_rate": 0.80,
  "defect_summary": {
    "factual_error": 1,
    "format_error": 0,
    "duplicate": 1,
    "incomplete": 1,
    "label_mismatch": 0
  }
}
```

### 验收标准

- [ ] 对示例数据执行质检，输出 `passed.jsonl` 和 `flagged.jsonl`
- [ ] 能识别出至少 1 类质量问题
- [ ] 生成 `quality_report.json` 包含各维度统计
- [ ] 质检过程不修改原始数据
- [ ] prompt 经过至少 1 轮调优

---

## Agent 5: 流程编排专家 🛠️

**职责**：编排完整的 AI4S 数据合成流水线，协调各 Agent 按顺序执行，汇总最终结果。

### 需要做的事

**1. 理解流水线**

完整流水线分 4 个阶段：

```
阶段1: 论文爬取 → papers.json
阶段2: PDF 解析（MinerU）→ parsed_papers/*.json
阶段3: 数据合成 → *.jsonl 训练数据
阶段4: 质检 → 质检报告 + 清洗数据
```

**2. 测试现有 prompt**

由于流程编排专家需要协调其他 Agent，但它无法直接调用其他 Agent（平台不支持 Agent 间调用），因此它的实际职责是：

- **单 Agent 内完成全流程**：在 Agent 内部依次执行"读取论文 → 解析 → 合成 → 质检"的步骤
- **产出检查**：验证每个阶段的输出文件存在且格式正确
- **汇总报告**：生成 `pipeline_report.json`

**3. 调优 prompt**

重点修改：

- 明确该 Agent 的工作方式：它自身需要完成全部流程（不是调用其他 Agent）
- 明确 MinerU 的调用方式（与 Agent 2 一致）
- 增加每个阶段的检查点（文件存在性、格式验证）
- 增加部分失败时的容错策略（跳过失败的论文，不中断整体）
- 增加进度报告（每个阶段完成后输出统计）

**4. 考虑拆分方案**

如果单 Agent 内完成全流程过于复杂，可以考虑将 prompt 调整为"分步编排"模式：
- 用户先创建"论文爬取"任务（Agent 1）
- 用户再创建"PDF 解析"任务（Agent 2），输入 papers.json
- 以此类推
- 流程编排专家只负责生成每个阶段的任务描述模板

### 验收标准

- [ ] 能从指定关键词出发，完成至少 1 篇论文的完整流水线
- [ ] 每个阶段的输出文件格式正确
- [ ] 生成 `pipeline_report.json` 包含各阶段统计
- [ ] 单篇论文失败时不影响其他论文的处理
- [ ] prompt 经过至少 1 轮调优

---

## 串联流水线测试

5 个 Agent 单独验证通过后，需要进行端到端串联测试：

```
论文爬取专家 → papers.json（论文元数据 + PDF 路径）
      ↓
PDF 解析专家（MinerU）→ parsed_papers/*.json（结构化内容）
      ↓
数据合成专家 → *.jsonl（Q&A / 知识三元组 / 摘要）
      ↓
质检专家 → quality_report.json + passed.jsonl
```

### 串联测试要求

1. 在平台上依次创建 4 个任务（按上述顺序）
2. 每个任务的描述中明确指定输入文件路径（上一个 Agent 的输出）
3. 使用相同的 Project（工作目录）
4. 验证整个流水线可以端到端运行
5. 记录每个阶段的：执行轮次、预算消耗、产出数量

### 测试关键词

建议使用能源电力领域的关键词进行测试：

- `smart grid optimization` — 智能电网优化
- `virtual power plant` — 虚拟电厂
- `renewable energy integration` — 新能源并网
- `power system resilience` — 电力系统韧性

---

## 工作规范

### Prompt 调优流程

对每个 Agent 遵循以下循环：

```
1. 使用现有 prompt 创建并执行一个任务
2. 分析输出：格式是否正确？内容是否准确？
3. 修改 data/agents.json 中该 Agent 的 prompt
4. 重新创建任务执行，对比改进效果
5. 在 WORKLOG.md 中记录变更和测试结果
```

### 文件修改范围

**可以修改**：
- `data/agents.json` — Agent 的 prompt、allowedTools、maxTurns、maxBudgetUsd
- `examples/` — 添加测试数据
- `WORKLOG.md` — 工作日志

**不建议修改**（除非有充分理由并提前沟通）：
- `server/` — 后端代码已稳定
- `web/` — 前端代码已稳定
- `server/sdk/queryWrapper.ts` — SDK 调用逻辑已验证

### 提交规范

```
feat: Agent <名称> prompt 调优 + 验证测试
```

每完成一个 Agent 的调优，提交一次。

---

## 参考文档

- `CLAUDE.md` — 项目整体架构和开发规范
- `requirement.md` — 完整架构设计文档
- `example.md` — 已跑通的 AI4S 数据生成示例（Power_Agent）
- `data/agents.json` — 所有 Agent 的当前配置
- `examples/output/` — 已有的输出文件可作为质量参考
- [MinerU 官方文档](https://opendatalab.github.io/MinerU/) — PDF 解析工具
- [MinerU GitHub](https://github.com/opendatalab/MinerU) — 安装和详细用法

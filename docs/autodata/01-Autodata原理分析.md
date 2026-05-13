# Meta Autodata 原理分析

> 来源：https://facebookresearch.github.io/RAM/blogs/autodata/
> 作者：Ilia Kulikov, Chenxi Whitehouse, Tianhao Wu 等 (Meta AI, RAM 团队)
> 日期：2026 年 4 月

---

## 1. 总体架构：双层循环

Autodata 的核心设计是一个 **内循环（Inner Loop）+ 外循环（Outer Loop）** 结构。

### 1.1 内循环 —— 数据科学家 Agent 的数据生产流程

1. **数据创建（Data Creation）**：主 LLM Agent 基于源数据（如论文）生成训练/评估数据
2. **数据分析（Data Analysis）**：对生成的数据进行质量检验（定性检查 + 定量评估）
3. **学习反馈（Learnings）**：从分析结果中提取"什么做对了、什么做错了"
4. **迭代改进（Iterate）**：将学习结果反馈到下一轮数据创建中，直到满足停止条件

### 1.2 外循环 —— 元优化（Meta-Optimization）

将内循环中的数据质量指标（如 weak-strong solver 分离率）作为外循环的优化目标，自动改进 Agent 本身的 harness（提示词、流程配置等）。本质上是用"造数据的能力"来训练"造数据的人"。

---

## 2. 具体实现：Agentic Self-Instruct

论文中给出的具体实现包含 5 个角色：

| 角色 | 模型 | 职责 |
|------|------|------|
| Main Agent（编排器） | Kimi-K2.5 | 协调整个流程，分析结果并决定是否迭代 |
| Challenger LLM | Kimi-K2.5 | 生成训练样本（问题 + 答案 + 评分标准） |
| Weak Solver | Qwen3.5-4B | 预期失败 —— 验证题目具有区分度 |
| Strong Solver | Qwen3.5-397B | 预期成功 —— 验证题目的可解性 |
| Verifier/Judge | Kimi-K2.5 | 评估 solver 回答的质量 |

### 2.1 验收条件

极为严格的多条件组合：

- Quality Verifier 通过（无上下文泄露、评分标准覆盖完整）
- Weak solver 平均分 ≤ 65%
- Strong solver 平均分 ≥ 60% 且 < 95%
- Gap（Strong - Weak）≥ 20%

每篇论文平均需要 3-5 轮迭代，最终从 10,000+ 篇 CS 论文中筛选出 2,117 个合格 QA 对。

### 2.2 流程

```
编排器 → Challenger 生成 QA + Rubric
  → Quality Verifier 检查
  → Weak Solver 回答 (×3 取平均)
  → Strong Solver 回答 (×3 取平均)
  → Judge 按 Rubric 逐维度评分
  → 计算 gap = strongAvg - weakAvg
  → 若通过 → ACCEPTED
  → 若未通过 → 分析失败原因 → 注入反馈 → 重新生成
```

---

## 3. 关键实验数据

### 3.1 数据质量对比

| 指标 | CoT Self-Instruct | Agentic Self-Instruct |
|------|-------------------|----------------------|
| Weak solver 平均分 | 71.4% | 43.7% |
| Strong solver 平均分 | 73.3% | 77.8% |
| Gap（区分度） | **1.9%** | **33.9%** |

Agentic Self-Instruct 将区分度从 1.9% 提升到 33.9%，差距扩大了 32 个百分点。

### 3.2 RL 训练效果

用 Agentic Self-Instruct 数据训练 Qwen-3.5-4B（GRPO），在 in-distribution 和 out-of-distribution 测试集上均显著优于 CoT Self-Instruct 数据训练的模型。

### 3.3 元优化效果

通过 233 次迭代（126 次被接受），将验证通过率从 **12.8% 提升到 42.4%**。

元优化器自动发现了 4 个关键改进：

1. **论文特定洞察强制**：问题必须测试论文特定知识，不能是通用 CS 知识
2. **上下文泄露预防**：上下文只描述问题域，不包含论文的解决方案
3. **正向评分标准 + 权重上限**：取消负权重，权重封顶 7
4. **结构化 JSON 格式**：消除解析错误

---

## 4. Main Agent Prompt 完整结构

```
# Main Agent

## Your Goal
产生一个高质量的 QA 数据点，满足所有验收标准。
通常需要多轮精炼。

## Your Role
编排流水线：challenger 生成 → QV 检查 → evaluate_rubric.py 测试。
你不自己解读论文——交给 challenger。

## Workflow
循环直到 ACCEPTED 或用尽步数：
1. 调用 challenger 生成 QA + rubrics
2. 调用 quality verifier 检查
3. 若 QV 失败 → 回到步骤 1（附反馈）
4. 运行 evaluate_rubric.py --weak-only
5. 若 weak 未通过 → 回到步骤 1（附反馈）
6. 运行 evaluate_rubric.py --strong-only
7. 检查 strong 条件和 gap → 若失败 → 回到步骤 1
8. 全部通过 → ACCEPTED

## Acceptance Criteria
- QV passed
- weak_avg ≤ 65%, max_weak ≤ 75%
- strong_avg ≥ 60% AND strong_avg < 95%
- Gap ≥ 20%
```

---

## 5. 元优化方法

### 5.1 流程

```
(1) Select — Boltzmann 采样选择候选 harness
(2) Evaluate — 在训练论文集上运行，收集轨迹和评分
(3) Analyze — LLM 读取完整 solver 交换记录，写根因分析
(4) Implement — 代码编辑 Agent 基于分析修改 harness
(5) Re-evaluate — 在验证论文集上重新评估
(6) Accept/Reject — 仅当验证分数严格优于父代时接受
(7) Summarize — 写入历史日志
```

### 5.2 关键发现

- 通用答案和 rubric 格式错误是导致分离率低的主要原因
- 负权重评分标准在实践中会误伤强模型，取消后效果更好
- 严格 JSON 格式约束消除了大量解析错误

# Sci-Evo 科学演化数据生成器

## 用途

将能源/电力系统控制领域的论文转化为结构化的科学演化数据 JSON，记录完整的科研闭环：问题提出 → 假设形成 → 方法设计 → 实验分析 → 方案调整。

## JSON Schema

每份数据包含三段式结构：

```
{
  "01_initial_request": {
    "target_name": "研究目标名称",
    "input_data": "输入数据/系统参数/可用信息",
    "user_intent": "研究动机和意图（要解决什么问题）",
    "quantifiable_goal": "可量化的性能指标（具体数值目标）"
  },
  "02_agent_trajectory": [
    {
      "step_index": 1,
      "thought": "[Background] 已知/已完成 ... [Gap] 缺失/未解决 ... [Decision] 决策和理由 ...",
      "action": "simulation | theoretical_derivation | experimental_validation | algorithm_design | parameter_tuning",
      "tool": { "name": "工具/方法名称", "version": "" },
      "parameters": { ... },
      "observation": "观察结果/数据",
      "valid": true/false,
      "references": []
    }
  ],
  "03_success_verification": {
    "validation_technique": "验证方法",
    "metrics": {
      "指标名": {
        "value": "数值",
        "unit": "单位",
        "interpretation": "解释"
      }
    },
    "final_verdict": "最终结论"
  }
}
```

## PDF 解析方法（多种可选）

### 方法 1: MinerU Cloud API（推荐，最快）

使用 MinerU 官方云 API 解析 PDF，无需本地模型：

```python
import requests
import json
import os

def parse_pdf_mineru_api(pdf_path, api_key):
    """使用 MinerU 云 API 解析 PDF"""
    url = "https://mineru.net/api/v4/file-urls/batch"

    # 上传文件获取 file_url
    with open(pdf_path, 'rb') as f:
        files = {'file': f}
        headers = {'Authorization': f'Bearer {api_key}'}
        response = requests.post(url, files=files, headers=headers)

    result = response.json()
    batch_id = result['data']['batch_id']

    # 轮询获取结果
    import time
    while True:
        status_url = f"https://mineru.net/api/v4/file-urls/batch/{batch_id}"
        status = requests.get(status_url, headers=headers).json()
        if status['data']['status'] == 'done':
            break
        time.sleep(5)

    # 获取 markdown 内容
    markdown_url = status['data']['results'][0]['markdown_url']
    md_content = requests.get(markdown_url).text
    return md_content
```

### 方法 2: MinerU 本地 SDK

使用 MinerU 本地 SDK 解析，需要 GPU 和模型权重：

```python
from magic_pdf.data.data_reader_writer import FileBasedDataReader, FileBasedDataWriter
from magic_pdf.data.dataset import PymuDocDataset
from magic_pdf.config.enums import SupportedPdfParseMethod
from magic_pdf.config.make_content_config import DropMode, MakeMode
from magic_pdf.model.doc_analyze_by_custom_model import doc_analyze

def parse_pdf_mineru_local(pdf_path, output_dir, lang='en'):
    """使用 MinerU 本地 SDK 解析 PDF"""
    import os
    os.makedirs(output_dir, exist_ok=True)

    reader = FileBasedDataReader('')
    pdf_bytes = reader.read(pdf_path)
    ds = PymuDocDataset(pdf_bytes, lang=lang)

    image_dir = os.path.join(output_dir, 'images')
    os.makedirs(image_dir, exist_ok=True)
    image_writer = FileBasedDataWriter(image_dir)

    if ds.classify() == SupportedPdfParseMethod.TXT:
        infer_result = ds.apply(doc_analyze, ocr=False, lang=ds._lang)
        pipe_result = infer_result.pipe_txt_mode(image_writer, lang=ds._lang)
    else:
        infer_result = ds.apply(doc_analyze, ocr=True, lang=ds._lang)
        pipe_result = infer_result.pipe_ocr_mode(image_writer, lang=ds._lang)

    md_content = pipe_result.get_markdown(
        str(os.path.basename(image_dir)),
        drop_mode=DropMode.NONE,
        md_make_mode=MakeMode.MM_MD
    )

    md_path = os.path.join(output_dir, 'output.md')
    with open(md_path, 'w', encoding='utf-8') as f:
        if isinstance(md_content, list):
            f.write('\n'.join(md_content))
        else:
            f.write(md_content)

    return md_content
```

### 方法 3: pdfplumber（最轻量，无需 GPU）

使用 pdfplumber 快速提取文本，适用于文本型 PDF：

```python
import pdfplumber

def parse_pdf_plumber(pdf_path):
    """使用 pdfplumber 提取 PDF 文本"""
    text_parts = []
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages):
            page_text = page.extract_text()
            if page_text:
                text_parts.append(f'--- Page {i+1} ---\n{page_text}')
    return '\n\n'.join(text_parts)
```

## 领域适配指南：能源/电力系统控制

### action 类型映射

| 科研活动 | action 值 | 说明 |
|----------|-----------|------|
| 数学建模与推导 | `theoretical_derivation` | 系统建模、稳定性证明、公式推导 |
| 控制策略设计 | `algorithm_design` | 控制器设计、算法开发 |
| 仿真验证 | `simulation` | MATLAB/Simulink/PSCAD 仿真 |
| 实验验证 | `experimental_validation` | 硬件实验平台验证 |
| 参数调试 | `parameter_tuning` | 控制参数整定、灵敏度分析 |

### 典型 tool 列表

| 工具 | 说明 |
|------|------|
| MATLAB Simulink | 电力系统仿真 |
| PSCAD/EMTDC | 电磁暂态仿真 |
| OPAL-RT | 实时仿真 |
| dSPACE | 硬件在环控制 |
| Lyapunov stability analysis | 稳定性分析 |
| Finite-time control theory | 有限时间控制理论 |
| Consensus algorithm | 一致性算法 |
| PPO/SAC/DDPG | 强化学习算法 |

### 常见 metrics

| 指标 | 单位 | 说明 |
|------|------|------|
| Voltage restoration error | V / % | 电压恢复精度 |
| Frequency deviation | Hz | 频率偏差 |
| Current/power sharing accuracy | % | 电流/功率分配精度 |
| Convergence time | seconds | 收敛时间 |
| Robustness to delays | ms | 通信延迟鲁棒性 |
| Tracking error | % | 跟踪误差 |
| Overshoot | % | 超调量 |

### thought 结构模板

每步的 thought 必须包含三段结构：

```
[Background] 已知/已完成：描述前序工作成果和已有知识
[Gap] 缺失/未解决：指出当前存在的问题或未解决的挑战
[Decision] 决策和理由：说明采取的方法及选择原因
```

## 生成流程

1. **解析论文**: 使用上述任一方法提取 PDF 内容
2. **分析论文结构**: 识别 Introduction → Method → Simulation/Experiment → Conclusion
3. **提取关键信息**:
   - 问题陈述和动机
   - 系统模型和参数
   - 控制方法/算法设计
   - 理论分析（稳定性证明）
   - 仿真/实验设置和结果
   - 性能指标
4. **构建 trajectory**:
   - 每篇论文生成 5-8 个步骤
   - 确保覆盖：问题建模 → 方法设计 → 理论分析 → 仿真验证 → 实验验证（如有） → 对比分析
   - 每步的 thought 严格遵循 [Background][Gap][Decision] 结构
5. **提取 metrics**: 从论文的仿真/实验结果中提取可量化的性能指标
6. **验证 JSON 格式**: 确保三段式结构完整，所有字段非空

## 验证脚本

```python
import json
import sys

def validate_sci_evo_json(filepath):
    """验证科学演化数据 JSON 格式"""
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)

    errors = []

    # 检查三段式结构
    required_sections = ['01_initial_request', '02_agent_trajectory', '03_success_verification']
    for section in required_sections:
        if section not in data:
            errors.append(f"Missing section: {section}")

    # 检查 initial_request 字段
    if '01_initial_request' in data:
        req = data['01_initial_request']
        for field in ['target_name', 'input_data', 'user_intent', 'quantifiable_goal']:
            if field not in req or not req[field]:
                errors.append(f"01_initial_request missing or empty: {field}")

    # 检查 trajectory 步骤
    if '02_agent_trajectory' in data:
        for step in data['02_agent_trajectory']:
            # 检查 thought 结构
            thought = step.get('thought', '')
            for tag in ['[Background]', '[Gap]', '[Decision]']:
                if tag not in thought:
                    errors.append(f"Step {step.get('step_index', '?')}: thought missing {tag}")
            # 检查 action
            if step.get('action') not in ['simulation', 'theoretical_derivation',
                'experimental_validation', 'algorithm_design', 'parameter_tuning']:
                errors.append(f"Step {step.get('step_index', '?')}: invalid action")

    # 检查 metrics
    if '03_success_verification' in data:
        ver = data['03_success_verification']
        if 'metrics' not in ver or not ver['metrics']:
            errors.append("03_success_verification missing metrics")
        else:
            for name, metric in ver['metrics'].items():
                for field in ['value', 'unit', 'interpretation']:
                    if field not in metric:
                        errors.append(f"Metric '{name}' missing: {field}")

    if errors:
        print(f"❌ {filepath}: {len(errors)} errors")
        for e in errors:
            print(f"  - {e}")
        return False
    else:
        print(f"✅ {filepath}: Valid")
        return True

if __name__ == '__main__':
    for f in sys.argv[1:]:
        validate_sci_evo_json(f)
```

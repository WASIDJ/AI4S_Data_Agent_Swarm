# Vendored Skills

This project vendors selected Claude Skills so the Agent SDK can discover
project-level Skills from `.claude/skills`.

## Sources

- `pdf-extraction`, `doc-parser`, `data-extractor`, `table-extractor`,
  `batch-convert`, `excel-automation`, `smart-ocr`
  - Source: https://github.com/claude-office-skills/skills
  - License: MIT
- `data-pipeline-builder`
  - Source: https://github.com/OneWave-AI/claude-skills
  - License: MIT

Project-specific thin Skills such as `mineru-pdf`, `sci-evo-generation`,
`data-quality-review`, and `pipeline-orchestration` remain local because they
encode the AI4S/MinerU competition workflow.


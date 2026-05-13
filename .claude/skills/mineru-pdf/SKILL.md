---
name: mineru-pdf
description: Use MinerU to parse scientific PDFs into structured JSON for AI4S data generation.
---

# MinerU PDF Parsing Workflow

Use this skill when the task involves scientific PDF parsing, paper content
extraction, or preparing parsed paper data for AI4S dataset generation.

## Workflow

1. Locate the input PDF files and create a stable output directory.
2. Prefer MinerU for document parsing before attempting ad hoc text extraction.
3. Extract layout, title, abstract, section hierarchy, formulas, tables, figures,
   captions, references, and metadata.
4. Normalize the result into structured JSON that downstream agents can consume.
5. Record parsing failures, missing sections, low-confidence OCR regions, and
   files that require manual review.

## Output Expectations

The output should preserve scientific structure and include enough provenance
for later quality review. Avoid treating the PDF as plain text when layout,
tables, formulas, or figure captions carry important meaning.


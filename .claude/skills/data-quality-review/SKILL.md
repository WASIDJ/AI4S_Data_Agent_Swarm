---
name: data-quality-review
description: Review AI4S generated data for structure, scientific consistency, and hallucination risk.
---

# AI4S Data Quality Review Workflow

Use this skill when reviewing generated AI4S dataset entries.

## Workflow

1. Validate required fields and JSON shape.
2. Check whether scientific claims are supported by parsed source content.
3. Detect duplicated samples, vague reasoning, unsupported conclusions, and
   format drift.
4. Classify issues by severity and provide concise repair instructions.
5. Approve only samples that are structurally complete and scientifically
   defensible.

## Output Expectations

Return actionable review notes. When rejecting a sample, explain the concrete
reason and the minimum change required to repair it.


---
name: sci-evo-generation
description: Generate Sci-Evo style AI4S training data from structured paper content.
---

# Sci-Evo Data Generation Workflow

Use this skill when converting parsed scientific papers into AI4S training
examples.

## Workflow

1. Read the structured paper JSON and identify the core scientific problem.
2. Extract methods, assumptions, constraints, datasets, experiments, metrics, and
   conclusions.
3. Generate training samples that preserve causal and scientific reasoning.
4. Keep generated fields traceable to source sections where possible.
5. Mark uncertain claims for quality review instead of inventing details.

## Output Expectations

Generated samples should be complete, internally consistent, and suitable for
the downstream quality review workflow.


---
name: pipeline-orchestration
description: Coordinate crawler, parser, synthesizer, and reviewer agents for AI4S data production.
---

# Multi-Agent Pipeline Orchestration Workflow

Use this skill when coordinating multiple agents across the AI4S data production
pipeline.

## Workflow

1. Split the work into paper discovery, PDF parsing, data generation, and quality
   review tasks.
2. Assign each task to the most suitable agent role.
3. Track artifacts between stages, especially PDF paths, parsed JSON, generated
   samples, and review reports.
4. Retry or route failed items based on failure type.
5. Produce a final status summary with completed items, rejected items, and
   unresolved blockers.

## Output Expectations

Keep the pipeline explainable. Each generated task should have a clear input,
expected output, assigned agent, and stopping condition.


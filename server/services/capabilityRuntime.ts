import type { Options } from "@anthropic-ai/claude-agent-sdk";
import * as capabilityStore from "../store/capabilityStore.js";

type RuntimeMode = "sdk-tool" | "project-skill" | "mcp-server" | "display-only";

interface RuntimeCapability {
  id: string;
  name: string;
  runtimeMode: RuntimeMode;
  allowedTools?: string[];
  skillPath?: string;
  promptSummary?: string;
  mcpServer?: {
    name: string;
    command: string;
    args?: string[];
  };
}

export interface ResolvedCapabilityRuntime {
  allowedTools: string[];
  promptAppend: string;
  mcpServers?: NonNullable<Options["mcpServers"]>;
}

const RUNTIME_CAPABILITIES: RuntimeCapability[] = [
  {
    id: "mineru-parser",
    name: "MinerU Parser",
    runtimeMode: "sdk-tool",
    allowedTools: ["Bash", "Read", "Write", "Edit", "Glob", "Grep"],
    promptSummary:
      "MinerU Parser is enabled. For scientific PDFs, prefer MinerU CLI/API through Bash and keep parsed JSON artifacts in the project workspace.",
  },
  {
    id: "filesystem-mcp",
    name: "Filesystem MCP",
    runtimeMode: "mcp-server",
    allowedTools: ["mcp__filesystem__read_file", "mcp__filesystem__write_file"],
    mcpServer: {
      name: "filesystem",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "."],
    },
    promptSummary:
      "Filesystem MCP is enabled for controlled workspace file access.",
  },
  {
    id: "local-workspace",
    name: "Local Workspace",
    runtimeMode: "sdk-tool",
    allowedTools: ["Read", "Write", "Edit", "Glob", "Grep"],
  },
  {
    id: "python-sandbox",
    name: "Python Sandbox",
    runtimeMode: "sdk-tool",
    allowedTools: ["Bash", "Read", "Write", "Edit"],
    promptSummary:
      "Python Sandbox is enabled. Use Bash/Python for structured data cleaning, validation, conversion, profiling, and batch processing.",
  },
  {
    id: "academic-search",
    name: "Academic Search",
    runtimeMode: "sdk-tool",
    allowedTools: ["WebFetch", "Bash", "Read", "Write"],
  },
  {
    id: "web-crawler",
    name: "Web Crawler",
    runtimeMode: "sdk-tool",
    allowedTools: ["WebFetch", "Bash", "Read", "Write"],
  },
  {
    id: "json-validator",
    name: "JSON Schema Validator",
    runtimeMode: "sdk-tool",
    allowedTools: ["Bash", "Read", "Write", "Edit"],
  },
  {
    id: "deduplicator",
    name: "Data Deduplicator",
    runtimeMode: "sdk-tool",
    allowedTools: ["Bash", "Read", "Write"],
  },
  {
    id: "dataset-profiler",
    name: "Dataset Profiler",
    runtimeMode: "sdk-tool",
    allowedTools: ["Bash", "Read", "Write"],
  },
  {
    id: "mineru-pdf-skill",
    name: "MinerU PDF 解析工作流",
    runtimeMode: "project-skill",
    skillPath: ".claude/skills/pdf-extraction/SKILL.md",
    promptSummary:
      "Use the project PDF extraction skill for PDF text, table, and metadata extraction; combine it with MinerU for scientific paper structure.",
  },
  {
    id: "html-extraction-skill",
    name: "HTML 页面抽取工作流",
    runtimeMode: "project-skill",
    skillPath: ".claude/skills/data-extractor/SKILL.md",
    promptSummary:
      "Use the data extraction skill when extracting structured content from HTML pages or web text.",
  },
  {
    id: "docx-parsing-skill",
    name: "DOC/DOCX 文档解析工作流",
    runtimeMode: "project-skill",
    skillPath: ".claude/skills/doc-parser/SKILL.md",
    promptSummary:
      "Use the document parser skill for DOC/DOCX structure, headings, tables, and markdown conversion.",
  },
  {
    id: "json-normalization-skill",
    name: "JSON 清洗与规范化工作流",
    runtimeMode: "project-skill",
    skillPath: ".claude/skills/data-extractor/SKILL.md",
    promptSummary:
      "Normalize JSON outputs against the requested schema and report malformed or missing fields.",
  },
  {
    id: "spreadsheet-cleaning-skill",
    name: "CSV/Excel 数据整理工作流",
    runtimeMode: "project-skill",
    skillPath: ".claude/skills/excel-automation/SKILL.md",
    promptSummary:
      "Use the Excel automation skill for CSV/XLSX cleaning, column profiling, and table conversion.",
  },
  {
    id: "multimodal-extraction-skill",
    name: "图文多模态抽取工作流",
    runtimeMode: "project-skill",
    skillPath: ".claude/skills/smart-ocr/SKILL.md",
    promptSummary:
      "Use the OCR skill for image text extraction, captions, scanned pages, and figure-related text.",
  },
  {
    id: "sci-evo-generation",
    name: "Sci-Evo 数据生成工作流",
    runtimeMode: "project-skill",
    skillPath: ".claude/skills/sci-evo-generation/SKILL.md",
    promptSummary:
      "Generate Sci-Evo style AI4S samples from parsed paper content with traceable scientific reasoning.",
  },
  {
    id: "data-quality-review",
    name: "AI4S 数据质检工作流",
    runtimeMode: "project-skill",
    skillPath: ".claude/skills/data-quality-review/SKILL.md",
    promptSummary:
      "Review AI4S data for schema completeness, scientific consistency, duplication, and hallucination risk.",
  },
  {
    id: "dedup-review-skill",
    name: "数据去重与覆盖分析工作流",
    runtimeMode: "project-skill",
    skillPath: ".claude/skills/table-extractor/SKILL.md",
    promptSummary:
      "Check duplicate or near-duplicate rows and compare field coverage before approving a dataset batch.",
  },
  {
    id: "literature-screening-skill",
    name: "文献检索筛选工作流",
    runtimeMode: "project-skill",
    skillPath: ".claude/skills/data-extractor/SKILL.md",
    promptSummary:
      "Screen papers by relevance, methods, data quality, and exclusion reasons before parsing.",
  },
  {
    id: "pipeline-orchestration",
    name: "多 Agent 流水线编排工作流",
    runtimeMode: "project-skill",
    skillPath: ".claude/skills/data-pipeline-builder/SKILL.md",
    promptSummary:
      "Plan data production as crawler, parser, synthesizer, and reviewer stages with explicit artifacts and stopping conditions.",
  },
];

const RUNTIME_BY_ID = new Map(RUNTIME_CAPABILITIES.map(capability => [capability.id, capability]));

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

export function resolveAgentCapabilityRuntime(agentId: string): ResolvedCapabilityRuntime {
  const enabledBindings = capabilityStore
    .getCapabilityBindingsForAgent(agentId)
    .filter(binding => binding.enabled);

  const enabledCapabilities = enabledBindings
    .map(binding => RUNTIME_BY_ID.get(binding.capabilityId))
    .filter((capability): capability is RuntimeCapability => !!capability)
    .filter(capability => capability.runtimeMode !== "display-only");

  const allowedTools = unique(enabledCapabilities.flatMap(capability => capability.allowedTools ?? []));
  const mcpServers: NonNullable<Options["mcpServers"]> = {};
  const skillLines: string[] = [];

  for (const capability of enabledCapabilities) {
    if (capability.runtimeMode === "mcp-server" && capability.mcpServer) {
      mcpServers[capability.mcpServer.name] = {
        type: "stdio",
        command: capability.mcpServer.command,
        args: capability.mcpServer.args,
      };
    }

    if (capability.runtimeMode === "project-skill" && capability.skillPath) {
      skillLines.push(
        `- ${capability.name}: ${capability.promptSummary ?? ""} Skill file: ${capability.skillPath}`,
      );
    } else if (capability.promptSummary) {
      skillLines.push(`- ${capability.name}: ${capability.promptSummary}`);
    }
  }

  const promptAppend = skillLines.length > 0
    ? [
        "Agent capability bindings are enabled for this run.",
        "Use the following project Skills and tool capabilities when relevant:",
        ...skillLines,
      ].join("\n")
    : "";

  return {
    allowedTools,
    promptAppend,
    ...(Object.keys(mcpServers).length > 0 ? { mcpServers } : {}),
  };
}

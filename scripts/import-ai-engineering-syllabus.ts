/**
 * One-off import of the AI Engineering syllabus (AI_Engineering_Syllabus.md)
 * into the syllabus data model, via the SyllabusRepository port.
 *
 * Each "PHASE N — ..." heading becomes a Subject under the "AI Engineering"
 * Domain; each bullet-point concept under that phase's concept list(s)
 * becomes a Concept, created as "planned". Teaching/quiz instructions,
 * explanatory prose, and the Final Integration section are deliberately
 * left out — only the bullet-point study concepts are imported.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/import-ai-engineering-syllabus.ts
 *     -> parses and prints the structure only (dry run)
 *   npx tsx --env-file=.env.local scripts/import-ai-engineering-syllabus.ts --apply
 *     -> also writes to the database
 *
 * Safe to rerun: every Domain/Subject/Concept is looked up by name before
 * creating, so re-running with --apply never creates duplicates.
 */

import { getSyllabusRepository } from "@/lib/syllabus/get-repository";
import type { SyllabusRepository } from "@/lib/syllabus/repository";

const DOMAIN_NAME = "AI Engineering";

const SYLLABUS: { subject: string; concepts: string[] }[] = [
  {
    subject: "Choosing the right AI architecture",
    concepts: [
      "deterministic software vs probabilistic/LLM components",
      "when not to use an LLM",
      "single LLM call",
      "structured generation",
      "fixed LLM workflow",
      "RAG workflow",
      "agent",
      "multi-agent system",
      "autonomy spectrum",
      "workflow vs agent",
      "when increasing complexity is actually justified",
    ],
  },
  {
    subject: "LLM workflow patterns",
    concepts: [
      "prompt chaining",
      "routing",
      "classification + dispatch",
      "parallelization",
      "fan-out / fan-in",
      "map-reduce style LLM workflows",
      "orchestrator-worker",
      "evaluator-optimizer",
      "generate → critique → revise",
      "reflection patterns",
      "planner/executor",
      "decomposition",
      "sequential workflows",
      "conditional workflows",
      "fallback chains",
    ],
  },
  {
    subject: "Agent fundamentals",
    concepts: [
      "what technically makes something an agent",
      "agent loop",
      "observe → reason/decide → act → observe",
      "tool calling / function calling",
      "environment feedback",
      "stopping conditions",
      "iteration limits",
      "task completion detection",
      "planning",
      "replanning",
      "error recovery",
      "state",
      "checkpoints",
      "resumability",
      "deterministic control around nondeterministic models",
    ],
  },
  {
    subject: "Tool engineering",
    concepts: [
      "tool/function definition",
      "schemas",
      "typed inputs and outputs",
      "tool descriptions",
      "tool selection",
      "tool granularity",
      "narrow vs broad tools",
      "deterministic validation",
      "retries",
      "idempotent tools",
      "side-effecting tools",
      "read tools vs write tools",
      "confirmation before destructive actions",
      "tool errors",
      "tool result formatting",
      "timeouts",
      "rate limits",
      "permissions",
      "least privilege",
      "sandboxing",
      "tool allowlists",
      "agent-computer interface / ACI",
      "what Model Context Protocol is",
      "MCP server/client mental model",
      "resources",
      "tools",
      "prompts",
      "where MCP fits relative to ordinary function calling",
      "when MCP is useful",
      "when it is needless abstraction",
    ],
  },
  {
    subject: "Context engineering",
    concepts: [
      "prompt engineering vs context engineering",
      "system instructions",
      "task instructions",
      "tool definitions as context",
      "retrieved information",
      "conversation history",
      "external state",
      "user state",
      "environment state",
      "context windows",
      "attention as a limited resource",
      "signal-to-noise",
      "context selection",
      "context ordering",
      "context compression",
      "summarization",
      "context compaction",
      "context pruning",
      "selective retrieval",
      "just-in-time context",
      "keeping long-running agents grounded",
      "avoiding stale context",
      "context poisoning",
      "provenance of context",
    ],
  },
  {
    subject: "Harness engineering",
    concepts: [
      "model vs harness",
      "what belongs in the harness",
      "instructions",
      "tools",
      "context assembly",
      "memory/state",
      "permissions",
      "execution environment",
      "validation",
      "feedback loops",
      "tracing",
      "testing",
      "retries/recovery",
      "stopping rules",
      "architectural constraints",
      "repository/environment legibility for coding agents",
    ],
  },
  {
    subject: "Structured outputs and reliable model interfaces",
    concepts: [
      "structured outputs",
      "JSON schemas",
      "typed schemas / validation",
      "constrained generation",
      "parsing",
      "schema validation",
      "normalization",
      "rejection vs repair",
      "retries on invalid output",
      "deterministic post-processing",
      "confidence signals",
      "model uncertainty vs application-level confidence",
    ],
  },
  {
    subject: "Retrieval and knowledge",
    concepts: [
      "retrieval vs stuffing context",
      "ingestion pipeline",
      "chunking",
      "metadata",
      "embeddings",
      "vector retrieval",
      "lexical/BM25 retrieval",
      "hybrid retrieval",
      "reranking",
      "parent-document retrieval",
      "query rewriting",
      "query decomposition",
      "self-querying retrieval",
      "filtering",
      "citations/provenance",
      "retrieval evaluation",
      "context selection after retrieval",
      "agentic retrieval",
      "when RAG is unnecessary",
    ],
  },
  {
    subject: "Memory and state",
    concepts: [
      "context vs memory vs persisted state",
      "short-term memory",
      "conversation state",
      "long-term memory",
      "episodic memory",
      "semantic memory",
      "user profiles",
      "summaries",
      "retrieval-backed memory",
      "database-backed state",
      "agent scratch/state",
      "checkpointing",
      "state machines",
      "memory write policies",
      "memory retrieval policies",
      "forgetting/pruning",
    ],
  },
  {
    subject: "Human-in-the-loop systems",
    concepts: [
      "human review",
      "human approval",
      "escalation",
      "exception handling",
      "confidence/risk-based routing",
      "review queues",
      "intervention checkpoints",
      "approval before irreversible actions",
      "correction/feedback capture",
      "active learning-style feedback loops",
      "balancing automation with human time",
    ],
  },
  {
    subject: "Evaluation",
    concepts: [
      "why ordinary unit tests are insufficient for LLM behavior",
      "deterministic tests around nondeterministic systems",
      "golden datasets",
      "test sets",
      "regression suites",
      "task-success metrics",
      "exact-match metrics where appropriate",
      "semantic evaluation",
      "rubric-based evaluation",
      "LLM-as-a-judge",
      "pairwise evaluation",
      "human evaluation",
      "judge calibration",
      "evaluator bias",
      "retrieval evals",
      "tool-use evals",
      "agent trajectory evals",
      "end-to-end evals",
      "online vs offline evaluation",
      "production feedback",
      "error taxonomy",
      "slicing results by task/customer/workflow",
      "eval-driven development",
    ],
  },
  {
    subject: "Observability and debugging",
    concepts: [
      "traces",
      "spans",
      "model calls",
      "tool calls",
      "token usage",
      "latency",
      "cost",
      "errors",
      "retrieved documents",
      "prompts/instructions",
      "prompt versions",
      "model versions",
      "agent trajectories",
      "correlation/request IDs",
      "user feedback",
      "debugging nondeterministic failures",
      "replay",
      "production monitoring",
    ],
  },
  {
    subject: "Failure modes and reliability",
    concepts: [
      "hallucination",
      "malformed output",
      "wrong tool selection",
      "bad tool arguments",
      "infinite/repetitive loops",
      "premature stopping",
      "context overflow",
      "context degradation",
      "retrieval failure",
      "stale information",
      "tool failure",
      "partial workflow failure",
      "duplicate side effects",
      "external API failure",
      "rate limits",
      "model/provider outage",
      "nondeterministic regressions",
      "compounding errors",
      "retries/backoff",
      "idempotency",
      "validation",
      "fallbacks",
      "checkpointing",
      "circuit breakers",
      "bounded loops",
      "deterministic guardrails",
      "human escalation",
      "provider/model fallback",
    ],
  },
  {
    subject: "Security and safety",
    concepts: [
      "prompt injection",
      "indirect prompt injection",
      "data exfiltration",
      "malicious retrieved content",
      "untrusted tool results",
      "privilege escalation",
      "secrets",
      "permissions",
      "tenant isolation",
      "sensitive data",
      "authorization",
      "audit logs",
      "least privilege",
      "sandboxing",
      "destructive actions",
      "approval gates",
      "blast radius",
      "containment",
    ],
  },
  {
    subject: "Model strategy",
    concepts: [
      "model selection",
      "capability vs cost",
      "capability vs latency",
      "reasoning models vs faster models",
      "model routing",
      "cascades",
      "fallback models",
      "multiple providers",
      "small model / large model routing",
      "temperature and sampling where still relevant",
      "context-window considerations",
      "version changes / model drift",
    ],
  },
  {
    subject: "Latency and cost engineering",
    concepts: [
      "tokens as cost",
      "context size",
      "output size",
      "model choice",
      "number of calls",
      "sequential-call latency",
      "parallelization",
      "caching",
      "semantic caching conceptually",
      "batching where applicable",
      "streaming",
      "speculative/background work conceptually",
      "cost per workflow",
      "unit economics",
      "latency budgets",
    ],
  },
  {
    subject: "Multi-agent systems",
    concepts: [
      "manager/worker",
      "supervisor",
      "peer agents",
      "specialist agents",
      "handoffs",
      "agent-as-tool",
      "delegation",
      "shared vs isolated context",
      "communication overhead",
      "coordination problems",
      "duplicated reasoning",
      "compounding errors",
      "observability difficulty",
    ],
  },
  {
    subject: "Production architecture",
    concepts: [
      "synchronous vs asynchronous AI work",
      "job/status pattern",
      "queues and workers",
      "background jobs",
      "webhooks",
      "persistence",
      "checkpoints",
      "retries",
      "rate limiting",
      "multi-tenancy",
      "usage metering",
    ],
  },
  {
    subject: "Shipping and operating AI features",
    concepts: [
      "prototype vs production",
      "prompt/version management",
      "model/version management",
      "feature flags",
      "shadow evaluation",
      "canary rollout conceptually",
      "regression tests",
      "rollback",
      "monitoring after launch",
      "collecting user feedback",
      "analyzing failures",
      "continuous improvement loops",
    ],
  },
  {
    subject: "AI-native software engineering / coding agents",
    concepts: [
      "coding agents",
      "agent-first development",
      "repository instructions",
      "AGENTS.md / equivalent conventions",
      "repository knowledge as context",
      "tools and environments for coding agents",
      "harness engineering for software agents",
      "mechanical architecture enforcement",
      "tests/linters/typechecks as agent feedback",
      "giving agents maps rather than giant instruction manuals",
      "human steering vs agent execution",
    ],
  },
];

async function upsertDomain(repo: SyllabusRepository, name: string) {
  const existing = (await repo.listDomains()).find((d) => d.name === name);
  return existing ?? repo.createDomain({ name });
}

async function upsertSubject(repo: SyllabusRepository, domainId: string, name: string) {
  const existing = (await repo.listSubjects(domainId)).find((s) => s.name === name);
  return existing ?? repo.createSubject(domainId, { name });
}

async function upsertConcept(repo: SyllabusRepository, subjectId: string, name: string) {
  const existing = (await repo.listConcepts(subjectId)).find((c) => c.name === name);
  return existing ?? repo.createConcept(subjectId, { name });
}

async function main() {
  const apply = process.argv.includes("--apply");
  const totalConcepts = SYLLABUS.reduce((sum, s) => sum + s.concepts.length, 0);

  console.log(JSON.stringify({ domain: DOMAIN_NAME, subjects: SYLLABUS }, null, 2));
  console.log(
    `\nParsed ${SYLLABUS.length} Subjects, ${totalConcepts} Concepts under Domain "${DOMAIN_NAME}".`,
  );

  if (!apply) {
    console.log("Dry run only — rerun with --apply to write to the database.");
    return;
  }

  const repo = getSyllabusRepository();
  const domain = await upsertDomain(repo, DOMAIN_NAME);

  let createdSubjects = 0;
  let createdConcepts = 0;

  for (const { subject, concepts } of SYLLABUS) {
    const subjectBefore = await repo.listSubjects(domain.id);
    const subjectRow = await upsertSubject(repo, domain.id, subject);
    if (!subjectBefore.some((s) => s.name === subject)) createdSubjects++;

    for (const conceptName of concepts) {
      const conceptsBefore = await repo.listConcepts(subjectRow.id);
      await upsertConcept(repo, subjectRow.id, conceptName);
      if (!conceptsBefore.some((c) => c.name === conceptName)) createdConcepts++;
    }
  }

  console.log(
    `\nDone. Domain "${domain.name}" (${domain.id}): created ${createdSubjects} new Subject(s) and ${createdConcepts} new Concept(s). Everything else already existed and was left untouched.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

# Cloud-Native Senior AI Engineer: Python + TypeScript

> **Цель:** Единая структурированная книга для подготовки к позиции Senior AI Engineer / LLM Engineer.
> **Стек:** Python + TypeScript, AWS Bedrock, Claude, LangGraph, RAG, Docker/K8s.
> **Фокус:** Общая архитектура AI-систем + подготовка к интервью в Salomon (Annecy).
> **Язык:** Основная часть — English, Salomon interview prep — Russian/French/English.

---

## Содержание

### Часть I — Фундамент: Python + TypeScript

| Глава | Тема | Источники |
|-------|------|-----------|
| 1 | **Concurrent & Asynchronous Python** — Event Loop, coroutines, asyncio, GIL, streaming | ai_engineer ch1 |
| 2 | **Async TypeScript & Node.js** — Event Loop, streaming, backpressure, SSE | ai_typescript_dev ch1 |
| 3 | **Python Advanced** — Decorators, Context Managers, Metaclasses, Pattern Matching | ai_engineer ch1.1-1.4 |
| 4 | **Enterprise Patterns for AI** — SOLID, DI, Repository/Adapter (Python + TS) | ai_engineer ch1.5-2.1 + ai_typescript_dev ch2 |
| 5 | **Memory Architecture & Type Safety** — GC, weakref, V8, typing Protocols | ai_engineer ch3, ch5 |

### Часть II — Cloud, Оркестрация, Инфраструктура

| Глава | Тема | Источники |
|-------|------|-----------|
| 6 | **Containerizing AI Applications** — Docker multi-stage (Python + Node) | ai_engineer ch6 + ai_typescript_dev ch4 |
| 7 | **Kubernetes for AI Workloads** — EKS, GPU pools, HPA, Probes | ai_engineer ch7 + ai_typescript_dev ch5 |
| 8 | **Infrastructure as Code** — Terraform, State, Drift recovery | ai_engineer ch8 + ai_typescript_dev ch6 |

### Часть III — Поиск и RAG

| Глава | Тема | Источники |
|-------|------|-----------|
| 9 | **Hybrid Search & Chunking** — BM25 + dense, semantic chunking, metadata | ai_engineer ch11 + ai_typescript_dev ch7 |
| 10 | **Reranking & Lost-in-the-Middle** — Cross-Encoders, Parent-Document Retriever | ai_typescript_dev ch8 |
| 11 | **Vector Databases** — HNSW, IVF, pgvector, Pinecone, OpenSearch | ai_engineer ch12 + ai_typescript_dev ch9 |

### Часть IV — Агенты и Состояние

| Глава | Тема | Источники |
|-------|------|-----------|
| 12 | **Agent Architectures** — LangGraph, State Graphs, Multi-agent | ai_engineer ch9 |
| 13 | **State Management & Persistence** — Checkpointers, PostgreSQL, recovery | ai_engineer ch10 + ai_typescript_dev ch10 |
| 14 | **Tool-Calling & Human-in-the-Loop** — Claude tools, Zod, HITL | ai_typescript_dev ch11 |
| 15 | **Prompt Engineering & Caching** — XML tags, Prompt Caching, optimization | ai_typescript_dev ch12 |

### Часть V — LLMOps, Evaluation, Security

| Глава | Тема | Источники |
|-------|------|-----------|
| 16 | **Evaluation Harness** — Golden datasets, LLM-as-a-Judge, CI/CD | ai_engineer ch15 + ai_typescript_dev ch13 |
| 17 | **LLM Security & Guardrails** — Prompt injection, PII, LlamaGuard | ai_engineer ch14 + ai_typescript_dev ch14 |
| 18 | **Observability & Tracing** — LangSmith, OpenLLMetry, traceId | ai_engineer ch15 + ai_typescript_dev ch15 |

### Часть VI — Salomon Interview Prep

| Глава | Тема | Источники |
|-------|------|-----------|
| 19 | **Job Description & Role Analysis** — Enablement team, CV mapping | job-specific-prep.md |
| 20 | **Technical Interview** — Round 1 questions, technical deep dives | solomon_anency/round-1.md |
| 21 | **Self-Presentation** — 10-min pitch, FR/EN scripts, interview flow | solomon_anency/my_history.md |
| 22 | **Curriculum & Learning Plan** — Что учить для Salomon LLM Engineer | job-specific-prep.md + plan.md |

---

## Источники

| Исходный файл | Строк | Использован в главах |
|---------------|-------|---------------------|
| `ai_engineer/chapter-1.md` | 572 | 1 |
| `ai_engineer/chapter-1.1.md` | 202 | 3 |
| `ai_engineer/chapter-1.2.md` | 155 | 3 |
| `ai_engineer/chapter-1.3.md` | 119 | 3 |
| `ai_engineer/chapter-1.4.md` | 101 | 3 |
| `ai_engineer/chapter-1.5.md` | 203 | 4 |
| `ai_engineer/chapter-1.5.5.md` | 101 | 4 |
| `ai_engineer/chapter-1.6.md` | 163 | 4 |
| `ai_engineer/chapter-1.7.md` | 163 | 4 |
| `ai_engineer/chapter-2.1.md` | 296 | 4 |
| `ai_engineer/introduction.md` | 77 | — (philosophy) |
| `ai_engineer/ciriculum.md` | 242 | — (TOC) |
| `ai_typescript_dev/chapters/chapter-1.md` | 203 | 2 |
| `ai_typescript_dev/chapters/chapter-2.md` | 348 | 4 |
| `ai_typescript_dev/chapters/chapter-3.md` | 907 | 12-15 |
| `ai_typescript_dev/plan.md` | 179 | — (TOC) |
| `ai_typescript_dev/job-specific-prep.md` | 1412 | 19-22 |
| `ai_typescript_dev/solomon_anency/round-1.md` | 791 | 19-20 |
| `ai_typescript_dev/solomon_anency/my_history.md` | 732 | 21-22 |

---

*Статус: in progress — рефакторинг из черновиков в структурированную книгу*

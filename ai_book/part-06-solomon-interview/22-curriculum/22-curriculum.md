# Глава 22: Curriculum — План подготовки к позиции LLM Engineer в Salomon

> **Источники:** job-specific-prep.md, plan.md — приоритизированный список тем для изучения, недельный план, ресурсы

## Что изучать для Salomon LLM Engineer

Темы отсортированы по приоритету — от наиболее критичных к дополнительным. Оценка важности проведена на основе прямых требований job description и разобранных вопросов с интервью.

### 1. TypeScript / Node.js Fundamentals (приоритет: критический)

Стек Salomon полностью TypeScript. Без глубокого понимания async/await, streaming, SOLID, DI контейнеров все остальное не имеет смысла.

| Тема | Почему важно | Что конкретно учить |
|------|-------------|-------------------|
| Async/await, Event Loop | Каждый LLM вызов — асинхронная операция | Microtasks vs macrotasks, Event Loop фазы, неблокирующий I/O |
| Streams | Streaming ответов Claude через SSE для UX | `ReadableStream`, `AsyncIterator`, backpressure, Vercel AI SDK `streamText()` |
| SOLID | Архитектура SDK и компонентов | Принципы SOLID применительно к LLM системам |
| DI (Dependency Injection) | Смена провайдеров на лету (Bedrock → Anthropic) | NestJS DI, InversifyJS, ручная реализация |
| Zod | Structured outputs для tool-calling | `z.object()`, `z.infer<>`, discriminated unions |
| Type System | Типизация LLM ответов | Template literal types, conditional types для branded IDs |

**Ключевые практики:**
- Написание тестов для асинхронного кода (Vitest, Playwright)
- Middleware паттерны (Observability middleware в SDK)
- Provider abstraction через Adapter pattern

### 2. AWS Bedrock & Claude API (приоритет: критический)

Bedrock — основная платформа деплоя, Claude — основная модель.

| Тема | Почему важно | Что учить |
|------|-------------|-----------|
| Bedrock SDK | Взаимодействие с моделями AWS | `@aws-sdk/client-bedrock-runtime`, `InvokeModel`, `InvokeModelWithResponseStream` |
| Claude API | Глубокое понимание модели | Tool use, streaming, system prompts XML, prompt caching |
| Claude 3.5 Sonnet vs Haiku | Когда какой моделью пользоваться | Trade-offs: cost vs latency vs reasoning quality |
| Prompt Caching | Снижение стоимости длинных контекстов | Cache breakpoints, Bedrock prompt caching, XML разметка |
| Structured Outputs | Гарантированный JSON ответ | `tools` + Zod схемы, `extendedThinking` |

**Ключевые концепты:**
- Streaming через SSE: `streamText()` из Vercel AI SDK
- Tool-calling: `tool({ description, parameters: z.object({...}) })`
- Prompt Caching: кэширование системного промпта (40k токенов → снижение стоимости на 85%)

### 3. RAG Pipeline Design (приоритет: высокий)

Центральная тема интервью — «where naive RAG breaks down».

| Тема | Уровень | Что учить |
|------|---------|-----------|
| Chunking strategies | Advanced | Semantic chunking, Parent-Child chunking, структурированный чанкинг по Markdown-заголовкам |
| Hybrid search | Advanced | Dense (pgvector HNSW) + Sparse (BM25/tsvector) + RRF fusion |
| Re-ranking | Advanced | Cross-Encoder модели (Cohere Rerank, BGE-reranker), Bi-Encoder vs Cross-Encoder |
| Vector databases | Production | pgvector (PostgreSQL), HNSW vs IVFFlat индексы, UPSERT операции |
| Adaptive RAG | Expert | Query Router, классификация сложности, multi-path pipeline |
| Semantic cache | Expert | Redis + vector similarity, TTL, cache invalidation при обновлении документов |

**System Design — что нужно уметь нарисовать:**
1. **Ingestion Pipeline:** PDF → OCR/Parser → Semantic Chunking → Embedding → pgvector (HNSW)
2. **Retrieval Pipeline:** User Query → Redis Semantic Cache → Hybrid Search (Dense + Sparse) → RRF → Re-ranker (Top-5) → Context Assembly
3. **Generation:** Guardrails → Claude 3.5 Sonnet (Streaming SSE) → Output Guardrails → LangSmith трассировка

**Trade-offs для обсуждения на интервью:**
- HNSW vs IVFFlat: память vs скорость построения, recall vs build time
- pgvector vs Pinecone/Weaviate: операционная простота vs масштабирование
- Parent-Child vs Fixed chunking: точность поиска vs сложность имплементации
- Haiku vs Sonnet: стоимость vs качество рассуждений

### 4. Agent Architectures (приоритет: высокий)

Multi-step reasoning, tool-calling, reliability.

| Тема | Что учить |
|------|-----------|
| State machines / LangGraph | State Graph, узлы, ребра, checkpointers, сериализация состояния |
| Tool-calling | Zod схемы для `tool()`, обработка ошибок API, self-repair loop |
| Human-in-the-Loop | Session freeze, persistence (PostgreSQL/Redis), Slack webhook resume |
| Context window management | Pruning старых tool call результатов, summarization, sliding window |
| Guardrails | Input (Prompt Injection detection через LlamaGuard), Output (PII masking через регулярные выражения) |

**Ключевой кейс для интервью:**
HITL для возвратов:
1. Агент → распознает `Refund` → session freeze в PostgreSQL (`PENDING_APPROVAL`)
2. Slack Block Kit → interactive message → кнопки Approve/Reject
3. Slack webhook → Node.js API → load state по `thread_id` → resume agent

### 5. Evaluation & LLMOps (приоритет: высокий)

«Design meaningful eval datasets for unfamiliar domains» — прямая цитата из JD.

| Тема | Что учить |
|------|-----------|
| Golden datasets | Synthetic generation (Claude → вопросы + ответы), domain expert review |
| RAG Triad | Context Relevance, Groundedness, Answer Relevance |
| LLM-as-a-Judge | Системный промпт для оценки, рубрикатор 1-5, bias detection |
| LangSmith | Трассировка, датасеты, автоматические evaluators, cost tracking |
| CI/CD для LLM | GitLab CI → golden dataset → LangSmith → pass/fail threshold |
| Regression prevention | Prompt diff → eval score delta → block deploy if ниже порога |

### 6. Production Deployment (приоритет: средний)

| Тема | Что учить |
|------|-----------|
| Docker multi-stage | TypeScript build → минимальный production image (< 150 МБ) |
| CI/CD | GitLab CI (developer velocity) + Jenkins (enterprise orchestration) |
| Monitoring | LangSmith, OpenTelemetry, traceId propagation, latency per step |
| Docker Compose | Локальная разработка: API + Redis + PostgreSQL + pgvector |

---

## Weekly Study Plan (8 недель)

### Phase 1: TypeScript + Node.js для AI (Недели 1-2)

**Цель:** Закрыть пробелы в асинхронном программировании и streaming.

**Неделя 1 — Async & Streams:**
- Пн-Ср: Event Loop, microtasks/macrotasks, `Promise.all` vs `allSettled`
- Чт-Пт: `ReadableStream`, `WritableStream`, `pipe()`, backpressure
- Сб-Вс: Vercel AI SDK `streamText()`, SSE реализация на Node.js

**Неделя 2 — SOLID, DI, Zod:**
- Пн-Вт: SOLID применительно к LLM: Adapter для провайдеров, Repository для vector store
- Ср-Чт: NestJS DI, провайдеры, модули — как альтернатива ручному DI
- Пт-Сб: Zod: схемы для tool-calling, discriminated unions, `z.infer<>`
- Вс: Контрольная: написать минимальный streaming сервер с Zod-валидацией

**Mock interview practice (Week 2 end):** Элеватор питч (2 мин), архитектура RAG (10 мин)

### Phase 2: RAG + Vector Search (Недели 3-4)

**Цель:** Уверенно объяснять, где naive RAG ломается и как это чинить.

**Неделя 3 — Chunking & Embeddings:**
- Пн-Ср: Semantic chunking (+ Parent-Child), сравнение со fixed-size
- Чт-Пт: Embedding модели (bge, cohere, OpenAI ada), dimension reduction
- Сб-Вс: Практика: реализовать Parent-Child chunking pipeline на TypeScript

**Неделя 4 — Hybrid Search & Re-ranking:**
- Пн-Ср: pgvector: HNSW index, IVFFlat, UPSERT, метрики расстояния
- Чт-Пт: BM25 (PostgreSQL tsvector), RRF fusion, hybrid search pipeline
- Сб-Вс: Re-ranking: Cross-Encoder (BGE, Cohere), Adaptive RAG routing

**Mock interview practice (Week 4 end):** System Design: полная RAG архитектура (live-design)

### Phase 3: Agents + Tool-calling (Недели 5-6)

**Цель:** Рассказывать про agent reliability и HITL как Senior.

**Неделя 5 — State & Tools:**
- Пн-Ср: State machines vs LangGraph, checkpointers, сериализация состояния
- Чт-Пт: Vercel AI SDK tool-calling, Zod схемы, `maxSteps`
- Сб-Вс: Self-repair loops, error recovery, graceful degradation

**Неделя 6 — HITL & Production Agents:**
- Пн-Ср: Human-in-the-loop: session freeze, Slack Block Kit, webhook resume
- Чт-Пт: Context window management: pruning, summarization, sliding window
- Сб-Вс: Guardrails: LlamaGuard (input), PII masking (output)

**Mock interview practice (Week 6 end):** Agent architecture + HITL design (live-coding sketch)

### Phase 4: Evaluation + Production (Недели 7-8)

**Цель:** Закрыть LLMOps, показать maturity в evaluation.

**Неделя 7 — Evaluation:**
- Пн-Ср: Golden datasets: synthetic generation, expert review, maintenance
- Чт-Пт: LLM-as-a-Judge: rubric design, bias detection, RAG Triad метрики
- Сб-Вс: LangSmith: datasets, evaluators, tracing, cost tracking

**Неделя 8 — Production & Full Mock:**
- Пн-Вт: CI/CD: GitLab CI eval pipeline, Jenkins orchestration
- Ср-Чт: Docker: multi-stage build для Node.js (< 150 МБ)
- Пт: Terraform для AI инфраструктуры (Bedrock, pgvector, Redis)
- Сб: **Full mock interview** — 10 мин презентация + Q&A
- Вс: Разбор ошибок, финальная корректировка

---

## Mock Interview Schedule

| Неделя | Тип | Фокус | Длительность | С кем |
|--------|-----|-------|-------------|-------|
| 2 | Pitch | Elevator pitch + RAG architecture | 15 мин | Запись на видео + self-review |
| 4 | System Design | RAG pipeline live-design | 30 мин | Сеньор-коллега / pet-проект |
| 6 | Agent Design | Agent + HITL architecture | 30 мин | Технический друг / ChatGPT voice |
| 8 | Full interview | 10 мин презентация + Q&A | 45 мин | Полная симуляция (рекомендуется ESN агентура) |

**Форматы отработки:**
- **Сам-с-собой (запись голоса):** Проговаривание скрипта вслух, замер времени (10 мин)
- **С ИИ (voice mode):** ChatGPT/Claude voice mode для импровизации Q&A
- **С ментором:** Полный mock с обратной связью
- **С ESN агентом:** Специфические вопросы Salomon + культурный фит

---

## Resource List

### Книги

| Книга | Для чего | Приоритет |
|-------|----------|-----------|
| «Designing Data-Intensive Applications» (Kleppmann) | Понимание распределенных систем, хранения, индексации — фундамент для RAG | ★★★★★ |
| «Building LLM Apps» (O'Reilly) | Практические паттерны RAG, agents, eval | ★★★★ |
| «Effective TypeScript» (Dan Vanderkam) | TypeScript: типы, дженерики, type-level программирование | ★★★★ |
| «System Design Interview» (Alex Xu) | Структура ответа на System Design вопросы | ★★★ |

### Документация

| Ресурс | Для чего |
|--------|----------|
| [Vercel AI SDK Docs](https://sdk.vercel.ai/docs) | Tool-calling, streaming, Zod integration — прямой стек Salomon |
| [AWS Bedrock Workshop](https://catalog.workshops.aws/building-with-amazon-bedrock) | Практика с Bedrock API, guardrails, agents |
| [Anthropic Docs — Tool Use](https://docs.anthropic.com/en/docs/build-with-claude/tool-use) | Tool-calling в Claude, best practices |
| [Anthropic Docs — Prompt Caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) | Кэширование промптов для снижения стоимости |
| [pgvector README](https://github.com/pgvector/pgvector) | Установка, индексы (HNSW/IVFFlat), SQL запросы |
| [LangSmith Docs](https://docs.smith.langchain.com) | Eval, tracing, datasets |

### Онлайн-курсы

| Курс | Для чего |
|------|----------|
| [DeepLearning.AI — Building Systems with ChatGPT](https://www.deeplearning.ai/short-courses/building-systems-with-chatgpt/) | Chain of Thought, evaluation, RAG |
| [DeepLearning.AI — LangGraph](https://www.deeplearning.ai/short-courses/ai-agents-in-langgraph/) | Agent state machines, HITL |
| [AWS Skill Builder — Bedrock](https://explore.skillbuilder.aws/learn/course/external/view/elearning/17568/building-generative-ai-applications-on-amazon-bedrock) | Bedrock SDK, streaming, guardrails |

### Практические проекты

| Проект | Что покрывает |
|--------|-------------|
| **RAG pipeline end-to-end** | Ingestion → chunking → embedding → hybrid search → re-ranking → generation |
| **Agent с HITL** | Tool-calling → session freeze → Slack webhook → resume |
| **CI/CD eval pipeline** | GitLab CI → golden dataset → LangSmith evaluator → pass/fail gate |
| **Shared SDK** | Provider abstraction → middleware (tracing + cost + retries) → subpath exports → npm публикация |

### Telegram / Сообщества

- Сообщество LLM Engineering (TypeScript-focused)
- Канал AWS Bedrock / Anthropic API changelog
- Группа ESN-агентуры для Salomon

---

## Чеклист готовности к интервью

Перед интервью пройдите по чеклисту — каждый пункт должен быть закрыт конкретным примером:

- [ ] Я могу рассказать BaseSystem case за 4 минуты с цифрами
- [ ] Я знаю 3 failure modes naive RAG и как их чинить (hybrid search, re-ranking, semantic chunking)
- [ ] Я могу объяснить HITL архитектуру (session freeze → Slack Block Kit → webhook resume)
- [ ] Я могу нарисовать RAG pipeline (ingestion → storage → retrieval → generation)
- [ ] Я объясню, почему HNSW, а не IVFFlat (incremental inserts, >95% recall)
- [ ] Я расскажу про SDK design (Adapter pattern, middleware, tree-shaking)
- [ ] Я опишу eval pipeline (golden dataset → CI/CD → LangSmith → pass/fail)
- [ ] Я отвечу на каверзные вопросы (small team, domain transfer, vector storage, Itransition)
- [ ] У меня есть 2-3 вопроса к интервьюеру
- [ ] Я отрепетировал 10-минутную презентацию 3+ раза вслух
- [ ] Я готов переключиться на английский, если французский мешает точности

---

## Систематизация: Roadmap к роли LLM Engineer в Salomon

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SALOMON LLM ENGINEER ROADMAP                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  НЕДЕЛИ 1-2                      НЕДЕЛИ 3-4                                 │
│  ┌─────────────────────┐         ┌─────────────────────┐                    │
│  │ TypeScript + Node   │         │ RAG + Vector Search  │                    │
│  │ • Async/Streams     │ ──────▶ │ • Chunking           │                    │
│  │ • SOLID + DI        │         │ • Hybrid Search      │                    │
│  │ • Zod               │         │ • Re-ranking         │                    │
│  │ • Vercel AI SDK     │         │ • pgvector + HNSW    │                    │
│  └─────────────────────┘         └─────────────────────┘                    │
│         │                              │                                    │
│         ▼                              ▼                                    │
│  НЕДЕЛИ 5-6                      НЕДЕЛИ 7-8                                 │
│  ┌─────────────────────┐         ┌─────────────────────┐                    │
│  │ Agents + Tooling    │         │ Eval + Production    │                    │
│  │ • State Machines    │ ──────▶ │ • Golden Datasets    │                    │
│  │ • HITL              │         │ • LLM-as-a-Judge     │                    │
│  │ • Guardrails        │         │ • LangSmith CI/CD    │                    │
│  │ • Error Recovery    │         │ • Docker/Terraform   │                    │
│  └─────────────────────┘         └─────────────────────┘                    │
│                                          │                                  │
│                                          ▼                                  │
│                              ┌─────────────────────┐                        │
│                              │  FULL MOCK WEEK 8    │                        │
│                              │  10min + Q&A         │                        │
│                              └─────────────────────┘                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

*Этот учебный план построен на основе анализа job description Salomon, материалов подготовки к Round 1 и опыта прохождения интервью. Каждая неделя заканчивается практическим результатом, а не просто прочитанным материалом. Ключевой принцип: «готовься к интервью, а не к экзамену» — каждое знание должно быть привязано к конкретному ответу на вопрос.*

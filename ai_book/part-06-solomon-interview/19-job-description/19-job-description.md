# Глава 19: Job Description — Анализ позиции LLM Engineer в Salomon (Enablement Team)

## Обзор позиции

### Salomon и новая AI-организация

Salomon (Amer Sports) формирует выделенную AI-команду для внедрения структурированной LLM-инженерии в свой софтверный delivery. Команда разделена на две функции:

| Команда | Миссия |
|---------|--------|
| **Platform Team** | Строит общую инфраструктуру: сервера, базовые API, деплой моделей, векторные базы данных |
| **Enablement Team (ваша роль)** | Работает с инженерными и продуктовыми командами над конкретными use cases, выводит их в продакшн, кодифицирует паттерны в переиспользуемые компоненты |

**Mission:** Измеримое повышение AI-компетенций across the SDLC в течение 6 месяцев.

### Что такое Enablement Team

В отличие от платформенной команды, которая строит «дороги», Enablement Team ездит по этим дорогам вместе с продуктовыми командами. Ключевые принципы:

- Работа происходит **внутри реальных use cases** вместе с delivery teams
- Артефакты (паттерны, обвязки, компоненты) попадают в **shared library** — Salomon AI SDK на TypeScript
- Цель за 6 месяцев: **4-6 use cases в продакшене** с документированными baseline качества
- Результат: равное количество инженерных и продуктовых команд, доставляющих AI-фичи **самостоятельно** после завершения engagement

### Что вы будете владеть (What you will own)

Из job description (оригинал на английском от рекрутера Amandine Gabriel):

| Область | Конкретные задачи |
|---------|------------------|
| **RAG pipeline design** | Retrieval strategies, chunking, re-ranking, hybrid search. Выбор storage и vector layer открыт — вы участвуете в решении |
| **Agent architecture** | Tool use patterns, multi-step reasoning flows, human-in-the-loop design, context window management |
| **Evaluation harnesses** | Test scaffolding в координации с LLMOps инженером |
| **Prompt engineering** | Structured prompting, few-shot design, chain-of-thought patterns |
| **Shared component library** | Reusable TypeScript components из use cases → Salomon AI SDK |
| **Use case kickoffs** | Участие в запуске и разработке use cases вместе с FDE и delivery team |

### Что ищут (What we are looking for)

- **LLM systems in production:** опыт доведения LLM-систем от прототипа через eval harness до production deployment
- **RAG и retrieval:** проектирование retrieval pipelines, понимание *«where naive RAG breaks down»*, trade-offs между dense, sparse и hybrid подходами
- **Agentic patterns:** опыт с tool-calling и multi-step agent flows, понимание их reliability characteristics
- **Evaluation:** умение проектировать осмысленные eval datasets для незнакомых доменов; написание evals как часть build process
- **TypeScript:** основной стек — TypeScript и Node.js; Vercel AI SDK и AWS Bedrock SDK — representative environments; основная модель — Claude через Anthropic API и Claude Enterprise
- **Collaboration:** опыт работы рядом с людьми разных специальностей: product managers, domain engineers, platform contributors

### Что такое успех через 6 месяцев

> Four to six use cases shipped to production with documented quality baselines. Core patterns codified and reusable. An equal number of engineering and product teams delivering AI work independently after the engagement.

---

## Соответствие CV требованиям (CV ↔ Poste mapping)

### RAG pipeline design

| Требование Salomon | Опыт кандидата (BaseSystem) |
|-------------------|---------------------------|
| Retrieval strategies, chunking, re-ranking, hybrid search | Мотор RAG на AWS Bedrock для запросов по регламентам горнолыжных курортов, погоде, страховкам — семантический chunking + BGE/Cohere re-ranking для фильтрации контекста перед подачей в Claude 3.5 Sonnet |
| Понимание где naive RAG ломается | Имеет сформированное мнение: chunking режет логику, pure vector search проваливается на точных идентификаторах, «Lost in the Middle» без re-ranking |
| Выбор storage и vector layer | Работал с PostgreSQL + pgvector (HNSW индекс) в продакшене |

### Agentic patterns / tool-calling

| Требование Salomon | Опыт кандидата (BaseSystem) |
|-------------------|---------------------------|
| Tool use patterns | Decision-making agents с real-time tool-calling: проверка stock билетов, предиктивный поиск скидок через REST API |
| Multi-step reasoning flows | Multi-step агенты с состоянием, графом шагов, лимитом итераций |
| Human-in-the-loop design | Двухфакторная валидация возвратов средств: session freeze + Slack Block Kit запрос → webhook → resume |
| Context window management | Pruning старых tool call результатов, summarization длинных диалогов |

### Evaluation

| Требование Salomon | Опыт кандидата |
|-------------------|---------------|
| Eval datasets для незнакомых доменов | Построил golden dataset для регламентов польских курортов (незнакомый домен) через синтетическую генерацию + review с domain expert |
| Evals как часть build process | CI/CD с автоматической регрессией промптов против golden datasets (GitLab CI, Jenkins) |
| Coordination с LLMOps | LangSmith для трассировки, детекции дрейфа, анализа стоимости |

### TypeScript / Node.js / Claude

| Требование Salomon | Опыт кандидата |
|-------------------|---------------|
| TypeScript и Node.js | Эксперт TypeScript, Node.js (Express, NestJS) — основной стек |
| Vercel AI SDK | Работал с Vercel AI SDK для streaming, tool-calling, Zod-валидации |
| AWS Bedrock | Основная платформа деплоя во всех проектах |
| Claude (Anthropic API, Claude Enterprise) | Claude 3/3.5 Sonnet & Haiku — основные модели |

### Shared component library

| Требование Salomon | Опыт кандидата |
|-------------------|---------------|
| Reusable TypeScript components → Salomon AI SDK | Дизайн и публикация внутренних TypeScript SDK (startup миссии): Provider Abstraction Wrapper (Bedrock ↔ Anthropic ↔ OpenRouter), Shared RAG/Agent SDK для других команд |

### Collaboration

| Требование Salomon | Опыт кандидата |
|-------------------|---------------|
| Работа с PM, domain engineers, platform contributors | Международный контекст, английский, работа в команде 4 LLM инженеров + кросс-функциональное взаимодействие с Core Backend и Operations |
| Французский / английский | Английский C1, французский B1+ — переписка и предварительный скрининг на французском |

---

## Ключевые технологии (что нужно знать)

### Обязательный стек

| Технология | Уровень | Комментарий |
|-----------|---------|------------|
| TypeScript | Expert | Основной язык всего SDK и сервисов |
| Node.js (NestJS/Express) | Expert | Фреймворки для API сервисов |
| AWS Bedrock | Production | Деплой Claude, эмбеддинги, guardrails |
| Claude 3.5 Sonnet / Haiku | Production | Основные модели для reasoning и быстрой классификации |
| Vercel AI SDK | Production | Streaming, tool-calling, Zod integration |

### Ключевые концепты для интервью

1. **RAG:**
   - Semantic chunking vs. fixed-size chunking
   - Parent-Child chunking (search на малых чанках → context из родительских блоков)
   - Hybrid search: Dense (pgvector) + Sparse (BM25/tsvector) с RRF fusion
   - Re-ranking: BGE-reranker / Cohere Rerank для фильтрации top-30 → top-5
   - Adaptive RAG / Query Router для экономии токенов

2. **Agent architecture:**
   - LangGraph / state machines для многошаговых потоков
   - Zod-схемы для строгой типизации tool-calling
   - Self-repair loops (передача ошибок API обратно в контекст)
   - Guardrails: input (Prompt Injection detection) и output (PII masking)

3. **Evaluation:**
   - Golden datasets (50-100 пар вопрос-ответ)
   - RAG Triad: Context Relevance, Groundedness, Answer Relevance
   - LLM-as-a-Judge
   - CI/CD интеграция через LangSmith

4. **SDK Design:**
   - Provider Abstraction (Adapter pattern)
   - Built-in middleware: telemetry, cost tracking, retries
   - Subpath exports для tree-shaking
   - Monorepo (pnpm/Turborepo) структура

---

## Критерии отбора в ESN / Salomon

### Что ищут рекрутеры (Amandine Gabriel — IT Lead Recruiter)

На этапе скрининга с ESN рекрутер оценивает:

- **Соответствие стека:** TypeScript, Node.js, AWS Bedrock, Claude — кандидат должен закрывать эти требования на 100%
- **Production опыт с LLM:** не просто эксперименты, а системы в продакшене с CI/CD, eval, monitoring
- **RAG + Agentic patterns:** конкретные кейсы, не теоретические знания
- **Enablement mindset:** готовность кодифицировать паттерны и передавать компетенции командам
- **Язык:** французский для общения с рекрутером, английский для технических этапов
- **Локация:** Annecy / Grenoble — гибридный формат 1-2 раза в неделю

### Что ищет техническая команда (Jamil и команда)

На техническом интервью (Round 1 — 10 мин презентация + Q&A) оценивают:

- **Hands-on capability:** писал ли кандидат код сам или был «powerpoint architect»
- **Depth of understanding:** «where naive RAG breaks down», reliability characteristics агентов
- **System design skill:** может ли нарисовать end-to-end архитектуру RAG pipeline
- **Evaluation maturity:** понимание, что eval — это не опция, а часть build process
- **Collaboration:** готовность работать с FDE, Platform team, product managers
- **Transferable skills:** способность зайти в незнакомый домен (retail/outdoor) и построить eval frameworks

### Факторы успеха

1. **Конкретные цифры и примеры** — не описания архитектур, а латенси, объемы, проценты
2. **Терминология из job description** — Enablement, Human-in-the-Loop, Shared Component Library
3. **BaseSystem как красная нить** — проект закрывает RAG + agents + HITL + eval + CI/CD + Claude/Bedrock
4. **Trade-off awareness** — понимание, когда использовать HNSW vs IVFFlat, Haiku vs Sonnet, pgvector vs Pinecone
5. **Hands-on lead позиционирование** — «я и архитектор, и разработчик, и LLMOps — писал код каждый день»

---

*Эта глава подготовлена на основе материалов рекрутера Amandine Gabriel (LinkedIn), job description Salomon, и стратегии подготовки к интервью. Следующая глава — полный разбор технического интервью с вопросами и ответами.*

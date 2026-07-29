# Глава 20: Technical Interview — Разбор первого раунда

> **Источник:** Solomon Annecy round-1.md — полная подготовка к клиентскому интервью

## Структура интервью

Формат: **10 минут презентации + Q&A**.

Цель: сфреймить презентацию напрямую под ожидания роли, а не делать хронологический обзор CV.

### Рекомендованная структура 10 минут

| Time | Секция | Содержание |
|------|--------|-----------|
| 0:00–1:30 | **Accroche (крючок)** | Кто он в одной фразе. *«LLM Engineer с 2+ годами в production AI системах (RAG, agents, evaluation) на TypeScript/Node.js, AWS Bedrock, Anthropic API»* |
| 1:30–5:30 | **Le cas BaseSystem** | Развернуть проект билетной системы для горнолыжных курортов как мини-историю — от оборачивания AI API до продакшена с CI/CD |
| 5:30–7:30 | **Socle technique transférable** | RAG гибрид + re-ranking, agents + tool-calling, human-in-the-loop, Zod, evaluation |
| 7:30–9:00 | **Volet SDK/plateforme** | Опыт проектирования shared TypeScript SDK → Shared Component Library Salomon |
| 9:00–10:00 | **Clôture** | Почему этот пост: способность industrialiser use case end-to-end + transfer компетенций |

### Практические напоминания

- **Быть конкретным и цифровым** — латенси, объемы, gains, а не описания архитектур
- **Использовать терминологию job description** — Enablement, Human-in-the-Loop, Shared Component Library
- **BaseSystem как красная нить** — закрывает RAG + agents + HITL + eval + CI/CD + Claude/Bedrock

---

## Технические вопросы и ответы по темам

### Тема 1: RAG Pipeline Design

#### Вопрос: «Where does naive RAG break down in production?»

**Проблема 1 — Плохой chunking:**
Фиксированный размер (например, 500 символов) разрывает логические предложения, таблицы, контекст. Условие «Исключение см. в пункте 4» уходит в другой чанк.

**Проблема 2 — Недостаток гибридного поиска:**
Семантический поиск проваливается на точных идентификаторах, артикулах, датах.

**Проблема 3 — «Lost in the Middle»:**
Если в контекст Claude передать 15-20 чанков, модель хуже усваивает информацию из середины окна.

**Ответ (пример из BaseSystem):**

> «В BaseSystem мы начали с naive RAG — фиксированные 500-токеновые чанки, pure vector similarity, top-10 результатов в LLM. Это быстро сломалось: noise и broken logic.
>
> Я обновил архитектуру до Advanced RAG:
> 1. **Hybrid Search** — BM25 для точных кодов + pgvector HNSW для семантики
> 2. **Structure-Aware Chunking** — деление по секциям и клаузам, а не по токенам
> 3. **Re-Ranking** — Cohere/BGE реранкер обрезает 30 chunks до top-3 high-density сниппетов
>
> Это сократило context payload на 60%, снизило API costs и подняло accuracy до 98% на eval benchmark.»

**Ключевые слова:** semantic chunking, Parent-Child, hybrid search (dense + sparse), RRF, re-ranking (Cross-Encoder), «Lost in the Middle»

#### Вопрос: «Почему вы не использовали один подход для всех запросов?»

**Ответ (Adaptive RAG / Query Router):**

> «Я реализовал **Adaptive RAG с query routing**. Для простых информационных запросов — часы работы курорта, погода — трафик шел через Naive RAG: быстро и дешево. Для сложных транзакционных запросов — возвраты, страховые случаи — легковесный классификатор направлял запрос на Advanced Hybrid RAG pipeline с re-ranking и HITL.
>
> Это 70/30 правило: 70% запросов обслуживаются с минимальной задержкой и стоимостью, 30% получают максимальную precision.»

**Ключевые слова:** Adaptive RAG, Query Router, cost optimization, 70/30 rule

#### Вопрос: «HNSW vs IVFFlat — что вы рекомендуете и почему?»

**Ответ:**

> «Я предпочитаю HNSW. Он не требует pre-training на seed dataset, handles incremental updates без перестройки индекса, дает logarithmic search latency с >95% recall. Да, HNSW потребляет больше RAM и build time выше, но для production систем с постоянно обновляющимися данными (регламенты, погода, каталоги) это правильный выбор.

**Trade-offs, которые нужно показать:**

| Фактор | HNSW | IVFFlat |
|--------|------|---------|
| Query latency | O(log N) | O(N) с кластеризацией |
| Recall | 95-99% | Ниже без перестройки |
| Memory | Высокая | Низкая |
| Incremental inserts | Да, на лету | Требует перекластеризации |
| Build time | Медленнее | Быстрее |

#### Вопрос: «Как работает Parent-Child Chunking?»

**Ответ:**

> «Small chunks (150 токенов) — для точности векторного поиска. Large parent blocks (1000 токенов) — для целостности контекста LLM.
>
> Векторный search идет только по `children` таблице. Когда `child_1`, `child_2` и `child_3` находят совпадение, мы делаем SQL lookup: `SELECT DISTINCT parent_text FROM parents WHERE id IN (...)`. Deduplication схлопывает множественные child-matches в 2-3 уникальных parent блока.
>
> Claude получает полные, связные параграфы, а не фрагментированные сниппеты.»

---

### Тема 2: Agentic Patterns / Tool-Calling

#### Вопрос: «How do you ensure reliability in multi-step agentic flows?»

**Ответ (с опытом LangGraph и NestJS):**

> **Проблема 1 — Бесконечные циклы:**
> Решение: State Graph с жестким `max_iterations = 5`. Превышение → graceful fallback на оператора.
>
> **Проблема 2 — Невалидный JSON от модели:**
> Решение: Vercel AI SDK + Zod схемы для `tool()`. Модель обязана вернуть строго типизированные аргументы. Если невалидно — повтор с сообщением об ошибке.
>
> **Проблема 3 — Падение внешних API при tool-calling:**
> Решение: Self-repair loop. Если `Inventory API` вернул `503`, ошибка форматируется и передается обратно в контекст: «The tool returned an error. Please try another parameter or explain to user».

**Ключевые слова:** state graph, max_iterations, Zod validation, self-repair loop, error recovery

#### Вопрос: «Describe your Human-in-the-Loop (HITL) implementation»

**Ответ (кейс с возвратом средств через Slack в BaseSystem):**

> **Архитектура:**
> 1. Агент распознает намерение `Refund` — транзакция **замораживается**
> 2. Состояние сессии сохраняется в PostgreSQL с `status = 'PENDING_APPROVAL'` и уникальным `thread_id`
> 3. Slack API (Block Kit) отправляет интерактивное сообщение в канал менеджеров с кнопками «Approve» / «Reject»
> 4. Менеджер кликает — Slack шлет webhook на Node.js API
> 5. Бэкенд загружает `AgentState` по `thread_id`, обновляет `approvalStatus`, возобновляет граф
>
> **Ключевые технические решения:**
> - State persistence в PostgreSQL (не в RAM — устойчиво к рестартам)
> - Асинхронный webhook (не держать HTTP-соединение открытым)
> - `thread_id` в payload кнопок Slack для однозначной идентификации сессии
>
> **Результат:** Успешные транзакции выросли с 88% до 99.4%, latency увеличилось незначительно (+150ms на повтор в случае ошибки).

**Ключевые слова:** state persistence, Slack Block Kit, webhook, session freeze, async resume

---

### Тема 3: Evaluation Harnesses

#### Вопрос: «How do you write evals for unfamiliar domains?»

**Ответ (на примере регламентов горнолыжных курортов):**

> **3-step процесс:**
>
> 1. **Синтетическая генерация:** Скармливаем raw regulation PDFs в Claude 3.5 Sonnet → получаем 100 реалистичных user questions с source text и ground-truth answers
> 2. **Domain Expert Review:** 2 часа с operations manager курорта — review, коррекция edge cases, валидация 50 пар «Золотого датасета»
> 3. **Automated Metrics в CI/CD:**
>    - Context Recall: нашел ли retrieval правильный chunk?
>    - Faithfulness: ответил ли Claude только по предоставленному chunk?
>    - Answer Relevancy: решил ли ответ вопрос пользователя?
>
> **Интеграция в CI/CD (GitLab CI + LangSmith):**
> - Каждый MR с изменением промпта → pipeline на golden dataset
> - LangSmith трассировка каждого шага (embedding latency, retrieval latency, re-ranker latency, LLM TTFT)
> - Если метрики падают ниже порога (< 0.85) → build fails

**Ключевые слова:** synthetic generation, golden dataset, LLM-as-a-Judge, RAG Triad, LangSmith CI/CD, regression prevention

---

### Тема 4: TypeScript / Node.js Stack

#### Вопрос: «Ваш стек совпадает с нашим — расскажите о работе с Vercel AI SDK»

**Ответ:**

> «Vercel AI SDK — ключевой инструмент в моем стеке. Использовал три его возможности:
>
> 1. **Streaming через SSE:** `streamText()` для отправки токенов пользователю в реальном времени через Server-Sent Events. Критично для UX — Time-to-First-Token снижается до ~200ms.
>
> 2. **Tool-calling с Zod:** `tool({ description, parameters: z.object({...}) })` — модель возвращает строго типизированные аргументы. Zod автоматически валидирует на стороне сервера до выполнения.
>
> 3. **Provider abstraction:** SDK абстрагирует конкретного провайдера (Bedrock vs Anthropic API) через единый интерфейс. Продуктовая команда пишет `generateText()`, а SDK решает, какой бэкенд использовать.»

---

### Тема 5: Shared Component Library

#### Вопрос: «How do you design an AI SDK for multiple engineering teams?»

**Ответ:**

> **1. Provider Abstraction (Adapter Pattern):**
> SDK оборачивает AWS Bedrock, Anthropic API и Vercel AI SDK в единый интерфейс:
> ```
> import { SalomonAI } from '@salomon/ai-sdk';
> const client = new SalomonAI({ environment: 'production' });
> ```
>
> **2. Decoupled Prompts:**
> Промпты не hardcoded — SDK загружает их из внешнего конфига. Обновление промпта не требует новой версии SDK.
>
> **3. Built-in Middleware (каждый вызов LLM проходит через):**
> - LangSmith tracing
> - Token & cost tracking per team
> - Automatic retries с exponential backoff
> - Failover: Bedrock → Anthropic native API при outage
>
> **4. Оптимизация:**
> - Tree-shaking через subpath exports (`"exports": { "./rag": "./dist/rag/index.js" }`)
> - Native Web Streams для SSE (ReadableStream)
> - Zod type inference (`z.infer<typeof schema>`) для end-to-end type safety

**Ключевые слова:** SOLID, Adapter pattern, Open/Closed Principle, middleware chain, tree-shaking, type inference

---

### Тема 6: Production Deployment

#### Вопрос: «How did you use GitLab CI and Jenkins — why both?»

**Ответ:**

> **GitLab CI — для быстрых developer feedback loops:**
> - `.gitlab-ci.yml` с авто-запуском prompt regression тестов на каждый MR
> - Docker build + push в Container Registry
>
> **Jenkins — для enterprise оркестрации:**
> - Multi-environment deployment pipelines с approval gates для financial modules
> - Nightly batch: 1000+ historical user queries regression + HNSW index rebuild
>
> **Почему оба:** GitLab CI дает скорость на уровне feature development, Jenkins — контроль на уровне enterprise release.

---

## Correspondance CV ↔ attentes

На что обратить внимание интервьюеру при оценке ответов кандидата:

### RAG pipeline design
- ✅ BaseSystem: RAG engine на AWS Bedrock для ski regulations, weather, insurance
- ✅ chunking adapté + re-ranking BGE/Cohere для релевантности
- ✅ Имеет мнение, где naive RAG breaks down — chunking precision, noise без re-ranking

### Agentic patterns / tool-calling
- ✅ Decision-making agents с tool-calling: stock check, predictive discounts
- ✅ **Human-in-the-loop**: двухфакторная валидация refunds через Slack (Block Kit) — «пример, который надо рассказать в деталях, это прямо указано в job description»

### Évaluation
- ✅ CI/CD с автоматической регрессией промптов против golden datasets (GitLab CI, Jenkins)
- ✅ LangSmith для alignment и drift detection
- ✅ Пример построения eval dataset для незнакомого домена (ski regulations)

### Stack TypeScript / Node.js / Claude
- ✅ Stack почти идентичный: TypeScript expert, NestJS/Express, AWS Bedrock, Anthropic API, Claude 3/3.5 Sonnet & Haiku
- ✅ Vercel AI SDK — тоже в компетенциях

### Shared component library
- ✅ Conception и publication внутренних TypeScript SDK (startup mission) — прямой линк с Salomon AI SDK

### Collaboration transverse
- ✅ Международный контекст, английский, работа с продукт/тех командами в стартапах
- ⚠️ **Point d'attention:** опыт в основном small team / solo (консультант). Подготовить пример коллаборации с PM или non-technical профилем

### Écarts probables — anticipation

| Вопрос | Как отвечать |
|--------|-------------|
| «Вы работали в малых командах/соло — как встроитесь в Enablement с FDE и Platform?» | Пример с SDK для других команд + привычка документировать и передавать (environnements détaillés в конце миссий) |
| «Опыт RAG/agents в ski, fitness — не в retail/outdoor. Как перенесете?» | Механика (chunking, re-ranking, tool-calling, HITL) domain-agnostic. Уже делал для незнакомого домена (ski regulations) |
| «Storage и vector layer открыты — ваша рекомендация?» | PostgreSQL + pgvector + HNSW: простота, операционность, без лишнего сервиса. Но прагматично — если volume требует Pinecone/Qdrant, готов рассмотреть |
| «Почему не было AI инструментов в Itransition 2021?» | Это был до LLM эры. Миссия показала фундаментальный back-end: API, security, databases — база, на которой строится AI |

---

## Каверзные вопросы (ожидать на интервью)

### 1. «Вы представились как Architect, Backend LLM Engineer и LLMOps — что именно вы делали руками?»

> **Ответ:** «Я был primary hands-on engineer с первого дня. Да, я делал high-level архитектуру, но я лично писал код end-to-end: API сервисы на TypeScript/Node.js к AWS Bedrock, Zod схемы для tool-calling, Query Router для Adaptive RAG, Slack интеграцию для HITL, GitLab CI скрипты для eval pipelines. Когда я говорю "architecture" — я имею в виду, что сделал технические выборы И написал код.»

### 2. «Что делал backend engineer, пока вы занимались LLM?»

> **Ответ:** «Backend team владела core business platform: user auth, relational databases, ticketing engine, payment gateways, стандартные REST API. Моя задача — Intelligence Layer поверх их архитектуры: я брал их REST API и оборачивал в Zod tool definitions для Claude, строил Adaptive RAG сервис, управлял embeddings, оркестрировал Bedrock и LLM observability через LangSmith.»

### 3. «У вас команда из 4 человек — как делили работу в AI team?»

> **Ответ:** «Я — core LLM reasoning & retrieval pipeline. Один инженер — data ingestion & ETL (PDF parsing, chunking, pgvector). Второй — session memory, SSE streaming endpoints. Третий — guardrails и prompt safety. Работали в agile sprints по 2 недели, code review, общие internal utility packages.»

### 4. «Semantic cache — TTL? А если документы обновились?»

> **Ответ:** «TTL (24 часа) + инвалидация кэша при обновлении документов в Ingestion Pipeline. При изменении контента очищаем семантический кэш для затронутых документов.»

### 5. «Размер Docker образа 2.8 ГБ — как уменьшить?»

> **Ответ:** «Multi-stage build: stage 1 — компиляция TypeScript с полным toolchain, stage 2 — только сжатый JS + runtime зависимости. Alpine-based Node.js image. Исключить devDependencies. Итог: < 150 МБ. Время старта пода с 4 минут до ~3 секунд.»

---

## Вопросы кандидата к интервьюеру

В конце интервью обязательно задать 2-3 вопроса:

1. **По use cases:** «Quels sont les 1 ou 2 premiers cas d'usage sur lesquels l'équipe Enablement va démarrer?»
2. **По разделению труда:** «Comment se répartit concrètement le travail entre l'équipe Platform et l'équipe Enablement au quotidien?»
3. **По maturity:** «Quel est le niveau de maturité actuel des équipes produit/ingénierie sur l'IA — part-on de zéro ou y a-t-il déjà des initiatives en cours?»

---

*Эта глава собрана из материалов подготовки к Round 1 интервью с Salomon. Все вопросы и ответы основаны на реальном опыте кандидата в BaseSystem и отражают фактический стек и кейсы. Следующая глава — полный скрипт самопрезентации на 10 минут.*

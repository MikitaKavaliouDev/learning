# Глава 10: Реранкинг и борьба с Lost-in-the-Middle

> **Ментальная модель:** *Лавинный спасатель.* Спасатели находят под снегом 15 сигналов от датчиков. Они не могут раскапывать все точки одновременно. Специальный прибор быстро ранжирует сигналы, определяя, где глубина залегания меньше всего и где помощь нужна немедленно, чтобы направить ресурсы туда в первую очередь. Реранкер делает то же самое с документами: из 20 найденных контекстов он выбирает 3–5 наиболее релевантных.

---

## 10.1. Феномен Lost-in-the-Middle

В 2023 году команда исследователей из Stanford и UC Berkeley опубликовала работу «Lost in the Middle: How Language Models Use Long Contexts». Ключевой вывод: даже самые мощные LLM (GPT-4, Claude 3) **значительно хуже извлекают информацию из середины длинного контекстного окна**.

### Экспериментальные данные

| Позиция релевантной информации | Точность извлечения |
|-------------------------------|---------------------|
| В начале контекста (top-3 документа) | ~87% |
| В конце контекста (bottom-3 документа) | ~83% |
| В середине контекста | ~43% |

**Почему это происходит?** Гипотеза — механизм внимания (attention) в трансформерах имеет «recency bias»: модель лучше запоминает то, что прочитала последним, и то, что было в начале последовательности (из-за эффекта примирования).

### Для RAG это катастрофа

Если ваша RAG-система находит 20 релевантных чанков и отправляет их все в контекст LLM, нужная информация может оказаться на 10-й позиции — и модель её просто «не заметит», сгенерировав ответ на основе менее релевантных данных из начала или конца.

```text
Контекст LLM (80К токенов):
┌──────────────────────────────────────────────┐
│ Документ 1: не очень релевантный (начало)    │ ← модель видит его
│ Документ 2: не очень релевантный             │
│ Документ 3: не очень релевантный             │
│ Документ 4: не очень релевантный             │
│ ...                                          │
│ Документ 10: **САМЫЙ ВАЖНЫЙ**                │ ← модель его ПРОПУСКАЕТ!
│ ...                                          │
│ Документ 20: moderately relevant (конец)     │ ← модель видит его
└──────────────────────────────────────────────┘
```

---

## 10.2. Cross-Encoders vs Bi-Encoders

Чтобы понять, как работает реранкинг, нужно разобраться в двух архитектурах энкодеров.

### Bi-Encoder (используется в векторном поиске)

Каждый документ и запрос кодируются **независимо** в один вектор. Это быстро (O(n) для n документов), но потеряно взаимодействие между запросом и документом.

```
Запрос: "Shift 13 DIN" → Энкодер → [0.1, 0.5, 0.8, ...]  ← вектор запроса
Документ: "крепления" → Энкодер → [0.2, 0.4, 0.7, ...]   ← вектор документа
                                                    ↑
                                            Косинусное сходство = 0.92
```

### Cross-Encoder (используется в реранкинге)

Запрос и документ подаются **вместе** в одну модель. Модель видит их взаимодействие на уровне токенов. Это медленно (O(n) × время инференса), но гораздо точнее.

```
Запрос + Документ: "Shift 13 DIN" + "крепления" → Cross-Encoder → [0.95]
                                                                      ↑
                                                              Оценка релевантности
```

| Характеристика | Bi-Encoder | Cross-Encoder |
|---------------|------------|---------------|
| Скорость | ~10K док/сек на CPU | ~50 док/сек на GPU |
| Точность | Средняя | Высокая |
| Индексирование | Да (векторы кэшируются) | Нет (каждый раз заново) |
| Применение | Первичный поиск | Реранкинг top-K |

---

## 10.3. Практическая реализация: Cohere Rerank

Cohere Rerank — один из самых популярных реранкеров. Он принимает запрос и список документов, возвращает отсортированные с оценками релевантности.

### Python (интеграция с LangChain)

```python
from langchain.retrievers import ContextualCompressionRetriever
from langchain.retrievers.document_compressors import CohereRerank
from langchain_community.vectorstores import PGVector
from langchain_community.embeddings import OpenAIEmbeddings

# Настраиваем первичный поиск (векторное хранилище)
vectorstore = PGVector(
    embedding_function=OpenAIEmbeddings(),
    collection_name="salomon_docs",
    connection_string="postgresql+psycopg2://user:pass@localhost:5432/ai_vectors"
)

# Оборачиваем в Contextual Compression с реранкером
retriever = ContextualCompressionRetriever(
    base_compressor=CohereRerank(model="rerank-english-v3.0", top_n=3),
    base_retriever=vectorstore.as_retriever(search_kwargs={"k": 20})
)

# Теперь retriever возвращает только 3 самых релевантных документа
docs = retriever.get_relevant_documents("Как настроить Shift 13 на вес 85 кг?")
for doc in docs:
    print(f"Score: {doc.metadata.get('relevance_score', 'N/A')}")
    print(f"Text: {doc.page_content[:100]}...")
```

### TypeScript (через API)

```typescript
// services/reranker.service.ts
export interface RerankResult {
  text: string;
  score: number;
}

export class CohereReranker {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.COHERE_API_KEY!;
  }

  async rerank(params: {
    query: string;
    documents: string[];
    topN: number;
  }): Promise<RerankResult[]> {
    const response = await fetch("https://api.cohere.ai/v1/rerank", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "rerank-english-v3.0",
        query: params.query,
        documents: params.documents,
        top_n: params.topN,
      }),
    });

    const data = await response.json();
    return data.results.map((r: any) => ({
      text: params.documents[r.index],
      score: r.relevance_score,
    }));
  }
}
```

---

## 10.4. Parent-Document Retriever — глубинная архитектура

Это ключевой паттерн, соединяющий гибридный поиск (глава 9) и реранкинг (глава 10).

### Архитектура

```
                    ┌──────────────────────┐
                    │  User Query          │
                    └──────────┬───────────┘
                               ▼
                    ┌──────────────────────┐
                    │  Step 1: Поиск       │
                    │  Гибридный поиск     │
                    │  (BM25 + Dense)      │
                    │  → 20 Child Chunks   │
                    └──────────┬───────────┘
                               ▼
                    ┌──────────────────────┐
                    │  Step 2: Извлечение  │
                    │  parentId → Parent   │
                    │  Документы (5-10 шт) │
                    └──────────┬───────────┘
                               ▼
                    ┌──────────────────────┐
                    │  Step 3: Реранкинг   │
                    │  Cross-Encoder       │
                    │  → Top 3 Parents     │
                    └──────────┬───────────┘
                               ▼
                    ┌──────────────────────┐
                    │  Step 4: Генерация   │
                    │  LLM (Claude)        │
                    │  с 3 полными         │
                    │  документами         │
                    └──────────────────────┘
```

### Реализация на Python (LangChain)

```python
from langchain.retrievers import ParentDocumentRetriever
from langchain.storage import InMemoryStore
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.embeddings import OpenAIEmbeddings
from langchain.vectorstores import Chroma

# Создаём ParentDocumentRetriever
parent_splitter = RecursiveCharacterTextSplitter(
    chunk_size=2000,   # Родительские документы — крупные блоки
    chunk_overlap=200,
)

child_splitter = RecursiveCharacterTextSplitter(
    chunk_size=400,    # Дочерние чанки — мелкие, для точного поиска
    chunk_overlap=50,
)

# Хранилище: родительские документы в памяти (или в БД)
parent_store = InMemoryStore()

# Векторное хранилище: дочерние чанки
vectorstore = Chroma(
    collection_name="child_chunks",
    embedding_function=OpenAIEmbeddings()
)

retriever = ParentDocumentRetriever(
    vectorstore=vectorstore,
    docstore=parent_store,
    child_splitter=child_splitter,
    parent_splitter=parent_splitter,
)

# Добавляем документы
retriever.add_documents([
    "Страница 1 инструкции Shift 13...",
    "Страница 2 инструкции Shift 13...",
])

# Поиск — возвращает родительские документы
results = retriever.get_relevant_documents(
    "Максимальный DIN для Shift 13"
)
# results содержит полные страницы, а не мелкие чанки
```

### Реализация на TypeScript

```typescript
// services/parent-document-retriever.ts
interface Document {
  id: string;
  text: string;
  parentId: string;
}

interface ParentDocument {
  id: string;
  text: string;
  children: string[];
}

export class ParentDocumentRetriever {
  constructor(
    private vectorStore: VectorStore,
    private parentStore: Map<string, ParentDocument>,
    private reranker: CohereReranker
  ) {}

  async retrieve(
    query: string,
    options: { topK: number; rerankTopN: number }
  ) {
    // 1. Поиск дочерних чанков
    const childChunks = await this.vectorStore.searchSimilar(query, {
      limit: 20,
    });

    // 2. Извлечение уникальных родительских документов
    const parentIds = [...new Set(childChunks.map((c) => c.parentId))];
    const parentDocs = parentIds
      .map((id) => this.parentStore.get(id))
      .filter(Boolean) as ParentDocument[];

    // 3. Реранкинг родительских документов
    const reranked = await this.reranker.rerank({
      query,
      documents: parentDocs.map((d) => d.text),
      topN: options.rerankTopN,
    });

    // 4. Возврат топ-N
    return reranked.map((r) => ({
      text: r.text,
      score: r.score,
    }));
  }
}
```

---

## 10.5. Когда реранкинг не нужен

Реранкинг — мощный, но дорогой инструмент. Добавление Cross-Encoder увеличивает latency на 200–500 мс и стоимость каждого запроса. Он оправдан, когда:

| Сценарий | Реранкинг нужен? | Почему |
|----------|------------------|--------|
| FAQ с <50 документов | Нет | Высокоточный BM25 справляется |
| Поиск по миллионам документов | Да | Первичный поиск шумный |
| Юридические/медицинские ответы | Обязательно | Цена ошибки высока |
| Чат-бот для погоды | Нет | Достаточно простого поиска |

**Паттерн «условный реранкинг»:** Запускайте реранкер только если confidence score первичного поиска ниже порога.

```python
def conditional_rerank(query: str, docs: list[dict]) -> list[dict]:
    # Если топ-1 документ имеет высокую оценку — не реранкируем
    if len(docs) > 0 and docs[0].get("score", 0) > 0.92:
        return docs[:3]

    # Иначе — запускаем реранкер
    return reranker.rerank(query, docs, top_n=3)
```

---

## 💬 Каверзный вопрос на интервью

> *«Ваша RAG-система находит 20 потенциально полезных страниц руководства Salomon по гарантийному обслуживанию Gore-Tex. Однако Claude упорно утверждает, что информации о повреждениях мембраны в тексте нет, хотя она находится на 10-й странице переданного контекста. Как внедрение Cross-Encoder реранкера решает эту проблему архитектурно?»*

**Архитектурный разбор:**

1. **Корень проблемы:** Феномен Lost-in-the-Middle. Даже при 20 релевантных документах, LLM «теряет» информацию в середине контекста. В данном случае страница 10 из 20 — это середина, где точность извлечения падает до ~43%.

2. **Решение — реранкинг:** Cross-Encoder (Cohere Rerank) оценивает релевантность каждого документа относительно запроса до того, как документы попадут в контекст LLM. Из 20 документов выбираются 3–5 с наивысшей оценкой. Таким образом, релевантная страница гарантированно оказывается в начале или конце контекста.

3. **Дополнительно — Parent-Document Retriever:** Если информация о повреждениях мембраны размазана по нескольким мелким чанкам, ни один из них не будет достаточно релевантен сам по себе. Parent-Document Retriever возвращает целые страницы-родители, содержащие полный контекст. Реранкер уже оценивает полноценные страницы, а не мелкие фрагменты.

4. **Результат:** После реранкинга в контекст попадают **только** страницы 3, 10 и 15 — те, что реально нужны. Страница 10 теперь не «зажата» в середине 20 страниц, а является 2-й из 3 — модель её гарантированно «видит».

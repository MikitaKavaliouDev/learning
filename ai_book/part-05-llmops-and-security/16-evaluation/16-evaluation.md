# Глава 16: Системы оценки качества (Evaluation Harness)

> **Ментальная модель:** *Гидравлический стенд проверки прочности ботинок.* Роботизированная нога сгибает ботинок Salomon 50 000 раз в условиях экстремального холода и влажности, фиксируя любую микротрещину. Мы тестируем наши промпты и RAG-системы точно так же — автоматически прогоняя их через сотни сценариев, чтобы поймать регрессию до того, как её увидят пользователи.

## 16.1 Проблема: LLM-системы не тестируются как обычный код

Юнит-тесты проверяют, что функция `add(a, b)` возвращает `a + b`. Но что делать, если функция генерирует текст? Нельзя написать `assert response == "Здравствуйте!"`, потому что модель может ответить «Привет!», «Добрый день!» или «Рады вас видеть!» — и все ответы будут правильными.

LLM-системы требуют **оценочного тестирования (evaluation)**: мы не проверяем точное совпадение строк, а измеряем качество ответа по нескольким метрикам.

### 16.1.1 Что мы оцениваем

1. **Faithfulness (Достоверность):** Насколько ответ соответствует предоставленному контексту. Нет ли галлюцинаций?
2. **Answer Relevance (Релевантность):** Насколько ответ отвечает на вопрос пользователя.
3. **Context Recall (Полнота контекста):** Содержит ли найденный RAG-контекст достаточно информации для ответа?

## 16.2 Золотые наборы данных (Golden Datasets)

Основа любой системы оценки — **золотой набор данных**, созданный совместно с экспертами предметной области.

### 16.2.1 Структура золотого набора

```python
from pydantic import BaseModel
from typing import List

class EvalExample(BaseModel):
    """Один тестовый пример для оценки"""
    id: str
    question: str                    # Вопрос пользователя
    golden_answer: str               # Эталонный ответ (написан экспертом)
    expected_context: List[str]      # ID документов, которые должны быть найдены
    user_level: str                  # Уровень пользователя (beginner/intermediate/expert)
    category: str                    # Категория вопроса (boots/warranty/sizing)

class GoldenDataset(BaseModel):
    """Золотой набор данных"""
    version: str
    created_by: str
    examples: List[EvalExample]
    
    # Метаданные
    total_examples: int
    categories: List[str]
    coverage: dict  # Распределение по категориям

# Пример набора для Salomon
SALOMON_GOLDEN_SET = GoldenDataset(
    version="v1.2",
    created_by="AI Enablement Team + Product Experts",
    examples=[
        EvalExample(
            id="boots-001",
            question="Какие ботинки подойдут новичку для катания по подготовленным трассам?",
            golden_answer="Для начинающих рекомендую Salomon QST Access 80. "
                          "Они имеют мягкий флекс (жёсткость 80), удобную колодку "
                          "и систему Easy Step-In для лёгкого надевания.",
            expected_context=["qst-access-specs", "beginner-boot-guide"],
            user_level="beginner",
            category="boots"
        ),
        EvalExample(
            id="warranty-015",
            question="У меня разошёлся шов на куртке через месяц после покупки, что делать?",
            golden_answer="Это гарантийный случай. Пожалуйста, заполните форму возврата, "
                          "приложите фото дефекта и чек. Срок рассмотрения — 5 рабочих дней.",
            expected_context=["warranty-policy-2024", "return-process"],
            user_level="intermediate",
            category="warranty"
        ),
    ]
)
```

### 16.2.2 Сбор данных от экспертов

Эксперты Salomon (менеджеры по продукту, инженеры по качеству) пишут эталонные ответы — именно так, как должен отвечать идеальный ассистент. Эти ответы становятся «золотым стандартом» для автоматической оценки.

## 16.3 LLM-as-a-Judge

Методология **LLM-as-a-Judge** использует отдельную модель (например, Claude 3.5 Sonnet с жёстким системным промптом) для оценки ответов тестируемой системы.

### 16.3.1 Промпт для модели-судьи (Faithfulness)

```python
FAITHFULNESS_JUDGE_PROMPT = """
Ты — эксперт по оценке качества ответов AI-ассистентов.

Твоя задача: оценить, насколько ответ ассистента соответствует 
предоставленному контексту (Faithfulness).

Контекст (документы, которые были доступны ассистенту):
<context>
{context}
</context>

Вопрос пользователя:
<question>
{question}
</question>

Ответ ассистента:
<assistant_response>
{response}
</assistant_response>

Инструкции по оценке:
1. Каждое утверждение в ответе ассистента должно подтверждаться контекстом.
2. Если ассистент делает утверждение, которого нет в контексте — это нарушение faithfulness.
3. Если ассистент отказывается отвечать, когда в контексте есть информация — это нарушение.
4. Если ассистент говорит "я не знаю" и в контексте действительно нет информации — это НЕ нарушение.

Ответь строго в формате JSON:
{
    "score": <0.0 - 1.0>,
    "is_faithful": <true/false>,
    "violations": ["список конкретных утверждений, не подтверждённых контекстом"],
    "reasoning": "краткое обоснование оценки"
}
"""
```

### 16.3.2 Реализация пайплайна оценки на Python

```python
import json
import asyncio
from typing import List
from dataclasses import dataclass

@dataclass
class EvalResult:
    example_id: str
    question: str
    response: str
    faithfulness_score: float
    relevance_score: float
    context_recall_score: float
    violations: List[str]
    passed: bool

class EvalPipeline:
    """Пайплайн автоматической оценки RAG-системы"""
    
    def __init__(self, llm_client, judge_model: str = "claude-3-5-sonnet-20240620"):
        self.llm = llm_client
        self.judge_model = judge_model
    
    async def evaluate_single(
        self, example: dict, rag_response: str, retrieved_context: str
    ) -> EvalResult:
        """Оценивает один пример из золотого набора"""
        
        # 1. Оценка Faithfulness (достоверность)
        faithfulness = await self._judge_metric(
            FAITHFULNESS_JUDGE_PROMPT.format(
                context=retrieved_context,
                question=example["question"],
                response=rag_response
            )
        )
        
        # 2. Оценка Relevance (релевантность)
        relevance = await self._judge_metric(
            ANSWER_RELEVANCE_JUDGE_PROMPT.format(
                question=example["question"],
                response=rag_response
            )
        )
        
        # 3. Оценка Context Recall (полнота контекста)
        context_recall = await self._judge_metric(
            CONTEXT_RECALL_JUDGE_PROMPT.format(
                question=example["question"],
                golden_answer=example["golden_answer"],
                retrieved_context=retrieved_context
            )
        )
        
        # 4. Агрегированный результат
        avg_score = (faithfulness["score"] + relevance["score"] + context_recall["score"]) / 3
        
        return EvalResult(
            example_id=example["id"],
            question=example["question"],
            response=rag_response,
            faithfulness_score=faithfulness["score"],
            relevance_score=relevance["score"],
            context_recall_score=context_recall["score"],
            violations=faithfulness.get("violations", []),
            passed=avg_score >= 0.85  # Quality Gate: порог 85%
        )
    
    async def _judge_metric(self, prompt: str) -> dict:
        """Вызывает модель-судью и парсит JSON-ответ"""
        response = await self.llm.generate(
            model=self.judge_model,
            system="Ты — строгий судья. Отвечай только в формате JSON.",
            prompt=prompt,
            max_tokens=500
        )
        return json.loads(response.text)
    
    async def run_full_evaluation(
        self, golden_set: List[dict], rag_system
    ) -> List[EvalResult]:
        """Прогоняет весь золотой набор через RAG-систему и оценивает"""
        results = []
        
        for example in golden_set:
            # Получаем ответ от тестируемой RAG-системы
            rag_response, context = await rag_system.answer(example["question"])
            
            # Оцениваем
            result = await self.evaluate_single(example, rag_response, context)
            results.append(result)
        
        return results
```

### 16.3.3 Агрегированные метрики

```python
class EvalReport:
    """Отчёт по результатам оценки"""
    
    def __init__(self, results: List[EvalResult]):
        self.results = results
        self.total = len(results)
    
    @property
    def pass_rate(self) -> float:
        """Процент примеров, прошедших Quality Gate"""
        passed = sum(1 for r in self.results if r.passed)
        return passed / self.total if self.total > 0 else 0.0
    
    @property
    def avg_faithfulness(self) -> float:
        return sum(r.faithfulness_score for r in self.results) / self.total
    
    @property
    def avg_relevance(self) -> float:
        return sum(r.relevance_score for r in self.results) / self.total
    
    @property
    def avg_context_recall(self) -> float:
        return sum(r.context_recall_score for r in self.results) / self.total
    
    def get_category_breakdown(self) -> dict:
        """Разбивка по категориям"""
        breakdown = {}
        for r in self.results:
            cat = getattr(r, 'category', 'unknown')
            if cat not in breakdown:
                breakdown[cat] = []
            breakdown[cat].append(r.faithfulness_score)
        return {cat: sum(scores)/len(scores) for cat, scores in breakdown.items()}
    
    def print_summary(self):
        print(f"=== Evaluation Report ===")
        print(f"Pass Rate: {self.pass_rate:.1%} (threshold: 85%)")
        print(f"Avg Faithfulness: {self.avg_faithfulness:.3f}")
        print(f"Avg Relevance: {self.avg_relevance:.3f}")
        print(f"Avg Context Recall: {self.avg_context_recall:.3f}")
        print(f"Failed examples: {self.total - sum(1 for r in self.results if r.passed)}")
```

## 16.4 Интеграция в CI/CD

Оценка качества должна запускаться автоматически при каждом изменении промпта, RAG-пайплайна или модели.

### 16.4.1 GitHub Actions пайплайн

```yaml
# .github/workflows/eval-pipeline.yml
name: LLM Evaluation Pipeline

on:
  pull_request:
    paths:
      - 'prompts/**'
      - 'services/rag/**'
      - 'agent/**'

jobs:
  evaluate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: pip install -r requirements.txt
      
      - name: Run evaluation
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        run: |
          python scripts/run_evaluation.py \
            --golden-set data/golden_set_v1.2.json \
            --rag-endpoint http://localhost:8080 \
            --output-dir eval-results/ \
            --threshold 0.85
      
      - name: Check quality gate
        run: |
          PASS_RATE=$(python scripts/parse_results.py eval-results/summary.json)
          if (( $(echo "$PASS_RATE < 85" | bc -l) )); then
            echo "❌ Quality gate failed: pass rate $PASS_RATE% < 85%"
            exit 1
          fi
          echo "✅ Quality gate passed: $PASS_RATE%"
      
      - name: Upload evaluation report
        uses: actions/upload-artifact@v4
        with:
          name: eval-results
          path: eval-results/
```

### 16.4.2 JSON-отчёт для CI/CD

```python
import json

def generate_ci_report(results: List[EvalResult], output_path: str):
    """Генерирует отчёт в формате, понятном для CI/CD"""
    report = EvalReport(results)
    
    ci_report = {
        "version": "1.0",
        "timestamp": datetime.now().isoformat(),
        "summary": {
            "total_examples": report.total,
            "pass_rate": report.pass_rate,
            "quality_gate_threshold": 0.85,
            "quality_gate_passed": report.pass_rate >= 0.85,
        },
        "metrics": {
            "faithfulness": report.avg_faithfulness,
            "relevance": report.avg_relevance,
            "context_recall": report.avg_context_recall,
        },
        "failures": [
            {
                "id": r.example_id,
                "question": r.question,
                "faithfulness_score": r.faithfulness_score,
                "violations": r.violations
            }
            for r in results if not r.passed
        ],
        "category_breakdown": report.get_category_breakdown()
    }
    
    with open(output_path, 'w') as f:
        json.dump(ci_report, f, indent=2, ensure_ascii=False)
    
    return ci_report
```

## 16.5 Диагностика падения метрик: галлюцинация или предвзятость судьи?

Когда метрика Faithfulness внезапно падает, нужно определить причину. Проблема может быть в:

1. **Галлюцинации:** Модель действительно начала придумывать факты.
2. **Предвзятость судьи:** Модель-судья негативно реагирует на изменение стиля ответа (например, более вежливый тон).

### 16.5.1 Метод A/B тестирования судьи

```python
async def diagnose_judge_bias(
    llm_client,
    old_responses: List[dict],
    new_responses: List[dict],
    judge_prompt: str
) -> dict:
    """
    Диагностика: Предвзят ли судья?
    
    Если судья последовательно занижает оценки новым ответам,
    но человеческие эксперты не видят разницы в качестве — 
    значит, проблема в предвзятости судьи, а не в галлюцинациях.
    """
    old_scores = []
    new_scores = []
    
    # Оцениваем старые ответы
    for resp in old_responses:
        result = await llm_client.generate(
            model="claude-3-5-sonnet-20240620",
            system=judge_prompt,
            prompt=f"Question: {resp['question']}\nResponse: {resp['response']}"
        )
        old_scores.append(json.loads(result.text)["score"])
    
    # Оцениваем новые ответы
    for resp in new_responses:
        result = await llm_client.generate(
            model="claude-3-5-sonnet-20240620",
            system=judge_prompt,
            prompt=f"Question: {resp['question']}\nResponse: {resp['response']}"
        )
        new_scores.append(json.loads(result.text)["score"])
    
    old_avg = sum(old_scores) / len(old_scores)
    new_avg = sum(new_scores) / len(new_scores)
    
    # Привлекаем человека для верификации
    return {
        "old_system_avg_score": old_avg,
        "new_system_avg_score": new_avg,
        "score_drop": old_avg - new_avg,
        "suspected_judge_bias": (old_avg - new_avg) > 0.1,
        "recommendation": (
            "Требуется ручная проверка экспертами" 
            if (old_avg - new_avg) > 0.1
            else "Падение в пределах нормы"
        )
    }
```

## 💬 Каверзный вопрос на интервью

> *«Вы внесли изменения в системный промпт ассистента поддержки Salomon, чтобы сделать его более вежливым. Метрика Faithfulness (достоверность) на тестовом наборе внезапно упала на 20%. Как определить: действительно ли модель начала галлюцинировать или модель-судья (Judge) предвзято оценивает новую вежливую тональность? Опишите пошаговый процесс диагностики, включая A/B тестирование судьи и привлечение человеческих экспертов.»*

# Глава 12: Мультиагентные системы и графы состояний

> **Ментальная модель:** *Редакция новостной газеты.* Автор пишет черновик статьи, Редактор проверяет его и предлагает правки, а Факт-чекер верифицирует данные. Статья ходит по кругу между Автором и Редактором до тех пор, пока не достигает стандартов качества для публикации. Это не конвейер — это цикл с обратной связью.

## 12.1 От линейных цепочек к циклическим графам

Традиционные LLM-приложения строились как линейные цепочки (chains): запрос пользователя → RAG-поиск → генерация ответа. Каждый шаг передавал результат следующему, и поток данных никогда не возвращался назад.

Проблема в том, что реальные бизнес-процессы редко бывают линейными. Оформление гарантийного возврата в Salomon требует: проверить чек → классифицировать дефект → запросить подтверждение у менеджера → списать бонусы → создать этикетку возврата. Решение на каждом шаге влияет на предыдущие, и система должна уметь откатываться и пересчитывать маршрут.

### 12.1.1 Когда цепочки ломаются

```python
# Линейная цепочка — хрупкая и негибкая
def process_return_claim(claim_data: dict) -> str:
    classification = classify_defect(claim_data)
    approval = get_manager_approval(claim_data["user_id"])
    # Если approval == False, мы уже потратили токены на классификацию
    refund = process_refund(claim_data["order_id"])
    return refund
```

Здесь нет возможности вернуться назад, если менеджер отклонил заявку. Состояние не сохраняется, повторный запуск начинается с нуля.

### 12.1.2 State Graph — граф состояний

Вместо линейной цепочки мы строим **конечный автомат** — граф, где каждое состояние фиксирует прогресс, а переходы между состояниями определяются логикой, а не порядком в коде.

```
               [ Старт ]
                   │
                   ▼
         [ Классификация дефекта ]
                   │
          ┌────────┴────────┐
          ▼                 ▼
   [ Требуется аппрув ]  [ Стандартный возврат ]
          │                 │
          ▼                 ▼
   [ Ожидание менеджера ]  [ Списание бонусов ]
          │                 │
          └────────┬────────┘
                   ▼
          [ Создание этикетки ]
                   │
                   ▼
                [ Финиш ]
```

## 12.2 LangGraph — фреймворк для графов состояний

LangGraph (часть экосистемы LangChain) — это библиотека на Python, которая позволяет проектировать циклические графы для агентных систем. Узлы (Nodes) выполняют действия (вызов LLM, API, вычисления), а рёбра (Edges) определяют маршруты — условные переходы между узлами.

### 12.2.1 Базовые компоненты

- **State (Состояние):** Типизированный объект, который передаётся между узлами. Содержит все данные, накопленные за время выполнения графа.
- **Node (Узел):** Функция, которая принимает текущее состояние и возвращает обновлённое состояние. Может вызывать LLM, API, базу данных.
- **Edge (Ребро):** Связь между узлами. Может быть безусловной (всегда идти из A в B) или условной (выбор следующего узла на основе текущего состояния).

### 12.2.2 Реализация на Python (LangGraph)

```python
from typing import TypedDict, List, Literal
from langgraph.graph import StateGraph, END

# 1. Определяем структуру состояния
class AgentState(TypedDict):
    claim_text: str
    classification: str
    requires_approval: bool
    approval_status: bool
    refund_processed: bool
    errors: List[str]

# 2. Определяем узлы
def classify_claim(state: AgentState) -> AgentState:
    """Классифицирует гарантийный случай"""
    llm_response = llm.invoke(
        f"Классифицируй дефект: {state['claim_text']}"
    )
    state["classification"] = llm_response.text
    state["requires_approval"] = "возврат_денег" in state["classification"]
    return state

def request_approval(state: AgentState) -> AgentState:
    """Отправляет запрос на утверждение менеджеру"""
    approval = human_approval_gate(state["claim_text"])
    state["approval_status"] = approval
    return state

def process_refund(state: AgentState) -> AgentState:
    """Списывает бонусы и создаёт возврат"""
    state["refund_processed"] = True
    return state

# 3. Определяем условные рёбра
def router(state: AgentState) -> Literal["request_approval", "process_refund"]:
    """Определяет, нужен ли аппрув менеджера"""
    if state["requires_approval"]:
        return "request_approval"
    return "process_refund"

def approval_router(state: AgentState) -> Literal["process_refund", "classify_claim"]:
    """Если менеджер отклонил — возвращаем на классификацию"""
    if state["approval_status"]:
        return "process_refund"
    # Откат: возвращаемся к классификации с исправленными данными
    return "classify_claim"

# 4. Строим граф
workflow = StateGraph(AgentState)
workflow.add_node("classify_claim", classify_claim)
workflow.add_node("request_approval", request_approval)
workflow.add_node("process_refund", process_refund)

workflow.set_entry_point("classify_claim")
workflow.add_conditional_edges(
    "classify_claim",
    router,
    {"request_approval": "request_approval", "process_refund": "process_refund"}
)
workflow.add_conditional_edges(
    "request_approval",
    approval_router,
    {"process_refund": "process_refund", "classify_claim": "classify_claim"}
)
workflow.add_edge("process_refund", END)

# 5. Компилируем и запускаем
app = workflow.compile()
result = app.invoke({
    "claim_text": "Молния на куртке сломалась через неделю после покупки",
    "errors": []
})
```

## 12.3 Паттерн Circuit Breaker для агентных циклов

Главный враг агентных систем — **бесконечный цикл**. Агент запрашивает инструмент → получает ошибку → запрашивает тот же инструмент с теми же параметрами → снова ошибка → и так до исчерпания лимита токенов.

Это не гипотетическая проблема. В реальных инцидентах Writer-Critic связка может прогнать один и тот же параграф через API 500 раз за 2 минуты, нагенерировав счёт на сотни долларов, прежде чем сработает ручной лимит бюджета AWS.

### 12.3.1 Реализация предохранителя

```python
from datetime import datetime, timedelta

class CircuitBreaker:
    """Предохранитель для агентных циклов"""
    
    def __init__(self, max_iterations: int = 10, window_seconds: int = 60):
        self.max_iterations = max_iterations
        self.window_start = datetime.now()
        self.iteration_count = 0
        self.open = False
    
    def call(self, node_name: str):
        """Проверяет, можно ли выполнить узел"""
        if self.open:
            raise RuntimeError(
                f"Circuit breaker разомкнут: {node_name} превысил лимит"
            )
        
        now = datetime.now()
        if now - self.window_start > timedelta(seconds=self.window_seconds):
            self.iteration_count = 0
            self.window_start = now
        
        self.iteration_count += 1
        if self.iteration_count > self.max_iterations:
            self.open = True
            raise RuntimeError(
                f"Circuit breaker разомкнут: {self.max_iterations} "
                f"итераций за {self.window_seconds}с"
            )

# Интеграция в граф
def safe_node_execution(state: AgentState, node_fn, breaker: CircuitBreaker):
    try:
        breaker.call(node_fn.__name__)
        return node_fn(state)
    except RuntimeError as e:
        state["errors"].append(str(e))
        return state
```

### 12.3.2 Практические стратегии защиты

1. **Счётчик итераций:** Каждый узел увеличивает счётчик. При превышении лимита (например, 5 вызовов одного инструмента подряд) граф переходит в состояние `error` и завершается аварийно.
2. **Лимит токенов:** Отслеживание суммарного количества токенов, потраченных на сессию. При превышении бюджета (например, $0.50 за диалог) — остановка.
3. **Тайм-аут узла:** Каждый вызов LLM оборачивается в `asyncio.wait_for()` с тайм-аутом 30 секунд.
4. **Дедупликация параметров:** Если агент вызывает один и тот же инструмент с идентичными параметрами трижды подряд — прерываем цикл.

## 12.4 Интеграция Human-in-the-Loop в граф

Критические операции (списание денег, удаление данных, изменение статуса заказа) требуют подтверждения человеком. В LangGraph это реализуется через специальные узлы-прерывания:

```python
def human_approval_gate(context: str) -> bool:
    """Отправляет запрос менеджеру через Slack/email и ждёт ответа"""
    approval_request = create_slack_message(
        channel="#manager-approvals",
        text=f"Требуется подтверждение операции:\n{context}"
    )
    response = wait_for_slack_response(approval_request, timeout_minutes=15)
    return response.get("approved", False)
```

Граф приостанавливает выполнение на узле `human_approval_gate` и сохраняет своё состояние в базу данных. Когда менеджер отвечает, граф загружает сохранённое состояние и продолжает выполнение с того же места.

## 💬 Каверзный вопрос на интервью

> *«Ваш Writer Agent и Critic Agent зациклились: они правили один и тот же абзац 500 раз за 2 минуты. Счёт за API Claude вырос до $500, прежде чем вы заметили проблему. Как спроектировать паттерн "Circuit Breaker" прямо в рёбрах графа состояний, чтобы предотвратить такие петли? Какие метрики вы будете отслеживать — количество итераций, потраченные токены, время выполнения? Напишите псевдокод предохранителя, который останавливает граф до того, как бюджет будет превышен.»*

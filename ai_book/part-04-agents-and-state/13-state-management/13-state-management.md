# Глава 13: Управление состоянием и отказоустойчивость агентов

> **Ментальная модель:** *Сохранение игры на чекпоинте.* Когда персонаж в видеоигре проходит сложное подземелье и внезапно отключается электричество, игрок не возвращается в самое начало игры. Он загружает последний автоматический чекпоинт. Наши агенты должны восстанавливать контекст диалога после любых сбоев так же бесшовно.

## 13.1 Проблема: агенты без памяти — это игрушки

Линейные цепочки (chains) не сохраняют состояние между вызовами. Если сервер упал на середине обработки гарантийного заявления Salomon, пользователь вынужден начинать диалог с нуля — пересылать фото дефекта, повторять номер заказа, объяснять суть проблемы. Это приводит к оттоку клиентов и потере доверия.

**Ключевое требование:** агентная система должна фиксировать своё состояние **после каждого шага**, а не только в конце. Если что-то пошло не так, мы загружаем последний чекпоинт и продолжаем с того же места.

### 13.1.1 Что такое состояние агента

Состояние агента — это полный слепок всех данных, которые агент накопил к текущему моменту:

```python
from typing import TypedDict, List

class CheckpointerState(TypedDict):
    session_id: str                    # ID сессии пользователя
    user_id: str                       # ID пользователя
    current_step: str                  # Текущий шаг в графе
    messages: List[dict]               # История сообщений
    accumulated_data: dict             # Собранные данные (чек, фото, адрес)
    tool_results: List[dict]           # Результаты вызова инструментов
    error_log: List[str]               # Лог ошибок
    created_at: str                    # Время создания чекпоинта
    version: int                       # Версия состояния (для отката)
```

## 13.2 Архитектура чекпоинтера

Чекпоинтер — это компонент, который сериализует состояние агента и сохраняет его в постоянное хранилище. Каждый раз, когда граф завершает выполнение узла, чекпоинтер фиксирует новое состояние.

### 13.2.1 In-Memory чекпоинтер (для разработки)

```python
from datetime import datetime

class InMemoryCheckpointer:
    """Простой чекпоинтер в памяти — для тестов, НЕ для продакшена"""
    
    def __init__(self):
        self._checkpoints: dict = {}
    
    def save(self, state: dict) -> str:
        checkpoint_id = f"cp_{datetime.now().timestamp()}"
        self._checkpoints[checkpoint_id] = {
            "state": state.copy(),
            "created_at": datetime.now().isoformat()
        }
        return checkpoint_id
    
    def load(self, checkpoint_id: str) -> dict:
        return self._checkpoints.get(checkpoint_id, {}).get("state")
    
    def list_versions(self, session_id: str) -> List[str]:
        return [k for k in self._checkpoints if session_id in k]
```

**Почему in-memory — не продакшен:** При перезапуске контейнера (Kubernetes, Out-of-Memory, деплой) все данные теряются. In-memory чекпоинтер подходит только для локальной разработки и интеграционных тестов.

### 13.2.2 PostgreSQL чекпоинтер с PostgresSaver

В продакшене состояние должно храниться в надёжной реляционной базе данных. LangGraph поддерживает `PostgresSaver` — чекпоинтер с версионированием на основе PostgreSQL.

```python
import asyncpg
from langgraph.checkpoint.postgres import PostgresSaver

class ProductionCheckpointer:
    """Чекпоинтер для продакшена — PostgreSQL с версионированием"""
    
    def __init__(self, connection_string: str):
        self.connection_string = connection_string
        self._pool = None
    
    async def connect(self):
        self._pool = await asyncpg.create_pool(self.connection_string)
        # Создаём таблицу для чекпоинтов
        await self._pool.execute("""
            CREATE TABLE IF NOT EXISTS agent_checkpoints (
                checkpoint_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                session_id VARCHAR(255) NOT NULL,
                thread_id VARCHAR(255) NOT NULL,
                state JSONB NOT NULL,
                parent_checkpoint_id UUID REFERENCES agent_checkpoints(checkpoint_id),
                version INTEGER NOT NULL DEFAULT 1,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                UNIQUE(session_id, thread_id, version)
            );
            CREATE INDEX IF NOT EXISTS idx_checkpoints_session 
                ON agent_checkpoints(session_id, thread_id);
        """)
    
    async def save_checkpoint(self, session_id: str, thread_id: str, state: dict) -> str:
        """Сохраняет чекпоинт и возвращает его ID"""
        async with self._pool.acquire() as conn:
            # Получаем текущую версию
            row = await conn.fetchrow(
                "SELECT MAX(version) as max_v FROM agent_checkpoints "
                "WHERE session_id = $1 AND thread_id = $2",
                session_id, thread_id
            )
            version = (row["max_v"] or 0) + 1
            
            checkpoint_id = await conn.fetchval(
                "INSERT INTO agent_checkpoints "
                "(session_id, thread_id, state, version) "
                "VALUES ($1, $2, $3::jsonb, $4) RETURNING checkpoint_id",
                session_id, thread_id, state, version
            )
            return str(checkpoint_id)
    
    async def load_checkpoint(self, session_id: str, thread_id: str) -> dict:
        """Загружает последний чекпоинт сессии"""
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT state FROM agent_checkpoints "
                "WHERE session_id = $1 AND thread_id = $2 "
                "ORDER BY version DESC LIMIT 1",
                session_id, thread_id
            )
            return row["state"] if row else {}
    
    async def get_checkpoint_by_version(self, session_id: str, thread_id: str, version: int) -> dict:
        """Загрузка конкретной версии — для отката"""
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT state FROM agent_checkpoints "
                "WHERE session_id = $1 AND thread_id = $2 AND version = $3",
                session_id, thread_id, version
            )
            return row["state"] if row else {}
```

### 13.2.3 Схема версионирования

Каждое изменение состояния создаёт новую **версию**. Это даёт суперспособность: мы можем откатить агента на любой предыдущий шаг.

```
Версия 1: [Классификация дефекта]
Версия 2: [Запрос аппрува у менеджера]
Версия 3: [Аппрув получен, списание бонусов]  ← Текущее состояние
Версия 4: [Ошибка: API CRM вернул 500]        ← Ошибка

Откат на версию 2 → исправление параметров → повторный запуск
```

## 13.3 Идемпотентность: гарантия «не более одного раза»

Идемпотентность — это свойство операции, при котором повторное выполнение даёт тот же результат, что и однократное. В мире агентов это критично: если контейнер упал во время списания бонусов, повторный запуск не должен списать их дважды.

### 13.3.1 Паттерн «проверить-прежде-чем-выполнить»

```python
class IdempotentOperation:
    """Обёртка для идемпотентного выполнения операций"""
    
    def __init__(self, checkpointer: ProductionCheckpointer):
        self.checkpointer = checkpointer
    
    async def execute_once(self, operation_id: str, operation_fn):
        """
        Выполняет операцию только если она ещё не была выполнена.
        operation_id должен быть детерминированным (session_id + шаг графа).
        """
        # 1. Проверяем, выполнялась ли операция
        existing = await self.checkpointer.load_checkpoint(
            operation_id, "operations"
        )
        if existing and existing.get("status") == "completed":
            logger.info(f"Операция {operation_id} уже выполнена, пропускаем")
            return existing.get("result")
        
        # 2. Блокируем операцию (чтобы два параллельных вызова не выполнили её дважды)
        locked = await self.acquire_lock(operation_id)
        if not locked:
            raise RuntimeError(f"Операция {operation_id} уже выполняется другим процессом")
        
        try:
            # 3. Выполняем
            result = await operation_fn()
            
            # 4. Сохраняем результат
            await self.checkpointer.save_checkpoint(
                operation_id, "operations",
                {"status": "completed", "result": result}
            )
            return result
        finally:
            await self.release_lock(operation_id)
```

## 13.4 Краткосрочная и долгосрочная память

В сложных диалогах агент должен различать:

- **Краткосрочная память (Short-term context):** Текущий разговор. Что пользователь сказал в этой сессии? Какие инструменты уже вызваны?
- **Долгосрочная память (Long-term memory):** История пользователя за недели. Какие товары он уже смотрел? Какие гарантийные случаи открывал?

### 13.4.1 Разделение хранилищ

```python
class MemoryManager:
    """Управление краткосрочной и долгосрочной памятью"""
    
    def __init__(self, pg_pool):
        self.pg_pool = pg_pool
    
    async def save_short_term(self, session_id: str, step_data: dict):
        """Текущий шаг диалога — живёт до завершения сессии"""
        async with self.pg_pool.acquire() as conn:
            await conn.execute(
                "UPDATE sessions SET current_step_data = $1::jsonb "
                "WHERE session_id = $2",
                step_data, session_id
            )
    
    async def save_long_term(self, user_id: str, fact: dict):
        """
        Долгосрочный факт о пользователе — сохраняется между сессиями.
        Пример: пользователь предпочитает ботинки с жёсткостью 110-120.
        """
        async with self.pg_pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO user_profile (user_id, facts) "
                "VALUES ($1, $2::jsonb) "
                "ON CONFLICT (user_id) DO UPDATE "
                "SET facts = user_profile.facts || $2::jsonb, "
                "updated_at = NOW()",
                user_id, fact
            )
    
    async def summarize_and_compress(self, session_id: str):
        """
        Когда сессия завершена — сжимаем краткосрочную память 
        в саммари для долгосрочной.
        """
        session_data = await self._get_full_session(session_id)
        
        # Используем LLM для суммаризации
        summary = await llm.invoke(
            "Суммируй ключевые факты этого диалога: {session_data}"
        )
        
        await self.save_long_term(
            session_data["user_id"],
            {"session_summary": summary.text, "date": datetime.now().isoformat()}
        )
```

## 💬 Каверзный вопрос на интервью

> *«Пользователь оформлял возврат горнолыжного костюма по гарантии. Агент уже начал списывать бонусы в CRM, но в этот момент контейнер приложения был принудительно перезапущен Kubernetes по превышению лимита памяти. Пользователь обновляет страницу. Как спроектировать схему сохранения состояния (State Persistence), чтобы транзакция не потерялась и не выполнилась дважды? Опишите структуру таблицы чекпоинтов, механизм блокировок и логику восстановления.»*

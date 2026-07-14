
## Pattern 1: Automatic Bubbling (Letting it Rise)

The simplest and most common approach is to do nothing in your low-level functions and let the exception bubble up naturally to your high-level worker or orchestrator.

### ⚠️ A Critical Python Detail: `BaseException`
Starting in Python 3.8, `asyncio.CancelledError` inherits from **`BaseException`** instead of `Exception`. 

This is highly beneficial: if you write `except Exception:` in your low-level code, **you will not accidentally catch or swallow the cancellation signal**. It bypasses standard error handlers and travels straight to your top-level worker task:

```python
# Low-level function (No try/except needed!)
async def fetch_llm_data():
    # If cancelled, the error is raised here, bypasses any 'except Exception' 
    # blocks below, and bubbles up to the caller automatically.
    try:
        response = await client.post("https://api.openai.com/v1/...")
        return response
    except ValueError:
        print("This only catches standard value errors, not cancellation!")
        raise
```

---

## Pattern 2: Context Managers (The Most Pythonic Way)

If a low-level function initializes resources (like a database transaction or temporary file) that must be cleaned up if cancelled, the most robust pattern is to use an **asynchronous context manager (`async with`)**.

If a task is cancelled while running inside an `async with` block, Python guarantees that the block's exit hook (`__aexit__`) will execute. This handles the cleanup automatically without any explicit `try/except` blocks in your function:

```python
from contextlib import asynccontextmanager

# 1. Create a reusable, cancellation-safe resource manager
@asynccontextmanager
async def database_transaction(session):
    try:
        yield session # Hand execution back to the function
        await session.commit()
    except BaseException:
        # If cancelled (or if an error occurs), roll back the transaction
        print("Rolling back transaction due to cancellation or error...")
        await session.rollback()
        raise

# 2. Use it in your functions
async def save_user_history(session, user_id, message):
    # If the container shuts down during this write, rollback is triggered automatically!
    async with database_transaction(session):
        await session.write_to_db(user_id, message)
```

---

## Pattern 3: Decorators (For Telemetry, Logging, & Metrics)

If you want to track when tasks are cancelled (for example, to increment a Prometheus metric or log telemetry), a **decorator** is an excellent choice. 

### Python Decorator Implementation
```python
import asyncio
from functools import wraps

def track_cancellation(metric_name: str):
    """Decorator to log and track when an async function is cancelled."""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            try:
                return await func(*args, **kwargs)
            except asyncio.CancelledError:
                # Intercept the cancellation for logging/metrics
                print(f"METRIC: Task '{func.__name__}' was cancelled. Incrementing count for: {metric_name}")
                
                # Crucial: You MUST re-raise CancelledError to let the task system
                # know this task has cooperatively acknowledged termination.
                raise 
        return wrapper
    return decorator

# Applying the decorator
@track_cancellation(metric_name="llm_request_cancelled_total")
async def fetch_llm_data():
    response = await client.post("https://api.openai.com/v1/...")
    return response
```

### The Limitation of Decorators
While decorators are perfect for logging and monitoring, they have a major limitation: **they do not have access to the local scope variables inside the function**. 

If your function creates a local variable (like opening a file handler midway through the code) and you need to close *that specific* file, a decorator wrapping the outside of the function cannot see it. For resource-specific cleanup, use **Context Managers (Pattern 2)**.

---

## ⚖️ Design Decision Matrix

| Use Case | Recommended Pattern | Why? |
| :--- | :--- | :--- |
| **Simple queries/API calls** | **Pattern 1: Bubbling** | No cleanup is needed; letting it bubble to the top keeps your code clean. |
| **DB Transactions, Sockets, Files** | **Pattern 2: Context Managers** | Guarantees resource cleanup (`__aexit__` is called) even during sudden cancellations. |
| **Metrics, Tracing, Logging** | **Pattern 3: Decorators** | Decouples logging and telemetry logic from your core business logic. |
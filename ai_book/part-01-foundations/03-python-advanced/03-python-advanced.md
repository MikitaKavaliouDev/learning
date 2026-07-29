# Chapter 3: Advanced Python Features for AI Engineering

Python's power in AI engineering comes not just from its ecosystem, but from the language features that enable clean abstraction, resource safety, and dynamic behavior. This chapter covers four essential advanced features: decorators, context managers and generators, metaclasses and descriptors, and structural pattern matching. Each is a tool you will reach for daily when building production AI systems.

---

## Decorators: The Custom Gift Wrap

### The Mental Model: The Gift Box

Imagine you have a plain cardboard box (your original function). You want to add security tagging or a shipping label (additional behavior) to it. Instead of tearing the box open and rebuilding it, you put the box inside a wrapper.

A decorator in Python is a function that takes another function as an argument, wraps it with extra behavior (like logging, authentication, or caching), and returns the newly wrapped function.

### Anatomy of a Decorator

```python
from functools import wraps
from typing import Callable, Any

def log_decorator(func: Callable) -> Callable:
    """Wraps a function with logging before and after execution."""
    @wraps(func)  # Preserves the original function's metadata (name, docstring)
    def wrapper(*args, **kwargs):
        print(f"[LOG] Calling {func.__name__} with args={args}, kwargs={kwargs}")
        result = func(*args, **kwargs)
        print(f"[LOG] {func.__name__} returned: {result}")
        return result
    return wrapper

@log_decorator
def calculate_total(price: float, tax: float) -> float:
    """Computes the total price including tax."""
    return price + tax

# Calling the function automatically triggers the wrapper
calculate_total(100, 15)
# Output:
# [LOG] Calling calculate_total with args=(100, 15), kwargs={}
# [LOG] calculate_total returned: 115
```

The `@wraps(func)` decorator is critical — without it, the wrapped function would lose its `__name__` and `__doc__`, breaking introspection tools and documentation generators.

### The `@` Syntax Sugar

The `@` symbol is syntactic sugar. These two are equivalent:

```python
# Using decorator syntax
@log_decorator
def greet(name: str) -> str:
    return f"Hello, {name}!"

# Manual wrapping (equivalent)
def greet(name: str) -> str:
    return f"Hello, {name}!"
greet = log_decorator(greet)
```

### Decorators with Arguments

When a decorator itself needs parameters, we add another layer of nesting:

```python
from functools import wraps

def retry(max_attempts: int = 3, delay: float = 1.0):
    """Decorator factory: retries a function up to max_attempts times."""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            import time
            for attempt in range(max_attempts):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    if attempt == max_attempts - 1:
                        raise
                    print(f"Attempt {attempt + 1} failed: {e}. Retrying in {delay}s...")
                    time.sleep(delay)
        return wrapper
    return decorator

@retry(max_attempts=3, delay=0.5)
def call_llm_api(prompt: str) -> str:
    # Simulated API call that may fail
    ...
```

### Real-World AI Use Cases for Decorators

- **Caching LLM responses**: Memoize identical prompts to avoid redundant API calls.
- **Rate limiting**: Enforce API call quotas per user or per minute.
- **Input validation**: Verify prompt structure before sending to the model.
- **Timing and metrics**: Record latency of every LLM call for observability.

```python
import time
from functools import wraps
from typing import Callable, Any

def latency_timer(metric_name: str):
    """Records execution time for observability."""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            start = time.perf_counter()
            try:
                return await func(*args, **kwargs)
            finally:
                duration = time.perf_counter() - start
                # In production: send to Prometheus / Datadog
                print(f"METRIC {metric_name}: {duration:.3f}s")
        return async_wrapper
    return decorator

@latency_timer(metric_name="llm_openai_completion")
async def get_completion(prompt: str) -> str:
    # ... actual API call
    ...
```

---

## Context Managers and Generators: Resource Safety

### The Mental Model: The PEZ Dispenser

Imagine you have a box of 1,000 candies:

- **The List Approach:** You dump all 1,000 candies onto the table at once. This requires a lot of space (RAM). If you only end up eating 3 of them, you still wasted space preparing the whole pile.
- **The Generator Approach:** You use a PEZ dispenser. The candies stay hidden inside. You only pop out one candy (using `yield`) when you are ready to eat it. The memory used at any single moment is only ever equal to one single candy.

### Context Managers with `with`

The `with` statement guarantees that a resource is cleaned up immediately when the block exits, even if an exception is thrown:

```python
# Without context manager: manual cleanup
file = open("data.txt", "r")
try:
    data = file.read()
finally:
    file.close()  # Easy to forget

# With context manager: automatic cleanup
with open("data.txt", "r") as file:
    data = file.read()
# File is closed automatically here
```

### Creating Custom Context Managers

You can create your own context manager using the `contextlib` module:

```python
from contextlib import contextmanager

@contextmanager
def managed_llm_session(api_key: str):
    """Context manager that handles LLM client lifecycle."""
    print("Opening LLM session...")
    client = {"api_key": api_key, "connected": True}
    try:
        yield client  # Hand execution to the 'with' block
    finally:
        print("Closing LLM session...")
        client["connected"] = False

# Usage
with managed_llm_session("sk-...") as client:
    # Use client inside this block
    response = client.get("model list")
# Session is automatically closed after the block
```

### Async Context Managers

For AI workloads with network connections, use async context managers:

```python
from contextlib import asynccontextmanager
import httpx

@asynccontextmanager
async def httpx_client_pool(max_connections: int = 10):
    """Async context manager for HTTPX connection pool."""
    limits = httpx.Limits(max_connections=max_connections)
    async with httpx.AsyncClient(limits=limits) as client:
        yield client

# Usage
async with httpx_client_pool(max_connections=50) as client:
    response = await client.post("https://api.openai.com/v1/...")
```

### Generators for Memory-Efficient Processing

A generator is created by using `yield` instead of `return`:

```python
from typing import Generator

def read_large_file(file_path: str) -> Generator[str, None, None]:
    """Reads a file line-by-line without loading it entirely into memory."""
    with open(file_path, "r") as file:
        for line in file:
            yield line.strip()

# Consuming the generator
for line in read_large_file("million_documents.txt"):
    process_line(line)  # Only ONE line in memory at a time
```

### Async Generators for Token Streaming

For streaming LLM responses, we combine async with generators:

```python
from typing import AsyncGenerator

async def token_stream(prompt: str) -> AsyncGenerator[str, None]:
    """Yields tokens as they arrive from the LLM."""
    # Simulated streaming from an API
    for token in ["The", "quick", "brown", "fox"]:
        await asyncio.sleep(0.1)  # Simulate network delay
        yield token

async def main():
    async for token in token_stream("Write a sentence"):
        print(token, end=" ", flush=True)
```

### The `else` Block in Exception Handling

Python's `try/except/else/finally` provides precise error boundaries:

```python
try:
    # 1. Run the risky code
    response = make_llm_api_call(prompt)
except ConnectionError:
    # 2. Run this ONLY if a connection error occurred
    fallback_to_local_model()
else:
    # 3. Run this ONLY if NO error occurred
    # Isolated from the risky code — exceptions here are NOT caught by except
    validate_and_store(response)
finally:
    # 4. Always run this (close connections)
    close_client()
```

The `else` block prevents exceptions in your processing logic from being accidentally caught by the `except` block.

### Mutable Default Arguments: The Legendary Python Trap

Default arguments are evaluated **once** at function definition time, not at call time:

```python
# WARNING: Anti-pattern
def add_to_history(message: str, history: list = []):
    history.append(message)
    return history

print(add_to_history("First"))    # Output: ["First"]
print(add_to_history("Second"))   # Output: ["First", "Second"]
print(add_to_history("Third"))    # Output: ["First", "Second", "Third"]
```

**The fix:** Use `None` and initialize inside the function:

```python
def add_to_history(message: str, history: list = None) -> list:
    if history is None:
        history = []  # Created afresh on each call
    history.append(message)
    return history
```

---

## Metaclasses and Descriptors: Controlling Class Creation

### The Mental Model: The Blueprint-Generating Machine

Instead of manually drawing blueprints for every new house (writing custom classes), we build a master blueprint generator (a metaclass). Every time an architect submits a plan, the generator intercepts it, automatically injects fire escape specs (attributes), and validates safety requirements before construction begins.

### `__new__` vs. `__init__`: The Two-Step Object Creation

In Python, class instantiation is a two-step process:

```
       1. Memory Allocation                 2. Initialization
Class ───────────► __new__(cls) ──► Instance ──────────► __init__(self)
```

1. **`__new__(cls, ...)` is the Allocator:** It is a static method responsible for creating and returning a new instance of the class.
2. **`__init__(self, ...)` is the Initializer:** It configures the newly created instance and returns nothing (`None`).

#### When to Override `__new__`

**Scenario A: Subclassing immutable types**

```python
class UppercaseString(str):
    def __new__(cls, value: str):
        # Immutable types must be modified during allocation
        uppercase_value = value.upper()
        return super().__new__(cls, uppercase_value)

my_str = UppercaseString("hello")
print(my_str)  # Output: HELLO
```

**Scenario B: The Singleton Pattern**

```python
class DatabaseConnectionPool:
    _instance = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
```

### Python Descriptors

Descriptors are classes that implement `__get__`, `__set__`, or `__delete__` methods. They intercept attribute access on other classes.

```python
from typing import Any

class ValidatedAttribute:
    """A descriptor that validates attribute values."""

    def __init__(self, validator: callable):
        self.validator = validator
        self.data = {}

    def __get__(self, obj: Any, objtype: type = None) -> Any:
        if obj is None:
            return self
        return self.data.get(id(obj), None)

    def __set__(self, obj: Any, value: Any) -> None:
        # Validate before setting
        if not self.validator(value):
            raise ValueError(f"Invalid value: {value}")
        self.data[id(obj)] = value

    def __delete__(self, obj: Any) -> None:
        del self.data[id(obj)]

# Usage in a model config class
class LLMConfig:
    temperature = ValidatedAttribute(lambda v: 0.0 <= v <= 2.0)
    max_tokens = ValidatedAttribute(lambda v: 1 <= v <= 128_000)

    def __init__(self, temperature: float, max_tokens: int):
        self.temperature = temperature  # Goes through __set__
        self.max_tokens = max_tokens

config = LLMConfig(temperature=0.7, max_tokens=4096)
config.temperature = 5.0  # Raises ValueError! Outside [0, 2]
```

This is the mechanism behind Python's `@property`, Pydantic's validators, and ORM field descriptors.

### Metaclasses: Class Factories

A metaclass is a class for creating classes. Just as a class defines the behavior of instances, a metaclass defines the behavior of classes.

```python
from typing import Dict, Any

class AgentRegistry(type):
    """Metaclass that auto-registers all subclasses into an agent catalog."""
    registry: Dict[str, type] = {}

    def __new__(mcs, name: str, bases: tuple, namespace: dict) -> type:
        cls = super().__new__(mcs, name, bases, namespace)
        # Auto-register any non-base class
        if name != "BaseAgent":
            AgentRegistry.registry[name] = cls
        return cls

class BaseAgent(metaclass=AgentRegistry):
    """All agents inherit from this and are auto-registered."""

class SummarizerAgent(BaseAgent):
    def run(self, task: str) -> str:
        return f"Summarized: {task}"

class TranslatorAgent(BaseAgent):
    def run(self, task: str) -> str:
        return f"Translated: {task}"

# Auto-discovery without manual imports!
print(AgentRegistry.registry)
# Output: {'SummarizerAgent': <class ...>, 'TranslatorAgent': <class ...>}

# Dynamic instantiation
agent_type = AgentRegistry.registry["SummarizerAgent"]
agent = agent_type()
print(agent.run("Long document..."))
```

This pattern is invaluable for AI agent frameworks where you want plugins and tools to auto-register without manual configuration.

---

## Structural Pattern Matching: Routing LLM Responses

Python 3.10 introduced `match/case` — structural pattern matching that goes far beyond simple switch statements. It is exceptionally useful for routing and parsing LLM responses.

### The Mental Model: The Postal Sorting Office

Incoming packages (LLM responses) arrive in various shapes and sizes. Instead of manually inspecting each one with if/elif chains, you have automated sorting chutes that match on shape, weight, and label — routing each package to the correct department without explicit conditionals.

### Basic Pattern Matching

```python
def route_llm_response(response: dict) -> str:
    """Routes an LLM response based on its structure."""
    match response:
        case {"type": "text", "content": str(content)}:
            return f"Text response: {content[:50]}..."
        case {"type": "tool_call", "tool": str(tool), "args": dict(args)}:
            return f"Tool call: {tool}({args})"
        case {"type": "error", "code": int(code)}:
            return f"Error code: {code}"
        case {"type": "stream_end", "usage": dict(usage)}:
            return f"Stream ended. Tokens: {usage.get('total_tokens', 'unknown')}"
        case _:
            return "Unknown response format"
```

### Guard Patterns with Conditions

You can add `if` guards to refine matching:

```python
def handle_llm_error(response: dict) -> str:
    match response:
        case {"status": code, "error": msg} if code >= 500:
            return f"Server error: {msg} — will retry"
        case {"status": code, "error": msg} if code == 429:
            return f"Rate limited — backing off"
        case {"status": code, "error": msg} if code == 400:
            return f"Bad request: {msg} — check prompt"
        case _:
            return "Unknown error"
```

### Matching Multiple Patterns

```python
def classify_llm_output(output: dict) -> str:
    """Classify what kind of response the LLM generated."""
    match output:
        case {"choices": [{"finish_reason": "stop", **rest}]}:
            return "Complete response"
        case {"choices": [{"finish_reason": "length", **rest}]}:
            return "Truncated — max_tokens reached"
        case {"choices": [{"finish_reason": "content_filter", **rest}]}:
            return "Blocked by content filter"
        case {"error": {"code": "insufficient_quota"}}:
            return "API quota exhausted"
        case _:
            return "Unknown"
```

### Matching Sequences

```python
def identify_prompt_template(messages: list) -> str:
    """Identify which prompt template was used from the message history."""
    match messages:
        case [{"role": "system", "content": _}] as msgs:
            return "Simple system prompt"
        case [{"role": "system", "content": _},
              *mid,
              {"role": "user", "content": _}] if mid:
            return "Multi-turn conversation with system prompt"
        case [{"role": "user", "content": _},
              {"role": "assistant", "content": _},
              *rest] if rest:
            return "Follow-up conversation"
        case _:
            return "Unknown format"
```

### Why Pattern Matching Matters for AI

Traditional if/elif chains become brittle when LLM response formats evolve. Pattern matching gives you:

- **Exhaustiveness checking:** The compiler/interpreter can warn if you miss a pattern.
- **Destructuring:** Extract values from nested dictionaries in the match expression itself.
- **Readability:** The intent of each branch is crystal clear from the pattern.

```python
# Without pattern matching — messy and error-prone
def legacy_router(response):
    if "type" in response and response["type"] == "text" and "content" in response:
        return handle_text(response["content"])
    elif "type" in response and response["type"] == "tool_call":
        ...
    # Easy to miss a case, easy to misread

# With pattern matching — clean and declarative
def modern_router(response):
    match response:
        case {"type": "text", "content": str(c)}: return handle_text(c)
        case {"type": "tool_call"}: ...
        case {"type": "error"}: ...
```

---

## Summary

| Feature | Mental Model | Key Use Case | Critical Detail |
|---------|-------------|--------------|-----------------|
| **Decorators** | Gift Box | Logging, caching, retry, auth | Use `@wraps` to preserve metadata |
| **Context Managers** | Hotel Housekeeper | Resource cleanup, sessions | `@contextmanager` for custom managers |
| **Generators** | PEZ Dispenser | Memory-efficient streaming | `yield` over giant lists |
| **Metaclasses** | Blueprint Generator | Auto-registration, validation | Override `__new__` for immutable types |
| **Descriptors** | Traffic Controller | Validated attributes, ORM | `__get__`/`__set__` intercept access |
| **Pattern Matching** | Postal Sorter | LLM response routing | Guards add conditional logic |

These six features form the bedrock of Pythonic AI engineering. Master them, and you will write code that is safer, more readable, and more maintainable at scale.

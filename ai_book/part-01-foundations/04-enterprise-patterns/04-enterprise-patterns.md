# Chapter 4: Enterprise Patterns for AI — SOLID, DI, and Adapters

As you transition from building local AI prototypes to designing production systems, you will quickly notice a fundamental challenge: **LLMs are non-deterministic and highly volatile**. API specifications change, models are deprecated, prompts require continuous tuning, and outputs can vary unexpectedly.

In traditional software development, we rely on rigid, predictable inputs and outputs. In AI engineering, we must build solid, deterministic architectures *around* non-deterministic models. This chapter explores how to apply SOLID design principles, Dependency Injection, and the Adapter pattern to AI workflows, with concrete examples in both Python and TypeScript.

---

## SOLID: What Changes When the Model Is Non-Deterministic

Traditional software is deterministic: on input `2 + 2` we always get `4`. LLMs are probabilistic — the same prompt can return different phrasings. To manage this chaos, the architecture around the model must be maximally strict and predictable.

```
❌ Bad Approach (Spaghetti Code):
[Controller] ──► Builds Prompt ──► Calls LLM SDK ──► Parses JSON ──► Writes to DB

⚡ Clean Approach (SOLID):
[Controller] ──► [PromptBuilder]
             ──► [LLMProvider (Interface)] ◄── [ClaudeAdapter]
             ──► [ResponseParser]
             ──► [UserRepository]
```

---

## Single Responsibility Principle (SRP): The Assembly Line

### The Mental Model: The Assembly Line

If you run a toy factory, you do not hire a single worker to design the toy, mold the plastic, paint the details, package the box, and drive the delivery truck. If that worker gets sick, your entire production line halts.

In AI engineering, a common anti-pattern is writing a single, massive function that handles prompt formatting, makes the network call, parses the result, validates the schema, and writes to a database. If the prompt changes or the API goes down, the entire function breaks.

Instead, we separate these steps into specialized, single-purpose components.

### Python Code

```python
import json
from typing import Dict, Any

class PromptBuilder:
    """Responsibility: Preparing the input prompt."""
    def create_summary_prompt(self, document: str) -> str:
        return f"Summarize the following document in exactly three sentences:\n\n{document}"

class OpenAIClient:
    """Responsibility: Handling raw network transport and API communication."""
    def __init__(self, api_key: str):
        self.api_key = api_key

    def call_model(self, prompt: str) -> str:
        # In production: actual HTTP call to OpenAI
        return '{"summary": "This is a structured summary."}'

class SummaryParser:
    """Responsibility: Validating and parsing model outputs."""
    def parse_to_dict(self, raw_output: str) -> Dict[str, Any]:
        try:
            return json.loads(raw_output)
        except json.JSONDecodeError:
            return {"error": "Failed to parse model output"}

# Orchestrating the pipeline
prompt_builder = PromptBuilder()
model_client = OpenAIClient(api_key="sk-...")
parser = SummaryParser()

prompt = prompt_builder.create_summary_prompt("Long document...")
raw_response = model_client.call_model(prompt)
structured_data = parser.parse_to_dict(raw_response)
```

### TypeScript Code

```typescript
class PromptBuilder {
    createSummaryPrompt(document: string): string {
        return `Summarize the following document:\n\n${document}`;
    }
}

class OpenAIClient {
    async callModel(prompt: string): Promise<string> {
        // In production: actual HTTP call
        return JSON.stringify({ summary: "TypeScript parsed summary" });
    }
}

class SummaryParser {
    parse(raw: string): Record<string, any> {
        return JSON.parse(raw);
    }
}

// Orchestration
const promptBuilder = new PromptBuilder();
const client = new OpenAIClient("sk-...");
const parser = new SummaryParser();

const prompt = promptBuilder.createSummaryPrompt("Long document...");
const raw = await client.callModel(prompt);
const result = parser.parse(raw);
```

---

## Open/Closed Principle (OCP) and Liskov Substitution (LSP)

- **Open/Closed Principle (OCP):** Software components should be open for extension, but closed for modification. You should be able to add support for a new model provider (like Anthropic or a local Llama model) without modifying your core business logic.
- **Liskov Substitution Principle (LSP):** Subclasses (or structural implementations) must be substitutable for their base types without altering the correctness of the program.

### The Mental Model: The Wall Socket

Your home's electrical sockets are designed to a standard contract. Whether you plug in a vacuum, a laptop charger, or a lamp, the socket delivers the same voltage interface. You do not need to rewire your house every time you buy a new appliance.

In AI, we define a structural interface for our model providers. The core application only interacts with this contract.

```
Core Application ──► [LLMProvider Contract]
                              ▲
                 ┌────────────┴────────────┐
                 │                         │
          OpenAIAdapter             AnthropicAdapter
```

### Python Code (using `typing.Protocol`)

```python
from typing import Protocol

# 1. Define the OCP Contract
class LLMProvider(Protocol):
    def generate(self, prompt: str) -> str:
        ...

# 2. Implement concrete adapters
class OpenAIAdapter:
    def generate(self, prompt: str) -> str:
        return "OpenAI generated content"

class AnthropicAdapter:
    def generate(self, prompt: str) -> str:
        return "Anthropic generated content"

# 3. Core pipeline accepts ANY class that satisfies the Protocol (LSP)
class DocumentSummarizer:
    def __init__(self, provider: LLMProvider):
        self.provider = provider

    def summarize(self, document: str) -> str:
        prompt = f"Summarize: {document}"
        return self.provider.generate(prompt)

# Switching providers at construction time
summarizer = DocumentSummarizer(OpenAIAdapter())
# summarizer = DocumentSummarizer(AnthropicAdapter())  # Same code, different provider
```

If your company decides to switch from OpenAI to Anthropic, you do not touch a single line of code inside `DocumentSummarizer`. You simply instantiate it with the `AnthropicAdapter` instead.

### TypeScript Code

```typescript
interface LLMProvider {
    generate(prompt: string): Promise<string>;
}

class OpenAIAdapter implements LLMProvider {
    async generate(prompt: string): Promise<string> {
        return "OpenAI content";
    }
}

class AnthropicAdapter implements LLMProvider {
    async generate(prompt: string): Promise<string> {
        return "Anthropic content";
    }
}

class DocumentSummarizer {
    constructor(private provider: LLMProvider) {}

    async summarize(document: string): Promise<string> {
        return this.provider.generate(document);
    }
}

// Usage
const summarizer = new DocumentSummarizer(new OpenAIAdapter());
```

---

## Interface Segregation Principle (ISP): Thin Contracts

Clients should not depend on methods they do not use. Do not create one giant interface containing methods for text generation, embeddings, speech recognition, and image generation. Split it into focused interfaces.

```python
# ❌ Fat interface — forces implementors to define unused methods
class GiantLLMInterface(Protocol):
    def generate_text(self, prompt: str) -> str: ...
    def create_embedding(self, text: str) -> list[float]: ...
    def transcribe_audio(self, audio: bytes) -> str: ...
    def generate_image(self, prompt: str) -> bytes: ...

# ✅ Segregated interfaces
class TextGenerator(Protocol):
    def generate(self, prompt: str) -> str: ...

class EmbeddingGenerator(Protocol):
    def embed(self, text: str) -> list[float]: ...

class AudioTranscriber(Protocol):
    def transcribe(self, audio: bytes) -> str: ...
```

```typescript
// ✅ TypeScript segregated interfaces
interface ITextGenerator {
    generate(prompt: string): Promise<string>;
}

interface IEmbeddingGenerator {
    embed(text: string): Promise<number[]>;
}
```

---

## Dependency Inversion Principle (DIP): Abstraction Over Implementation

**The Problem:** High-level modules should not depend on low-level modules. Both should depend on abstractions.

If your high-level orchestrator manually instantiates class dependencies internally using `self.client = OpenAIClient()`, the components are tightly coupled. You cannot easily test the orchestrator without hitting the real live OpenAI network endpoints, and swapping providers requires rewriting the core class.

**The Solution:** Inject dependencies at runtime (Dependency Injection).

```
❌ BAD (Tightly Coupled):
[Core Engine] ──► [New Concrete OpenAIClient()]

⚡ GOOD (Dependency Injection):
[Core Engine] ──► [Abstraction (Interface)] ◄── [OpenAIAdapter]
```

### The Travel Power Adapter Mental Model

Your laptop does not care if the wall socket is US, UK, or EU style — it just wants standard electrical current. The adapter handles the translation. We design our AI applications the same way, separating our core business logic from the specific LLM provider we use.

### Python: Manual DI vs. FastAPI DI

**Manual DI (simple, explicit):**

```python
class TextClassificationEngine:
    def __init__(self, model_provider: LLMProvider):
        self.model_provider = model_provider

    def classify_sentiment(self, text: str) -> str:
        prompt = f"Classify the sentiment of this text: {text}"
        return self.model_provider.generate(prompt)

# Constructing the graph at runtime
provider = OpenAIAdapter()
engine = TextClassificationEngine(model_provider=provider)
```

**FastAPI DI (framework-managed):**

```python
from fastapi import FastAPI, Depends

app = FastAPI()

# 1. Define dependency providers
def get_llm_provider() -> LLMProvider:
    # This acts as your container registry.
    # Change this return value to AnthropicAdapter() based on env variables.
    return OpenAIAdapter()

def get_engine(provider: LLMProvider = Depends(get_llm_provider)) -> TextClassificationEngine:
    return TextClassificationEngine(model_provider=provider)

# 2. Inject directly into your API endpoints
@app.post("/classify")
async def classify_route(
    text: str,
    engine: TextClassificationEngine = Depends(get_engine)
):
    return {"result": engine.classify_sentiment(text)}
```

This route-level dependency injection is incredibly powerful. When writing integration tests, you can easily override dependencies:

```python
# Swapping out the real LLM for a mock during test execution
app.dependency_overrides[get_llm_provider] = MockLLMAdapter
```

### TypeScript: NestJS DI

```typescript
// app.module.ts
import { Module } from '@nestjs/common';

@Module({
  controllers: [RecommendationController],
  providers: [
    RecommendationService,
    {
      provide: 'ITextGenerator',
      useFactory: () => {
        if (process.env.AI_PROVIDER === 'mock') {
          return new MockLLMAdapter();
        }
        return new ClaudeBedrockAdapter(process.env.AWS_REGION || 'eu-central-1');
      },
    },
  ],
})
export class AppModule {}
```

```typescript
// recommendation.service.ts
import { Injectable, Inject } from '@nestjs/common';

@Injectable()
export class RecommendationService {
  constructor(
    @Inject('ITextGenerator') private readonly llm: ITextGenerator
  ) {}

  async getGearGuide(userSkill: string): Promise<string> {
    const prompt = `Recommend gear for skill level: "${userSkill}".`;
    const response = await this.llm.generate(prompt);
    return response.text;
  }
}
```

---

## Repository Pattern for AI

The Repository pattern isolates domain logic from data access details. In AI, we use it to abstract LLM provider SDKs behind a clean interface.

### The Complete Adapter Pattern in TypeScript

```typescript
// types/llm.ts
export interface LLMRequestOptions {
  temperature?: number;
  maxTokens?: number;
}

export interface LLMResponse {
  text: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
  };
}

export interface ITextGenerator {
  generate(prompt: string, options?: LLMRequestOptions): Promise<LLMResponse>;
}
```

```typescript
// adapters/claude-bedrock.adapter.ts
import { ITextGenerator, LLMRequestOptions, LLMResponse } from '../types/llm';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

export class ClaudeBedrockAdapter implements ITextGenerator {
  private client: BedrockRuntimeClient;
  private modelId = 'anthropic.claude-3-5-sonnet-20240620-v1:0';

  constructor(region: string = 'eu-central-1') {
    this.client = new BedrockRuntimeClient({ region });
  }

  async generate(prompt: string, options?: LLMRequestOptions): Promise<LLMResponse> {
    const payload = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: options?.maxTokens ?? 1000,
      temperature: options?.temperature ?? 0.3,
      messages: [{ role: 'user', content: prompt }],
    };

    const command = new InvokeModelCommand({
      modelId: this.modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload),
    });

    const response = await this.client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    return {
      text: responseBody.content[0].text,
      usage: {
        promptTokens: responseBody.usage?.input_tokens ?? 0,
        completionTokens: responseBody.usage?.output_tokens ?? 0,
      },
    };
  }
}
```

### The Complete Adapter Pattern in Python

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional

@dataclass
class LLMResponse:
    text: str
    prompt_tokens: int
    completion_tokens: int

class TextGenerator(ABC):
    @abstractmethod
    async def generate(
        self, prompt: str, temperature: float = 0.3, max_tokens: int = 1000
    ) -> LLMResponse:
        ...

class ClaudeBedrockAdapter(TextGenerator):
    def __init__(self, region: str = "eu-central-1"):
        import boto3
        self.bedrock = boto3.client("bedrock-runtime", region_name=region)
        self.model_id = "anthropic.claude-3-5-sonnet-20240620-v1:0"

    async def generate(
        self, prompt: str, temperature: float = 0.3, max_tokens: int = 1000
    ) -> LLMResponse:
        import json
        payload = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": [{"role": "user", "content": prompt}],
        }
        response = self.bedrock.invoke_model(
            modelId=self.model_id,
            body=json.dumps(payload),
        )
        response_body = json.loads(response["body"].read())
        return LLMResponse(
            text=response_body["content"][0]["text"],
            prompt_tokens=response_body["usage"]["input_tokens"],
            completion_tokens=response_body["usage"]["output_tokens"],
        )
```

---

## Testing the Untestable: Mocking LLM Payloads

Writing unit tests for AI functions often scares developers: *"How can I test the result if the LLM returns slightly different text every time?"*

Clean architecture makes this trivial. We separate tests into two categories:

1. **Unit tests of business logic (Deterministic):** Replace the real `ITextGenerator` with a predictable `MockLLMAdapter`.
2. **Integration tests (Infrastructure):** Test only the adapter itself against real SDK calls (mocked at network layer).

### Creating a Mock Adapter (TypeScript)

```typescript
// mocks/llm.mock.ts
import { ITextGenerator, LLMResponse } from '../types/llm';

export class MockLLMAdapter implements ITextGenerator {
  public lastPrompt: string = '';
  public mockResponse: string = 'Recommendation: Salomon S/Max 10';

  async generate(prompt: string): Promise<LLMResponse> {
    this.lastPrompt = prompt;
    return {
      text: this.mockResponse,
      usage: { promptTokens: 10, completionTokens: 5 },
    };
  }
}
```

### Writing a Pure Unit Test (TypeScript)

```typescript
// recommendation.service.spec.ts
describe('RecommendationService', () => {
  it('should format prompt correctly and return recommendation', async () => {
    // 1. Create a mock
    const mockLlm = new MockLLMAdapter();
    mockLlm.mockResponse = 'Test skis: Salomon QST 98';

    // 2. Inject it manually (no NestJS startup needed)
    const service = new RecommendationService(mockLlm);

    // 3. Execute
    const result = await service.getGearGuide('Expert freeride');

    // 4. Assert
    expect(result).toContain('Salomon QST 98');
    expect(mockLlm.lastPrompt).toContain('Expert freeride');
  });
});
```

This test runs in 2 milliseconds, requires no internet connection, and costs nothing in API fees.

### Creating a Mock Adapter (Python)

```python
from unittest.mock import AsyncMock

class MockLLMAdapter:
    """Deterministic mock for testing."""
    def __init__(self):
        self.last_prompt = ""
        self.mock_response = "Default mock response"

    async def generate(self, prompt: str, **kwargs) -> LLMResponse:
        self.last_prompt = prompt
        return LLMResponse(
            text=self.mock_response,
            prompt_tokens=10,
            completion_tokens=5,
        )

# Pytest test
@pytest.mark.asyncio
async def test_classification_engine():
    mock_llm = MockLLMAdapter()
    mock_llm.mock_response = "Positive sentiment"

    engine = TextClassificationEngine(model_provider=mock_llm)
    result = engine.classify_sentiment("Great product!")

    assert result == "Positive sentiment"
    assert "Great product" in mock_llm.last_prompt
```

### Pytest Fixtures for AI Tests

```python
import pytest
from typing import AsyncGenerator, Generator

@pytest.fixture
def mock_llm_provider() -> MockLLMAdapter:
    """Fixture providing a reusable mock LLM provider."""
    mock = MockLLMAdapter()
    mock.mock_response = '{"summary": "Test summary"}'
    return mock

@pytest.fixture
def engine(mock_llm_provider: MockLLMAdapter) -> TextClassificationEngine:
    """Fixture providing a test engine with mocked dependencies."""
    return TextClassificationEngine(model_provider=mock_llm_provider)

@pytest.mark.asyncio
async def test_summary_pipeline(engine, mock_llm_provider):
    result = await engine.summarize("Test document")
    assert result["summary"] == "Test summary"
```

---

## Graceful Shutdown and Task Cancellation

In cloud environments like Kubernetes, pods are periodically stopped during deployments, scaling changes, or node rebalancing. When a shutdown signal (`SIGTERM`) is received, your application must clean up active connections gracefully.

### The Mental Model: The Restaurant Last Call

- **Abrupt Shutdown:** At midnight, the manager suddenly turns off all lights, locks the doors, and throws everyone out. Diners leave hungry, plates are unwashed.
- **Graceful Shutdown:** At 11:30 PM, the manager announces last call. The kitchen stops taking new orders, active diners finish their meals, dishes are washed, and everyone departs in an orderly fashion.

### Python: Cooperative Cancellation with `asyncio.CancelledError`

```python
import asyncio
import signal

async def process_stream(task_id: int):
    try:
        while True:
            print(f"Task {task_id}: Processing tokens...")
            await asyncio.sleep(1.0)
    except asyncio.CancelledError:
        print(f"Task {task_id}: Cleaning up...")
        await asyncio.sleep(0.2)
        print(f"Task {task_id}: Cleaned up.")
        raise

async def shutdown(sig, loop):
    print(f"\nReceived {sig.name}. Shutting down...")
    tasks = [t for t in asyncio.all_tasks() if t is not asyncio.current_task()]
    for task in tasks:
        task.cancel()
    await asyncio.gather(*tasks, return_exceptions=True)
    loop.stop()

def main():
    loop = asyncio.new_event_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, lambda s=sig: asyncio.create_task(shutdown(s, loop)))
    loop.create_task(process_stream(1))
    loop.run_forever()
```

### Three Patterns for Cancellation-Safe Code

**Pattern 1: Automatic Bubbling** — Let `CancelledError` propagate naturally.

```python
async def fetch_llm_data():
    # If cancelled, CancelledError bypasses 'except Exception' blocks
    # (CancelledError inherits from BaseException, not Exception)
    try:
        response = await client.post("https://api.openai.com/...")
        return response
    except ValueError:
        # This catches only ValueError, not CancelledError!
        raise
```

**Pattern 2: Async Context Managers** — Guarantee resource cleanup even on cancellation.

```python
from contextlib import asynccontextmanager

@asynccontextmanager
async def database_transaction(session):
    try:
        yield session
        await session.commit()
    except BaseException:
        await session.rollback()
        raise

async def save_user_history(session, user_id, message):
    async with database_transaction(session):
        await session.write(user_id, message)
```

**Pattern 3: Decorators for Telemetry** — Log cancellations without affecting business logic.

```python
from functools import wraps

def track_cancellation(metric_name: str):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            try:
                return await func(*args, **kwargs)
            except asyncio.CancelledError:
                print(f"METRIC: {metric_name} cancelled")
                raise  # MUST re-raise!
        return wrapper
    return decorator
```

---

## The Quirky Interview: Hot-Swapping LLM Providers

### The Scenario

> *"Anthropic just released a new Claude model with a completely different payload format, and OpenAI's API is down. How does your adapter architecture let you hot-swap the LLM provider in under 10 seconds without running a code redeployment or restarting your servers?"*

### Architectural Breakdown

#### 1. Strategy: Three-Layer Hot-Swapping

To solve this in real time, combine three approaches:

- **Interface Abstraction:** Business logic depends only on `ITextGenerator`/`LLMProvider` — it does not know which provider is behind it.
- **Dynamic Factory in DI Container:** The provider initializes the right adapter dynamically based on external config.
- **External Config Store (Feature Flags):** Use Redis or AWS AppConfig to change the active provider without restarting servers.

#### 2. Implementation: Dynamic Switch via Redis (TypeScript)

```typescript
// providers/dynamic-llm.provider.ts
import { ClaudeBedrockAdapter } from '../adapters/claude-bedrock.adapter';
import { OpenAIAdapter } from '../adapters/openai.adapter';
import { RedisConfigService } from '../services/redis-config.service';

export const DynamicLLMProvider = {
  provide: 'ITextGenerator',
  useFactory: async (configService: RedisConfigService) => {
    return {
      async generate(prompt: string, options?: any) {
        const activeProvider = await configService.get('ACTIVE_AI_PROVIDER');

        if (activeProvider === 'openai') {
          return new OpenAIAdapter().generate(prompt, options);
        }
        return new ClaudeBedrockAdapter().generate(prompt, options);
      }
    };
  },
  inject: [RedisConfigService],
};
```

#### 3. Incident Response

When an outage occurs:

1. An engineer changes a value in Redis: `SET ACTIVE_AI_PROVIDER "openai"`.
2. On the next user request, the system reads the new value and instantly redirects to OpenAI.
3. **Result:** Incident resolved in under 3 seconds. No Docker containers restarted. Business logic unchanged.

#### 4. Python Implementation (FastAPI + Redis)

```python
from fastapi import FastAPI, Depends
import redis.asyncio as redis

app = FastAPI()
redis_client = redis.Redis(host="localhost", port=6379)

async def get_active_provider() -> TextGenerator:
    provider_name = await redis_client.get("ACTIVE_AI_PROVIDER")
    if provider_name == b"openai":
        return OpenAIAdapter()
    elif provider_name == b"anthropic":
        return AnthropicAdapter()
    else:
        return ClaudeBedrockAdapter()  # default

@app.post("/classify")
async def classify(
    text: str,
    provider: TextGenerator = Depends(get_active_provider),
):
    engine = TextClassificationEngine(model_provider=provider)
    return {"result": engine.classify_sentiment(text)}
```

---

## Summary: Architecture Decision Matrix

| Use Case | Python Pattern | TypeScript Pattern |
|----------|---------------|-------------------|
| **LLM Provider Abstraction** | `typing.Protocol` | `interface` |
| **DI Container** | FastAPI `Depends` | NestJS `@Injectable` |
| **Client Pooling** | `httpx.AsyncClient` | `http.Agent` + keepAlive |
| **Adapter for New Provider** | Implement Protocol class | Implement Interface class |
| **Testing** | `MockLLMAdapter` + pytest | `MockLLMAdapter` + Jest |
| **Config-Driven Switching** | Redis + Factory function | Redis + `useFactory` |
| **Graceful Shutdown** | `asyncio.CancelledError` + `loop.add_signal_handler` | `AbortController` + `process.on` |
| **Structured Mock** | `pytest.fixture` + `AsyncMock` | Class implementing interface |

Clean architecture in AI is not about over-engineering — it is about survival. The LLM landscape changes weekly. Build your abstractions wisely, and you will be able to pivot without rewriting your entire codebase.

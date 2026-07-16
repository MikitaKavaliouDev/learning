# chapter-2.1.md

As you transition from building local AI prototypes to designing production systems, you will quickly notice a fundamental challenge: **LLMs are non-deterministic and highly volatile**. API specifications change, models are deprecated, prompts require continuous tuning, and outputs can vary unexpectedly.

In traditional software development, we rely on rigid, predictable inputs and outputs. In AI engineering, we must build solid, deterministic architectures *around* non-deterministic models. This lesson explores how to apply **SOLID Design Principles** to AI workflows, translating these concepts into terms you already know from Node.js (TypeScript) and PHP [2.1].

---

## 🎁 1. Single Responsibility Principle (SRP) in AI Workflows

### The Mental Model: *The Assembly Line*
If you run a toy factory, you do not hire a single worker to design the toy, mold the plastic, paint the details, package the box, and drive the delivery truck. If that worker gets sick, your entire production line halts. 

In AI engineering, a common anti-pattern is writing a single, massive function that handles prompt formatting, makes the network call to OpenAI, parses the resulting text, validates the JSON schema, and writes the result to a database. If the prompt changes or the API goes down, the entire function breaks.

Instead, we separate these steps into specialized, single-purpose components.

### Python Code (The Structured Assembly Line)
By separating prompt preparation, network communication, parsing, and database operations, each class has exactly one reason to change.

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
        # Simulate API network request
        return '{"summary": "This is a structured summary of the document."}'

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

# Execution flows sequentially through single-responsibility classes
prompt = prompt_builder.create_summary_prompt("Lorem Ipsum...")
raw_response = model_client.call_model(prompt)
structured_data = parser.parse_to_dict(raw_response)
```

### The Node.js / TypeScript Translation
In TypeScript, you likely apply SRP by splitting middleware, controller layers, and services:

```typescript
class PromptBuilder {
    createSummaryPrompt(document: string): string {
        return `Summarize the following document:\n\n${document}`;
    }
}

class OpenAIClient {
    async callModel(prompt: string): Promise<string> {
        return JSON.stringify({ summary: "TypeScript parsed summary" });
    }
}

class SummaryParser {
    parse(raw: string): Record<string, any> {
        return JSON.parse(raw);
    }
}
```

### The PHP Translation
In modern PHP 8.x, we leverage typed classes and native typing to enforce SRP:

```php
declare(strict_types=1);

class PromptBuilder {
    public function createSummaryPrompt(string $document): string {
        return "Summarize the following document:\n\n" . $document;
    }
}

class OpenAIClient {
    public function callModel(string $prompt): string {
        return json_encode(['summary' => 'PHP parsed summary']);
    }
}

class SummaryParser {
    public function parse(string $raw): array {
        return json_decode($raw, true) ?? [];
    }
}
```

---

## 🗃️ 2. Open/Closed Principle (OCP) & Liskov Substitution (LSP)

* **Open/Closed Principle (OCP):** Software components should be open for extension, but closed for modification. You should be able to add support for a new model provider (like Anthropic or a local Llama model) without modifying your core business logic [2.2].
* **Liskov Substitution Principle (LSP):** Subclasses (or structural implementations) must be substitutable for their base types without altering the correctness of the program.

### The Mental Model: *The Wall Sockets*
Your home's electrical sockets are designed to a standard contract. Whether you plug in a vacuum, a laptop charger, or a lamp, the socket delivers the same voltage interface. You do not need to rewire your house's electrical grid every time you buy a new appliance.

In AI, we define a structural interface (a **`Protocol`** or **`Interface`**) for our model providers. The core application only interacts with this contract.

```
Core Application ──► [LLMProvider Contract]
                              ▲
                 ┌────────────┴────────────┐
                 │                         │
          OpenAIAdapter             AnthropicAdapter
```

### Python Code
We use Python's `typing.Protocol` to define structural contracts. Any class that implements a `generate` method matching the exact signature is automatically compatible.

```python
from typing import Protocol

# 1. Define the OCP Contract
class LLMProvider(Protocol):
    def generate(self, prompt: str) -> str:
        ...

# 2. Implement concrete adapters
class OpenAIAdapter:
    def generate(self, prompt: str) -> str:
        # OpenAI specific implementation
        return "OpenAI generated content"

class AnthropicAdapter:
    def generate(self, prompt: str) -> str:
        # Anthropic specific implementation
        return "Anthropic generated content"

# 3. Core pipeline accepts ANY class that satisfies the Protocol (LSP)
class DocumentSummarizer:
    def __init__(self, provider: LLMProvider):
        self.provider = provider

    def summarize(self, document: str) -> str:
        prompt = f"Summarize: {document}"
        # Core logic remains unchanged regardless of provider!
        return self.provider.generate(prompt)
```

If your company decides to switch from OpenAI to Anthropic, you do not touch a single line of code inside `DocumentSummarizer`. You simply instantiate it with the `AnthropicAdapter` instead.

### The Node.js / TypeScript Translation
TypeScript achieves this elegantly using structural typing and interfaces:

```typescript
interface LLMProvider {
    generate(prompt: string): Promise<string>;
}

class OpenAIAdapter implements LLMProvider {
    async generate(prompt: string): Promise<string> {
        return "OpenAI content";
    }
}

class DocumentSummarizer {
    constructor(private provider: LLMProvider) {}

    async summarize(document: string): Promise<string> {
        return this.provider.generate(document);
    }
}
```

### The PHP Translation
In PHP, we use native `interface` inheritance to enforce this behavior:

```php
interface LLMProviderInterface {
    public function generate(string $prompt): string;
}

class OpenAIAdapter implements LLMProviderInterface {
    public function generate(string $prompt): string {
        return "OpenAI content";
    }
}

class DocumentSummarizer {
    // Constructor Promotion in PHP 8.x
    public function __construct(private LLMProviderInterface $provider) {}

    public function summarize(string $document): string {
        return $this->provider->generate($document);
    }
}
```

---

## 🪿 3. Dependency Inversion Principle (DIP)

**The Problem:** High-level modules should not depend on low-level modules. Both should depend on abstractions. 

If your high-level orchestrator manually instantiates class dependencies internally using `self.client = OpenAIClient()`, the components are tightly coupled. You cannot easily test the orchestrator without hitting the real live OpenAI network endpoints, and swapping providers requires rewriting the core class.

**The Solution:** Inject dependencies at runtime (Dependency Injection) [2.3].

```
❌ BAD (Tightly Coupled):
[Core Engine] ──► [New Concrete OpenAIClient()]

⚡ GOOD (Dependency Injection):
[Core Engine] ──► [Abstraction (Protocol)] ◄── [OpenAIAdapter]
```

### Python Code (Manual Dependency Injection)
Instead of hardcoding concrete dependencies inside our application class, we pass them into the constructor (`__init__`):

```python
class TextClassificationEngine:
    # We pass the abstraction (LLMProvider) rather than a concrete OpenAI class
    def __init__(self, model_provider: LLMProvider):
        self.model_provider = model_provider

    def classify_sentiment(self, text: str) -> str:
        prompt = f"Classify the sentiment of this text: {text}"
        return self.model_provider.generate(prompt)

# Constructing the graph at runtime
provider = OpenAIAdapter()
engine = TextClassificationEngine(model_provider=provider)
```

---

## 🗺️ Framework Containers: FastAPI vs. NestJS & Laravel

If you are coming from NestJS or Laravel, you are likely used to a framework-managed **Dependency Injection Container** that handles class resolution automatically.

### 🟢 NestJS (TypeScript DI)
NestJS uses decorators and class constructors to resolve dependencies dynamically:
```typescript
@Injectable()
export class TextClassificationEngine {
    constructor(private readonly provider: LLMProvider) {}
}
```

### 🐘 Laravel (PHP Service Container)
Laravel uses its Service Container to bind interfaces to concrete classes inside a Service Provider:
```php
$this->app->bind(LLMProviderInterface::class, OpenAIAdapter::class);
```

### 🐍 FastAPI (Python DI)
FastAPI has a highly modern dependency injection system that operates on a per-route basis using the `Depends` keyword. It resolves functions and classes recursively at runtime:

```python
from fastapi import FastAPI, Depends

app = FastAPI()

# 1. Define dependency providers
def get_llm_provider() -> LLMProvider:
    # This acts as your container registry. 
    # You can easily change this return value to AnthropicAdapter() 
    # based on environment variables.
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

This route-level dependency injection is incredibly powerful. When writing integration tests, you can easily override dependencies on your application instance:

```python
# Swapping out the real LLM for a mock during test execution
app.dependency_overrides[get_llm_provider] = MockLLMAdapter
```
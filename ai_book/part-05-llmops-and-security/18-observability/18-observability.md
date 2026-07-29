# Глава 18: Наблюдаемость (Observability) и распределённый трейсинг

> **Ментальная модель:** *Бортовой самописец (чёрный ящик).* Во время полёта самописец фиксирует не просто конечный результат («самолёт приземлился»), а сотни параметров каждую секунду: высоту, скорость ветра, угол наклона закрылков, работу каждого двигателя. Если происходит малейшее отклонение, инженеры могут поминутно восстановить картину событий. В AI-системах мы должны делать то же самое — записывать каждый шаг принятия решения.

## 18.1 Почему обычных логов недостаточно

В традиционном бэкенде логов достаточно: запрос пришёл → SQL выполнен → ответ отправлен. В AI-системе каждый «запрос» — это каскад из десятков разнородных операций:

```
Запрос пользователя
  ├── Input Guardrail (LlamaGuard)
  ├── Векторный поиск (pgvector/OpenSearch)
  │     ├── Query transformation
  │     └── Re-ranking (Cohere)
  ├── Вызов Claude 3.5 Sonnet
  │     ├── Системный промпт (40K токенов)
  │     ├── Контекст RAG (15K токенов)
  │     ├── Вызов инструмента getOrderStatus
  │     │     └── Запрос к CRM API
  │     ├── Вызов инструмента processRefund
  │     │     ├── Human-in-the-Loop (ожидание менеджера)
  │     │     └── Запрос к платежному шлюзу
  │     └── Генерация ответа
  └── Output Guardrail (PII detection)
```

Если агент дал пользователю скидку 50% без оснований, кто виноват? LLM, CRM API, человек-оператор, или глюк в графе состояний? **Без распределённого трейсинга вы не сможете ответить на этот вопрос.**

## 18.2 Распределённый трейсинг

### 18.2.1 Основные концепции

- **Trace:** Полная запись одного запроса (сессии пользователя). Уникальный ID.
- **Span:** Одна операция внутри trace (запрос к LLM, вызов инструмента, поиск в векторной БД). Имеет начало, конец, статус, атрибуты.
- **Context Propagation:** Передача traceId через асинхронные цепочки вызовов.

```
Trace: a1b2c3d4 (session_id: "user-session-42")
│
├─ Span: input_guardrail (duration: 45ms, passed: true)
│
├─ Span: vector_search (duration: 230ms, results: 5, score: 0.89)
│
├─ Span: llm_call_claude (duration: 3200ms, tokens_in: 45200, tokens_out: 320)
│   │
│   ├─ Span: tool_getOrderStatus (duration: 150ms, order_id: "5421")
│   │
│   └─ Span: tool_processRefund (duration: 45000ms, status: "pending_approval")
│       │
│       └─ Span: human_approval (duration: 42000ms, approved: true)
│
└─ Span: output_guardrail (duration: 12ms, pii_found: 0)
```

### 18.2.2 Настройка OpenLLMetry (TypeScript)

OpenLLMetry — это библиотека на основе OpenTelemetry, адаптированная для AI-систем. Она автоматически создаёт спаны для вызовов LLM, векторных баз данных и инструментов.

```typescript
import { init } from '@traceloop/opentelemetry';
import { DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';

// Инициализация OpenLLMetry
init({
  resource: {
    'service.name': 'salomon-ai-assistant',
    'service.version': '1.2.0',
    'deployment.environment': 'production',
  },
  instrumentations: [
    // Автоматический трейсинг Vercel AI SDK / Bedrock
    getBedrockInstrumentation(),
    getPgInstrumentation(),  // PostgreSQL / pgvector
    getHttpInstrumentation(), // HTTP-вызовы
  ],
});
```

### 18.2.3 Ручное создание спанов

Для кастомной логики (особые шаги агента, Human-in-the-Loop, guardrails) создаём спаны вручную:

```typescript
import { trace, Span, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('salomon-ai-tracer');

class ObservableAgent {
  async processUserRequest(query: string): Promise<string> {
    // Создаём корневой спан для всего запроса
    return await tracer.startActiveSpan('agent_process_request', async (rootSpan) => {
      rootSpan.setAttribute('user.query', query);
      rootSpan.setAttribute('user.session_id', currentSession.id);

      try {
        // Шаг 1: Guardrail
        const guardrailResult = await this.tracedStep(
          'input_guardrail',
          { query },
          async () => await this.inputGuardrail.inspect(query)
        );

        if (guardrailResult.passed === false) {
          rootSpan.setAttribute('guardrail.blocked', true);
          rootSpan.setStatus({ code: SpanStatusCode.ERROR });
          return 'Запрос заблокирован системой безопасности.';
        }

        // Шаг 2: Векторный поиск
        const context = await this.tracedStep(
          'vector_search',
          { query, topK: 5 },
          async () => await this.vectorStore.search(query, { limit: 5 })
        );

        rootSpan.setAttribute('context.chunks', context.length);
        rootSpan.setAttribute('context.scores', JSON.stringify(
          context.map(c => c.score)
        ));
        rootSpan.setAttribute('context.total_tokens', 
          context.reduce((sum, c) => sum + c.tokenCount, 0)
        );

        // Шаг 3: Вызов LLM
        const response = await this.tracedStep(
          'llm_call',
          { 
            model: 'claude-3-5-sonnet',
            system_prompt_tokens: 40000,
            context_tokens: context.reduce((sum, c) => sum + c.tokenCount, 0),
          },
          async () => await this.llm.generate({
            model: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
            system: SYSTEM_PROMPT,
            context: context.map(c => c.text).join('\n'),
            query,
          })
        );

        rootSpan.setAttribute('llm.total_tokens', response.usage.totalTokens);
        rootSpan.setAttribute('llm.output_tokens', response.usage.outputTokens);

        rootSpan.setStatus({ code: SpanStatusCode.OK });
        return response.text;

      } catch (error) {
        rootSpan.recordException(error);
        rootSpan.setStatus({ 
          code: SpanStatusCode.ERROR, 
          message: error.message 
        });
        throw error;
      } finally {
        rootSpan.end();
      }
    });
  }

  private async tracedStep<T>(
    spanName: string,
    attributes: Record<string, any>,
    fn: () => Promise<T>
  ): Promise<T> {
    return await tracer.startActiveSpan(spanName, async (span) => {
      // Устанавливаем атрибуты
      Object.entries(attributes).forEach(([key, value]) => {
        span.setAttribute(key, typeof value === 'string' ? value : JSON.stringify(value));
      });

      const startTime = Date.now();

      try {
        const result = await fn();
        
        span.setAttribute('duration_ms', Date.now() - startTime);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setAttribute('duration_ms', Date.now() - startTime);
        span.recordException(error);
        span.setStatus({ 
          code: SpanStatusCode.ERROR, 
          message: error.message 
        });
        throw error;
      } finally {
        span.end();
      }
    });
  }
}
```

## 18.3 Сквозная передача traceId через асинхронные цепочки

Проблема Node.js в том, что `async/await` теряет контекст. Когда мы вызываем инструмент, который вызывает API, который вызывает колбэк — traceId может потеряться.

### 18.3.1 Контекстная пропагация

```typescript
import { context, propagation, setActiveSpan } from '@opentelemetry/api';

class TracePropagator {
  /**
   * Создаёт дочерний trace для вызова инструмента.
   * Гарантирует, что все логи и метрики внутри инструмента 
   * будут привязаны к родительскому trace.
   */
  async instrumentToolCall<T>(
    toolName: string,
    args: any,
    fn: () => Promise<T>
  ): Promise<T> {
    const parentSpan = trace.getActiveSpan();
    
    return await tracer.startActiveSpan(`tool.${toolName}`, async (span) => {
      // Передаём traceId в контекст выполнения
      span.setAttribute('tool.args', JSON.stringify(args));
      span.setAttribute('tool.name', toolName);
      
      // Если есть родительский спан — связываем
      if (parentSpan) {
        span.setAttribute('parent_span_id', parentSpan.spanContext().spanId);
      }
      
      try {
        const result = await fn();
        span.setAttribute('tool.success', true);
        return result;
      } catch (error) {
        span.setAttribute('tool.success', false);
        span.setAttribute('tool.error', error.message);
        throw error;
      } finally {
        span.end();
      }
    });
  }
}

// Пример: вызов инструмента с сохранением traceId
class ObservableToolExecutor {
  private propagator = new TracePropagator();

  async executeTool(toolCall: ToolCall): Promise<any> {
    // traceId автоматически пробрасывается через контекст OpenTelemetry
    return await this.propagator.instrumentToolCall(
      toolCall.name,
      toolCall.args,
      async () => {
        const result = await this.actualExecutor.execute(toolCall);
        
        // Логируем с traceId
        logger.info({
          traceId: trace.getActiveSpan()?.spanContext().traceId,
          toolName: toolCall.name,
          result,
        });
        
        return result;
      }
    );
  }
}
```

## 18.4 Атрибуты спанов: что записывать

Хороший спан содержит достаточно информации для диагностики, но не настолько много, чтобы захламить хранилище.

| Категория | Атрибуты | Пример |
|-----------|----------|--------|
| **LLM вызов** | model, tokens_in, tokens_out, latency, temperature | `llm.tokens_in: 45200` |
| **RAG поиск** | top_k, scores, chunk_count, retrieved_tokens | `rag.scores: [0.95, 0.87, 0.76]` |
| **Инструменты** | tool_name, args, result, error | `tool.error: "API timeout"` |
| **Guardrails** | guardrail_type, passed, risk_score, violations | `guardrail.blocked: true` |
| **Human-in-the-Loop** | approval_required, wait_time, approved | `hitl.approved: false` |
| **Бизнес-метрики** | user_id, action_type, order_id | `business.action: "refund"` |

### 18.4.1 Пример структурированного спана

```typescript
function recordLlmSpan(span: Span, callData: LlmCallData) {
  span.setAttribute('llm.model', callData.model);
  span.setAttribute('llm.provider', 'aws-bedrock');
  span.setAttribute('llm.region', 'eu-central-1');
  
  // Количество токенов
  span.setAttribute('llm.usage.input_tokens', callData.inputTokens);
  span.setAttribute('llm.usage.output_tokens', callData.outputTokens);
  span.setAttribute('llm.usage.total_tokens', callData.inputTokens + callData.outputTokens);
  
  // Временные метрики
  span.setAttribute('llm.ttft_ms', callData.timeToFirstToken);
  span.setAttribute('llm.total_duration_ms', callData.duration);
  
  // Кэширование
  span.setAttribute('llm.cache_hit', callData.cacheHit);
  span.setAttribute('llm.cache_read_tokens', callData.cacheReadTokens);
  
  // Стоимость
  const cost = calculateCost(callData.inputTokens, callData.outputTokens);
  span.setAttribute('llm.estimated_cost_usd', cost);
}
```

## 18.5 LangFuse и LangSmith — платформы наблюдаемости

Эти платформы предоставляют готовые дашборды для анализа AI-трассировок.

### 18.5.1 Интеграция с LangFuse (TypeScript)

```typescript
import Langfuse from 'langfuse';

const langfuse = new Langfuse({
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  baseUrl: process.env.LANGFUSE_HOST,
});

class LangfuseTracer {
  async traceAgentExecution(sessionId: string, query: string) {
    const trace = langfuse.trace({
      id: sessionId,
      name: 'agent-execution',
      metadata: {
        environment: 'production',
        version: '1.2.0',
      },
    });

    // Создаём span для каждого шага
    const guardrailSpan = trace.span({
      name: 'input-guardrail',
      input: query,
    });

    try {
      const result = await inputGuardrail.inspect(query);
      guardrailSpan.end({
        output: result,
        metadata: { riskScore: result.riskScore },
      });
    } catch (error) {
      guardrailSpan.end({ 
        level: 'ERROR',
        metadata: { error: error.message },
      });
    }

    // LLM вызов
    const llmSpan = trace.span({
      name: 'llm-call',
      model: 'claude-3-5-sonnet',
      input: { query, systemPrompt: SYSTEM_PROMPT },
    });

    // ... выполнение LLM ...

    llmSpan.end({
      output: response,
      usage: {
        input: response.usage.inputTokens,
        output: response.usage.outputTokens,
        total: response.usage.totalTokens,
      },
    });

    return trace;
  }
}
```

### 18.5.2 Что дают платформы наблюдаемости

- **Дашборд затрат:** Сколько денег тратится на каждую модель, пользователя, сессию.
- **Анализ latency:** Где узкие места — векторный поиск, LLM, Human-in-the-Loop?
- **Поиск по сессиям:** Найти все сессии, где faithfulness score упал ниже 0.7.
- **Алерты:** Уведомление, если TTFT превысил 5 секунд или стоимость сессии превысила $1.

## 💬 Каверзный вопрос на интервью

> *«Пользователь жалуется, что агент Salomon дал ему скидку 50% на лыжи во время диалога, но в системе нет записей об этой ошибке. Опишите, как с помощью распределённого трейсинга (Trace/Span) вы локализуете проблему и поймёте, на каком именно шаге агент принял ошибочное решение при вызове внутренних инструментов. Какие атрибуты вы добавите в спаны, какие метрики будете отслеживать, и как настроите алерты на подозрительные действия агента?»*

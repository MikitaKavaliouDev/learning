# Глава 14: Безопасный вызов инструментов (Tool-Calling)

> **Ментальная модель:** *Предохранительное кольцо на лавинном рюкзаке.* Рюкзак с подушкой безопасности спасает жизнь, но вы не хотите, чтобы он случайно раскрылся в салоне автомобиля или на подъемнике от случайного толчка. На запуск системы установлена жесткая механическая блокировка, требующая осознанного действия. Точно так же мы блокируем опасные вызовы инструментов, пока агент не пройдет все проверки.

## 14.1 Механика Tool-Calling в Claude

Когда LLM (например, Claude) получает запрос пользователя, он может не просто сгенерировать текст, а **запросить вызов инструмента** — структурированную команду с именем функции и параметрами. Модель сама решает, какой инструмент вызвать и с какими аргументами, основываясь на описании доступных инструментов.

### 14.1.1 Как это работает

1. Разработчик описывает инструменты — их имена, описания, схемы параметров.
2. Claude получает запрос пользователя + описания инструментов.
3. Модель решает: ответить текстом или запросить вызов инструмента.
4. Claude возвращает JSON с `toolName` и `args`.
5. Приложение выполняет инструмент и возвращает результат модели.
6. Модель использует результат для формирования финального ответа или запроса следующего инструмента.

```
Пользователь: "Проверь статус заказа #5421"
         │
         ▼
    Claude анализирует запрос
         │
         ▼
    Claude: {toolName: "getOrderStatus", args: {orderId: "5421"}}
         │
         ▼
    Система выполняет getOrderStatus("5421")
         │
         ▼
    Результат: "Заказ отгружен, ожидается 15 марта"
         │
         ▼
    Claude: "Ваш заказ #5421 отгружен и прибудет 15 марта."
```

## 14.2 Описание инструментов с TypeScript и Zod

Vercel AI SDK позволяет описывать инструменты с помощью Zod-схем. Zod выводит статические типы TypeScript и валидирует аргументы во время выполнения.

```typescript
import { z } from 'zod';
import { generateText, tool } from 'ai';
import { bedrock } from '@ai-sdk/amazon-bedrock';

// 1. Определяем инструменты с Zod-валидацией
const tools = {
  getOrderStatus: tool({
    description: 'Проверяет статус заказа по его номеру',
    parameters: z.object({
      orderId: z.string().min(1, 'ID заказа обязателен'),
    }),
    execute: async ({ orderId }) => {
      const result = await db.query(
        'SELECT status, estimated_delivery FROM orders WHERE id = $1',
        [orderId]
      );
      return result;
    },
  }),

  processRefund: tool({
    description: 'Оформляет возврат средств по заказу',
    parameters: z.object({
      orderId: z.string().min(1, 'ID заказа обязателен'),
      amount: z.number().positive('Сумма должна быть положительной').max(10000),
      reason: z.string().min(10, 'Укажите причину возврата'),
    }),
    execute: async ({ orderId, amount, reason }) => {
      // Вызов CRM API
      return await crmService.createRefund(orderId, amount, reason);
    },
  }),

  sendSlackNotification: tool({
    description: 'Отправляет уведомление менеджеру в Slack',
    parameters: z.object({
      channel: z.string(),
      message: z.string(),
    }),
    execute: async ({ channel, message }) => {
      return await slackClient.sendMessage(channel, message);
    },
  }),
};

// 2. Вызов модели с инструментами
async function handleUserQuery(query: string) {
  const { text, toolCalls } = await generateText({
    model: bedrock('anthropic.claude-3-5-sonnet-20240620-v1:0'),
    system: 'Ты — ассистент поддержки Salomon. Используй инструменты для выполнения действий.',
    prompt: query,
    tools, // Передаём описание всех доступных инструментов
    maxSteps: 5, // Максимум шагов в цикле инструментов
  });

  return text;
}
```

### 14.2.1 Автоматическая валидация аргументов

Zod-схемы работают как **страж на входе**. Если Claude возвращает невалидные аргументы (например, `amount: -500`), Vercel AI SDK перехватывает ошибку и отправляет модели сообщение: «Аргументы не прошли валидацию, исправь их». Модель пытается снова:

```typescript
// Zod автоматически отклонит:
//   processRefund({ orderId: "", amount: -100, reason: "нет" })
// 
// Потому что:
//   - orderId: min(1) — пустая строка не пройдёт
//   - amount: positive() — отрицательная сумма не пройдёт
//   - reason: min(10) — слишком короткая причина не пройдёт
```

## 14.3 Human-in-the-Loop: прерывание сессии

Критические операции (возврат денег, удаление профиля, изменение ролей) должны проходить через **ручное подтверждение**. Паттерн Human-in-the-Loop (HITL) приостанавливает выполнение графа, сохраняет состояние и ждёт ответа от человека.

### 14.3.1 Архитектура прерывания

```typescript
interface HumanInTheLoopConfig {
  requiredApproval: boolean;
  approverChannel: string; // Slack-канал менеджеров
  timeoutMinutes: number;
  escalationUserId?: string;
}

class HumanInTheLoopGate {
  async requestApproval(
    toolName: string,
    args: Record<string, unknown>,
    userContext: string
  ): Promise<ApprovalResult> {
    // 1. Сохраняем состояние графа
    await checkpointer.save({
      status: 'paused_for_approval',
      pendingTool: toolName,
      pendingArgs: args,
      userContext,
    });

    // 2. Отправляем уведомление в Slack с Block Kit
    const approvalMessage = await slackClient.sendMessage({
      channel: '#manager-approvals',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `⚠️ *Требуется подтверждение*\nПользователь: ${userContext}\nИнструмент: \`${toolName}\`\nАргументы: \`${JSON.stringify(args)}\``,
          },
        },
        {
          type: 'actions',
          elements: [
            { type: 'button', text: '✅ Подтвердить', actionId: 'approve', style: 'primary', value: 'yes' },
            { type: 'button', text: '❌ Отклонить', actionId: 'reject', style: 'danger', value: 'no' },
          ],
        },
      ],
    });

    // 3. Ждём ответа (поллинг или Webhook)
    const response = await waitForApproval(
      approvalMessage.ts,
      this.config.timeoutMinutes
    );

    return response;
  }
}
```

### 14.3.2 Интеграция с графом состояний

```typescript
// Типы состояний агента
type AgentState = 
  | { status: 'idle' }
  | { status: 'running'; toolName: string }
  | { status: 'paused_for_approval'; pendingAction: string }
  | { status: 'error'; message: string };

// Обработчик с проверкой на опасные операции
async function executeWithGuard(state: AgentState, toolCall: any) {
  if (isDestructiveOperation(toolCall.name)) {
    // Переключаем состояние в ожидание аппрува
    const approval = await hitlGate.requestApproval(
      toolCall.name,
      toolCall.args,
      state.sessionContext
    );
    
    if (!approval.approved) {
      return `Операция ${toolCall.name} отклонена менеджером. Причина: ${approval.reason}`;
    }
  }
  
  // Выполняем инструмент
  return await executeTool(toolCall);
}
```

## 14.4 Защита от несанкционированных вызовов

Модель может ошибочно интерпретировать запрос пользователя и вызвать опасный инструмент. Пользователь пишет: *«Я требую вернуть деньги за заказ #999, и не спорьте со мной!»* — и модель может вызвать `refundOrder`. Нам нужна защита без сотен `if/else`.

### 14.4.1 Принцип наименьших привилегий

Инструменты никогда не должны иметь прямого доступа к деструктивным операциям. Они работают только через **шлюз с ограниченными правами**:

```typescript
class ToolAuthorizationGuard {
  private policies = new Map<string, ToolPolicy>();

  registerPolicy(toolName: string, policy: ToolPolicy) {
    this.policies.set(toolName, policy);
  }

  async authorize(toolName: string, args: any, context: AuthContext): Promise<AuthDecision> {
    const policy = this.policies.get(toolName);
    if (!policy) return { allowed: true }; // Нет политики — пропускаем

    // Проверяем условия политики
    const violations: string[] = [];

    if (policy.requireManagerRole && context.userRole !== 'manager') {
      violations.push('Требуется роль менеджера');
    }

    if (policy.maxAmount && args.amount > policy.maxAmount) {
      violations.push(`Сумма ${args.amount} превышает лимит ${policy.maxAmount}`);
    }

    if (policy.requireApproval) {
      return { allowed: true, requiresApproval: true }; // HITL
    }

    return {
      allowed: violations.length === 0,
      reason: violations.join('; '),
    };
  }
}

// Регистрация политик для инструментов
const authGuard = new ToolAuthorizationGuard();
authGuard.registerPolicy('processRefund', {
  requireManagerRole: true,
  maxAmount: 5000,
  requireApproval: true,
});
authGuard.registerPolicy('deleteUserProfile', {
  requireManagerRole: true,
  requireApproval: true,
});
authGuard.registerPolicy('getOrderStatus', {}); // Нет ограничений
```

### 14.4.2 Многоуровневая защита

```typescript
async function safeToolExecution(toolName: string, args: any, context: AuthContext) {
  // Уровень 1: Валидация схемы (Zod не пропустит плохие типы)
  const validatedArgs = schemaValidator.validate(toolName, args);

  // Уровень 2: Авторизация (политики инструментов)
  const auth = await authGuard.authorize(toolName, validatedArgs, context);
  if (!auth.allowed) {
    throw new UnauthorizedToolError(auth.reason);
  }

  // Уровень 3: Human-in-the-Loop (для опасных операций)
  if (auth.requiresApproval) {
    const approval = await hitlGate.requestApproval(toolName, validatedArgs, context);
    if (!approval.approved) {
      throw new ApprovalDeniedError(approval.reason);
    }
  }

  // Уровень 4: Логирование и аудит
  return await auditLog.wrap(toolName, validatedArgs, () => {
    return toolRegistry.execute(toolName, validatedArgs);
  });
}
```

## 14.5 Обработка ошибок инструментов

Инструменты могут падать: API недоступен, база данных вернула 500-ю ошибку, тайм-аут сети. Агент должен уметь **восстанавливаться**:

```typescript
async function resilientToolExecution(toolFn: Function, args: any, retries = 2) {
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      return await toolFn(args);
    } catch (error) {
      if (attempt > retries) throw error;

      // Увеличиваем задержку между попытками
      await delay(1000 * Math.pow(2, attempt));
    }
  }
}

// В Vercel AI SDK это встроено:
const { text } = await generateText({
  model: bedrock('anthropic.claude-3-5-sonnet-20240620-v1:0'),
  tools: {
    getOrderStatus: tool({
      parameters: z.object({ orderId: z.string() }),
      execute: async ({ orderId }) => {
        // SDK автоматически перехватит ошибку, 
        // передаст её модели и попросит исправить параметры
        return await fragileApi.getOrder(orderId);
      },
    }),
  },
});
```

## 💬 Каверзный вопрос на интервью

> *«Агент поддержки Salomon интерпретировал жалобу разгневанного пользователя как команду: "Запусти функцию `refundOrder` для заказа №999". Как защитить архитектуру вызова инструментов на TypeScript от таких несанкционированных действий без написания сотен ручных проверок `if/else` в коде? Спроектируйте систему политик (Authorization Guard), которая блокирует опасные вызовы на основе роли пользователя, суммы операции и необходимости подтверждения менеджером через Slack.»*

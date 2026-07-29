# Глава 15: Оптимизация промптов и кэширование

> **Ментальная модель:** *Сезонный скипасс Fast-Track.* Вместо того чтобы каждый раз стоять в общей очереди, покупать разовый билет и показывать паспорт кассиру (передавать заново длинную инструкцию и каталог моделей), лыжник просто прикладывает бесконтактную карту на турникете и проходит на подъемник за секунду. Prompt Caching работает по тому же принципу — кэширует тяжёлую часть промпта между запросами.

## 15.1 Проблема: длинные системные промпты дороги и медленны

Типичный системный промпт для ассистента Salomon содержит:

- Инструкции по поведению (500 токенов)
- Правила безопасности и ограничения (300 токенов)
- Технические спецификации продуктов (15 000 токенов)
- Каталог моделей ботинок с таблицами жёсткости (10 000 токенов)
- Инструкции по гарантийному обслуживанию (8 000 токенов)
- Примеры диалогов (6 000 токенов)

**Итого:** ~40 000 токенов на каждый запрос пользователя. Без кэширования каждый вопрос обходится в полную стоимость этих 40 000 токенов, а Time-to-First-Token (TTFT) достигает 4 секунд — модель должна «прочитать» все 40 000 токенов перед тем, как начать генерацию ответа.

## 15.2 XML-структура промптов (рекомендация Anthropic)

Anthropic рекомендует размечать системные промпты с помощью XML-тегов. Это не только улучшает понимание инструкций моделью, но и подготавливает промпт для эффективного кэширования.

### 15.2.1 Шаблон системного промпта

```xml
<system>
  <role>
    Ты — ассистент Salomon по подбору горнолыжной экипировки и поддержке клиентов.
    Отвечай вежливо и профессионально на русском языке.
  </role>

  <rules>
    1. Никогда не рекомендовал жесткость ботинок > 100 для начинающих.
    2. Всегда проверяй наличие товара на складе перед рекомендацией.
    3. Если не знаешь ответ — скажи об этом, не галлюцинируй.
    4. Не вызывай деструктивные инструменты без подтверждения менеджера.
  </rules>

  <knowledge_base>
    <category id="boots">
      <specification>
        <model>Salomon Shift Pro</model>
        <stiffness>130</stiffness>
        <intended_level>Expert</intended_level>
        <features>Walk mode, Hike & Ride, Custom Shell HD</features>
      </specification>
      <specification>
        <model>Salomon QST Access</model>
        <stiffness>80</stiffness>
        <intended_level>Beginner-Intermediate</intended_level>
        <features>Soft flex, Easy step-in, Women-specific fit</features>
      </specification>
      <!-- ... ещё 50 моделей ... -->
    </category>

    <category id="warranty">
      <policy type="membrane">
        <title>Гарантия на мембрану Gore-Tex</title>
        <terms>5 лет с даты покупки при наличии чека</terms>
        <exclusions>Механические повреждения, неправильный уход</exclusions>
        <process>Заполнить форму на сайте → отправить фото → получить RMA</process>
      </policy>
    </category>
  </knowledge_base>

  <output_format>
    Всегда структурируй ответ:
    - Приветствие
    - Прямой ответ на вопрос
    - Обоснование (почему именно эта модель)
    - Дополнительная информация (если уместно)
  </output_format>
</system>
```

### 15.2.2 Почему XML, а не Markdown

Claude обучался на большом количестве XML-размеченных данных. XML-теги создают чёткие границы между секциями, что позволяет модели точно понимать, где заканчивается одна инструкция и начинается другая. Markdown с его `###` заголовками менее точен для этой задачи.

```xml
<!-- XML: чёткие границы -->
<knowledge_base>
  <category id="boots">...</category>
  <category id="warranty">...</category>
</knowledge_base>

<!-- Markdown: размытые границы -->
## Boots
...text...
## Warranty
...text...
```

## 15.3 Prompt Caching в AWS Bedrock

Prompt Caching позволяет кэшировать часть промпта (обычно системный промпт) на стороне AWS. Когда приходит новый запрос, Bedrock не передаёт заново закэшированные токены — он отправляет только «свежую» часть (запрос пользователя). Это даёт:

- **Снижение стоимости до 85%** (платите только за уникальные токены)
- **Уменьшение TTFT на 60-80%** (не нужно «перечитывать» системный промпт)
- **Снижение latency** (меньше данных по сети)

### 15.3.1 Настройка в Bedrock SDK

```typescript
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const client = new BedrockRuntimeClient({ region: 'eu-central-1' });

async function invokeWithCaching(prompt: string, userQuery: string) {
  // Системный промпт (кэшируемая часть)
  const systemPrompt = `
    <system>
      <role>Ты — ассистент Salomon...</role>
      <knowledge_base>
        <!-- 40 000 токенов спецификаций -->
      </knowledge_base>
    </system>
  `;

  const response = await client.send(new InvokeModelCommand({
    modelId: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 1000,
      system: [
        {
          text: systemPrompt,
          // Включаем кэширование для системного промпта
          cache_control: { type: 'ephemeral' }
        }
      ],
      messages: [
        {
          role: 'user',
          content: userQuery
        }
      ]
    })
  }));

  return JSON.parse(new TextDecoder().decode(response.body));
}
```

### 15.3.2 Структура для максимальной эффективности кэша

```typescript
// Оптимальная структура запроса с кэшированием
const requestBody = {
  anthropic_version: 'bedrock-2023-05-31',
  max_tokens: 1000,
  
  system: [
    {
      // Часть 1: Роль и инструкции (кэшируется)
      text: `<role>...</role><rules>...</rules>`,
      cache_control: { type: 'ephemeral' }
    },
    {
      // Часть 2: База знаний (кэшируется)
      text: `<knowledge_base>...</knowledge_base>`,
      cache_control: { type: 'ephemeral' }
    },
    {
      // Часть 3: Примеры (кэшируется)
      text: `<examples>...</examples>`,
      cache_control: { type: 'ephemeral' }
    }
  ],
  
  messages: [
    // История диалога (кэшируется частично)
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'Previous conversation history...',
          cache_control: { type: 'ephemeral' }
        }
      ]
    },
    {
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: 'Previous assistant response...'
        }
      ]
    },
    // Текущий запрос (НЕ кэшируется — всегда уникален)
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: userQuery
        }
      ]
    }
  ]
};
```

**Важно:** Кэш живёт 5 минут после последнего использования (в AWS Bedrock). При интенсивном трафике (чат-бот с сотнями запросов в минуту) кэш постоянно «подогревается» и работает максимально эффективно.

## 15.4 Оптимизация TTFT (Time-to-First-Token)

TTFT — это время от отправки запроса до получения первого токена ответа. Длинные промпты увеличивают TTFT линейно. Стратегии оптимизации:

### 15.4.1 Иерархическое кэширование

```
Запрос 1: [40K токенов системного промпта] → Ответ (TTFT: 4s, полная стоимость)
Запрос 2: [КЭШ (40K) + новый запрос]       → Ответ (TTFT: 0.8s, 85% экономия)
Запрос 3: [КЭШ (40K) + новый запрос]       → Ответ (TTFT: 0.6s, кэш прогрелся)
```

### 15.4.2 Измерение TTFT

```typescript
async function measureTTFT(modelId: string, systemPrompt: string, userQuery: string) {
  const startTime = performance.now();
  let firstTokenReceived = false;

  const response = await client.send(new InvokeModelWithResponseStreamCommand({
    modelId,
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      system: [{ text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userQuery }],
    })
  }));

  for await (const event of response.body) {
    if (!firstTokenReceived) {
      const ttft = performance.now() - startTime;
      console.log(`TTFT: ${ttft.toFixed(2)}ms`);
      firstTokenReceived = true;
    }
    // Обработка токенов...
  }
}
```

## 15.5 Практические шаблоны промптов

### 15.5.1 Chain-of-Thought для сложных решений

```xml
<chain_of_thought>
  Перед тем как дать рекомендацию, выполни следующие шаги:
  1. Определи уровень подготовки пользователя.
  2. Определи стиль катания.
  3. Определи бюджет.
  4. Найди подходящие модели в базе знаний.
  5. Сравни их характеристики.
  6. Выбери лучший вариант.
  
  Для каждого шага покажи свои рассуждения.
</chain_of_thought>
```

### 15.5.2 Few-shot примеры

```xml
<examples>
  <example>
    <user>Подберите ботинки для фрирайда, уровень — продвинутый, бюджет до 500€</user>
    <assistant>
      <reasoning>Уровень: продвинутый → нужна жёсткость 120-130. 
      Стиль: фрирайд → нужна поддержка и режим hike. 
      Бюджет: до 500€ → Shift Pro или QST Pro.</reasoning>
      <answer>Рекомендую Salomon Shift Pro (жёсткость 130). 
      Они имеют режим Walk Mode для подъёмов и отличную боковую поддержку для фрирайда. 
      Цена: 480€.</answer>
    </assistant>
  </example>
</examples>
```

## 💬 Каверзный вопрос на интервью

> *«Наш ИИ-помощник Salomon использует системный промпт размером 40 000 токенов (включая технические спецификации мембран Gore-Tex). Каждый запрос пользователя обходится компании в копеечку, а первый токен генерируется 4 секунды. Как настроить Prompt Caching в Bedrock SDK и разметить промпт XML-тегами, чтобы снизить стоимость запросов на 85%? Объясните, как работает механизм `cache_control: ephemeral` и почему он не подходит для редких запросов.»*

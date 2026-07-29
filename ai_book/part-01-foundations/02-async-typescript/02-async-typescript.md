# Глава 2: Склоны и подъемники — Асинхронные потоки и стриминг в Node.js/TypeScript

Представьте себе утро на горнолыжном курорте во французских Альпах. Свежий вельвет на трассах ждет первых лыжников. На нижней станции подъемника собирается толпа. У администрации курорта есть два способа поднять людей на вершину:

1. **Большая гондола (Синхронный подход с ожиданием):** Мы запускаем огромную кабину на 100 человек. Но она не тронется с места, пока полностью не заполнится. Лыжники стоят внизу, мерзнут и ждут. Когда кабина наконец заполняется, она медленно поднимается. Наверху одновременно выходят 100 человек, создавая давку на старте трассы.
2. **Кресельный подъемник (Асинхронный стриминг):** Кресла идут непрерывным потоком. Как только пара лыжников подходит к турникету, они тут же садятся и уезжают вверх. Наверху они плавно и без давки выходят на склон. Никто не стоит внизу в ожидании полной загрузки.

В AI-инженерии большая гондола — это традиционный синхронный HTTP-запрос. Если мы просим модель Claude сгенерировать развернутый ответ, генерация 1000 токенов займет около 8 секунд. В это время пользователь видит унылый крутящийся спиннер, а сервер держит открытым тяжелое соединение, накапливая данные в буфере.

Кресельный подъемник — это **стриминг (Streaming)**. Как только модель генерирует первый слог первого слова, этот кусочек данных (токен) тут же отправляется в сеть и отображается на экране смартфона. Время ожидания для пользователя (Time-to-First-Token, TTFT) падает с 8 секунд до 150 миллисекунд.

В этой главе мы разберем, как спроектировать такую систему на Node.js и TypeScript без угрозы перегрузки памяти серверов.

---

## Под капотом: Event Loop и запросы к AWS Bedrock

Чтобы построить надежный стриминговый сервис, нужно понимать, как среда выполнения Node.js справляется с этой задачей без создания тысяч потоков ОС.

Node.js — это однопоточная среда выполнения. Если бы мы блокировали этот единственный поток на те самые 8 секунд, пока LLM думает над ответом, наш сервер не смог бы обслужить больше одного пользователя одновременно.

Когда ваше приложение на NestJS или Express делает запрос к API AWS Bedrock для вызова модели Claude, происходит следующее:

```
                  [ Запрос к AWS Bedrock ]
                             │
                             ▼
 ┌────────────────────────────────────────────────────────┐
 │                      Event Loop                        │
 │                                                        │
 │ 1. Отправляет запрос в ядро ОС (epoll/kqueue)          │
 │ 2. Освобождает поток выполнения для других задач       │
 │ 3. Ждет системного прерывания от сетевой карты         │
 └───────────────────────────┬────────────────────────────┘
                             │
                             ▼
               [ Пришел пакет байт от Claude ]
                             │
                             ▼
                  [ Callback в очередь задач ]
```

### libuv и системные мультиплексоры

Node.js построен на библиотеке **libuv**, которая обеспечивает абстракцию над асинхронным вводом-выводом операционной системы:

- На **Linux** используется `epoll` — высокопроизводительный мультиплексор, способный отслеживать тысячи файловых дескрипторов за O(1).
- На **macOS** и BSD используется `kqueue` — аналогичный механизм с уведомлениями о событиях на сокетах и файлах.
- На **Windows** используется `IOCP` (Input/Output Completion Ports).

Event Loop регистрирует сокет соединения и говорит: *«Я свободен для других задач. Когда сетевая карта получит первые байты от AWS Bedrock, дайте мне знать»*.

### Фазы Event Loop

```
   ┌───────────────────────────┐
┌─>│          timers           │
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │     pending callbacks     │
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │       idle, prepare       │
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │           poll            │◄── Ожидание новых сокетных событий
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │           check           │
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │      close callbacks      │
│  └───────────────────────────┘
```

Как только первая порция данных от Claude (например, JSON-строка чанка SSE) приземляется в буфер сетевой карты, ОС генерирует прерывание. libuv уведомляет Event Loop. Тот подхватывает событие, выполняет коллбэк и передает эти байты дальше по цепочке — вашему клиенту.

---

## Стриминг с Vercel AI SDK и Server-Sent Events (SSE)

Для реализации стриминга в веб-приложениях используется протокол **Server-Sent Events (SSE)**. В отличие от двунаправленных WebSockets, SSE работает поверх стандартного протокола HTTP, используя заголовок `Transfer-Encoding: chunked`. Сервер держит соединение открытым и отправляет данные текстовыми блоками специального формата:

```text
data: {"type":"text_delta","text":"Рекомендуемая "}

data: {"type":"text_delta","text":"модель "}

data: {"type":"text_delta","text":"- Speedcross 6"}
```

### Time-to-First-Token (TTFT): почему это критично

TTFT — это метрика, измеряющая время от момента отправки запроса пользователем до момента получения **первого** сгенерированного токена. В синхронной модели пользователь ждет 8+ секунд, видя пустой экран. При стриминге:

- Первый токен приходит через 150-400 мс (время до первого байта от модели).
- Пользователь начинает читать ответ почти мгновенно.
- Воспринимаемая задержка (perceived latency) падает драматически.

### Production-ready обработчик на TypeScript

Давайте напишем production-ready обработчик, используя Vercel AI SDK и официальный адаптер для AWS Bedrock:

```typescript
import { streamText } from 'ai';
import { bedrock } from '@ai-sdk/amazon-bedrock';
import { Request, Response } from 'express';

export async function handleRecommendationStream(req: Request, res: Response) {
  const { userActivity, terrainType } = req.body;

  try {
    // 1. Устанавливаем HTTP-заголовки для SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    // Отключаем буферизацию Nginx (если он стоит перед Node.js)
    res.setHeader('X-Accel-Buffering', 'no');

    // 2. Инициируем стриминг из AWS Bedrock с использованием Claude 3.5 Sonnet
    const result = await streamText({
      model: bedrock('anthropic.claude-3-5-sonnet-20240620-v1:0'),
      prompt: `Ты — эксперт по экипировке.
               Подбери идеальную обувь для следующей активности: "${userActivity}" на типе покрытия "${terrainType}".
               Объясни свой выбор кратко, выдели ключевые технологии.`,
    });

    // 3. Перенаправляем поток данных (ReadableStream) напрямую в HTTP-ответ (WritableStream)
    // Метод pipeDataStreamToResponse() автоматически форматирует вывод под стандарты SSE
    result.pipeDataStreamToResponse(res);

  } catch (error) {
    console.error('Ошибка стриминга из Bedrock:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Не удалось сгенерировать рекомендацию.' });
    }
  }
}
```

Благодаря абстракции `streamText`, нам не нужно вручную парсить сырые байты от AWS. Библиотека сама обрабатывает поток, упаковывает его в формат SSE и передает клиенту.

### Streaming с API OpenAI на Node.js: ручной парсинг SSE

Если вы используете OpenAI напрямую (без Vercel AI SDK), вот как выглядит ручная обработка SSE-потока:

```typescript
import OpenAI from 'openai';
import { Request, Response } from 'express';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function handleOpenAIStream(req: Request, res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    const stream = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: req.body.prompt }],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        // Форматируем как SSE-событие
        res.write(`data: ${JSON.stringify({ text: content })}\n\n`);
      }
    }

    // Сигнал об окончании потока
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch (error) {
    console.error('OpenAI streaming error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Streaming failed' });
    }
  }
}
```

---

## Угроза перегрузки: Борьба с Backpressure

Стриминг кажется идеальным решением, пока ваше приложение не сталкивается с суровой реальностью продакшена: **разной скоростью работы систем**.

Представьте себе ситуацию на том же подъемнике. Наверху кресла прибывают со скоростью 1 кресло каждые 3 секунды. Лыжники должны быстро соскакивать и уезжать в сторону склона. Но что, если один из лыжников замешкался, упал прямо на выходе или просто медленно поправляет крепления? Кресла продолжают прибывать с прежней скоростью. Если оператор не остановит подъемник, на выходе произойдет опасное столкновение и завал из людей.

В разработке этот завал называется **Backpressure (Обратное давление)**.

```
┌────────────────────────┐      Высокая скорость      ┌────────────────────────┐
│  Источник (Bedrock)    ├───────────────────────────►│  Буфер Node.js (RAM)   │
└────────────────────────┘                            └──────────┬─────────────┘
                                                                  │  Медленно (3G)
                                                                  ▼
                                                       ┌────────────────────────┐
                                                       │    Клиент (Смартфон)   │
                                                       └────────────────────────┘
```

Когда мы стримим ответ от Claude, **источник (Producer)** в лице мощного облака AWS Bedrock отдает чанки данных на огромной скорости (например, 100 КБ/с). Однако наш **потребитель (Consumer)** — это клиент, который подключен к интернету через нестабильный и медленный 3G-канал (скорость приема всего 5 КБ/с).

Поскольку сетевое соединение клиента не может принять данные быстрее, чем 5 КБ/с, Node.js не может отправить их в сокет. Куда деваются остальные 95 КБ/с, которые продолжает присылать AWS Bedrock?

Они начинают накапливаться во внутренней оперативной памяти процесса Node.js (в буфере потока внутри кучи V8). Под высокой нагрузкой, когда одновременно сотни пользователей с плохим интернетом запрашивают рекомендации, память вашего сервера мгновенно забьется невостребованными буферами, и процесс упадет по ошибке `Out of Memory` (OOM).

### Как работает механизм Backpressure в Node.js

Встроенные потоки Node.js (Streams API) имеют встроенную систему сигнализации:

1. Каждое сетевое соединение (WritableStream) имеет параметр `highWaterMark` (предельный размер буфера в байтах, по умолчанию 16 КБ).
2. Когда мы пишем данные в сокет с помощью метода `res.write(chunk)`, он возвращает логическое значение (`true` или `false`).
3. Если метод вернул `false`, это означает: *«Мой буфер переполнен! Клиент не успевает читать. Пожалуйста, прекрати присылать новые данные!»* (Это аналог кнопки остановки подъемника).
4. В этот момент мы должны приостановить чтение из источника (`readableStream.pause()`).
5. Когда клиент наконец прочитает данные и буфер очистится, сокет сгенерирует событие `'drain'`. Услышав его, мы можем возобновить чтение (`readableStream.resume()`).

### Безопасный пайплайнинг потоков

К счастью, при использовании `result.pipeDataStreamToResponse(res)` из Vercel AI SDK или стандартного метода `.pipe()` в Node.js, этот сложный танец с паузами и возобновлением происходит автоматически под капотом. Но если вы начнете писать данные в ответ вручную через цикл, вы рискуете обойти эту защиту.

При написании решения на чистом Node.js (без Vercel AI SDK), правильный код выглядит так:

```typescript
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { Request, Response } from 'express';

export async function handleSafeStream(req: Request, res: Response) {
  // ... Настройка заголовков SSE ...

  // Создаем поток чтения из нашего источника (например, клиента Bedrock)
  const sdkReadableStream: Readable = await getBedrockReadableStream();

  // Использование pipeline автоматически связывает потоки,
  // останавливая чтение из Bedrock, если res (клиент) не успевает принимать данные.
  try {
    await pipeline(
      sdkReadableStream,
      res
    );
    console.log('Стрим успешно завершен без утечек памяти.');
  } catch (err) {
    console.error('Поток прерван:', err);
  }
}
```

---

## Параллельная обработка: Promise.all и ограничение конкурентности

Как и в Python, в TypeScript важно не только стримить одиночные ответы, но и эффективно обрабатывать множество параллельных запросов. Рассмотрим пару типичных AI-сценариев.

### Антипаттерн: последовательный await в цикле

```typescript
// ❌ МЕДЛЕННО: Последовательное выполнение
const results = [];
for (const doc of documents) {
  // Ждем завершения каждого запроса, прежде чем начать следующий
  const result = await callLLM(doc.prompt);
  results.push(result);
}
```

### Исправление: Promise.all с ограничением

```typescript
// ⚡ БЫСТРО: Конкурентное выполнение с лимитом
async function processBatchConcurrently(
  documents: Array<{ id: string; prompt: string }>,
  concurrencyLimit: number = 5
): Promise<Array<{ id: string; status: string; data?: string; error?: string }>> {
  const results: Array<{ id: string; status: string; data?: string; error?: string }> = [];
  const executing: Array<Promise<void>> = [];

  async function worker(doc: { id: string; prompt: string }): Promise<void> {
    try {
      const response = await callLLM(doc.prompt);
      results.push({ id: doc.id, status: 'success', data: response });
    } catch (error) {
      results.push({ id: doc.id, status: 'error', error: String(error) });
    }
  }

  for (const doc of documents) {
    // Запускаем задачу
    const task = worker(doc);
    executing.push(task);

    // Если достигли лимита — ждем завершения хотя бы одной задачи
    if (executing.length >= concurrencyLimit) {
      await Promise.race(executing);
      // Удаляем завершенные задачи из массива
      executing.splice(0, executing.length, ...executing.filter(t => {
        // В реальном коде здесь используется более надежный механизм
        return true; // Упрощение для примера
      }));
    }
  }

  // Ждем завершения всех оставшихся задач
  await Promise.all(executing);
  return results;
}
```

Более элегантное решение — использовать библиотеку `p-limit`:

```typescript
import pLimit from 'p-limit';

async function processBatchWithLimit(documents: Array<{ id: string; prompt: string }>) {
  const limit = pLimit(5); // Максимум 5 одновременных запросов

  const tasks = documents.map(doc =>
    limit(async () => {
      const response = await callLLM(doc.prompt);
      return { id: doc.id, data: response };
    })
  );

  return Promise.all(tasks);
}
```

---

## Сравнение asyncio (Python) и Event Loop (Node.js)

Понимание параллелей между Python asyncio и Node.js помогает видеть общую картину:

| Аспект | Python (asyncio) | Node.js (libuv) |
|--------|-----------------|-----------------|
| **Цикл событий** | `asyncio.run()` | Встроенный libuv |
| **Мультиплексор** | `epoll`/`kqueue`/`select` | `epoll`/`kqueue`/`IOCP` |
| **Конкурентность** | coroutines + Tasks | Promises + async/await |
| **Потоков** | 1 (GIL) | 1 (JavaScript — single threaded) |
| **CPU-bound** | `ProcessPoolExecutor` | Worker Threads или дочерний процесс |
| **Streaming** | Async generators (`yield`) | Readable/ Writable Streams |
| **Ограничение** | `asyncio.Semaphore` | `p-limit` или ручной контроль |
| **Балансировка** | `asyncio.gather` | `Promise.all` / `Promise.allSettled` |

---

## Сложное интервью: Диагностика OOM при стриминге

### Сценарий

> *«Наш сервер на NestJS выступает в роли шлюза. Он принимает вопросы от пользователей, ходит в AWS Bedrock к модели Claude 3.5 Sonnet, получает стриминговый ответ и транслирует его на фронтенд. При нагрузочном тестировании сервер падает по ошибке Out-Of-Memory (OOM) уже на 200 параллельных пользователях. При этом загрузка CPU не превышает 10%. Почему память забивается и как локализовать и решить эту проблему?»*

### Архитектурный разбор и решение

#### 1. Диагностика

Низкая загрузка CPU при лавинообразном росте потребления RAM во время стриминга — классический симптом **проблемы "быстрого продюсера и медленного потребителя" (Fast Producer, Slow Consumer)** при отсутствии контроля обратного давления (Backpressure).

Скорее всего, разработчики написали ручной цикл подписки на события от Bedrock и отправляли их клиенту напрямую через сокет без проверки пропускной способности, используя конструкцию вида:

```typescript
// ❌ ОПАСНЫЙ КОД: Игнорирование Backpressure
bedrockStream.on('data', (chunk) => {
  // Мы пишем в ответ, игнорируя возвращаемое значение false.
  // Данные бесконтрольно накапливаются в памяти V8 для медленных клиентов.
  res.write(chunk);
});
```

Если у части тестируемых клиентов эмулировалось медленное мобильное соединение, их сетевые буферы переполнялись, а Node.js продолжал удерживать миллионы строковых чанков в куче V8, ожидая возможности их отправки.

#### 2. Как изолировать проблему без print-логов?

Для подтверждения гипотезы мы можем использовать встроенный профайлер Node.js или утилиту `clinic.js`:

```bash
# Запускаем приложение под наблюдением clinic
npx clinic doctor -- node server.js

# Или делаем снимки кучи (Heap Snapshot) в Chrome DevTools
# node --inspect server.js
# Открываем chrome://inspect и сравниваем снимки памяти
```

- Запускаем нагрузочный тест с профилированием кучи (Heap Snapshot).
- Сравниваем снимки памяти в начале теста и в момент пика RAM.
- В здоровом приложении основную память занимают системные объекты. В случае Backpressure-утечки мы увидим миллионы экземпляров классов `WriteWrap`, `Buffer` или строк с фрагментами ответов Claude, ожидающих отправки в сетевом стеке.

#### 3. Исправление архитектуры

Для исправления мы должны отказаться от ручной подписки на события `'data'` и перейти на стандартный пайплайнинг потоков, который уважает состояние буферов.

```typescript
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

export async function handleSafeStream(req: Request, res: Response) {
  // Настройка заголовков SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // Получаем стрим от Bedrock
  const bedrockStream: Readable = await getBedrockReadableStream(req.body.prompt);

  try {
    // pipeline() автоматически управляет backpressure:
    // - Приостанавливает чтение из bedrockStream, если res.write() вернул false
    // - Возобновляет чтение при событии 'drain' от res
    await pipeline(bedrockStream, res);
    console.log('Стрим успешно завершен.');
  } catch (err) {
    console.error('Поток прерван:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Stream failed' });
    }
  }
}
```

При использовании Vercel AI SDK метод `result.pipeDataStreamToResponse(res)` берет эту заботу на себя, гарантируя, что подъемник будет вовремя останавливаться, если трасса наверху заблокирована медленными клиентами.

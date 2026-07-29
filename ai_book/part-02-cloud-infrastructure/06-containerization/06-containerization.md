# Глава 6: Контейнеризация AI-приложений — Docker для Python и Node.js

> **Ментальная модель:** *Ультралегкий штурмовой рюкзак.* Отправляясь на скоростное восхождение, альпинист выкидывает каждый лишний грамм из рюкзака. При сборке Docker-образа мы безжалостно вырезаем инструменты компиляции, dev-зависимости и системные пакеты, оставляя в продакшене только сжатый рантайм и минимальный набор runtime-зависимостей. Каждый лишний мегабайт в контейнере — это лишние секунды при автоскейлинге.

---

## 6.1. Проблема «толстых» контейнеров в AI

AI-приложения имеют уникальную проблему: их зависимости тяжелы. PyTorch с CUDA-поддержкой весит более 2 ГБ. Инструменты компиляции TypeScript (`node_modules`, `typescript`, `esbuild`) добавляют ещё 300–500 МБ. Если собрать всё в один слой, образ легко переваливает за 14 ГБ — и тогда автоскейлинг во время пиковых нагрузок (Black Friday, старт лыжного сезона) становится невозможным: запуск нового пода занимает 4–12 минут, а не 3 секунды.

**Типичный антипаттерн — монолитный Dockerfile:**

```dockerfile
# ❌ ПЛОХО: всё в одном слое
FROM python:3.12-slim
COPY . /app
RUN pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
RUN pip install -r requirements.txt
CMD ["python", "worker.py"]
```

Этот образ содержит компилятор C++, системные утилиты, документацию pip и десятки файлов, не нужных в рантайме.

---

## 6.2. Multi-stage сборка: разделяем билд и рантайм

Multi-stage сборка позволяет использовать **разные базовые образы** на этапе компиляции и на этапе исполнения. Первый этап (builder) содержит всё для сборки; второй (runtime) — только то, что нужно для запуска.

### 6.2.1. Python: многоэтапный Dockerfile для ML-воркера

```dockerfile
# === ЭТАП 1: Сборка (builder) ===
FROM python:3.12-slim AS builder

# Устанавливаем системные зависимости для компиляции
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Устанавливаем виртуальное окружение
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Копируем только файл с зависимостями (кэширование слоёв)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# === ЭТАП 2: Runtime (финальный образ) ===
FROM python:3.12-slim AS runtime

# Копируем виртуальное окружение из builder — без компиляторов!
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Копируем только исходный код приложения
COPY src/ /app/src/
COPY config/ /app/config/

WORKDIR /app
CMD ["python", "-m", "src.worker"]
```

**Критический нюанс для ML-токенизаторов:** Некоторые токенизаторы (например, `sentencepiece`, `tiktoken`) требуют C-расширения, собранные под конкретную архитектуру. Если вы собираете на `x86_64`, а запускаете на `arm64` (Graviton), токенизатор упадёт с `Illegal instruction`. Решение: либо собирать под целевую архитектуру через `--platform`, либо использовать pure-Python реализации.

### 6.2.2. TypeScript/Node.js: distroless + esbuild

Для Node.js-сервисов применяем ту же стратегию, но с esbuild для компиляции TypeScript:

```dockerfile
# === ЭТАП 1: Сборка (builder) ===
FROM node:20-alpine AS builder

WORKDIR /build

# Копируем манифесты зависимостей (кэширование)
COPY package.json pnpm-lock.yaml ./
RUN npm ci --prod=false

# Компилируем TypeScript через esbuild (быстро, без tsc)
COPY tsconfig.json ./
COPY src/ ./src/
RUN npx esbuild src/index.ts --bundle --platform=node --outfile=dist/index.js --external:aws-sdk

# === ЭТАП 2: Runtime (distroless) ===
FROM gcr.io/distroless/nodejs20-debian12 AS runtime

# Копируем только скомпилированный бандл — ни node_modules, ни TS-исходников!
COPY --from=builder /build/dist/index.js /app/index.js
COPY --from=builder /build/node_modules/ /app/node_modules/

EXPOSE 3000

# USER nonroot — встроенный непривилегированный пользователь
USER nonroot
CMD ["/app/index.js"]
```

**Почему distroless?** Образ `gcr.io/distroless/nodejs` содержит только Node.js и системные библиотеки — нет shell, нет apt, нет `curl`. Это уменьшает поверхность атаки и радикально снижает размер. В сочетании с esbuild-бандлом (один файл вместо сотен) итоговый образ — 120–150 МБ вместо 2.8 ГБ.

---

## 6.3. Управление секретами: API-ключи и AWS-доступы

Хардкодить ключи в образе — грубейшее нарушение безопасности. В AI-приложениях секретов много: ключи Anthropic, AWS-креденшелы, токены OpenSearch, пароли Redis.

### Правильные подходы:

| Метод | Когда использовать | Пример |
|-------|-------------------|--------|
| **Переменные окружения** | Для единичных ключей при локальной разработке | `docker run -e ANTHROPIC_API_KEY=sk-...` |
| **Docker Secrets** | Docker Swarm (редко в AI) | `/run/secrets/` |
| **AWS Secrets Manager / SSM** | Продакшен в AWS, EKS, ECS | `aws secretsmanager get-secret-value` |
| **Kubernetes Secrets** | EKS (следующая глава) | `envFrom` в манифесте пода |

```dockerfile
# Пример: секреты пробрасываются в рантайм, а не в образ
FROM gcr.io/distroless/nodejs20-debian12

COPY --from=builder /build/dist /app

# Никаких ENV ANTHROPIC_API_KEY=... — это идёт из рантайма!
EXPOSE 3000

# При запуске:
# docker run -e ANTHROPIC_API_KEY=$(aws secretsmanager --secret-id prod/ai/anthropic --query SecretString --output text) ...
CMD ["/app/index.js"]
```

---

## 6.4. Docker Compose: локальная разработка AI-стэка

Для локальной разработки AI-сервисов редко бывает достаточно одного контейнера. Типичный стэк включает:

- **API-сервер** (Node.js/Python)
- **PostgreSQL + pgvector** (векторное хранилище)
- **Redis** (кэш, очереди, Pub/Sub)
- **OpenSearch** (гибридный поиск — опционально)

```yaml
# docker-compose.yml
version: "3.9"

services:
  api:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    env_file:
      - .env.local  # Только локальные ключи, не в git!
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: ai_knowledge
      POSTGRES_USER: ai_user
      POSTGRES_PASSWORD: local_dev_only # Never in prod!
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ai_user -d ai_knowledge"]
      interval: 5s
      timeout: 3s
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 3s

volumes:
  pgdata:
```

**Ключевые паттерны:**
- `condition: service_healthy` — API не стартует, пока БД и Redis не готовы принять соединения.
- `.env.local` — в `.gitignore`, содержит только локальные ключи.
- Никаких продакшен-секретов в Compose-файле.

---

## 6.5. Оптимизация времени старта контейнера

Размер образа — не единственная метрика. **Время до первого ответа (Time-to-First-Byte)** критично для AI-сервисов при автоскейлинге.

| Фактор | Влияние | Оптимизация |
|--------|---------|-------------|
| Размер образа | 2.8 ГБ → 150 МБ | Multi-stage, distroless, esbuild |
| Загрузка модели при старте | До 30 секунд | Горячий кэш модели на EBS/EFS |
| Инициализация соединений | 1–2 сек | Lazy connections, пулы |
| Установка зависимостей | Никогда (уже в образе) | Однослойный COPY приложения |

**Паттерн «Graceful Readiness»:**

```typescript
// readiness.ts — сервис не принимает трафик, пока не готов
import { createServer } from "http";

const ready = async (): Promise<boolean> => {
  try {
    // Проверяем, что модель загружена и БД отвечает
    await db.$queryRaw`SELECT 1`;
    return model.isLoaded();
  } catch {
    return false;
  }
};

const server = createServer(async (req, res) => {
  if (req.url === "/healthz") {
    const isReady = await ready();
    res.writeHead(isReady ? 200 : 503);
    res.end(isReady ? "OK" : "Not Ready");
    return;
  }
  // ... основной обработчик
});
```

---

## 💬 Каверзный вопрос на интервью

> *«Разработчики из продуктовой команды создали образ с ИИ-ассистентом, размер которого составил 2.8 ГБ из-за компиляторов и лишних зависимостей. При автоскейлинге во время распродажи Black Friday запуск нового пода занимает 4 минуты, из-за чего пользователи получают ошибки таймаута. Как переписать Dockerfile, чтобы снизить размер образа до 150 МБ и сократить время старта до 3 секунд?»*

**Архитектурный разбор:**

1. **Multi-stage сборка:** Первый этап — `node:20-alpine` с TypeScript, `esbuild` и всеми dev-зависимостями. Второй этап — `gcr.io/distroless/nodejs20-debian12`, куда копируется только скомпилированный бандл.

2. **Детекция причин:** 2.8 ГБ — это `node_modules` с dev-зависимостями (`@types/*`, `typescript`, `jest`) и, возможно, системные пакеты `build-essential`. Используем `npm ci --prod` для продакшен-зависимостей и `esbuild --bundle` для исключения неиспользуемого кода.

3. **Дополнительная оптимизация:** Использовать `npm prune --production` после сборки, удалить кэш npm (`rm -rf /root/.npm`), переключить базовый образ на `alpine` или `distroless`.

4. **Время старта 3 секунды:** При размере 150 МБ Docker-демон загружает образ за <1 сек. Самый тяжёлый шаг — загрузка модели. Используем `sidecar`-контейнер для предварительной загрузки модели в общую файловую систему, либо подключаем слой EBS/EFS с горячим кэшем.

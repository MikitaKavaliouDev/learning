# Глава 17: Лабораторная работа — Миграция монолита в микросервисы

> **Цель:** Взять монолит Task Tracker из Главы 16 и поэтапно выделить из него сервис аутентификации в самостоятельный микросервис. Закрепить на практике паттерны Strangler Fig, межсервисное взаимодействие, Docker-контейнеризацию и событийную архитектуру.
> **Время выполнения:** 4–5 дней (по 4–6 часов)
> **Уровень:** Senior

---

## Контекст

Вы — Senior-разработчик в компании, которая решила мигрировать монолитное приложение на микросервисную архитектуру. В качестве пилотного проекта вы выбрали выделение сервиса аутентификации. Это классический «Strangler Fig» (Паттерн «Удав»): вы не переписываете всё сразу, а постепенно заменяете части монолита микросервисами.

Исходный код: Task Tracker из Главы 16.

---

## Архитектура «До» (Монолит)

```
[ Angular SPA ] ──► [ Monolith: api:8080 ]
                       ├── AuthController (JWT)
                       ├── TaskController
                       ├── TaskService
                       └── UserRepository / TaskRepository
                              └── [ PostgreSQL:5432 ]
```

## Архитектура «После» (Микросервисы)

```
[ Angular SPA ] ──► [ API Gateway:8080 ]
                       ├── Auth Service:8081 ──► [ Auth DB:5432 ]
                       └── Task Service:8082 ──► [ Task DB:5433 ]
                                                    │
                                              [ Kafka:9092 ]
                                              (UserRegistered event)
```

---

## Шаг 1. Выделение Auth Service

### 1.1. Создайте новый проект Auth Service

Используйте Spring Initializr:

- **Project:** Maven
- **Java 21**
- **Dependencies:** Spring Web, Spring Security, Spring Data JPA, PostgreSQL Driver, Validation, Lombok

### 1.2. Скопируйте JWT-логику из монолита

Перенесите из монолита (Глава 16):

- `JwtService` — генерация и валидация токенов
- `JwtAuthenticationFilter` — фильтр для проверки JWT
- `SecurityConfig` — конфигурация Spring Security
- `AuthController` — эндпоинты `/api/auth/login` и `/api/auth/register`
- `User` entity и `UserRepository`

### 1.3. Добавьте REST-эндпоинт для валидации токена

Task Service должен иметь возможность проверить токен. Добавьте в Auth Service:

```java
// AuthController.java (дополнение)
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    // ... существующие методы login, register ...

    @PostMapping("/validate")
    public ResponseEntity<ValidationResponse> validateToken(
            @RequestBody TokenValidationRequest request) {
        boolean valid = jwtService.isTokenValid(request.token());
        String username = valid ? jwtService.extractUsername(request.token()) : null;

        return ResponseEntity.ok(new ValidationResponse(valid, username));
    }
}

record TokenValidationRequest(String token) {}
record ValidationResponse(boolean valid, String username) {}
```

**Почему POST, а не GET?** Токен может быть длинным, и передавать его в query-параметрах небезопасно (попадает в логи сервера).

### 1.4. Настройте application.yml для Auth Service

```yaml
# auth-service/src/main/resources/application.yml
server:
  port: 8081

spring:
  datasource:
    url: jdbc:postgresql://localhost:5433/authdb
    username: auth_user
    password: auth_pass
  jpa:
    hibernate:
      ddl-auto: update

jwt:
  secret: ${JWT_SECRET}
  expiration-ms: 3600000
```

---

## Шаг 2. Модификация Task Service

### 2.1. Создайте проект Task Service

На базе Task Tracker из Главы 16, но **удалите** из него:

- `JwtService`
- `JwtAuthenticationFilter`
- `SecurityConfig` (замените на упрощенную версию)
- `AuthController`
- Всё, что связано с пользователями

### 2.2. Добавьте HTTP-клиент к Auth Service

```java
package com.taskservice.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
public class RestClientConfig {

    @Bean
    public RestClient authServiceClient() {
        return RestClient.builder()
            .baseUrl("http://localhost:8081/api/auth")
            .build();
    }
}
```

### 2.3. Создайте сервис для валидации токена

```java
package com.taskservice.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
@RequiredArgsConstructor
public class TokenValidationService {

    private final RestClient authServiceClient;

    public ValidationResponse validateToken(String token) {
        return authServiceClient.post()
            .uri("/validate")
            .body(new TokenValidationRequest(token))
            .retrieve()
            .body(ValidationResponse.class);
    }
}

record TokenValidationRequest(String token) {}
record ValidationResponse(boolean valid, String username) {}
```

### 2.4. Обновите SecurityConfig в Task Service

```java
package com.taskservice.config.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.*;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@RequiredArgsConstructor
class InternalAuthFilter extends OncePerRequestFilter {

    private final TokenValidationService tokenValidationService;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) {

        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            ValidationResponse result = tokenValidationService.validateToken(token);

            if (result.valid()) {
                // Устанавливаем SecurityContext
                UsernamePasswordAuthenticationToken auth =
                    new UsernamePasswordAuthenticationToken(
                        result.username(), null, List.of());
                SecurityContextHolder.getContext().setAuthentication(auth);
            }
        }

        filterChain.doFilter(request, response);
    }
}
```

### 2.5. Gateway — единая точка входа

Создайте третий микросервис — `api-gateway` на Spring Cloud Gateway:

```yaml
# gateway/src/main/resources/application.yml
server:
  port: 8080

spring:
  cloud:
    gateway:
      routes:
        - id: auth-service
          uri: http://localhost:8081
          predicates:
            - Path=/api/auth/**
        - id: task-service
          uri: http://localhost:8082
          predicates:
            - Path=/api/tasks/**

# Настройка CORS для Angular
  cloud.gateway.globalcors:
    cors-configurations:
      '[/**]':
        allowedOrigins: "http://localhost:4200"
        allowedMethods: "*"
        allowedHeaders: "*"
```

---

## Шаг 3. Docker-контейнеризация

### 3.1. Dockerfile для Auth Service

```dockerfile
# auth-service/Dockerfile
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -B
COPY src ./src
RUN mvn package -DskipTests

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8081
ENTRYPOINT ["java", "-jar", "app.jar"]
```

### 3.2. Обновленный docker-compose.yml

```yaml
# docker-compose.yml
version: '3.8'

services:
  # ---- Auth Service ----
  auth-db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: authdb
      POSTGRES_USER: auth_user
      POSTGRES_PASSWORD: auth_pass
    ports:
      - "5433:5432"
    volumes:
      - auth-pgdata:/var/lib/postgresql/data

  auth-service:
    build: ./auth-service
    ports:
      - "8081:8081"
    environment:
      SPRING_DATASOURCE_URL: jdbc:postgresql://auth-db:5432/authdb
      SPRING_DATASOURCE_USERNAME: auth_user
      SPRING_DATASOURCE_PASSWORD: auth_pass
      JWT_SECRET: ${JWT_SECRET}
    depends_on:
      - auth-db

  # ---- Task Service ----
  task-db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: taskdb
      POSTGRES_USER: task_user
      POSTGRES_PASSWORD: task_pass
    ports:
      - "5434:5432"
    volumes:
      - task-pgdata:/var/lib/postgresql/data

  task-service:
    build: ./task-service
    ports:
      - "8082:8082"
    environment:
      SPRING_DATASOURCE_URL: jdbc:postgresql://task-db:5432/taskdb
      SPRING_DATASOURCE_USERNAME: task_user
      SPRING_DATASOURCE_PASSWORD: task_pass
      AUTH_SERVICE_URL: http://auth-service:8081
    depends_on:
      - task-db
      - auth-service

  # ---- Gateway ----
  gateway:
    build: ./gateway
    ports:
      - "8080:8080"
    depends_on:
      - auth-service
      - task-service

  # ---- Kafka (добавим на шаге 5) ----
  kafka:
    image: confluentinc/cp-kafka:latest
    ports:
      - "9092:9092"
    # ...конфигурация...

  # ---- Frontend ----
  frontend:
    build: ./frontend
    ports:
      - "4200:80"
    depends_on:
      - gateway

volumes:
  auth-pgdata:
  task-pgdata:
```

---

## Шаг 4. Межсервисное взаимодействие

### 4.1. Синхронное: HTTP (REST) — готово

Мы уже настроили Auth Service → Task Service через `RestClient`. 

**Проблема синхронной связи:**
- Если Auth Service недоступен, Task Service не может валидировать токены → падает весь API.
- Высокая задержка: каждый запрос к API задач ждёт ответа от Auth Service.

### 4.2. Продвинутый: HTTP с Circuit Breaker (Resilience4j)

Добавьте Resilience4j в Task Service:

```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-circuitbreaker-resilience4j</artifactId>
</dependency>
```

Обновите `TokenValidationService`:

```java
@Service
@RequiredArgsConstructor
public class TokenValidationService {

    private final RestClient authServiceClient;
    private final CircuitBreaker circuitBreaker;

    public ValidationResponse validateToken(String token) {
        return circuitBreaker.runSupplier(
            () -> authServiceClient.post()
                .uri("/validate")
                .body(new TokenValidationRequest(token))
                .retrieve()
                .body(ValidationResponse.class),
            throwable -> {
                // Fallback: кэшированная валидация или отказ
                log.warn("Auth service unavailable, falling back");
                return new ValidationResponse(false, null);
            }
        );
    }
}
```

### 4.3. Асинхронное: RabbitMQ (для событий)

Добавьте опциональный шаг: при регистрации пользователя в Auth Service отправлять событие `UserRegistered` в RabbitMQ, чтобы Task Service мог подготовить для нового пользователя начальные данные (например, категорию «Личное»).

**Auth Service (продюсер):**

```java
@Service
@RequiredArgsConstructor
public class UserEventPublisher {

    private final RabbitTemplate rabbitTemplate;

    public void publishUserRegistered(String email) {
        UserRegisteredEvent event = new UserRegisteredEvent(email, Instant.now());
        rabbitTemplate.convertAndSend("user.exchange", "user.registered", event);
    }
}

record UserRegisteredEvent(String email, Instant timestamp) {}
```

**Task Service (консюмер):**

```java
@Component
@RequiredArgsConstructor
public class UserEventListener {

    private final CategoryRepository categoryRepository;

    @RabbitListener(queues = "task.user.registered")
    public void handleUserRegistered(UserRegisteredEvent event) {
        // Создаем дефолтную категорию для нового пользователя
        Category personal = Category.builder()
            .name("Личное")
            .userEmail(event.email())
            .build();
        categoryRepository.save(personal);
    }
}
```

---

## Шаг 5. (Advanced) Kafka для Event-Driven архитектуры

### 5.1. Зачем переходить с RabbitMQ на Kafka?

| Критерий | RabbitMQ | Kafka |
|----------|----------|-------|
| Модель | Очередь (Queue) | Log (Журнал) |
| Хранение | Удаляет после доставки | Хранит по retention policy |
| Повторная обработка | Нужно переотправлять | Можно перечитать с любого offset |
| Порядок сообщений | В рамках очереди | В рамках партиции |
| Use-case | Команды / Task distribution | События / Event Sourcing |

### 5.2. Настройка Kafka в docker-compose (уже добавлена)

### 5.3. Продюсер в Auth Service

```java
// Auth Service
@Service
@RequiredArgsConstructor
public class KafkaEventPublisher {

    private final KafkaTemplate<String, Object> kafka;

    public void publishUserRegistered(String email) {
        UserRegisteredEvent event = new UserRegisteredEvent(email, Instant.now());
        kafka.send("user.registered", email, event);
    }
}
```

### 5.4. Консюмер в Task Service

```java
// Task Service
@Component
@RequiredArgsConstructor
public class KafkaUserEventListener {

    private final CategoryRepository categoryRepository;

    @KafkaListener(topics = "user.registered", groupId = "task-service")
    public void handleUserRegistered(UserRegisteredEvent event,
                                      @Header(KafkaHeaders.RECEIVED_KEY) String email) {
        log.info("Received user.registered for {}", email);

        Category personal = Category.builder()
            .name("Личное")
            .userEmail(email)
            .build();
        categoryRepository.save(personal);
    }
}
```

### 5.5. Kafka Configuration

```java
@Configuration
public class KafkaConfig {

    @Bean
    public NewTopic userRegisteredTopic() {
        return TopicBuilder.name("user.registered")
            .partitions(3)
            .replicas(1)
            .build();
    }

    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, Object> kafkaListenerFactory(
            ConsumerFactory<String, Object> consumerFactory) {
        var factory = new ConcurrentKafkaListenerContainerFactory<String, Object>();
        factory.setConsumerFactory(consumerFactory);
        return factory;
    }
}
```

---

## Шаг 6. Наблюдаемость (Observability)

### 6.1. Distributed Tracing с Micrometer + Zipkin

Добавьте в каждый микросервис:

```xml
<dependency>
    <groupId>io.micrometer</groupId>
    <artifactId>micrometer-tracing-bridge-brave</artifactId>
</dependency>
<dependency>
    <groupId>io.zipkin.reporter2</groupId>
    <artifactId>zipkin-reporter-brave</artifactId>
</dependency>
```

```yaml
# application.yml (каждый сервис)
management:
  tracing:
    sampling:
      probability: 1.0
  zipkin:
    tracing:
      endpoint: http://zipkin:9411/api/v2/spans
```

### 6.2. Логирование с correlation ID

```java
@Component
public class CorrelationIdFilter extends OncePerRequestFilter {

    private static final String CORRELATION_ID_HEADER = "X-Correlation-Id";

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                     HttpServletResponse response,
                                     FilterChain chain) {
        String correlationId = request.getHeader(CORRELATION_ID_HEADER);
        if (correlationId == null) {
            correlationId = UUID.randomUUID().toString();
        }

        // Прокидываем в MDC для логирования
        MDC.put("correlationId", correlationId);
        response.setHeader(CORRELATION_ID_HEADER, correlationId);

        chain.doFilter(request, response);
    }
}
```

### 6.3. Health Checks

```yaml
# application.yml
management:
  endpoints:
    web:
      exposure:
        include: health,info,prometheus
  endpoint:
    health:
      show-details: always
```

---

## Шаг 7. Обработка ошибок между сервисами

### 7.1. Проблемы распределённой архитектуры

| Проблема | Последствие | Решение |
|----------|-------------|---------|
| Auth Service недоступен | Пользователи не могут войти | Circuit Breaker + fallback |
| Task Service недоступен | Задачи не загружаются | Graceful degradation |
| Kafka недоступен | События теряются | Retry + Dead Letter Queue |
| Race condition: регистрация → создание задачи | Task Service не знает о пользователе | Eventual consistency |

### 7.2. Graceful Degradation (Постепенная деградация)

Если Task Service не может проверить токен, он может:

1. **Отказать** — вернуть 401 (безопасно, но плохой UX).
2. **Использовать кэш** — если токен уже был проверен ранее, доверить кэшированному результату.
3. **Разрешить read-only** — только GET запросы без авторизации.

```java
@Service
public class TokenCacheService {

    private final Cache<String, ValidationResponse> cache =
        Caffeine.newBuilder()
            .expireAfterWrite(5, TimeUnit.MINUTES)
            .maximumSize(10000)
            .build();

    public ValidationResponse validateWithCache(String token,
                                                 Supplier<ValidationResponse> remoteCall) {
        try {
            ValidationResponse result = remoteCall.get();
            cache.put(token, result);
            return result;
        } catch (Exception e) {
            ValidationResponse cached = cache.getIfPresent(token);
            if (cached != null) return cached;
            throw new ServiceUnavailableException("Auth service unavailable");
        }
    }
}
```

### 7.3. Dead Letter Queue (DLQ) для Kafka

Сообщения, которые не удалось обработать, отправляются в DLQ:

```java
@RetryableTopic(
    attempts = "3",
    backoff = @Backoff(delay = 1000, multiplier = 2),
    dltTopicSuffix = ".dead-letter"
)
@KafkaListener(topics = "user.registered", groupId = "task-service")
public void handleUserRegistered(UserRegisteredEvent event) {
    // ...
}

@DltHandler
public void handleDlt(UserRegisteredEvent event, @Header(KafkaHeaders.RECEIVED_TOPIC) String topic) {
    log.error("Event from {} failed after retries. Payload: {}", topic, event);
    // Отправить уведомление в Slack/PagerDuty
}
```

---

## Вопросы для размышления (Interview Prep)

Ответьте на эти вопросы перед собеседованием:

1. **Почему мы выбрали именно Auth Service в качестве первого кандидата на выделение?** Какие критерии выбора первого микросервиса?

2. **Как обеспечить Consistency (согласованность) между сервисами?** Если пользователь зарегистрировался, но Task Service ещё не получил событие, что произойдёт?

3. **Как вы тестируете интеграцию между микросервисами локально?** Контрактные тесты (Pact), Testcontainers, или Docker Compose?

4. **Что будет, если Gateway упадёт?** Как избежать Single Point of Failure?

5. **Как мигрировать данные пользователей из монолитной БД в новую БД Auth Service?** Стратегия:双重書き込み (Dual Write) или Change Data Capture (Debezium)?

6. **Как вы организуете логин в распределённой системе?** Session vs JWT vs BFF + HttpOnly Cookie?

7. **Что такое Distributed Transaction и почему их стараются избегать?** В чём разница между двухфазным коммитом (2PC) и сагой (Saga)?

---

## Чек-лист выполнения лабораторной

| Шаг | Задача | Статус |
|-----|--------|--------|
| 1 | Создать Auth Service с JWT и эндпоинтом `/validate` | ☐ |
| 2 | Модифицировать Task Service: удалить JWT, добавить HTTP-клиент | ☐ |
| 3 | Создать Gateway (Spring Cloud Gateway) | ☐ |
| 4 | Настроить Docker Compose на 3 сервиса + 2 БД | ☐ |
| 5 | Добавить Circuit Breaker (Resilience4j) | ☐ |
| 6 | Добавить RabbitMQ или Kafka для событий | ☐ |
| 7 | Настроить Distributed Tracing (Zipkin) | ☐ |
| 8 | Реализовать очевидность (Health Checks, логи с correlation ID) | ☐ |
| 9 | Написать интеграционные тесты для межсервисного взаимодействия | ☐ |
| 10 | Ответить на все вопросы для размышления (см. выше) | ☐ |

---

## Критерии оценки (Self-Check)

- **Базовый уровень (Шаги 1–3):** Выделен Auth Service, Task Service общается с ним через HTTP.
- **Средний уровень (Шаги 4–5):** Добавлен Gateway, Circuit Breaker, Docker Compose для 3+ контейнеров.
- **Продвинутый уровень (Шаги 6–7):** Kafka/RabbitMQ, distributed tracing, DLQ, graceful degradation.

---

## Итог

Выполнив эту лабораторную работу, вы:

1. **Реализовали** паттерн Strangler Fig на практике.
2. **Настроили** межсервисное взаимодействие (синхронное HTTP + асинхронные события).
3. **Добавили** отказоустойчивость через Circuit Breaker и Retry.
4. **Внедрили** наблюдаемость: distributed tracing, correlation ID, health checks.
5. **Поняли** боли распределённых систем: согласованность, тайм-ауты, DLQ, race conditions.

Этот опыт — **идеальный кейс для рассказа на Senior-интервью**. На французских собеседованиях особенно ценятся кандидаты, которые не просто «знают теорию микросервисов», а реально делали миграцию и могут обосновать каждое архитектурное решение.

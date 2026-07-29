# Глава 9: От монолита к микросервисам

> «Микросервисы — это не архитектура. Это **организационный паттерн**, который требует зрелости команды, инфраструктуры и процессов» — *из реального комитета архитекторов STMicroelectronics.*

После миграции Java 8 → 21 и Angular 8 → 20 следующим логическим шагом стало разбиение монолита на микросервисы. Мы не делали «Big Bang» декомпозицию — каждый микросервис вырезался по одному, через Strangler Fig.

---

## 9.1. Domain-Driven Design: Bounded Context

### Почему DDD?

Декомпозиция «на глаз» (по слоям или технологиям) приводит к **distribution monolith** — распределённому монолиту, который сочетает недостатки монолита (связность) и микросервисов (сетевая задержка).

### Event Storming

Мы провели **Event Storming** — workshop, где бизнес-аналитики и разработчики вместе моделируют доменные события:

```
1. Определяем доменные события (глаголы в прошедшем времени)
   - OrderPlaced, PaymentReceived, InvoiceGenerated, ShipmentDelivered

2. Группируем события по агрегатам
   - Order Aggregate: {OrderPlaced, OrderCancelled, OrderConfirmed}
   - Payment Aggregate: {PaymentReceived, PaymentRefunded, PaymentFailed}

3. Проводим границы Bounded Context
   - Ordering Context (заказы)
   - Billing Context (биллинг)
   - Inventory Context (склад)
```

### Bounded Context — физические границы

Каждый Bounded Context стал отдельным микросервисом:

```
┌─────────────────────────────────────────────────────┐
│                  API Gateway                         │
├──────────┬──────────┬──────────┬─────────────────────┤
│ Orders   │ Billing  │Inventory │ Notification         │
│ Service  │ Service  │ Service  │ Service              │
├──────────┼──────────┼──────────┼─────────────────────┤
│ orders_  │ billing_ │ inventory│ events_              │
│ db       │ db       │ _db      │ db (outbox)         │
└──────────┴──────────┴──────────┴─────────────────────┘
```

Каждый сервис имеет:
- **Свою БД** (Database per Service pattern).
- **Свой API** (REST/gRPC).
- **Свой CI/CD pipeline**.
- **Свою команду** (2–3 разработчика).

---

## 9.2. Критерии декомпозиции

### По бизнес-логике

Сервисы группируются по доменным событиям и агрегатам:

| Сервис | Агрегаты | Бизнес-категория |
|--------|---------|------------------|
| OrderService | Order, OrderItem | Purchasing |
| PaymentService | Payment, Refund | Billing |
| InventoryService | Stock, Warehouse | Logistics |
| NotificationService | Email, SMS, Push | Communication |
| UserService | User, Profile, Role | Identity & Access |

### По нагрузке

Некоторые сервисы выделялись из-за профиля нагрузки:

```java
// InventoryService — Cache-heavy: частая запись, редкое чтение
@Service
public class InventoryService {
    @CachePut(value = "stock", key = "#productId")
    public void updateStock(Long productId, int quantity) { ... }

    @Cacheable(value = "stock", key = "#productId")
    public int getStock(Long productId) { ... }
}

// ReportService — CPU-heavy: тяжёлые вычисления
@Service
public class ReportService {
    public Report generateReport(Long companyId) {
        // Выделен в отдельный микросервис из-за высокого потребления CPU
        return complexCalculation(companyId);
    }
}
```

### Правило «2 pizza team»

Каждый микросервис должен обслуживаться командой, которую можно накормить двумя пиццами (5–8 человек). Если команда больше — сервис слишком сложный и требует дальнейшей декомпозиции.

---

## 9.3. API Gateway vs Direct Communication

### Проблема прямого общения

Если микросервисы общаются напрямую:

- Клиентский код знает о всех сервисах.
- Сложно версионировать API.
- Нет единой точки аутентификации.
- Сложно рефакторить (менять адреса сервисов).

### Решение: API Gateway (Spring Cloud Gateway)

```yaml
# application.yml — API Gateway
spring:
  cloud:
    gateway:
      routes:
        - id: order-service
          uri: lb://order-service  # load-balanced через Eureka/K8s
          predicates:
            - Path=/api/orders/**
          filters:
            - name: CircuitBreaker
              args:
                name: orderServiceCircuitBreaker
                fallbackUri: forward:/fallback/orders

        - id: billing-service
          uri: lb://billing-service
          predicates:
            - Path=/api/billing/**
```

### REST, gRPC, GraphQL — что выбрали мы

| Протокол | Где используем | Почему |
|----------|---------------|--------|
| **REST/JSON** | Внешние API (клиенты, партнёры) | Универсальность, совместимость |
| **gRPC** | Internal сервис-сервис | Высокая производительность, строгие контракты (protobuf) |
| **GraphQL** | Frontend (BFF) | Гибкие запросы, уменьшение over-fetching |

**Пример gRPC-контракта (protobuf):**

```protobuf
syntax = "proto3";

service OrderService {
  rpc GetOrder (GetOrderRequest) returns (Order);
  rpc CreateOrder (CreateOrderRequest) returns (Order);
}

message GetOrderRequest {
  int64 order_id = 1;
}

message Order {
  int64 id = 1;
  string status = 2;
  repeated OrderItem items = 3;
}
```

---

## 9.4. Message Brokers: Kafka / RabbitMQ

### Зачем нужен брокер сообщений

В монолите один сервис синхронно вызывал другой: `paymentService.processPayment(order)`. В микросервисах такой синхронный вызов создаёт жёсткую связь.

### Event-Driven Architecture

Мы перешли на событийную архитектуру с Apache Kafka:

```
OrderService ──(OrderPlaced)──► Kafka ──(OrderPlaced)──► BillingService
                                       ──(OrderPlaced)──► InventoryService
                                       ──(OrderPlaced)──► NotificationService
```

**Пример публикации события:**

```java
@Service
public class OrderService {
    private final KafkaTemplate<String, Object> kafka;

    @Transactional
    public Order placeOrder(CreateOrderRequest request) {
        Order order = orderRepository.save(new Order(request));

        // Публикуем событие — BillingService спишет деньги
        kafka.send("orders", new OrderPlacedEvent(order.getId(), order.getTotal()));
        
        return order;
    }
}
```

**Пример обработки события:**

```java
@Component
public class BillingEventHandler {
    
    @KafkaListener(topics = "orders", groupId = "billing-group")
    public void handleOrderPlaced(OrderPlacedEvent event) {
        // Kafka гарантирует at-least-once delivery
        if (alreadyProcessed(event.orderId())) {
            return; // Идемпотентность
        }
        
        paymentService.charge(event.orderId(), event.total());
    }
}
```

### Kafka vs RabbitMQ

| Критерий | Apache Kafka | RabbitMQ |
|---------|-------------|----------|
| **Модель** | Log-based (хранение событий) | Queue-based (очередь сообщений) |
| **Хранение** | Долгое (дни/недели) | Короткое (после обработки удаляется) |
| **Производительность** | ~1M msg/sec | ~50K msg/sec |
| **Порядок сообщений** | Гарантирован в partition-е | Не гарантирован |
| **Когда выбирать** | Event sourcing, stream processing | Task queues, RPC, простые очереди |

---

## 9.5. Sagas, Компенсирующие транзакции, Идемпотентность

### Проблема распределённых транзакций

В монолите была одна ACID-транзакция: `@Transactional` на весь процесс заказа. В микросервисах транзакция распределена между сервисами.

Двухфазный коммит (2PC) не подходит — он блокирует ресурсы и не масштабируется.

### Saga Pattern

Saga — это последовательность локальных транзакций с компенсациями (откатами):

```
OrderService: placeOrder() ✓
    → BillingService: charge() ✓  
        → InventoryService: reserveStock() ✗ (товара нет)
            → BillingService: refund() (компенсация)
                → OrderService: cancelOrder() (компенсация)
```

**Choreography-based Saga (децентрализованная):**

```java
@Service
public class OrderSagaService {
    
    @Transactional
    public void placeOrder(Long orderId) {
        Order order = orderRepository.findById(orderId)
            .orElseThrow();

        // Шаг 1: Создаём заказ
        order.setStatus(OrderStatus.PENDING);
        orderRepository.save(order);

        // Шаг 2: Отправляем событие для резервирования средств
        kafka.send("payment-commands", new ReservePaymentCommand(orderId, order.getTotal()));
    }
}
```

**Orchestration-based Saga (централизованная):**

```java
@Component
public class OrderSagaOrchestrator {

    @Saga
    public void execute(OrderSagaData data) {
        // Оркестратор управляет шагами
        step()
            .invoke(() -> paymentService.charge(data.getOrderId()))
            .withCompensation(() -> paymentService.refund(data.getOrderId()));

        step()
            .invoke(() -> inventoryService.reserve(data.getOrderId(), data.getItems()))
            .withCompensation(() -> inventoryService.release(data.getOrderId(), data.getItems()));

        step()
            .invoke(() -> notificationService.sendConfirmation(data.getOrderId()));
    }
}
```

### Идемпотентность — ключ к надёжности

В распределённых системах сообщения могут дублироваться (at-least-once delivery). Каждый обработчик должен быть **идемпотентным**:

```java
@Component
public class PaymentHandler {

    // Таблица идемпотентности
    private final Set<String> processedEvents = ConcurrentHashMap.newKeySet();

    @KafkaListener(topics = "payment-commands")
    public void handlePayment(ReservePaymentCommand command) {
        // 1. Проверяем, не обработано ли уже событие
        String eventId = command.eventId();
        if (!processedEvents.add(eventId)) {
            log.info("Duplicate event: {}", eventId);
            return; // Уже обработано
        }

        // 2. Обрабатываем
        paymentService.charge(command.orderId(), command.amount());

        // 3. Публикуем результат
        kafka.send("payment-events", new PaymentReservedEvent(command.orderId()));
    }
}
```

---

## 9.6. Наблюдаемость: ELK, Prometheus, Jaeger

В монолите достаточно было читать логи одного приложения. В микросервисах нужна **централизованная наблюдаемость (Observability)** — три столпа:

### 1. Логирование (ELK Stack)

```yaml
# docker-compose для ELK
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.x
  logstash:
    image: docker.elastic.co/logstash/logstash:8.x
  kibana:
    image: docker.elastic.co/kibana/kibana:8.x
```

В Spring Boot добавляем **корреляционный ID**:

```java
@Bean
public OncePerRequestFilter correlationIdFilter() {
    return new OncePerRequestFilter() {
        @Override
        protected void doFilterInternal(HttpServletRequest request,
                                         HttpServletResponse response,
                                         FilterChain chain) throws IOException, ServletException {
            String correlationId = request.getHeader("X-Correlation-Id");
            if (correlationId == null) {
                correlationId = UUID.randomUUID().toString();
            }
            MDC.put("correlationId", correlationId);
            response.setHeader("X-Correlation-Id", correlationId);
            chain.doFilter(request, response);
        }
    };
}
```

### 2. Метрики (Prometheus + Grafana)

```yaml
# application.yml
management:
  endpoints:
    web:
      exposure:
        include: prometheus
  metrics:
    export:
      prometheus:
        enabled: true
```

Key метрики микросервиса:

```
http_request_duration_seconds{method="POST",uri="/api/orders",status="200"}
jvm_memory_used_bytes{area="heap"}
resilience4j_circuitbreaker_state{name="orderService"}
kafka_consumer_fetch_manager_records_lag
```

### 3. Трейсинг (Jaeger / OpenTelemetry)

```xml
<!-- OpenTelemetry + Jaeger -->
<dependency>
    <groupId>io.opentelemetry</groupId>
    <artifactId>opentelemetry-exporter-otlp</artifactId>
</dependency>
```

```yaml
# application.yml
otel:
  service.name: order-service
  exporter:
    otlp:
      endpoint: http://jaeger:4317
```

---

## 9.7. Resilience Patterns: Circuit Breaker, Retry, Rate Limiting

### Resilience4j в микросервисах

Во время миграции старый монолит (Java 8) общался с новыми микросервисами (Java 21). Старые сервисы работали нестабильно — мы применили **Resilience4j**.

### Circuit Breaker (Предохранитель)

```java
@CircuitBreaker(name = "inventoryService", fallbackMethod = "getDefaultStock")
public StockResponse getStock(Long productId) {
    return inventoryClient.getStock(productId);
}

public StockResponse getDefaultStock(Long productId, Throwable t) {
    log.warn("Inventory service unavailable, returning default", t);
    return new StockResponse(productId, 0); // Fallback
}
```

Конфигурация:

```yaml
resilience4j:
  circuitbreaker:
    instances:
      inventoryService:
        slidingWindowSize: 10
        minimumNumberOfCalls: 5
        failureRateThreshold: 50
        waitDurationInOpenState: 30s
```

### Retry (Автоматические повторные попытки)

```java
@Retry(name = "paymentService", fallbackMethod = "paymentFallback")
public PaymentResponse processPayment(PaymentRequest request) {
    return paymentClient.charge(request);
}
```

```yaml
resilience4j:
  retry:
    instances:
      paymentService:
        maxAttempts: 3
        waitDuration: 500ms
        exponentialBackoffMultiplier: 2
```

### Rate Limiter (Ограничение частоты запросов)

```java
@RateLimiter(name = "orderCreation")
@PostMapping("/orders")
public ResponseEntity<Order> createOrder(@Valid @RequestBody CreateOrderRequest request) {
    return ResponseEntity.ok(orderService.createOrder(request));
}
```

```yaml
resilience4j:
  ratelimiter:
    instances:
      orderCreation:
        limitForPeriod: 100
        limitRefreshPeriod: 1m
        timeoutDuration: 0
```

### Bulkhead (Изоляция потоков)

```java
@Bulkhead(name = "pdfGeneration", type = Bulkhead.Type.THREADPOOL)
public PdfDocument generatePdf(Long reportId) {
    return pdfService.generate(reportId);
}
```

---

## 9.8. Database per Service — как делить данные

### Проблема: монолитная БД

В монолите все таблицы были в одной базе PostgreSQL:

```
monolith_db
├── orders (10M rows)
├── payments (5M rows)
├── users (500K rows)
├── inventory (1M rows)
└── reports (параллельные запросы грузят CPU)
```

### Решение: делим БД по Bounded Context

```
orders_db (PostgreSQL)
├── orders
└── order_items

billing_db (PostgreSQL)
├── payments
└── invoices

inventory_db (PostgreSQL, heavy write)
├── stock
└── warehouse_logs

reports_db (Read Replica, ClickHouse для аналитики)
├── materialized_views
└── aggregated_reports
```

**Важно:** В микросервисах **запрещены** cross-service JOIN-ы. Данные агрегируются на уровне приложения или через CQRS.

---

## 9.9. Шпаргалка для Senior-интервью

### Ключевые ответы

| Вопрос | Ответ |
|--------|-------|
| **«Как декомпозировали монолит?»** | Event Storming → Bounded Context → Database per Service → Strangler Fig |
| **«Как сервисы общаются?»** | gRPC для internal (protobuf контракты), REST/JSON для внешних API, Kafka для событий |
| **«Как обеспечиваете консистентность?** | Sagas (Orchestration-based) + idempotency keys + outbox pattern |
| **«Что с производительностью?** | CQRS для read-heavy, Redis cache для горячих данных, async обработка через Kafka |
| **«Resilience Patterns?** | Circuit Breaker (Resilience4j), Retry с exponential backoff, Bulkhead для thread pool изоляции |

---

> **Подводный камень (Gotcha):** «Database per Service» не означает, что каждый микросервис должен иметь свой экземпляр PostgreSQL. Это означает, что сервис имеет **доступ только к своим данным** через своё API. Физически БД может быть одна, но схемы (schemas) разграничены.

---

**Что дальше:** В Главе 10 — миграция в облако: Docker, Kubernetes, CI/CD и cloud-native стратегии.

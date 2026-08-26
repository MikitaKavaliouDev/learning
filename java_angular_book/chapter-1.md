# CHAPTER 1: The Monolith vs. The Airport City
### *Microservices Architecture, Bounded Contexts & Distributed Resilience*

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    THE MONOLITHIC AIRPORT TERMINAL                          │
│                                                                             │
│  [ Ticketing ] ─── [ Baggage ] ─── [ Fuel Depot ] ─── [ Banking Vault ]     │
│         │                │                │                   │             │
│         └────────────────┴───────┬────────┴───────────────────┘             │
│                                  │                                          │
│                   ❌ SINGLE FAILURE: Pipe burst in Fuel                      │
│                      Depot floods the Banking Vault.                        │
│                      ENTIRE AIRPORT EVACUATED & GROUNDED.                   │
└─────────────────────────────────────────────────────────────────────────────┘

                                    VS.

┌─────────────────────────────────────────────────────────────────────────────┐
│                  THE DISTRIBUTED AEROTROPOLIS (MICROSERVICES)               │
│                                                                             │
│  ┌──────────────────────┐    REST / JSON    ┌──────────────────────┐        │
│  │   Passenger Terminal │ ◄───────────────► │  Cargo & Supply Hub  │        │
│  │   (Spring Boot Pod)  │                   │  (Spring Boot Pod)   │        │
│  └──────────┬───────────┘                   └──────────┬───────────┘        │
│             │                                          │                    │
│      [ Dedicated DB ]                           [ Dedicated DB ]            │
│             │                                          │                    │
│             ▼                                          ▼                    │
│   ══════════════════════════ Kafka Event Bus ══════════════════════════     │
│             ▲                                          ▲                    │
│  ┌──────────┴───────────┐                   ┌──────────┴───────────┐        │
│  │   Payment Vault Svc  │ ◄─ [CIRCUIT] ───► │  Flight Control Svc  │        │
│  │   (Isolated Engine)  │    [BREAKER]      │  (Zero-Downtime Pod) │        │
│  └──────────────────────┘                   └──────────────────────┘        │
│                                                                             │
│  ✔ ISOLATION: Cargo Hub failure never stops Payment Vault.                  │
│  ✔ INDEPENDENT SCALING: Terminal scales up 10x during peak hours.           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 1. THE MENTAL MODEL

In the early days of aviation, an airport was a single wooden hangar. The ticket agent, the mechanic, the customs guard, the fuel barrels, and the cash safe all sat inside the same room under one roof. 

If the fuel barrel leaked and caught fire, the ticket counter burned down, the cash safe melted, and every flight across the continent was grounded. If 5,000 holiday passengers stormed the lobby, the mechanic was crushed in the crowd and could not reach the runway to change an airplane tire.

This is the **Monolith**. It is simple to build on day one, but as complexity grows, every component shares the same memory space, the same CPU, and the exact same database. A single `OutOfMemoryError` in a PDF export routine takes down the core payment processing engine.

**The Modern Aerotropolis (Microservices Architecture)** breaks the single building into a sprawling, interconnected ecosystem of autonomous facilities:

* **Bounded Contexts (Dedicated Buildings):** The Passenger Terminal (Ticketing), the Industrial Freight Hub (Supply Chain & Warehousing), and the Armored Vault (Banking Core) operate in physically separate buildings.
* **Database-per-Service (Private Basements):** The Freight Hub does not possess keys to the Armored Vault’s basement. If the Freight Hub needs payment confirmation, it must send an official courier (an authenticated API call or event message) to the Vault's front desk.
* **Blast Radius Containment (Fire Doors):** If a conveyor belt motor explodes in the Freight Hub, automated fire doors snap shut. The Cargo terminal operates at reduced capacity, but the Passenger Terminal and the Banking Core continue processing millions of euros per second completely unaffected.
* **The Circuit Breaker (The Automated Border Checkpoint):** If the Customs Checkpoint is overwhelmed and stops answering calls, the Passenger Terminal does not allow 10,000 passengers to pile up in a narrow hallway until everyone suffocates. It diverts them immediately to a comfortable holding lounge with a clear explanatory broadcast (Fallback).

---

### 2. THE MECHANICS

#### 2.1 Domain-Driven Design (DDD) & Bounded Contexts
In a combined Banking and Industrial Supply Chain system, words lose universal meaning. 

In a Monolith, developers create a colossal `Order.java` entity with 140 columns trying to satisfy everyone. In DDD, we enforce strict **Bounded Contexts**:

```
                       [ DOMAIN: THE ENTERPRISE ]
                                   │
         ┌─────────────────────────┴─────────────────────────┐
         ▼                                                   ▼
[ PAYMENT CONTEXT ]                                 [ LOGISTICS CONTEXT ]
- Order = A financial debit liability               - Order = A physical package
- Key Attributes: TransactionId, Amount, Currency   - Key Attributes: WeightKg, Dimensions,
- Invariant: Balance cannot drop below zero           WarehouseSlotId
                                                    - Invariant: Stock cannot be negative
```

Each microservice owns its data model, its business invariants, and its dedicated datastore. **Never allow Service A to read or write directly to Service B’s database.**

---

#### 2.2 Implementing Fault Tolerance with Resilience4j in Spring Boot 3+

When microservices communicate over HTTP/REST, the network *will* fail, packets *will* drop, and remote servers *will* slow down. 

A call that hangs for 30 seconds holds onto an active Tomcat worker thread. If 200 concurrent requests hang, the entire service runs out of threads and dies (**Cascading Failure**).

We prevent this using the **Resilience4j Circuit Breaker** state machine:

```
           Normal Operation
         ┌──────────────────┐
         │      CLOSED      │ ◄─────────────────────────┐
         └────────┬─────────┘                           │
                  │ Failure Rate > Threshold            │ Success Rate > Threshold
                  │ (e.g., 50% of calls fail)           │ (e.g., 80% calls succeed)
                  ▼                                     │
         ┌──────────────────┐                  ┌────────┴─────────┐
         │       OPEN       │ ── Wait 10s ───► │    HALF-OPEN     │
         └──────────────────┘  (Sleep Window)  └──────────────────┘
           Fast Fail: Reject                     Probe: Test with a
           all incoming calls                    few canary requests
           immediately!
```

##### Production-Grade Resilience4j Configuration (`application.yml`)

```yaml
resilience4j:
  circuitbreaker:
    instances:
      inventoryServiceBreaker:
        slidingWindowType: COUNT_BASED
        slidingWindowSize: 20             # Evaluate the last 20 requests
        minimumNumberOfCalls: 10          # Need at least 10 calls before calculating rate
        failureRateThreshold: 50          # Open circuit if 50% or more fail
        slowCallRateThreshold: 75         # Open circuit if 75% take longer than slowCallDuration
        slowCallDurationThreshold: 2000ms # Any call > 2 seconds is considered "slow"
        waitDurationInOpenState: 10000ms  # Stay in OPEN state for 10s before probing (HALF-OPEN)
        permittedNumberOfCallsInHalfOpenState: 5 # Let 5 canary requests through in HALF-OPEN
        automaticTransitionFromOpenToHalfOpenEnabled: true
  timelimiter:
    instances:
      inventoryServiceBreaker:
        timeoutDuration: 3000ms           # Hard cutoff at 3 seconds
```

##### Resilient Banking-Logistics Client Implementation (Java 17+ / Spring Boot 3+)

```java
package com.astek.banking.logistics.client;

import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.timelimiter.annotation.TimeLimiter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.concurrent.CompletableFuture;

@Slf4j
@Component
@RequiredArgsConstructor
public class InventoryServiceClient {

    private final RestClient restClient;
    private static final String SERVICE_NAME = "inventoryServiceBreaker";

    /**
     * Calls remote warehouse service to reserve physical assets.
     * Wrapped with CircuitBreaker and TimeLimiter to guarantee zero thread starvation.
     */
    @CircuitBreaker(name = SERVICE_NAME, fallbackMethod = "reserveStockFallback")
    @TimeLimiter(name = SERVICE_NAME)
    public CompletableFuture<StockReservationResponse> reserveStock(StockReservationRequest request) {
        return CompletableFuture.supplyAsync(() -> {
            log.info("Executing remote stock reservation for SKU: {}", request.sku());
            return restClient.post()
                    .uri("/api/v1/warehouse/reserve")
                    .body(request)
                    .retrieve()
                    .body(StockReservationResponse.class);
        });
    }

    /**
     * FALLBACK MECHANISM:
     * Invoked instantly when Circuit is OPEN, timed out, or HTTP 5xx occurs.
     * Prevents the entire banking transaction from crashing ungracefully.
     */
    public CompletableFuture<StockReservationResponse> reserveStockFallback(
            StockReservationRequest request, Throwable throwable) {
        
        log.error("Warehouse Service unavailable. Triggering degraded fallback for SKU: {}. Root cause: {}", 
                request.sku(), throwable.getMessage());

        // Return a degraded, queued status instead of failing hard
        StockReservationResponse degradedResponse = new StockReservationResponse(
                request.sku(),
                ReservationStatus.PENDING_ASYNC_CONFIRMATION,
                "Warehouse system degraded. Order queued in Outbox for eventual consistency."
        );

        return CompletableFuture.completedFuture(degradedResponse);
    }
}
```

---

#### 2.3 The CAP Theorem & Eventual Consistency in Financial Logistics

In a distributed environment, the network is fundamentally unreliable. The **CAP Theorem** dictates that a distributed data store can simultaneously provide at most two of the following three guarantees:

```
                          Consistency (C)
                          (All nodes see same
                           data simultaneously)
                               / \
                              /   \
                             /  ★  \
                            /       \
                           /  BANK   \
                          /   TRANS-  \
                         /    ACTIONS  \
                        /               \
        Availability (A) ═══════════════ Partition Tolerance (P)
     (Every request gets                (System functions despite
      a non-error response)              dropped network packets)
```

1. **Banking Wire Transfers (CP System):** We choose **Consistency** over Availability. If the network between Paris and New York splits, we **refuse** the transfer rather than risk double-spending funds.
2. **Supply Chain Tracking / Catalog (AP System):** We choose **Availability** over strict immediate Consistency. If the central warehouse database cannot be reached, the UI still serves cached tracking data with a status: *"Estimated location as of 5 mins ago."*

---

### 3. THE ENTERPRISE PITFALLS

#### 💣 War Story: The Distributed Monolith Avalanche
* **Context:** A major banking client split their monolith into 14 microservices. However, every service called the next service via synchronous HTTP REST (`OrderService` $\rightarrow$ `PaymentService` $\rightarrow$ `AccountService` $\rightarrow$ `NotificationService` $\rightarrow$ `AuditService`).
* **The Disaster:** `AuditService` suffered a slow memory leak and started taking 8 seconds per request instead of 10 milliseconds. 
* **The Result:** The latency cascaded upstream like dominoes. `NotificationService` ran out of HTTP connection pool threads, which exhausted `AccountService`, which exhausted `PaymentService`, which froze `OrderService`. The entire banking portal crashed. 
* **The Root Cause:** They built a **Distributed Monolith**—all the network latency, deployment complexity, and debugging nightmares of microservices, with the tight coupling of a monolith.
* **The Architectural Fix:** Decouple synchronous chains using **Asynchronous Event-Driven Messaging (Kafka/RabbitMQ)** and place strict timeouts and Circuit Breakers on all remaining synchronous boundaries.

```
❌ BAD (Synchronous Cascading Chain):
[Client] ──> [Order Svc] ──> [Payment Svc] ──> [Audit Svc (HANGS 8s!)] ──> 💥 Crash All

✔ GOOD (Decoupled with Event Bus):
[Client] ──> [Order Svc] ──> [Payment Svc] ──> (Returns 202 Accepted immediately)
                                 │
                           [ Kafka Event ]
                         /        │        \
                        ▼         ▼         ▼
                [Audit Svc] [Notif Svc] [Logistics Svc]
```

---

#### 💣 War Story: The "Dual-Write" Financial Catastrophe
* **Context:** An e-commerce supply chain platform executing an order checkout.
* **The Anti-Pattern Code:**

```java
// ❌ THE SILENT KILLER: Dual-Write Anti-Pattern
@Transactional
public void processOrder(Order order) {
    // Step 1: Write to local PostgreSQL DB
    orderRepository.save(order); 
    
    // Step 2: Send message to Kafka broker
    kafkaTemplate.send("order-events", new OrderCreatedEvent(order)); 
}
```

* **What Blew Up:** If the database commit succeeds, but the network connection to Kafka hiccups before the event is sent, the bank account is debited, but the warehouse never ships the product. Conversely, if Kafka accepts the event, but the database transaction rolls back due to a constraint violation, the warehouse ships a package for free!
* **The Architectural Fix: The Transactional Outbox Pattern.**

```
[ Local Database Transaction Boundary ]
┌────────────────────────────────────────────────────────┐
│  1. INSERT INTO orders (...)                           │
│  2. INSERT INTO outbox_table (event_payload, status)   │
└────────────────────────────────────────────────────────┘
                           │ (Guaranteed ACID Atomic)
                           ▼
          [ Debezium / Polling Publisher Engine ]
                           │ (Reads Outbox Table)
                           ▼
               [ Apache Kafka / RabbitMQ ]
```

---

### 4. THE INTERVIEW CHEAT SHEET

##### Q1: How do you decide whether an enterprise should use a Monolith or Microservices?
> **Answer:** Microservices are an **organizational and operational scalability solution**, not a default design. 
> * Choose a **Modular Monolith** when domain boundaries are still shifting, team size is small (<15 devs), and low operational complexity/speed-to-market is the priority. 
> * Choose **Microservices** when multiple autonomous cross-functional teams need to deploy independently without release train bottlenecks, when distinct subdomains have radically different scaling profiles (e.g., high-throughput telemetry vs. low-throughput payment processing), and when blast-radius isolation is mandatory for compliance and uptime.

##### Q2: What is a "Distributed Monolith", and how do you detect one in an existing codebase?
> **Answer:** A Distributed Monolith occurs when an architecture is physically deployed as separate services, but remains **tightly coupled in design**. 
> Key symptoms include:
> 1. Cascading runtime outages (one service slowing down causes all upstream services to crash).
> 2. Direct database sharing between microservices.
> 3. Lock-step deployments (Service A version 2.4 cannot deploy without deploying Service B version 1.8 simultaneously).
> 4. Excessive synchronous HTTP chains ($A \rightarrow B \rightarrow C \rightarrow D$) instead of asynchronous, event-driven integration.

##### Q3: How does Resilience4j's Circuit Breaker determine when to open and close?
> **Answer:** It uses an internal ring buffer (sliding window) based either on a **count of calls** (e.g., last 100 requests) or **time duration** (e.g., last 60 seconds). 
> * If the **failure rate** or **slow-call rate** exceeds the configured threshold within that window, it transitions from `CLOSED` to `OPEN`, immediately fast-failing future calls without hitting the network.
> * After a configured `waitDurationInOpenState`, it enters `HALF-OPEN`, permitting a small number of trial/canary requests through. 
> * If the canary requests succeed above the recovery threshold, it resets to `CLOSED`; otherwise, it returns to `OPEN`.

##### Q4: What is the Saga Pattern, and how does it replace 2-Phase Commit (2PC) in distributed transactions?
> **Answer:** 2PC is a blocking protocol that doesn't scale in distributed cloud architectures because it holds database locks across network boundaries until all nodes agree. 
> The **Saga Pattern** manages distributed transactions as a sequence of local transactions:
> * Each service executes its local database transaction and publishes an event/message.
> * The next service executes its transaction upon receiving the event.
> * If any step fails, the Saga coordinates **Compensating Transactions** that run backward to undo the changes explicitly (e.g., refunding a debit or unreserving inventory).
> * Sagas can be implemented via **Choreography** (event-driven, decentralized) or **Orchestration** (a central state machine directing the steps).

##### Q5: How do you enforce data consistency between a database write and a message broker emission (The Dual-Write Problem)?
> **Answer:** By implementing the **Transactional Outbox Pattern**. Instead of writing to the database and publishing to the message broker in two separate operations, the application saves the business entity and an event record into a dedicated `outbox` table within the **same local ACID database transaction**. 
> An asynchronous background worker (using Change Data Capture / Debezium reading the database WAL log, or a high-performance polling engine) reads the outbox table and reliably publishes the messages to the broker with **at-least-once delivery guarantees**.
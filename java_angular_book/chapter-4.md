# CHAPTER 4: The Spring Boot Power Grid
### *Inversion of Control, Dependency Injection & The Bean Lifecycle*

```
                 [ THE CENTRAL SUBSTATION: ApplicationContext ]
                                       │
     ┌─────────────────────────────────┼─────────────────────────────────┐
     ▼                                 ▼                                 ▼
[ Radar Bean ]                [ JetBridge Bean ]                [ Cargo Scanner Bean ]
(Singleton Grid)              (Singleton Grid)                  (Prototype Pod)
     │                                 │                                 │
     └───────────────────── Standardized Conduit Plug ───────────────────┘
                                       │
                   [ @Service / Final Constructor Injection ]
                                       │
                                       ▼
                     [ Dynamic Proxy Interceptor Layer ]
                     ( @Transactional / @PreAuthorize )
```

---

### 1. THE MENTAL MODEL

Imagine building a modern international mega-airport from scratch.

In an amateur design, every time a baggage scanner needs electricity, the technician behind the desk lays a dedicated copper wire out the window, runs it across the tarmac, and builds a miniature diesel generator in the parking lot. When the flight radar system needs time synchronization, an air traffic controller constructs a private mechanical pendulum clock in the control tower.

When 200 different instruments each build, manage, and fuel their own isolated power generators, three fatal conditions arise:
1. **Unchecked Proliferation:** You have 5,000 tiny combustion engines sputtering across the terminals, consuming vast resources and leaking toxic exhaust.
2. **Hidden Failure Points:** If a generator catches fire behind a drywall partition, nobody knows who built it or how to shut it down.
3. **Rigid Inflexibility:** If you want to switch from diesel fuel to solar power, you have to dismantle and rebuild all 5,000 appliances by hand.

**Spring Boot is the Centralized High-Voltage Automated Power Grid.**

* **The Inversion of Control (IoC) Container / `ApplicationContext` (The Central Substation):** It owns the generation and dispatching of power. It parses the airport engineering schematics (`@Configuration`, `@Component`, `@Service`), manufactures the heavy machinery (**Beans**), wires the infrastructure together in strict dependency order, and monitors operational health.
* **Inversion of Control (IoC):** Appliances *never* build their own power plants (`new HeavyService()`). Instead, they surrender control. An appliance simply exposes an industry-standard three-prong conduit socket.
* **Dependency Injection (DI):** The central substation spots the socket and injects the exact transformer matching the required specification at startup.
* **Bean Scopes:**
  * **Singleton (The Terminal Air Conditioning):** Exactly one shared, uninterrupted system keeps the entire airport climate-controlled. Every room connects to the same master airflow.
  * **Prototype (The Printed Boarding Pass):** A brand-new, independent, stateful paper slip is stamped out every single time an agent presses the button.
  * **Request Scope (The Passenger Luggage Trolley):** Checked out the moment a passenger steps through the front door, retained across transit, and completely dismantled/recycled when the traveler exits.
* **Dynamic Proxies (The Transparent Power Transformer):** When an appliance requests a line with Surge Protection (`@Transactional`) or an Encrypted Voltage Regulator (`@PreAuthorize`), Spring does not plug the wire directly into the device. It routes the wire through a transparent transformer box (a CGLIB or JDK Dynamic Proxy) that intercepts and verifies the current before it ever touches the appliance.

---

### 2. THE MECHANICS

#### 2.1 Constructor Injection: The Immutability Standard
In modern enterprise development (Spring Boot 3+ and Java 17/21), **Field Injection via `@Autowired` on private fields is an uninsulated fire hazard.**

| Injection Style | Immutability (`final`) | Pure Unit Testability (Without Spring/Reflection) | Circular Dependency Detection |
| :--- | :--- | :--- | :--- |
| **Field Injection (`@Autowired private Svc x;`)** | ❌ Impossible | ❌ Requires reflection or `MockitoExtension` | ❌ Fails at runtime during call |
| **Setter Injection (`@Autowired setSvc(Svc x)`)** | ❌ Mutable | ⚠️ Fragile (State can change post-init) | ⚠️ May mask architectural flaws |
| **Constructor Injection (`final Svc x`)** | ✔ **Guaranteed** | ✔ **Instantiate with plain `new` in JUnit** | ✔ **Fails fast at container startup** |

```java
package com.astek.banking.vault.service;

import com.astek.banking.vault.domain.Account;
import com.astek.banking.vault.repository.AccountRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.Objects;

@Slf4j
@Service
public class SettlementService {

    // 1. Dependencies declared as final: guarantees immutability and thread safety
    private final AccountRepository accountRepository;
    private final FraudAuditEngine fraudAuditEngine;

    // 2. Explicit constructor injection (No @Autowired annotation needed in Spring 4.3+)
    public SettlementService(AccountRepository accountRepository, 
                             FraudAuditEngine fraudAuditEngine) {
        this.accountRepository = Objects.requireNonNull(accountRepository, "AccountRepository cannot be null");
        this.fraudAuditEngine = Objects.requireNonNull(fraudAuditEngine, "FraudAuditEngine cannot be null");
    }

    public void settleInterbankDebit(String accountIban, BigDecimal amount) {
        fraudAuditEngine.assertAccountInGoodStanding(accountIban);
        Account account = accountRepository.findByIbanForUpdate(accountIban)
                .orElseThrow(() -> new IllegalArgumentException("Target account not found"));
        
        account.debit(amount);
        accountRepository.save(account);
        log.info("Successfully settled interbank debit of {} for IBAN: {}", amount, accountIban);
    }
}
```

---

#### 2.2 The Complete 7-Phase Bean Lifecycle Pipeline

Before a Spring Bean can serve a single HTTP request or process an asynchronous event, it must pass through an automated factory pipeline:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SPRING BEAN LIFECYCLE                              │
│                                                                             │
│  [ Phase 1: Instantiation ]                                                 │
│       │  JVM calls Constructor / Reflective instance creation               │
│       ▼                                                                     │
│  [ Phase 2: Populate Properties & Dependencies ]                            │
│       │  Spring injects all constructor dependencies and @Value fields      │
│       ▼                                                                     │
│  [ Phase 3: Aware Interface Callbacks ]                                     │
│       │  BeanNameAware, ApplicationContextAware, EnvironmentAware           │
│       ▼                                                                     │
│  [ Phase 4: BeanPostProcessor (Before Initialization) ]                     │
│       │  Custom interceptors execute: postProcessBeforeInitialization()     │
│       ▼                                                                     │
│  [ Phase 5: Initialization Hooks ]                                          │
│       │  1. @PostConstruct method runs                                      │
│       │  2. InitializingBean.afterPropertiesSet() runs                      │
│       │  3. Custom init-method defined in @Bean(initMethod = "...") runs    │
│       ▼                                                                     │
│  [ Phase 6: BeanPostProcessor (After Initialization) ]                      │
│       │  Spring wraps the raw Bean inside Dynamic Proxies                   │
│       │  (CGLIB/JDK for @Transactional, @Async, @Cacheable)                 │
│       ▼                                                                     │
│  [ Phase 7: Bean is LIVE (Serving Requests in ApplicationContext) ]         │
│       │                                                                     │
│       ▼ (Application Shutdown Signal SIGTERM)                               │
│  [ Phase 8: Teardown / Destruction Hooks ]                                  │
│          1. @PreDestroy method runs                                         │
│          2. DisposableBean.destroy() runs                                   │
│          3. Custom destroyMethod runs                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

##### Production Lifecycle Implementation:
```java
package com.astek.logistics.warehouse;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.BeanNameAware;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class AutomatedLuggageCarrouselHub implements BeanNameAware, InitializingBean, DisposableBean {

    private String beanName;

    @Value("${airport.terminal.carrousel-speed-rpm:45}")
    private int motorRpm;

    public AutomatedLuggageCarrouselHub() {
        log.info("[Phase 1] Constructor: Memory allocated. motorRpm is not yet injected (0).");
    }

    @Override
    public void setBeanName(String name) {
        this.beanName = name;
        log.info("[Phase 3] Aware Hook: Bean registered in container namespace as '{}'", this.beanName);
    }

    @PostConstruct
    public void onPostConstruct() {
        log.info("[Phase 5a] @PostConstruct: Properties injected. Calibrating motor to {} RPM.", motorRpm);
    }

    @Override
    public void afterPropertiesSet() {
        log.info("[Phase 5b] InitializingBean: Running mechanical failsafe diagnostics.");
    }

    public void processBaggageTag(String luggageId) {
        log.info("Routing luggage '{}' across carrousel...", luggageId);
    }

    @PreDestroy
    public void onPreDestroy() {
        log.warn("[Phase 8a] @PreDestroy: SIGTERM received. Initiating controlled deceleration of carrousel.");
    }

    @Override
    public void destroy() {
        log.warn("[Phase 8b] DisposableBean: Power disconnected. Carrousel safely parked.");
    }
}
```

---

#### 2.3 Under the Hood: CGLIB vs. JDK Dynamic Proxies

Spring achieves declarative features like `@Transactional` by applying the **Proxy Design Pattern**. The client never talks directly to your bean; it talks to a dynamically generated proxy.

```
Caller (e.g., RestController)
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│              CGLIB / JDK DYNAMIC PROXY                  │
│                                                         │
│  1. Intercept method invocation                         │
│  2. PlatformTransactionManager.getTransaction(...)      │
│  3. try {                                               │
│         targetBean.executeTransfer();                   │
│         PlatformTransactionManager.commit(...);         │
│     } catch (RuntimeException ex) {                     │
│         PlatformTransactionManager.rollback(...);       │
│         throw ex;                                       │
│     }                                                   │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
               [ Target Real Bean Method ]
```

* **JDK Dynamic Proxies:** Used when the target class implements an `interface`. The proxy implements the same interface and routes calls via an `InvocationHandler`.
* **CGLIB Proxies:** Used when the target class does not implement an interface (or by default in Spring Boot 2.x/3.x via `spring.aop.proxy-target-class=true`). CGLIB generates a dynamic subclass of your bean at runtime.
* **Crucial Takeaway:** Because CGLIB creates a subclass, **`@Transactional` methods and classes cannot be marked `final`**, and `private` methods cannot be intercepted.

---

#### 2.4 Type-Safe Configuration with `@ConfigurationProperties`

In enterprise architectures, scattering `@Value("${some.property}")` across dozens of classes causes configuration drift, silent runtime typos, and zero validation.

**Spring Boot 3 enforces type-safe, validated Configuration Records.**

```java
package com.astek.banking.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.time.Duration;

@Validated
@ConfigurationProperties(prefix = "bank.settlement")
public record SettlementProperties(
    @NotBlank String clearingHouseCode,
    @Min(1) @Max(5000000) long maxDailyTransferLimitEuros,
    @NotNull Duration connectionTimeout,
    @NotNull SslConfiguration ssl
) {
    public record SslConfiguration(
        boolean enabled,
        @NotBlank String keyStorePath,
        @NotBlank String keyStorePassword
    ) {}
}
```

```yaml
# application.yml
bank:
  settlement:
    clearing-house-code: "SEPA-FR-PARIS-01"
    max-daily-transfer-limit-euros: 2500000
    connection-timeout: 5000ms
    ssl:
      enabled: true
      key-store-path: "/var/secrets/keystore.p12"
      key-store-password: "${SETTLEMENT_VAULT_PASSWORD}"
```

---

### 3. THE ENTERPRISE PITFALLS

#### 💣 War Story: The Self-Invocation Phantom Rollback
* **Context:** An overnight batch settlement service in a corporate banking module.
* **The Incident:** An unhandled exception was thrown during account rebalancing, but **zero database rollbacks occurred**. Millions in erroneous debits persisted in the database.
* **The Root Cause:** A public method called another `@Transactional` method located **inside the exact same class instance**:

```java
@Service
public class LedgerAuditService {

    // Entry point called by Controller / Scheduled Task
    public void processDailyAuditBatch(List<AuditRecord> records) {
        for (AuditRecord record : records) {
            // ❌ DIRECT THIS-CALL: Bypasses the Spring CGLIB Proxy!
            // No transaction interceptor executes; rollback rules are completely ignored.
            this.settleSingleRecord(record); 
        }
    }

    @Transactional(rollbackFor = Exception.class, propagation = Propagation.REQUIRES_NEW)
    public void settleSingleRecord(AuditRecord record) {
        // Mutates database ledger...
        if (record.isCorrupted()) {
            throw new IllegalStateException("Corrupted audit trace detected!");
        }
    }
}
```

* **The Architectural Fix:**
  1. **Preferred (Clean DDD):** Move `settleSingleRecord` into a separate, focused collaborator bean (e.g., `SingleRecordSettlementEngine`) and inject it.
  2. **Programmatic (Zero Reflection):** Use Spring’s `TransactionTemplate` directly:

```java
@Service
@RequiredArgsConstructor
public class ResilientLedgerService {

    private final TransactionTemplate transactionTemplate;

    public void processDailyAuditBatch(List<AuditRecord> records) {
        for (AuditRecord record : records) {
            // Explicit programmatic transaction boundary: 100% immune to self-invocation bugs
            transactionTemplate.execute(status -> {
                settleSingleRecord(record);
                return true;
            });
        }
    }

    private void settleSingleRecord(AuditRecord record) {
        // Business logic...
    }
}
```

---

#### 💣 War Story: The Mutable Shared State in a Singleton Bean
* **Context:** An industrial logistics container tracking gateway handling 800 HTTP requests/second.
* **The Incident:** During peak cargo dispatch hours, shipping container #90214 was rerouted to a harbor 4,000 miles away from its intended destination.
* **The Root Cause:** A developer stored temporary request state in a class-level instance variable inside a Singleton `@Service`:

```java
// ❌ CRITICAL BUG: Singleton Beans are shared across ALL concurrent threads!
@Service
public class ContainerDispatchService {

    // Shared mutable state on the Heap!
    private String currentContainerDestination; 

    public void routeContainer(String containerId, String destination) {
        this.currentContainerDestination = destination; // Thread A writes "Rotterdam"
        
        simulateComplexLogisticsCalculation(); // Context switch: Thread B writes "Singapore"!
        
        // Thread A now reads "Singapore" instead of "Rotterdam"!
        dispatchCraneToHarbor(containerId, this.currentContainerDestination); 
    }
}
```

* **The Rule:** **Spring Singleton Beans must remain strictly stateless or encapsulate thread-safe data structures (`ConcurrentHashMap`, `AtomicReference`). State must live inside local method variables (on the thread stack) or scoped request objects.**

---

### 4. THE INTERVIEW CHEAT SHEET

##### Q1: What is the operational difference between Constructor Injection, Field Injection, and Setter Injection?
> **Answer:** 
> * **Constructor Injection** guarantees immutability (`final` fields), guarantees that an object cannot be instantiated in an uninitialized state, enables simple unit testing with plain `new` operators without needing Spring reflection, and forces circular dependencies to fail fast at application startup.
> * **Field Injection (`@Autowired` on private fields)** tightly couples code to the Spring Container, masks architectural complexity by making it too easy to add excessive dependencies, and prevents `final` field declaration.
> * **Setter Injection** should only be used for genuinely optional dependencies that can be reconfigured dynamically at runtime.

##### Q2: What are the distinct Scopes available in Spring, and what is a "Scoped Proxy"?
> **Answer:** 
> * Core scopes include: **Singleton** (one shared instance per `ApplicationContext`), **Prototype** (new instance on every injection/lookup), **Request** (one per HTTP request lifecycle), **Session** (one per HTTP Session), and **Application** (scoped to `ServletContext`).
> * A **Scoped Proxy** (`proxyMode = ScopedProxyMode.TARGET_CLASS`) is required when injecting a short-lived scoped bean (e.g., Request-scoped) into a longer-lived bean (e.g., Singleton). Because the Singleton is instantiated once at startup, Spring injects a dynamic proxy standing in for the short-lived bean. When the Singleton invokes the proxy, the proxy delegates the call to the active request bean instance on the current thread.

##### Q3: How do `@Configuration` and `@Component` differ when defining `@Bean` methods?
> **Answer:** 
> * Classes annotated with `@Configuration` are enhanced at startup using **CGLIB bytecode generation (Full Mode)**. If one `@Bean` method invokes another `@Bean` method inside the same configuration class, the CGLIB proxy intercepts the call and returns the cached singleton instance, preserving singleton guarantees.
> * In a standard `@Component` class (Lite Mode), `@Bean` methods are executed as plain Java method calls without proxy interception; invoking one `@Bean` method from another creates a brand-new, unmanaged instance, breaking singleton semantics.

##### Q4: What is the BeanPostProcessor interface, and how does Spring use it?
> **Answer:** `BeanPostProcessor` is a core internal extension interface comprising two methods: `postProcessBeforeInitialization` and `postProcessAfterInitialization`. 
> * It allows custom modification or wrapping of newly created bean instances. 
> * Spring internally uses `BeanPostProcessors` to process annotations like `@Autowired`, `@Value`, and `@PostConstruct`, and to wrap raw target beans into **Dynamic Proxies** for AOP features such as `@Transactional`, `@Async`, and `@Retryable`.

##### Q5: Why are circular dependencies disabled by default in Spring Boot 2.6+ / 3.x, and how do you resolve them cleanly?
> **Answer:** Circular dependencies indicate a **flaw in domain boundaries and architectural design** (e.g., Service A depends on Service B, which depends on Service A), violating the Single Responsibility Principle and complicating deterministic startup order. 
> * To resolve them cleanly:
>   1. Refactor common logic into a third collaborator bean (Service C).
>   2. Decouple interaction using **Application Events (`ApplicationEventPublisher`)** or asynchronous messaging.
>   3. As a temporary workaround, annotate one injection point with `@Lazy` to defer bean resolution until first use.
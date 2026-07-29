# Глава 7: Миграция Java 8 → Java 21

> «Java 8 was a revolution. Java 21 is the next evolution.» — *Brian Goetz (Java Language Architect)*

Эта глава — подробное руководство по миграции с Java 8 на Java 21, основанное на реальном опыте перевода enterprise-приложения. Вы узнаете о ключевых изменениях языка, JVM, библиотек и фреймворков, а также о подводных камнях, с которыми столкнётесь.

---

## 7.1. Timeline: От Java 8 до Java 21

Прежде чем погружаться в детали, важно понимать мапу релизов.

```
Java 8    (март 2014) — LTS: лямбды, Streams API, java.time
Java 9    (сентябрь 2017) — Module System (Project Jigsaw), REPL (JShell)
Java 10   (март 2018) — Вывод типов локальных переменных (var)
Java 11   (сентябрь 2018) — LTS: HTTP Client, удаление Java EE / CORBA
Java 12   (март 2019) — Switch Expressions (preview)
Java 13   (сентябрь 2019) — Text Blocks (preview)
Java 14   (март 2020) — Records (preview), Pattern Matching for instanceof
Java 15   (сентябрь 2020) — Sealed Classes (preview), Text Blocks (final)
Java 16   (март 2021) — Records (final), Pattern Matching (final)
Java 17   (сентябрь 2021) — LTS: Sealed Classes (final), JFR Event Streaming
Java 18   (март 2022) — Simple Web Server, UTF-8 by default
Java 19   (сентябрь 2022) — Virtual Threads (preview), Record Patterns
Java 20   (март 2023) — Scoped Values (incubator), Virtual Threads (2nd preview)
Java 21   (сентябрь 2023) — LTS: Virtual Threads (final), Record Patterns (final)
```

### Какую стратегию выбрали мы

Прыгнуть с Java 8 на Java 21 за один шаг невозможно (слишком много breaking changes). Мы шли поэтапно:

```
Java 8 → Java 11 → Java 17 → Java 21
```

Каждый этап занимал примерно 3-4 месяца с учётом стабилизации и регрессионного тестирования.

---

## 7.2. Java 9 → 11: Модульная система (Project Jigsaw)

### Что изменилось

Java 9 ввела модульную систему (JPMS — Java Platform Module System). Это фундаментальное изменение архитектуры JDK:

- Вместо монолитного `rt.jar` — модули (`java.base`, `java.sql`, `java.xml`).
- Строгая инкапсуляция — внутренние API JDK (`sun.misc.*`, `com.sun.*`) больше не доступны через рефлексию.
- Удалены устаревшие модули: CORBA, Java EE (JAXB, JAX-WS), `java.se.ee`.

### С чем столкнулись

**Проблема 1: Отсутствие JAXB и JAX-WS**

В Java 8 библиотеки JAXB (XML-парсинг) и JAX-WS (SOAP-веб-сервисы) входили в состав JDK. С Java 11 их вырезали.

```java
// Java 8: работало без дополнительных зависимостей
import javax.xml.bind.JAXBContext;

// Java 11+: NoClassDefFoundError — нужно добавить вручную
```

**Решение:** Добавить зависимость в `pom.xml`:

```xml
<dependency>
    <groupId>org.glassfish.jaxb</groupId>
    <artifactId>jaxb-runtime</artifactId>
    <version>4.0.5</version>
</dependency>
<dependency>
    <groupId>jakarta.xml.bind</groupId>
    <artifactId>jakarta.xml.bind-api</artifactId>
    <version>4.0.2</version>
</dependency>
```

**Проблема 2: InaccessibleObjectException**

Старые версии Lombok, Jackson, Hibernate использовали рефлексию для доступа к внутренним классам JDK:

```bash
java.lang.reflect.InaccessibleObjectException: 
  Unable to make field private final byte[] java.lang.String.value accessible: 
  module java.base does not "opens java.lang" to unnamed module
```

**Решение:** Обновить библиотеки до версий, поддерживающих Java 11+:

```xml
<!-- Lombok 1.18.28+ поддерживает Java 21 -->
<dependency>
    <groupId>org.projectlombok</groupId>
    <artifactId>lombok</artifactId>
    <version>1.18.34</version>
</dependency>

<!-- Jackson 2.16+ поддерживает Java 21 -->
<dependency>
    <groupId>com.fasterxml.jackson.core</groupId>
    <artifactId>jackson-databind</artifactId>
    <version>2.17.2</version>
</dependency>
```

---

## 7.3. Java 14 → 17: Records, Switch Expressions, Pattern Matching

### Records (Java 14 preview → Java 16 final)

Records — неизменяемые (immutable) классы-контейнеры для данных.

```java
// Java 8: DTO с бойлерплейтом
public class UserDto {
    private final Long id;
    private final String email;
    
    public UserDto(Long id, String email) {
        this.id = id;
        this.email = email;
    }
    // геттеры, equals, hashCode, toString — 50 строк кода
}

// Java 16+: Record — всё в одной строке
public record UserDto(Long id, String email) {}
```

**Важный нюанс:** Records **нельзя использовать как Entity для Hibernate**, так как они должны быть immutable, а Hibernate требует изменяемости (прокси, lazy loading).

```java
// ❌ Нельзя: Record как Entity
@Entity
public record User(Long id, String email) {} // Ошибка!

// ✅ Правильно: Record только для DTO
public record CreateUserRequest(
    @NotBlank String email,
    @NotBlank String name
) {}
```

### Switch Expressions (Java 12 preview → Java 14 final)

Switch стал выражением — может возвращать значение и использовать `->` вместо `break`:

```java
// Java 8: switch как оператор
String result;
switch (day) {
    case MONDAY:
        result = "Work";
        break;
    case SATURDAY:
        result = "Rest";
        break;
    default:
        result = "Unknown";
}

// Java 14+: switch как выражение
String result = switch (day) {
    case MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY -> "Work";
    case SATURDAY, SUNDAY -> "Rest";
    default -> "Unknown";
};
```

### Pattern Matching for instanceof (Java 14 preview → Java 16 final)

Избавляет от явного приведения типов:

```java
// Java 8: приведение вручную
if (obj instanceof User) {
    User user = (User) obj;
    System.out.println(user.email());
}

// Java 16+: Pattern Matching
if (obj instanceof User user) {
    System.out.println(user.email()); // user уже приведён!
}
```

### Text Blocks (Java 13 preview → Java 15 final)

Многострочные строки без конкатенации:

```java
// Java 8: ужас с конкатенацией
String json = "{\n" +
    "  \"name\": \"John\",\n" +
    "  \"age\": 30\n" +
    "}";

// Java 15+: Text Blocks
String json = """
    {
      "name": "John",
      "age": 30
    }
    """;
```

### Sealed Classes (Java 15 preview → Java 17 final)

Контролируемая иерархия наследования:

```java
// Java 17: Запечатанный класс
public sealed class Payment permits CardPayment, PaypalPayment, CryptoPayment {}

// Разрешённые наследники
public final class CardPayment extends Payment {}
public final class PaypalPayment extends Payment {}
public record CryptoPayment(String currency) extends Payment {}
```

> **Подводный камень (Gotcha):** Sealed Classes полезны для доменной логики (например, типы платежей в финтехе), но не злоупотребляйте ими в DTO и простых структурах данных.

---

## 7.4. Java 21: Virtual Threads (Project Loom)

### Проблема: Thread-per-request

В традиционном Spring MVC каждый HTTP-запрос обрабатывается в отдельном потоке ОС (Platform Thread). Поток ОС — «дорогой» ресурс (~1 МБ памяти). JVM не может создать миллионы таких потоков.

Более того: когда поток делает I/O-вызов (запрос к БД, REST API), он **блокируется** и ждёт ответа, простаивая впустую:

```java
@Service
public class OrderService {
    public OrderResponse getOrder(Long id) {
        // Поток БЛОКИРУЕТСЯ здесь, ожидая ответа от БД
        Order order = orderRepository.findById(id).orElseThrow();
        // Поток БЛОКИРУЕТСЯ здесь, ожидая ответа от внешнего API
        PaymentStatus status = paymentClient.getStatus(order.paymentId());
        return new OrderResponse(order, status);
    }
}
```

### Решение: Virtual Threads

Virtual Threads — это легковесные потоки, управляемые JVM, а не ОС. Один физический поток ОС (Carrier Thread) может переключать миллионы виртуальных потоков, **приостанавливая** их на время I/O и **возобновляя** после ответа.

```java
// Включение Virtual Threads в Spring Boot 3.2+
spring:
  threads:
    virtual:
      enabled: true
```

Или программно:

```java
@Configuration
public class VirtualThreadConfig {
    
    @Bean
    public TomcatProtocolHandlerCustomizer<?> protocolHandlerCustomizer() {
        return protocolHandler -> {
            protocolHandler.setExecutor(Executors.newVirtualThreadPerTaskExecutor());
        };
    }
}
```

### Сравнение производительности

| Метрика | Platform Threads (Java 8) | Virtual Threads (Java 21) |
|---------|--------------------------|--------------------------|
| Max concurrent requests | ~200 (на 4GB heap) | ~100 000 (на 4GB heap) |
| Memory per thread | ~1 MB | ~1 KB |
| Context switch overhead | High (ОС kernel) | Minimal (JVM) |
| Code complexity | Реактивный стек (WebFlux) | Обычный блокирующий код |

### Когда Virtual Threads НЕ подходят

- **CPU-bound задачи** (криптография, обработка видео) — Virtual Threads не ускоряют вычисления.
- **Долгие блокировки synchronized** — Virtual Threads не вытесняются (не preemptive), долгий `synchronized` блокирует Carrier Thread.
- **Native код через JNI** — блокирует Carrier Thread.

> **Подводный камень (Gotcha):** Virtual Threads НЕ заменяют реактивное программирование для CPU-bound задач. Они решают исключительно проблему блокирующего I/O. Если ваш сервис делает много вычислений — оставляйте Platform Threads.

---

## 7.5. Jakarta EE миграция (javax.* → jakarta.*)

### Почему это произошло

Oracle передала Java EE фонду Eclipse Foundation с условием: новое имя — **Jakarta EE**, новый неймспейс — `jakarta.*`. `javax.*` остался за Oracle.

### Что изменилось в Spring Boot 3

| Старое (Spring Boot 2 / Java 8) | Новое (Spring Boot 3 / Java 17+) |
|--------------------------------|----------------------------------|
| `javax.persistence.Entity` | `jakarta.persistence.Entity` |
| `javax.validation.Valid` | `jakarta.validation.Valid` |
| `javax.servlet.http.HttpServlet` | `jakarta.servlet.http.HttpServlet` |
| `javax.annotation.PostConstruct` | `jakarta.annotation.PostConstruct` |
| `javax.transaction.Transactional` | `jakarta.transaction.Transactional` |

### Как автоматизировать замену

Используйте **OpenRewrite** (см. Главу 6):

```bash
mvn -U org.openrewrite.maven:rewrite-maven-plugin:run \
  -Drewrite.activeRecipes=org.openrewrite.java.spring.boot3.UpgradeSpringBoot_3_0
```

---

## 7.6. Spring Boot 2 → 3: Security 6, Native Images

### Breaking Changes в Spring Security 6

Главное изменение — удаление `WebSecurityConfigurerAdapter`:

```java
// Spring Boot 2: старый стиль
@Configuration
public class SecurityConfig extends WebSecurityConfigurerAdapter {
    @Override
    protected void configure(HttpSecurity http) throws Exception {
        http
            .authorizeRequests()
            .antMatchers("/api/public/**").permitAll()
            .anyRequest().authenticated()
            .and()
            .formLogin();
    }
}

// Spring Boot 3: новый стиль (component-based security)
@Configuration
public class SecurityConfig {
    
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/public/**").permitAll()
                .anyRequest().authenticated()
            )
            .formLogin(Customizer.withDefaults());
        return http.build();
    }
}
```

### Spring Native (AOT — Ahead-of-Time Compilation)

Spring Boot 3 поддерживает компиляцию в нативный образ через GraalVM:

```bash
# Установка native-image
gu install native-image

# Сборка нативного образа
./gradlew nativeCompile

# Запуск (мгновенный старт!)
./build/native/nativeCompile/myapp
```

**Преимущества:**
- Старт за миллисекунды (против 10–30 секунд на JVM).
- Меньше потребление RAM (от 50 MB vs 500 MB).
- Идеально для Serverless (AWS Lambda).

**Ограничения:**
- Медленная сборка (5–10 минут).
- Не все библиотеки совместимы (Lombok, Mockito, CGLIB proxies).

---

## 7.7. Hibernate 5 → 6: SQM и изменения SQL

### Что изменилось

Hibernate 6 полностью переписал движок генерации SQL (SQM — Semantic Query Model).

**Проблемы при миграции:**
- Старые Native Queries могли работать некорректно.
- JSONB-типы в PostgreSQL требуют нового диалекта.
- Битовые маски теперь обрабатываются иначе.

### Миграция нативных запросов

```java
// Hibernate 5: старый стиль
@Query(value = "SELECT * FROM orders WHERE status = ?1", nativeQuery = true)
List<Order> findByStatus(String status);

// Hibernate 6: рекомендуется JPQL с FETCH JOIN
@Query("SELECT o FROM Order o LEFT JOIN FETCH o.items WHERE o.status = :status")
List<Order> findByStatus(@Param("status") String status);
```

### Диалекты PostgreSQL

```java
// Hibernate 5 (устарел)
org.hibernate.dialect.PostgreSQL95Dialect

// Hibernate 6 (актуально)
org.hibernate.dialect.PostgreSQLDialect
```

---

## 7.8. Garbage Collector: G1GC → ZGC

### G1GC (Garbage First)

По умолчанию в Java 9+ (в Java 8 был Parallel GC). Хороший баланс пропускной способности и задержек.

```bash
# G1GC — стандарт для большинства сервисов
java -XX:+UseG1GC -Xms4g -Xmx4g -jar app.jar
```

### ZGC (Zero Allocation Pauses)

Только в Java 15+ (production-ready в Java 21). Паузы Stop-The-World < 1 мс, независимо от размера кучи.

```bash
# ZGC — для low-latency приложений
java -XX:+UseZGC -Xms4g -Xmx4g -jar app.jar

# Дополнительно: настройка параллельности
-XX:ConcGCThreads=2 -XX:ParallelGCThreads=4
```

### Нагрузочное тестирование: JMH

Для сравнения GC мы использовали JMH (Java Microbenchmark Harness):

```java
@Benchmark
@BenchmarkMode(Mode.Throughput)
@Fork(value = 2, jvmArgs = {"-XX:+UseZGC"})
public void testThroughputZGC() {
    // Нагрузочный сценарий
    orderService.processOrders(testData);
}

@Benchmark
@BenchmarkMode(Mode.Throughput)
@Fork(value = 2, jvmArgs = {"-XX:+UseG1GC"})
public void testThroughputG1GC() {
    orderService.processOrders(testData);
}
```

---

## 7.9. Шпаргалка: Что изменилось в Java для Senior-интервью

### Ключевые ответы на вопросы:

| Вопрос | Ответ |
|--------|-------|
| **«Что дала миграция на Java 21?»** | Virtual Threads для масштабирования, Records для DTO, Pattern Matching для чистого кода + ZGC для низких задержек |
| **«Какая была самая сложная часть?»** | Jakarta EE (javax → jakarta) через OpenRewrite и зависимость от старых библиотек |
| **«Как решали проблему совместимости?»** | Переход через LTS-версии (8 → 11 → 17 → 21), обновление библиотек до совместимых версий, Characterisation Tests с Testcontainers |
| **«Что делать с CMS GC?»** | Заменить G1GC или ZGC, убрать старые JVM-флаги из скриптов деплоя |
| **«Virtual Threads или WebFlux?** | Для I/O-bound задач — Virtual Threads с простым императивным кодом. Для CPU-bound или сложных потоковых сценариев — WebFlux |

---

> **Подводный камень (Gotcha):** На собеседовании не говорите «мы просто обновили версию Java». Подчеркните **процесс**: Analyse d'Impact → Characterisation Tests → поэтапное обновление (8→11→17→21) → нагрузочное тестирование GC → профилирование Virtual Threads. Это покажет вашу зрелость как Senior-инженера.

---

**Что дальше:** В Главе 8 — детальный разбор миграции Angular 8 → Angular 20.

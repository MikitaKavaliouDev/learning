Here is the complete, in-depth execution of **Phase 1 (The French Pitch & Alignment)** and **Phase 2 (Core Java & Java 8 ➔ 17 ➔ 21 Mastery)**.

---

# 🎙️ PHASE 1: The French Pitch & Value Proposition

Since French is your operational working language (B1/B2), the key is having **structured, ready-to-use sentences** with the exact vocabulary French banking recruiters and tech leads love to hear (*flux financiers, criticité, robustesse, dette technique, synergie métier*).

---

### 1. The 2-Minute Elevator Pitch (Le Pitch de Présentation)

Rehearse this until you can deliver it smoothly:

> **« Bonjour. Pour me présenter rapidement : je suis développeur Java / Spring Boot avec plus de 5 ans d'expérience dans la conception et la modernisation de systèmes d'information critiques et transactionnels.**
>
> **Récemment chez Basesystem, j’ai principalement travaillé sur la modernisation d’un socle legacy : nous avons migré des applications vers Java 17/21 et Spring Boot 3, tout en modernisant l’interface Angular. Au quotidien, je traitais des flux de données à forte criticité avec Hibernate et PostgreSQL, déployés sur des conteneurs via Kubernetes.**
>
> **Aujourd'hui, je souhaite rejoindre une équipe Agile structurée où la robustesse et la rigueur technique sont primordiales. Votre opportunité chez AGAP2 sur le cœur comptable bancaire correspond exactement à ce que j'aime faire : traiter des flux d'événements financiers critiques, assurer la résilience des données, et travailler en synergie étroite avec les Business Analysts et le Product Owner. »**

---

### 2. Answering the "Must-Ask" Questions in French

#### Q1: "Pourquoi la comptabilité bancaire vous intéresse-t-elle ?" (Why banking accounting?)
* **Réponse type :**
  > « Ce qui me motive dans le domaine bancaire, c'est l'exigence de **tolérance zéro pour la perte de données** et le besoin d'une **cohérence transactionnelle absolue**. Gérer des flux de crédits/débits et leurs impacts comptables via des architectures événementielles (Kafka) demande une vraie rigueur sur l'idempotence, la gestion des transactions (ACID) et la performance des requêtes SQL. C'est un challenge technique très stimulant. »

#### Q2: "Comment travaillez-vous avec les Business Analysts (BA) et le Product Owner (PO) ?"
* **Réponse type :**
  > « Dans mes expériences précédentes, la collaboration avec les BA et le PO était quotidienne. Lors des rituels de refinement et de cadrage (*3 Amigos*), mon rôle est de challenger les spécifications sous l'angle technique, d'identifier les cas limites (*edge cases*) et de m'assurer que les règles métier comptables sont parfaitement traduites dans le code avec des tests automatisés solides (TDD / tests unitaires et d'intégration). »

#### Q3: "Vous êtes à Grenoble ? Quelle est votre disponibilité ?"
* **Réponse type :**
  > « Oui, je suis basé à Grenoble (secteur Gare / agglomération), donc je suis parfaitement mobile pour le site. Je suis disponible immédiatement, ce qui s'aligne très bien avec votre calendrier pour un démarrage en septembre. »

---

### 3. Cheat Sheet: French Banking & Tech Keywords
| Concept | French Term to Use |
| :--- | :--- |
| Core Banking System | *Cœur de système d'information bancaire / SI Bancaire* |
| Credits / Debits / Financial Flows | *Crédits, débits, flux financiers, écritures comptables* |
| Data Consistency | *Cohérence transactionnelle, intégrité des données* |
| Legacy Modernization | *Montée de version, résorption de la dette technique* |
| Knowledge Sharing | *Partage de connaissances, revues de code croisées* |

---

# ☕ PHASE 2: Core Java & Modern Java (8 ➔ 17 ➔ 21)

Here is everything you must know, organized from core fundamentals to Java 21 features.

---

## 1. Core Java 8 Fundamentals & Concurrency

### A. Functional Interfaces & Streams API
* **Core interfaces:** `Predicate<T>` (`test`), `Function<T, R>` (`apply`), `Consumer<T>` (`accept`), `Supplier<T>` (`get`).
* **`map` vs `flatMap`:**
  * `map`: 1-to-1 transformation.
  * `flatMap`: 1-to-N transformation (flattens nested streams, e.g., `account.getTransactions()` $\rightarrow$ stream of transactions).
* **Parallel Streams caveat in Banking:**
  * `parallelStream()` uses the common `ForkJoinPool.commonPool()`.
  * **Warning:** In a web server (Spring Boot / Tomcat), parallel streams can monopolize the common thread pool and block other requests. For DB or I/O calls, stick to sequential streams or dedicated `ExecutorService` thread pools.

### B. `Optional` Best Practices
* ❌ **Never do:** `optional.get()` without `isPresent()` (throws `NoSuchElementException`).
* ❌ **Don't use `Optional` as:** method parameters or entity fields (causes serialization issues with Hibernate).
* ✅ **Idiomatic usage:**
  ```java
  return accountRepository.findById(accountId)
      .map(this::toDto)
      .orElseThrow(() -> new AccountNotFoundException("Account not found: " + accountId));
  ```

### C. Concurrency: `CompletableFuture` & Thread Safety
* Used for parallel asynchronous tasks (e.g., calling two downstream banking services at once):
  ```java
  CompletableFuture<BalanceDto> balanceFuture = CompletableFuture.supplyAsync(() -> fetchBalance(accId), customExecutor);
  CompletableFuture<ProfileDto> profileFuture = CompletableFuture.supplyAsync(() -> fetchProfile(accId), customExecutor);

  CompletableFuture.allOf(balanceFuture, profileFuture).join();
  ```
* **Thread safety mechanisms:**
  * `AtomicReference`, `AtomicLong` (lock-free CAS operations).
  * `ConcurrentHashMap` (segmented locking, better than `Hashtable` or synchronized maps).

---

## 2. JVM Memory & Production Troubleshooting

You will likely be asked how to diagnose an incident in production.

### A. Memory Areas
* **Stack:** Stores primitive local variables and method call frames. Fast, per-thread lifecycle.
* **Heap:** Stores all objects and instances. Managed by the Garbage Collector.
* **Metaspace (since Java 8):** Stores class metadata in native memory (replaces PermGen). Configurable via `-XX:MaxMetaspaceSize`.

### B. Garbage Collectors in Modern Java
* **G1GC (Garbage-First):** Default since Java 9. Divides the heap into equal regions. Designed for multi-gigabyte heaps with predictable pause times.
* **ZGC (Z Garbage Collector):** Ultra-low latency GC (sub-millisecond pauses), fully production-ready in Java 21. Great for real-time financial systems.

### C. Diagnosing Memory Leaks & CPU Spikes
1. **CPU Spike:** Run `top -H -p <PID>` to find the offending OS thread ID, convert thread ID to hexadecimal, and inspect it via `jstack <PID>`.
2. **Out of Memory (`OutOfMemoryError: Java heap space`):**
   * Configure JVM flag: `-XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/dumps/heap.hprof`
   * Analyze the `.hprof` dump using Eclipse Memory Analyzer (MAT) to identify the "Leak Suspect" (e.g., unclosed Hibernate sessions, unbounded static collections, or unconsumed Kafka message queues).

---

## 3. Java 11 & Java 17 (The Enterprise Standard)

### A. `Records` (Java 16+)
* Immutable data carriers. Automatically generates constructor, getters, `equals()`, `hashCode()`, and `toString()`.
* **Ideal for Banking Event DTOs / Kafka Payloads:**
  ```java
  public record BankingTransactionEvent(
      UUID transactionId,
      String accountNumber,
      BigDecimal amount,
      Currency currency,
      Instant timestamp
  ) {
      // Compact constructor for validation
      public BankingTransactionEvent {
          Objects.requireNonNull(transactionId, "transactionId is required");
          if (amount.compareTo(BigDecimal.ZERO) == 0) {
              throw new IllegalArgumentException("Amount cannot be zero");
          }
      }
  }
  ```

### B. Pattern Matching for `instanceof` (Java 16) & `switch` (Java 17/21)
Eliminates boilerplate type casting:
```java
// Modern instanceof
if (event instanceof CreditEvent c) {
    applyCredit(c.amount());
}

// Pattern matching for switch (Java 17 preview / 21 standard)
String describeEvent(BankingEvent event) {
    return switch (event) {
        case CreditEvent c when c.amount().compareTo(new BigDecimal("10000")) > 0 -> "Large Credit: " + c.amount();
        case CreditEvent c -> "Standard Credit: " + c.amount();
        case DebitEvent d  -> "Debit: " + d.amount();
        case null          -> "Empty event";
    };
}
```

### C. Sealed Classes & Interfaces (Java 17)
* Restricts which classes can extend or implement a type.
* Crucial for domain-driven financial events to ensure exhaustiveness:
  ```java
  public sealed interface AccountingOperation 
      permits CreditOperation, DebitOperation, FeeOperation {}

  public final class CreditOperation implements AccountingOperation { ... }
  public final class DebitOperation implements AccountingOperation { ... }
  public final class FeeOperation implements AccountingOperation { ... }
  ```

### D. Other Key Enhancements
* **Text Blocks (`"""`):** Clean SQL queries in code without concatenation.
* **`var` (Java 10):** Local variable type inference (use where type is obvious).
* **Unmodifiable Collections:** `List.of()`, `Set.of()`, `Map.of()`, `List.copyOf()`.

---

## 4. Java 21 (Modern Edge & Differentiators)

### A. Virtual Threads (Project Loom)
* **What are they?** Lightweight threads managed by the JVM instead of OS threads. 1 OS thread can host thousands of Virtual Threads.
* **Why it matters:** In I/O-bound microservices (waiting for DB queries, Kafka ACKs, REST APIs), Virtual Threads provide massive throughput without reactive programming complexity.
* **How to start one:**
  ```java
  // In Spring Boot 3.2+: spring.threads.virtual.enabled=true
  try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
      executor.submit(() -> processAccountingEvent(event));
  }
  ```
* **⚠️ Golden Rule / Interview Trap:**
  * **Pinning issue:** Avoid `synchronized` blocks with blocking I/O inside Virtual Threads because it pins the virtual thread to the underlying carrier OS thread. Use `ReentrantLock` instead.

### B. Sequenced Collections
* Added standardized methods: `getFirst()`, `getLast()`, `addFirst()`, `reversed()` across `List`, `Deque`, and `SortedSet`.

---

## 5. Mock Technical Interview: 5 Targeted Questions & Model Answers

### Q1: "Why should we use `BigDecimal` instead of `double` or `float` for monetary amounts?"
> **Answer:** `float` and `double` use IEEE 754 floating-point representation, which cannot precisely represent base-10 decimals (e.g., `0.1 + 0.2 = 0.30000000000000004`). In financial accounting, rounding errors cause cumulative balance mismatches. `BigDecimal` provides exact precision and explicit rounding modes (e.g., `RoundingMode.HALF_EVEN` / Banker's rounding).

### Q2: "What is the difference between `==` and `equals()` in Java, and how does it relate to `hashCode()`?"
> **Answer:** `==` checks reference equality (same memory address on Heap). `equals()` tests logical equality. The contract states: **if two objects are equal according to `equals()`, they MUST return the same `hashCode()`**. If broken, hash-based collections (`HashMap`, `HashSet`) will fail to find or retrieve keys properly.

### Q3: "What are the main breaking points when migrating an application from Java 8 to Java 17/21?"
> **Answer:**
> 1. **Removal of internal APIs:** Encapsulation of JDK internals via the Java Module System (`--illegal-access=deny`).
> 2. **Removal of Java EE modules:** JAXB, JAX-WS were removed from the JDK and require external dependencies.
> 3. **Garbage Collection changes:** Deprecation/removal of CMS (Concurrent Mark Sweep), replaced by G1GC default.
> 4. **Spring Boot 3 / Jakarta migration:** Transition from `javax.*` to `jakarta.*` packages for JPA, Servlet, and Validation.

### Q4: "How do you avoid deadlock in a multithreaded banking transfer operation?"
> **Answer:** A classic deadlock happens when Thread A locks Account 1 and waits for Account 2, while Thread B locks Account 2 and waits for Account 1. The solution is **Lock Ordering**: always acquire locks in a globally deterministic order (e.g., compare `account1.getId().compareTo(account2.getId())` and lock the smaller ID first).

### Q5: "What is the difference between an Exception and an Error, and how should they be handled?"
> **Answer:** Both inherit from `Throwable`.
> * `Error` represents serious problems that an application should not try to catch (e.g., `OutOfMemoryError`, `StackOverflowError`).
> * `Exception` represents conditions that a reasonable application might want to catch:
>   * *Checked Exceptions* (subclasses of `Exception` excluding `RuntimeException`): forced by the compiler to be caught or declared.
>   * *Unchecked Exceptions* (`RuntimeException`): programming bugs or unexpected states (e.g., `NullPointerException`, `IllegalArgumentException`). In Spring, only unchecked exceptions trigger a transaction rollback by default.
Вот разбор всех ключевых концепций **Java (8 ➔ 17 ➔ 21)** простыми словами, на жизненных аналогиях — так, чтобы это намертво отложилось в голове и на собеседовании вы отвечали легко и уверенно.

---

# 1. Java 8: Функциональщина и Streams

### 🏭 Stream API: `map` vs `flatMap`
* **Аналогия:** Заводской конвейер.
* **`map` (1 в 1):** На конвейер заезжает ящик с деталью $\rightarrow$ робот красит её в синий цвет $\rightarrow$ с конвейера съезжает одна синяя деталь.
  * *В коде:* Список пользователей `List<User>` $\rightarrow$ получаем список их email `List<String>`.
* **`flatMap` (1 ко многим, распаковка):** На конвейер заезжает **закрытая коробка**, в которой лежат 3 телефона $\rightarrow$ робот вскрывает коробку и выкладывает телефоны на ленту по отдельности.
  * *В коде:* У одного банковского аккаунта есть список транзакций `List<Transaction>`. Если у вас список аккаунтов `List<Account>`, то `flatMap` достанет все транзакции из всех аккаунтов и сложит их в **один общий плоский поток** `Stream<Transaction>`.

---

### 📦 `Optional`
* **Аналогия:** Запечатанная посылка с надписью «Внутри может быть подарок, а может быть пусто».
* **Как правильно:** Вы не лезете в коробку вслепую (не вызываете `.get()` — иначе получите по рукам `NullPointerException`). Вы говорите: *«Если там есть подарок — отдай его клиенту, если пусто — выдай дефолтный сувенир»* (`.orElse(...)`) или *«выброси понятную ошибку»* (`.orElseThrow(...)`).

---

# 2. Память JVM и Garbage Collector (Уборщик мусора)

### 🏢 Память: Stack vs Heap vs Metaspace
Представьте рабочий кабинет:
1. **Stack (Рабочий стол разработчика):**
   * Очень быстрый, но маленький.
   * Здесь лежат текущие черновики (локальные переменные метода `int a = 5;`) и записки, какой метод сейчас выполняется.
   * Как только метод закончил работу — со стола всё сразу смахнули в корзину.
2. **Heap (Куча / Большой склад):**
   * Огромное пространство, где хранятся все реальные объекты (`new Account()`, `new Order()`).
   * На рабочем столе (в Stack) лежит только бумажка с номером полки (ссылка на объект в Heap).
3. **Metaspace (Шкаф с чертежами и инструкциями):**
   * Здесь хранятся структуры самих классов (как устроен `Account`, какие у него методы). Лежит в отдельной нативной памяти операционной системы.

---

### 🧹 Garbage Collector (G1GC vs ZGC)
Объекты на складе (в Heap), на которые больше никто не ссылается (забытые коробки), надо выкидывать.
* **G1GC (Garbage-First — стандарт с Java 9):**
  * *Аналогия:* Уборщик делит склад на равные зоны (комнаты). Он приходит и первым делом убирает ту комнату, где больше всего мусора (Garbage-First), делая короткие паузы в работе склада.
* **ZGC (Java 21, ультра-низкие задержки):**
  * *Аналогия:* Робот-пылесос-невидимка. Он убирает склад прямо во время работы сотрудников, не останавливая процессы вообще (паузы меньше 1 миллисекунды). Идеально для банков, где каждая миллисекунда задержки транзакции критична.

---

### 🚨 Memory Leak (Утечка памяти)
* **Аналогия:** Синдром Плюшкина. Вы покупаете вещи (создаете объекты), складываете их в гараж (Heap) и привязываете к ним веревочку от своего ремня (статическая коллекция `static List`). Уборщик видит, что веревочка натянута, и думает: *«О, хозяину это нужно!»* — и не выбрасывает. В итоге гараж забит, и наступает **OutOfMemoryError**.

---

# 3. Java 11 и 17: Современная база

### 🪪 Records (Java 16+)
* **Проблема прошлого:** Чтобы создать простой объект для передачи данных (DTO), нужно было писать 50 строк: геттеры, сеттеры, `equals`, `hashCode`, `toString`, конструктор.
* **Аналогия с Record:** Пластиковый запаянный бейджик с фото и именем сотрудника. Вы один раз напечатали данные — их нельзя стереть или подделать (он **immutable** / неизменяемый).
* **Для чего в банке:** Идеально для событий (Events) из Kafka и DTO:
  ```java
  public record MoneyTransfer(String fromAccount, String toAccount, BigDecimal amount) {}
  ```
  Всё! Конструктор, геттеры и неизменяемость готовы в одну строчку.

---

### 🚪 Sealed Classes / Запечатанные классы (Java 17)
* **Аналогия:** Закрытый VIP-клуб, куда пускают строго по списку в приглашении.
* **В коде:** Вы объявляете интерфейс `AccountingEvent` и прямо в нем жестко прописываете: *«Тебя могут реализовать ТОЛЬКО `CreditEvent` и `DebitEvent`, и больше никто в мире»*:
  ```java
  public sealed interface AccountingEvent permits CreditEvent, DebitEvent {}
  ```
* **Зачем это банку:** Чтобы никто из других команд не мог случайно создать неизвестный тип бухгалтерской операции, который сломает баланс.

---

### 🕵️ Pattern Matching (Java 17/21)
* **Раньше:** «Покажи паспорт $\rightarrow$ Проверь, что это паспорт $\rightarrow$ Кастуй к типу Паспорт $\rightarrow$ Прочитай серию».
* **Сейчас (Pattern Matching):** Таможенник бросает один взгляд на документ:
  ```java
  if (obj instanceof Passport p) {
      System.out.println(p.getSeries()); // Переменная 'p' уже готова к использованию!
  }
  ```

---

# 4. Java 21: Высший пилотаж

### 🧵 Virtual Threads / Виртуальные потоки (Project Loom)
Это главная киллер-фича Java 21.

* **Классические потоки (Platform Threads):**
  * *Аналогия:* Тяжелый грузовик с водителем. Грузовиков в парке всего 200 штук (дорогие, жрут по 1 МБ памяти каждый). Когда грузовик приезжает на склад (ждет ответа от базы данных или Kafka), он просто стоит с заведенным мотором 2 секунды. Все 200 грузовиков встали $\rightarrow$ система перестала принимать новые заказы.
* **Virtual Threads (Виртуальные потоки):**
  * *Аналогия:* Обычный грузовик остается, но мы выдаем 1 000 000 номерков клиентам. Как только задача начинает **ждать** базу данных (I/O блокировка), виртуальный поток «отцепляется» от реального системного потока, освобождая его для другой работы.
* **Итог:** Ваш сервер может держать не 200, а **сотни тысяч** одновременных запросов к базе и внешним API без сложного реактивного программирования.

---

# 5. Банковская классика: Вопросы с подвохом

### 💰 Почему деньги — это ТОЛЬКО `BigDecimal`, а не `double`?
* **Аналогия с `double`:** Вы режете колбасу на глаз тупым ножом. Вроде ровно, но где-то отвалилась крошка. 
  * В двоичной системе `0.1 + 0.2 = 0.30000000000000004`. В банке через миллион операций эти «крошки» превратятся в недостачу в тысячи евро.
* **Аналогия с `BigDecimal`:** Вы взвешиваете золото на аптекарских микро-весах с точностью до атома и по строгому правилу округления (Banker's rounding).

---

### 🔒 Deadlock (Взаимная блокировка)
* **Аналогия:** Два очень вежливых человека встретились в узкой двери.
  * Первый говорит: *«Я сделаю шаг, только когда ты уступишь мне дорогу»*.
  * Второй говорит: *«А я сделаю шаг, только когда ты отойдешь»*.
  * Они стоят и смотрят друг на друга вечно.
* **В банковском коде:**
  * Поток 1 переводит с Аккаунта А на Аккаунт Б (заблокировал А, ждет блокировки Б).
  * Поток 2 в ту же миллисекунду переводит с Аккаунта Б на Аккаунт А (заблокировал Б, ждет блокировки А).
* **Как лечить (Lock Ordering):** Договориться о правиле: *«Всегда первым блокируем тот аккаунт, чей ID меньше»*. Тогда оба потока сначала попытаются заблокировать Аккаунт А, и один спокойно подождет второго без клинча.

---

### 🎯 Шпаргалка для собеседования (Как это подать):
1. Если спросят про миграцию с Java 8 на 17/21 $\rightarrow$ Сразу упоминайте: **Records** (для DTO), **Sealed Classes** (для строгой доменной модели), **Pattern Matching** (для чистоты кода) и **Virtual Threads** (для масштабируемости I/O).
2. Если спросят про многопоточность в банке $\rightarrow$ Упоминайте **детерминированный порядок блокировок** от Deadlock'ов и **BigDecimal** для расчетов.
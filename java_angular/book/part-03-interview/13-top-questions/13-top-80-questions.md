# Глава 13: Топ-80 вопросов на собеседовании

В этой главе собраны все ключевые вопросы, которые вам могут задать на техническом собеседовании во французских ESN (Capgemini, Sopra Steria, Devoteam) и у прямых клиентов (банки, SNCF, STMicroelectronics).

Каждый вопрос содержит:
1. **Краткое определение** — чтобы сразу понять, о чём речь
2. **Техническая глубина для Senior** — что оценит интервьюер
3. **Жизненная аналогия** — для запоминания и для ответа (французы это любят)
4. **Gotcha / подводные камни** — что скрыто и где ошибаются

---

# Часть 1: Java Core (20 вопросов)

---

## Вопрос 1: Overloading (Surcharge) vs Overriding (Redéfinition)

**Определение:**
- **Overloading (Перегрузка):** несколько методов с одинаковым именем, но разными сигнатурами (количество/тип параметров). Решается на этапе компиляции (статический полиморфизм).
- **Overriding (Переопределение):** дочерний класс переопределяет метод родителя с той же сигнатурой. Решается в runtime (динамический полиморфизм).

**Глубина для Senior:**
- Overloading: возвращаемый тип НЕ является частью сигнатуры — нельзя перегрузить только по типу возврата
- `@Override` не обязательна, но защищает от опечаток
- Overriding: требуется ковариантность возвращаемого типа

**Аналогия:**
- **Overloading — кофемашина:** много кнопок «Приготовить кофе» с разными параметрами (без параметров → эспрессо, +молоко → капучино, +молоко+сироп → латте). Выбор рецепта на этапе сборки (компиляции).
- **Overriding — сеть отелей ibis:** в каждом отеле подают «Стандартный завтрак», но в Париже это круассаны, в Токио — рис и мисо-суп. Что именно — выясняется только при заселении (runtime).

**Gotcha:**
```java
// Это НЕ скомпилируется — отличается только возвращаемый тип
public int calc() { return 1; }
public String calc() { return "one"; } // Ошибка компиляции!
```

---

## Вопрос 2: Abstract Class vs Interface (Java 8+)

**Определение:**
- **Interface:** контракт поведения (can-do). Класс может реализовать много интерфейсов. Нет состояния (только `public static final` константы).
- **Abstract Class:** частичная реализация (is-a). Может иметь состояние, конструкторы, private-методы. Класс наследует только один абстрактный класс.

**Глубина для Senior:**
- Java 8+: в интерфейсах появились `default` и `static` методы
- Java 9+: `private` методы в интерфейсах
- Даже с default-методами интерфейс ≠ абстрактный класс (нет полей экземпляра)

**Аналогия:**
- **Интерфейс — водительские права:** любой может водить машину, если умеет рулить, тормозить, парковаться
- **Абстрактный класс — чертёж автомобиля:** есть кузов, объём бака, VIN-номер. Нельзя купить «просто автомобиль» — только конкретный Peugeot 208 или Renault Clio

**Gotcha:**
```java
// Интерфейс НЕ может иметь поле экземпляра
interface Payment {
    String status = "PENDING"; // Это public static final, не поле экземпляра!
}
```

---

## Вопрос 3: Access Modifiers (модификаторы доступа)

**Определение:**

| Модификатор | Класс | Пакет | Дочерние (др. пакет) | Все |
|-------------|:----:|:----:|:--------------------:|:---:|
| `private` | Да | Нет | Нет | Нет |
| `default` | Да | Да | Нет | Нет |
| `protected` | Да | Да | Да | Нет |
| `public` | Да | Да | Да | Да |

**Аналогия (многоэтажный офис):**
- `private` — личный блокнот на столе
- `default` — кофемашина в отделе (ваш этаж)
- `protected` — база знаний компании (ваш отдел + дети основателя)
- `public` — ресепшен на входе

**Gotcha:** `default` (package-private) — это отсутствие модификатора. Не путайте с `default` в интерфейсах!

---

## Вопрос 4: Номинальная vs Структурная типизация

**Определение:**
- **Номинальная (Java):** тип объекта определяется его явным объявлением (`implements`, `extends`). Даже если структура классов совпадает, компилятор требует явного указания.
- **Структурная (TypeScript, Go):** если объект имеет те же методы, что и интерфейс, он автоматически удовлетворяет интерфейсу (duck typing).

**Аналогия:**
- **Паспортный контроль (Java):** нужен документ именно государственного образца
- **Фейсконтроль в клубе (TS):** если у тебя белые кроссовки и нет дресс-кода — проходишь

**Gotcha:** Даже если класс в Java имеет один в один те же методы, что в интерфейсе, без `implements` компилятор выдаст ошибку.

---

## Вопрос 5: Примитивы vs Объекты-обёртки (Autoboxing)

**Определение:**
- **Примитивы:** `int`, `long`, `boolean`, `double` — хранятся в стеке, не могут быть `null`
- **Обёртки:** `Integer`, `Long`, `Boolean`, `Double` — объекты в куче, могут быть `null`
- **Autoboxing:** автоматическая конвертация `int → Integer` и обратно

**Глубина для Senior:**
```java
Integer a = 127;
Integer b = 127;
System.out.println(a == b); // true (кэш до 127)

Integer c = 128;
Integer d = 128;
System.out.println(c == d); // false! Разные объекты в куче!
```

**Аналогия:** Обычный гвоздь (примитив) vs гвоздь в подарочной упаковке с инструкцией (обёртка).

**Gotcha:** `==` сравнивает ссылки объектов-обёрток, а не значения. Используйте `.equals()`. Autoboxing в циклах создаёт лишние объекты.

---

## Вопрос 6: Records — назначение, ограничения

**Определение:**
```java
public record UserDTO(Long id, String email) {}
```
Неизменяемый (immutable) контейнер данных. Автоматически генерирует: конструктор, геттеры (без `get`), `equals()`, `hashCode()`, `toString()`.

**Глубина для Senior:**
- Идеальны для DTO и response
- **НЕЛЬЗЯ использовать как Entity для Hibernate** (требуется изменяемость для dirty checking)

**Аналогия:** Запечатанная на заводе посылка с фиксированным содержимым — нельзя вскрыть и изменить.

**Gotcha:**
```java
@Entity
public record Task(Long id, String title) {} // Ошибка! Hibernate не сможет создать прокси
```

---

## Вопрос 7: Коллекции — когда что использовать

**Определение:**

| Коллекция | Порядок | Дубликаты | Null | Скорость поиска |
|-----------|---------|-----------|------|-----------------|
| `ArrayList` | да | да | да | O(n) (O(1) по индексу) |
| `LinkedList` | да | да | да | O(n) |
| `HashSet` | нет | нет | 1 null | O(1) |
| `TreeSet` | сортировка | нет | нет | O(log n) |
| `HashMap` | нет | ключи: нет | 1 null ключ | O(1) |
| `TreeMap` | сортировка | ключи: нет | нет | O(log n) |

**Аналогия:**
- `List` — упорядоченная очередь в магазине
- `Set` — список уникальных гостей на вечеринке
- `Map` — номерки в гардеробе (ключ → вещь)

**Gotcha:** `HashSet` и `HashMap` требуют корректной реализации `equals()` и `hashCode()`.

---

## Вопрос 8: Streams API — ленивые вычисления

**Определение:**
```java
list.stream()
    .filter(u -> u.isActive())
    .map(u -> u.getEmail())
    .toList();
```
Конвейерная обработка данных в функциональном стиле.

**Глубина для Senior:**
- **Ленивые вычисления:** операции .filter(), .map() не выполняются, пока не вызван терминальный оператор (`.toList()`, `.collect()`, `.forEach()`)
- Streame идут по **одному элементу** за раз, а не выполняют всю фильтрацию, потом весь маппинг

**Аналогия:** Заводской конвейер — сырьё движется по ленте, проходя сортировку и обработку, но конвейер запускается только когда нажат финальный выключатель.

**Gotcha:**
```java
// Код НЕ выполнится — нет терминального оператора!
list.stream()
    .filter(u -> { System.out.println("Фильтрую..."); return true; });
```

---

## Вопрос 9: equals() и hashCode() — контракт

**Определение:**
- Если `equals()` возвращает `true` для двух объектов, их `hashCode()` **обязан** быть одинаковым
- Обратное не требуется: разные hashCode при равных equals — это коллизия (но легально)

**Глубина для Senior:**
- Нарушение контракта → `HashMap` и `HashSet` перестают работать: объект можно положить, но не найти
- `HashMap` сначала сравнивает hashCode (быстро), потом equals (точно)

**Аналогия:** Библиотечный каталог. hashCode — номер полки (мы ищем в правильном отделе), equals — сверка ISBN (точное совпадение).

**Gotcha:**
```java
class User {
    String email;
    
    @Override
    public boolean equals(Object o) {
        // equals переопределили...
    }
    // hashCode НЕ переопределили! → HashMap сломана
}
```

---

## Вопрос 10: Исключения — checked vs unchecked

**Определение:**
- **Checked (проверяемые):** `IOException`, `SQLException` — обязаны обработать (`try-catch` или `throws`)
- **Unchecked (непроверяемые):** `NullPointerException`, `IllegalArgumentException` (наследники `RuntimeException`) — можно не обрабатывать

**Глубина для Senior:**
- Spring по умолчанию откатывает транзакцию на `RuntimeException`, но не на checked
- Современный подход: checked исключения считаются анти-паттерном (см. Java 8+ функциональщина)

**Аналогия:** 
- **Checked:** вы ведёте машину и видите знак «Ремонт дороги» — обязаны объехать
- **Unchecked:** внезапно лопнуло колесо — страховка (catch) может сработать, но не обязана

**Gotcha:**
```java
@Transactional
public void process() throws Exception { // checked!
    // если упадёт — транзакция НЕ откатится!
}
```

---

## Вопрос 11: Generics — стирание типов, вариативность

**Определение:**
- Generics позволяют параметризовать типы: `List<String>`
- **Type Erasure:** информация о generic-типе **стирается** на этапе компиляции. В runtime `List<String>` и `List<Integer>` — один и тот же класс `List`

**Глубина для Senior:**
- PECS: Producer Extends, Consumer Super
- `List<? extends Number>` — можно читать как Number, нельзя добавлять
- `List<? super Integer>` — можно добавлять Integer, нельзя читать как Integer (только Object)

**Аналогия:** Коробка с пометкой «Фрукты» (`List<? extends Fruit>`). Вы знаете, что внутри фрукт, но не можете положить туда яблоко — вдруг там коробка для цитрусовых?

**Gotcha:**
```java
// Нельзя создать массив generic-типов
List<String>[] array = new List<String>[10]; // Ошибка компиляции!
// Почему? Из-за стирания типов и ковариантности массивов
```

---

## Вопрос 12: Многопоточность — synchronized, volatile, atomic

**Определение:**
- **synchronized:** блокировка монитора объекта, гарантирует видимость и атомарность
- **volatile:** запрещает кэширование переменной в регистрах CPU (гарантирует видимость, НЕ атомарность)
- **Atomic***: `AtomicInteger`, `AtomicReference` — CAS (Compare-And-Swap) операции без блокировки

**Глубина для Senior:**
- `synchronized` — пессимистическая блокировка (дорого)
- `volatile` решает проблему видимости, но не race condition для `i++`
- `AtomicInteger` использует `Unsafe.compareAndSwapInt` (на уровне CPU)

**Gotcha:**
```java
private volatile int count = 0;
// ЭТО НЕ РАБОТАЕТ — count++ это read+modify+write
count++; // не атомарно!

// Работает только AtomicInteger
private AtomicInteger count = new AtomicInteger(0);
count.incrementAndGet();
```

---

## Вопрос 13: Virtual Threads (Project Loom)

**Определение:**
Виртуальные потоки (Java 21+) — легковесные потоки, управляемые JVM, а не ОС. Позволяют создавать миллионы потоков без просадки памяти.

**Глубина для Senior:**
- Физический поток ОС ≈ 1 МБ; виртуальный поток ≈ несколько сотен байт
- При блокирующем I/O виртуальный поток «паркуется», а физический поток переключается на другой виртуальный поток
- Код остаётся синхронным — не нужен `async/await`

**Аналогия:** Ресторан с актёрами, которые мгновенно меняют маски. Пока один гость читает меню, актёр обслуживает другого столика.

**Gotcha:**
```java
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    executor.submit(() -> {
        // Блокирующий I/O не блокирует физический поток
        Thread.sleep(1000); // допустимо с VT!
    });
}
```

---

## Вопрос 14: Garbage Collector — G1, ZGC

**Определение:**
GC — фоновый процесс JVM, удаляющий неиспользуемые объекты из кучи (Heap).

**Глубина для Senior:**
- **G1GC (по умолчанию с Java 9):** разделяет Heap на регионы, собирает самые «мусорные» первыми (Garbage-First)
- **ZGC (Java 21+):** паузы Stop-The-World < 1 мс независимо от размера кучи (Scalable Low-Latency)
- **CMS:** удалён в Java 14 (был стандартом в Java 8)

**Аналогия:**
- **G1GC:** уборщик, который сначала убирает самую грязную комнату
- **ZGC:** уборщик-призрак, убирающий пыль, пока вы спите — вы никогда не замечаете уборки

**Gotcha:**
```java
// Если запустить на Java 21 старые скрипты с флагом CMS:
-XX:+UseConcMarkSweepGC // JVM не запустится! Флаг удалён
```

---

## Вопрос 15: String pool, immutability

**Определение:**
- `String` в Java **immutable** (неизменяемый)
- **String Pool:** пул строк в Metaspace. При создании `"hello"` JVM проверяет, есть ли уже такая строка в пуле

```java
String a = "hello";
String b = "hello";
System.out.println(a == b); // true (один объект из пула)

String c = new String("hello");
System.out.println(a == c); // false (новый объект в куче)
```

**Аналогия:** Общий склад книг в библиотеке. Если двум читателям нужна одна книга, библиотека не покупает второй экземпляр — даёт одну на двоих.

**Gotcha:**
```java
// StringBuilder быстрее, чем конкатенация строк в цикле!
String result = "";
for (int i = 0; i < 1000; i++) {
    result += i; // Создаётся 1000 новых строк!
}
// Используйте StringBuilder
```

---

## Вопрос 16: Файловая система NIO.2

**Определение:**
`java.nio.file` (Java 7+) — современный API для работы с файлами.

```java
Path path = Paths.get("/tmp/file.txt");
List<String> lines = Files.readAllLines(path);
Files.write(path, "content".getBytes());
```

**Глубина для Senior:**
- `Files.walk()` — рекурсивный обход дерева
- `WatchService` — слежение за изменениями файлов (как `fs.watch` в Node.js)

**Gotcha:** `Files.readAllLines()` загружает весь файл в память. Для больших файлов используйте `Files.lines()` (Stream-based).

---

## Вопрос 17: Сериализация

**Определение:**
Преобразование объекта в поток байт для передачи/сохранения.

```java
public class User implements Serializable {
    private static final long serialVersionUID = 1L;
}
```

**Глубина для Senior:**
- `transient` поля не сериализуются
- `serialVersionUID` — версия класса для совместимости
- **Не используйте Java Serialization в современных проектах** — используйте JSON (Jackson), Protocol Buffers

**Gotcha:** Если изменить класс после сериализации и не обновить `serialVersionUID`, получите `InvalidClassException`.

---

## Вопрос 18: Reflection API

**Определение:**
Возможность исследовать и изменять структуру классов и вызывать методы в runtime.

```java
Method method = obj.getClass().getMethod("getName");
String name = (String) method.invoke(obj);
```

**Глубина для Senior:**
- Используется в Spring (DI, AOP), Hibernate, JPA
- **С Java 17:** `setAccessible(true)` для private полей требует флага `--add-opens`
- **Медленнее прямого вызова** (но JIT может оптимизировать)

**Gotcha:** Рефлексия может нарушать инкапсуляцию. На Java 9+ модульная система запрещает доступ к внутренним API JDK.

---

## Вопрос 19: Модульная система (Java 9+)

**Определение:**
Project Jigsaw — система модулей, позволяющая группировать код и явно указывать, какие пакеты экспортируются.

```java
// module-info.java
module com.myapp {
    exports com.myapp.api;
    requires spring.boot;
}
```

**Глубина для Senior:**
- Решает проблему Classpath Hell
- `exports` — что доступно внешнему миру
- `requires` — какие модули нужны
- `--add-opens` — открыть пакет для рефлексии (нужно для Lombok, Jackson)

**Gotcha:** Старые библиотеки (JAXB в Java 8 были в JDK) удалены. Нужно явно добавлять их в зависимости.

---

## Вопрос 20: Optional — правильное использование

**Определение:**
Контейнер, который может содержать или не содержать значение (защита от NPE).

```java
Optional<User> userOpt = repository.findByEmail("test@mail.com");
String name = userOpt.map(User::getName).orElse("Anonymous");
```

**Глубина для Senior:**
- **НЕ используйте `Optional.get()` без `isPresent()`** — это та же NPE
- **НЕ используйте Optional как поле класса** — он не Serializable
- **НЕ используйте Optional как параметр метода** — это нарушение контракта

**Gotcha:**
```java
// ПЛОХО: NPE, если userOpt пуст
String name = userOpt.get();

// ХОРОШО: дефолтное значение
String name = userOpt.orElse("Anonymous");
```

---

# Часть 2: Spring Boot / JPA (15 вопросов)

---

## Вопрос 21: IoC/DI — что это и как работает

**Определение:**
**Inversion of Control (IoC)** — управление жизненным циклом объектов передаётся контейнеру Spring.
**Dependency Injection (DI)** — контейнер сам внедряет зависимости в объект.

```java
@Service
public class UserService {
    private final UserRepository repo;
    
    // Spring сам внедрит UserRepository через конструктор
    public UserService(UserRepository repo) {
        this.repo = repo;
    }
}
```

**Аналогия:** Вместо того чтобы собирать кухню вручную, вы заказываете модульную — система сама привозит и подключает холодильник, плиту и раковину.

**Gotcha:** Constructor injection — предпочтительный способ (final поля, удобно тестировать). Field injection (@Autowired) — устарел.

---

## Вопрос 22: Bean Lifecycle (жизненный цикл бина)

**Определение:**
1. Создание экземпляра (constructor)
2. Установка зависимостей (setters/@Autowired)
3. `@PostConstruct` — инициализация
4. Готов к использованию
5. `@PreDestroy` — перед уничтожением

**Аналогия:** Работник нанимается (создание), ему выдают инструменты (DI), он проходит инструктаж (@PostConstruct), работает, и перед увольнением сдаёт инструменты (@PreDestroy).

**Gotcha:**
```java
@Component
public class MyBean {
    public MyBean() { /* 1 */ }
    
    @Autowired
    private Helper helper; /* 2 */
    
    @PostConstruct
    public void init() { /* 3 */ } // helper уже доступен!
}
```

---

## Вопрос 23: @Component vs @Service vs @Repository vs @Controller

**Определение:**
Все они — стереотипные аннотации, наследующие `@Component`. Отличаются семантической ролью:
- `@Service` — бизнес-логика
- `@Repository` — слой доступа к БД (транслирует SQL-исключения в `DataAccessException`)
- `@Controller` / `@RestController` — веб-слой (принимает HTTP-запросы)

**Аналогия:** Разные отделы в компании — бухгалтерия, склад, менеджеры. У каждого своя зона ответственности.

**Gotcha:** Технически можно везде использовать `@Component`, но это нарушает принцип единственной ответственности и усложняет AOP (например, `@Repository` включает трансляцию исключений).

---

## Вопрос 24: Spring Security Filter Chain

**Определение:**
Запрос проходит через цепочку фильтров безопасности перед тем, как попасть в контроллер.

**Порядок фильтров:**
1. CORS Filter
2. CsrfFilter
3. UsernamePasswordAuthenticationFilter
4. **Custom JWT Filter** (ваш)
5. ExceptionTranslationFilter
6. FilterSecurityInterceptor (проверка авторизации)

**Аналогия:** Многоуровневый досмотр в аэропорту:
1. Проверка паспорта (CORS)
2. Сканер багажа (CSRF)
3. Посадка в транзитную зону (SecurityContextHolder)
4. Контроль у ворот (Authorization)

**Gotcha:** `SecurityContextHolder` по умолчанию использует `ThreadLocal`. Если вы запускаете асинхронную задачу (через `@Async` или Virtual Thread без настройки), контекст безопасности теряется.

---

## Вопрос 25: JWT — жизненный цикл

**Определение:**
JSON Web Token — компактный URL-безопасный формат для передачи claims.

**Жизненный цикл:**
1. Пользователь логинится → сервер выдаёт Access Token + Refresh Token
2. Angular хранит Access Token в памяти (или HttpOnly cookie)
3. Каждый запрос → Interceptor добавляет `Authorization: Bearer <Access Token>`
4. При 401 → Interceptor пытается обновить через Refresh Token
5. Refresh Token протух → logout

**Gotcha:**
```java
// Никогда не храните JWT в localStorage! XSS-уязвимость.
// localStorage.getItem('token') может прочитать любой JS-скрипт.
```
Правильное решение: **HttpOnly Secure SameSite Strict cookie** + BFF (Backend For Frontend) паттерн.

---

## Вопрос 26: @Transactional — propagation, isolation

**Определение:**
Управление транзакциями в Spring. Основные параметры:

```java
@Transactional(
    propagation = Propagation.REQUIRED,  // по умолчанию: использует текущую или создаёт новую
    isolation = Isolation.READ_COMMITTED  // по умолчанию в PostgreSQL
)
```

**Propagation (распространение):**
- `REQUIRED` — использует текущую транзакцию или создаёт новую
- `REQUIRES_NEW` — приостанавливает текущую и создаёт новую
- `NESTED` — точка сохранения внутри текущей (Savepoint)
- `MANDATORY` — должен быть вызван внутри транзакции (иначе ошибка)

**Isolation (изоляция):**
- `READ_COMMITTED` — защита от Dirty Read (по умолчанию в PostgreSQL)
- `REPEATABLE_READ` — защита от Non-Repeatable Read
- `SERIALIZABLE` — полная изоляция (дорого!)

**Gotcha:**
```java
// Self-invocation — транзакция НЕ откроется!
@Service
public class UserService {
    public void methodA() {
        methodB(); // this.methodB() — прокси не вызывается!
    }
    
    @Transactional
    public void methodB() { /* ... */ }
}
```

---

## Вопрос 27: N+1 проблема и JOIN FETCH

**Определение:**
Hibernate делает 1 запрос для списка и N запросов для каждого элемента списка.

```java
// Проблема N+1:
List<User> users = userRepo.findAll();
for (User u : users) {
    System.out.println(u.getPosts().size()); // каждый getPosts() — новый SQL
}

// Решение:
@Query("SELECT u FROM User u LEFT JOIN FETCH u.posts")
List<User> findAllWithPosts();
```

**Аналогия:** Сходить в магазин 10 раз за 10 продуктами вместо одного раза со списком.

**Gotcha:** LAZY — по умолчанию для коллекций. Если обращаться к lazy-полю вне транзакции — получите `LazyInitializationException`.

---

## Вопрос 28: @ControllerAdvice

**Определение:**
Глобальный обработчик исключений для всех контроллеров.

```java
@RestControllerAdvice
public class GlobalExceptionHandler {
    
    @ExceptionHandler(EntityNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ErrorResponse handleNotFound(EntityNotFoundException ex) {
        return new ErrorResponse("NOT_FOUND", ex.getMessage());
    }
}
```

**Аналогия:** Подушка безопасности — перехватывает любые аварии и превращает их в стандартные JSON-ответы.

**Gotcha:** Не обрабатывайте `Exception.class` глобально — это скроет реальные ошибки. Обрабатывайте конкретные типы исключений.

---

## Вопрос 29: AOP — как работает, join points

**Определение:**
Аспектно-ориентированное программирование — вынос сквозной логики (логирование, безопасность, транзакции) из бизнес-кода.

```java
@Aspect
@Component
public class LoggingAspect {
    
    @Before("execution(* com.myapp.service.*.*(..))")
    public void logBefore(JoinPoint jp) {
        log.info("Called: {}", jp.getSignature());
    }
}
```

**Аналогия:** Рамка металлоискателя на входе — каждый посетитель проходит через неё автоматически, сотрудникам внутри не нужно проверять каждого вручную.

**Gotcha:** AOP работает через Dynamic Proxy. Если би не реализует интерфейс, Spring использует CGLIB (через наследование). Self-invocation не перехватывается.

---

## Вопрос 30: Entity vs DTO, Records

**Определение:**
- **Entity** — класс, аннотированный `@Entity`, привязан к таблице БД
- **DTO** — объект передачи данных между слоями

```java
// Entity — для Hibernate
@Entity
public class User {
    @Id private Long id;
    private String email;
}

// DTO — для API (Record)
public record UserResponse(Long id, String email) {}
```

**Gotcha:** Никогда не отдавайте Entity напрямую через API. Это нарушает инкапсуляцию и может привести к lazy-loading проблемам. Всегда используйте DTO/Records.

---

## Вопрос 31: @OneToMany vs @ManyToOne

**Определение:**
```java
// Владеющая сторона (держит Foreign Key)
@Entity
public class Task {
    @ManyToOne
    @JoinColumn(name = "category_id")
    private Category category;
}

// Обратная сторона
@Entity
public class Category {
    @OneToMany(mappedBy = "category")
    private List<Task> tasks = new ArrayList<>();
}
```

**Аналогия:** Обручальные кольца — муж (Task) носит кольцо (Foreign Key), жена (Category) говорит «я замужем за тем, кто носит кольцо» (`mappedBy`).

**Gotcha:** Без `mappedBy` Hibernate создаст лишнюю связующую таблицу.

---

## Вопрос 32: @Query vs derived queries

**Определение:**
Spring Data JPA может генерировать запросы из имени метода (derived query) или принимать пользовательский JPQL/SQL.

```java
// Derived query (по имени метода)
List<User> findByEmailContainingIgnoreCase(String email);

// JPQL
@Query("SELECT u FROM User u WHERE u.email LIKE %:email%")
List<User> searchByEmail(@Param("email") String email);

// Native SQL
@Query(value = "SELECT * FROM users WHERE email LIKE %:email%", nativeQuery = true)
List<User> nativeSearch(@Param("email") String email);
```

**Gotcha:** Derived queries с JOIN могут создавать N+1. Используйте `@Query` с `JOIN FETCH` для контроля.

---

## Вопрос 33: Spring Boot autoconfiguration

**Определение:**
Spring Boot автоматически настраивает бины на основе зависимостей в classpath.

```java
@SpringBootApplication  // = @Configuration + @EnableAutoConfiguration + @ComponentScan
public class Application { }
```

**Глубина для Senior:**
- `spring.factories` — файл с конфигурациями автоконфигураций
- `@ConditionalOnClass`, `@ConditionalOnMissingBean` — условные аннотации
- Можно переопределить любую автоконфигурацию, объявив свой бин

**Gotcha:** Если непонятно, почему бин создаётся не так — включите debug-логи: `application.properties` → `debug=true`.

---

## Вопрос 34: Testing — @SpringBootTest vs @WebMvcTest

**Определение:**
```java
// Полный контекст (все бины)
@SpringBootTest
class UserServiceTest { }

// Только веб-слой
@WebMvcTest(UserController.class)
class UserControllerTest { }
```

**Глубина для Senior:**
- `@SpringBootTest` — интеграционное тестирование (тяжёлое, загружает все бины)
- `@WebMvcTest` — только контроллеры, остальное мокается
- `@DataJpaTest` — только репозитории
- Используйте **Testcontainers** (не H2!) для интеграционных тестов

**Gotcha:** `@WebMvcTest` не загружает `@Service`, `@Repository` бины — нужно мокать через `@MockBean`.

---

## Вопрос 35: Profiles и конфигурация

**Определение:**
Разделение конфигурации по окружениям:

```yaml
# application-dev.yml
spring:
  datasource:
    url: jdbc:h2:mem:testdb

# application-prod.yml
spring:
  datasource:
    url: jdbc:postgresql://prod:5432/db
```

```java
@Profile("dev")
@Component
public class DevDataSource { }
```

**Gotcha:** Не путайте `@Profile` с `@Conditional`. Profile — для окружений, Conditional — для условий (есть ли класс в classpath, задано ли свойство).

---

# Часть 3: Angular / RxJS (15 вопросов)

---

## Вопрос 36: Signals vs RxJS

**Определение:**
- **Signals (Сигналы):** синхронный, мелкозернистый контейнер состояния (`signal()`, `computed()`, `effect()`)
- **RxJS:** асинхронный поток данных во времени (`Observable`, `Subject`, операторы)

```typescript
// Signals — для синхронного UI-состояния
count = signal(0);
double = computed(() => count() * 2);

// RxJS — для асинхронных операций
data$ = this.http.get('/api/users').pipe(
  switchMap(users => this.processUsers(users))
);
```

**Аналогия:** Signals — таблица Excel (изменение одной ячейки пересчитывает только зависимые). RxJS — водопроводная труба (данные текут, можно ставить фильтры, разветвители).

**Gotcha:** Не используйте `effect()` для загрузки данных — это антипаттерн. Используйте `resource()` или RxJS.

---

## Вопрос 37: Новый Control Flow (@if/@for/@switch)

**Определение:**
Встроенный в компилятор синтаксис (Angular 17+), заменивший `*ngIf` и `*ngFor`.

```html
@if (isLoaded()) {
  <ul>
    @for (user of users(); track user.id) {
      <li>{{ user.name }}</li>
    } @empty {
      <li>Список пуст</li>
    }
  </ul>
} @else {
  <p>Загрузка...</p>
}
```

**Преимущества:** быстрее, не требует импорта `CommonModule`, блок `@empty` встроен.

**Аналогия:** Встроенный автоматический конвейер с детектором пустоты (не нужно писать отдельные проверки).

---

## Вопрос 38: Reactive Forms vs Template-driven

**Определение:**

| Reactive Forms | Template-driven |
|---------------|-----------------|
| Логика формы в TS-классе | Логика формы в HTML |
| `FormGroup`, `FormControl`, `FormBuilder` | `ngModel`, `#myVar="ngModel"` |
| Легко тестировать | Сложно тестировать |
| Строгая типизация (v14+) | Нет строгой типизации |

```typescript
// Reactive Form
form = new FormGroup({
  name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  email: new FormControl('', [Validators.email])
});
```

**Аналогия:** Виртуальный пульт управления в кабине пилота (TS), к которому подключены кнопки из кабины (HTML).

---

## Вопрос 39: HTTP Interceptors для JWT

**Определение:**
Функция, перехватывающая все HTTP-запросы/ответы.

```typescript
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).getToken();
  if (token) {
    req = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
  }
  return next(req);
};
```

**Глубина для Senior:**
- Интерцептор для 401 → автоматический Refresh Token
- Флаг `isRefreshing` + `BehaviorSubject` для блокировки параллельных запросов на refresh

**Аналогия:** Охранник, который проверяет пропуск у каждого входящего и ставит печать.

---

## Вопрос 40: Functional Guards

**Определение:**
Функция для защиты маршрутов (Angular 15+).

```typescript
export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  
  if (auth.isAuthenticated()) return true;
  
  router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
  return false;
};
```

**Gotcha:** Проверяйте не только `canActivate`, но и `canMatch` (для lazy-loaded modules).

---

## Вопрос 41: switchMap, debounceTime, combineLatest

**Определение:**
- **switchMap:** переключается на новый поток, отменяя предыдущий (живой поиск)
- **debounceTime:** задерживает срабатывание, пока не пройдёт N мс тишины
- **combineLatest:** объединяет последние значения из нескольких потоков

```typescript
// Живой поиск с debounce и отменой предыдущего запроса
search$ = new Subject<string>();

ngOnInit() {
  this.search$.pipe(
    debounceTime(300),
    filter(query => query.length >= 3),
    switchMap(query => this.http.get(`/api/search?q=${query}`))
  ).subscribe(results => this.results = results);
}
```

**Аналогия:** Эскалатор с датчиком — если в течение 300 мс никто не вошёл, эскалатор замедляется (debounce). Если кто-то вошёл — переключается на новый режим (switchMap).

**Gotcha:** switchMap отменяет предыдущий HTTP-запрос, если он всё ещё выполняется. Это предотвращает race condition, но используйте mergeMap, если отмена не нужна.

---

## Вопрос 42: Standalone Components

**Определение:**
Компоненты, не требующие `NgModule`. Самостоятельно декларируют свои зависимости.

```typescript
@Component({
  selector: 'app-user',
  standalone: true,
  imports: [NgIf, AsyncPipe],
  template: `...`
})
export class UserComponent {}
```

**Аналогия:** Переход от коммунальной квартиры (NgModule — всё общее) к отдельной квартире-студии (standalone — всё своё).

**Gotcha:** Даже в standalone-режиме нужен `imports: []` — это мост между TS и HTML (сборщик не видит использование в HTML-строке).

---

## Вопрос 43: Change Detection OnPush

**Определение:**
Режим, при котором компонент обновляется только при изменении входных параметров (`@Input`) или сигналов, а не при любом событии в приложении.

```typescript
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MyComponent { }
```

**Аналогия:** OnPush — вы отвечаете на звонки только по имени (если вас позвали — обновляетесь). Default — вы отвечаете на любой звук.

**Gotcha:** Если вы изменили поле объекта, а не ссылку, OnPush не увидит изменения. Нужно создать новый объект.

---

## Вопрос 44: Async pipe

**Определение:**
Пайп, автоматически подписывающийся на Observable/сигнал и отписывающийся при уничтожении компонента.

```html
<!-- async pipe автоматически управляет подпиской -->
<ul>
  <li *ngFor="let user of users$ | async">{{ user.name }}</li>
</ul>
```

**Аналогия:** Подписка на журнал — вы платите (рендерите компонент), и журнал приходит. Как только вы съезжаете (компонент уничтожен) — подписка отменяется автоматически.

**Gotcha:** Не используйте `| async` несколько раз на одном Observable — каждый пайп создаст новую подписку. Используйте конструкцию `as` или `@if (obs | async; as data)`.

---

## Вопрос 45: takeUntilDestroyed

**Определение:**
Оператор (Angular 16+), автоматически отписывающий Observable при уничтожении компонента.

```typescript
@Component({})
export class MyComponent {
  constructor() {
    interval(1000).pipe(
      takeUntilDestroyed() // автоматическая отписка
    ).subscribe(console.log);
  }
}
```

**Gotcha:** `takeUntilDestroyed()` работает только в контексте инжектора (конструктор или поле, не метод). Если вызвать в методе — нужен `DestroyRef`.

---

## Вопрос 46: Content Projection

**Определение:**
Проекция контента из родительского компонента в дочерний через `<ng-content>`.

```html
<!-- Дочерний компонент: -->
<div class="card">
  <ng-content select="[header]"></ng-content>
  <ng-content></ng-content>
</div>

<!-- Родительский компонент: -->
<app-card>
  <div header>Заголовок</div>
  <p>Основной контент</p>
</app-card>
```

**Аналогия:** Рамка для фотографии — вы вставляете свою фотографию (контент), рамка остаётся той же.

---

## Вопрос 47: Dependency Injection в Angular

**Определение:**
Система внедрения зависимостей, построенная на иерархических инжекторах.

```typescript
@Injectable({ providedIn: 'root' })  // Singleton на всё приложение
export class UserService { }

@Component({
  providers: [LocalService]  // Свой экземпляр для компонента и его детей
})
export class MyComponent {
  private userService = inject(UserService); // новый API inject()
}
```

**Аналогия:** Водопровод — есть центральный стояк (root injector), от которого отходят трубы к каждой квартире (компоненту). Можно перекрыть кран в своей квартире (providers: []).

**Gotcha:** Если зарегистрировать сервис в `providers` компонента, каждый экземпляр компонента получит свой сервис. Не делайте так для стейт-менеджмента.

---

## Вопрос 48: @Input/@Output сигналы

**Определение:**
Современный способ коммуникации между компонентами (Angular 17+).

```typescript
@Component({})
export class ChildComponent {
  // Входной сигнал (замена @Input)
  userName = input<string>('default');
  
  // Выходной сигнал (замена @Output + EventEmitter)
  userChange = output<string>();
  
  // Двусторонний сигнал (замена [(ngModel)])
  visible = model(false);
}
```

**Преимущества:** строгая типизация, поддержка computed, нет EventEmitter.

---

## Вопрос 49: Lazy Loading

**Определение:**
Отложенная загрузка модулей/компонентов (загружаются только при переходе на маршрут).

```typescript
// Angular 17+ — ленивая загрузка компонента
const routes: Routes = [{
  path: 'profile',
  loadComponent: () => import('./profile/profile.component')
    .then(m => m.ProfileComponent)  // одна строка!
}];
```

**Аналогия:** Библиотека с закрытым стеллажом — вы приносите запрос, библиотекарь идёт в подсобку и приносит книгу (загружает). Книги не выложены все сразу.

**Gotcha:** `loadComponent` (для standalone-компонентов) проще, чем старый `loadChildren` (для модулей).

---

## Вопрос 50: State Management без NgRx

**Определение:**
Для небольших и средних приложений не нужен NgRx. Достаточно сервиса с сигналами.

```typescript
@Injectable({ providedIn: 'root' })
export class UserStore {
  private users = signal<User[]>([]);
  private selectedId = signal<number | null>(null);
  
  // Readonly публичные сигналы
  readonly users$ = this.users.asReadonly();
  readonly selectedUser = computed(() => 
    this.users().find(u => u.id === this.selectedId())
  );
  
  // Методы для обновления
  setUsers(users: User[]) { this.users.set(users); }
  selectUser(id: number) { this.selectedId.set(id); }
}
```

**Аналогия:** Персональный сейф (сервис), где хранятся ценности (состояние). Доступ через ключ (методы). Никто не может залезть в сейф напрямую.

---

# Часть 4: Архитектура / DDD (10 вопросов)

---

## Вопрос 51: Clean Architecture

**Определение:**
Архитектура, где бизнес-логика (ядро) не зависит от внешних систем (БД, UI, фреймворков).

```
[ Внешнее кольцо: БД, UI, API ]
    [ Среднее кольцо: Адаптеры (Controllers, Repositories) ]
        [ Ядро: Entities, Use Cases ]  ← самое важное
```

**Аналогия:** Розетка в стене — неважно, какой прибор вы включите (пылесос, фен, зарядка), розетка предоставляет стандартный интерфейс. В коде бизнес-логика не знает, какая БД используется.

**Gotcha:** Не путайте Clean Architecture с многослойной архитектурой (Controller → Service → Repository). Clean Architecture — о направлении зависимостей (внутрь, а не вниз).

---

## Вопрос 52: SOLID принципы

**Определение:**
1. **S**ingle Responsibility — одна причина для изменения класса
2. **O**pen/Closed — открыт для расширения, закрыт для изменения
3. **L**iskov Substitution — подкласс может заменить родителя
4. **I**nterface Segregation — много маленьких интерфейсов лучше одного большого
5. **D**ependency Inversion — зависимость от абстракций, не от конкретных классов

**Аналогия:** 
- **SRP:** Шеф-повар не должен мыть посуду
- **OCP:** Можно добавить новый соус к бургеру без изменения рецепта бургера
- **LSP:** Если функция ждёт «Птицу», можно передать «Утку» (она наследует птицу)
- **ISP:** Лучше два интерфейса «Умеет летать» и «Умеет плавать», чем один «Умеет всё»
- **DIP:** Подключайте телефон к розетке (интерфейс), а не напрямую к проводам в стене

---

## Вопрос 53: Bounded Context

**Определение:**
Понятие из Domain-Driven Design — явная граница вокруг модели данных для конкретной поддоменной области.

- **Order Context:** управляет заказами (Order, LineItem)
- **Billing Context:** управляет платежами (Invoice, Payment)
- **Shipping Context:** управляет доставкой (Package, Address)

Один и тот же «User» может иметь разные модели в разных контекстах.

**Аналогия:** Одна и та же девушка — для мамы она «дочка», для мужа «жена», для начальника «сотрудник». Разные контексты, разные роли.

---

## Вопрос 54: Event-Driven Architecture

**Определение:**
Архитектура, где сервисы общаются через события (messages), а не прямые HTTP-вызовы.

```
[ Service A ] ──(Event)──► [ Message Broker ] ──(Event)──► [ Service B ]
                                                      └──(Event)──► [ Service C ]
```

**Глубина для Senior:**
- RabbitMQ — классическая очередь (point-to-point)
- Kafka — лог событий (pub-sub, replay)
- Event Sourcing — хранение не текущего состояния, а всей последовательности событий

**Аналогия:** Радиостанция — она вещает (публикует), кто угодно может включить приёмник (подписаться). Станции не важно, кто слушает.

---

## Вопрос 55: Saga Pattern

**Определение:**
Паттерн для управления распределёнными транзакциями. Вместо ACID — серия компенсирующих действий.

```
Заказ создан ──► Деньги списаны ──► Товар зарезервирован ──► Отправлено
                                                                    │
                                                    Если ошибка ───┘
                                                    → Компенсация: вернуть деньги, отменить резерв
```

**Аналогия:** Бронирование путешествия — вы бронируете отель + билеты + страховку. Если билеты не купились — нужно отменить отель и страховку (компенсирующие действия).

---

## Вопрос 56: CQRS

**Определение:**
Command Query Responsibility Segregation — разделение команд (запись) и запросов (чтение).

**Глубина для Senior:**
- **Команды:** изменяют состояние, возвращают void
- **Запросы:** читают состояние, не изменяют
- Разные модели для чтения и записи
- Часто комбинируется с Event Sourcing

**Аналогия:** Библиотека — вы сдаёте книгу (команда) через одного библиотекаря, а берёте книгу (запрос) через другого. Разные процессы, разные модели.

**Gotcha:** CQRS избыточен для CRUD-приложений. Используйте только когда модели чтения и записи действительно разные.

---

## Вопрос 57: Strangler Fig

**Определение:**
Паттерн постепенной миграции: новый функционал пишется на новом стеке, старый постепенно «удушается» фиговым деревом.

```
┌──────────────────┐     ┌──────────────────┐
│ Старое приложение│     │ Старое приложение│
│ (Java 8)         │ ──► │ (Java 8)         │
│                  │     │   ┌──────────┐   │
│                  │     │   │ Новая    │   │
│                  │     │   │ фича     │   │
│                  │     │   │ (Java 21)│   │
└──────────────────┘     └──────────────────┘
                              ↓
                         ┌──────────────┐
                         │ Java 21 only │
                         └──────────────┘
```

**Аналогия:** Фиговое дерево-душитель — прорастает вокруг старого дерева, постепенно заменяя его. Старое дерево в итоге отмирает.

---

## Вопрос 58: Feature Toggles

**Определение:**
Механизм включения/выключения функционала без деплоя (через конфигурацию, БД, LaunchDarkly).

```java
if (featureToggle.isEnabled("new-checkout")) {
    return newCheckoutService.process(order);
} else {
    return oldCheckoutService.process(order);
}
```

**Аналогия:** Выключатель света — функционал можно включить, не перекладывая проводку.

**Gotcha:** Feature Toggles накапливаются. Нужно регулярно чистить старые флаги (иначе — технический долг).

---

## Вопрос 59: API Gateway

**Определение:**
Единая точка входа для всех микросервисов. Задачи: маршрутизация, авторизация, rate limiting.

```
[ Client ] ──► [ API Gateway: Spring Cloud Gateway ]
                    ├──→ User Service
                    ├──→ Order Service
                    └──→ Payment Service
```

**Глубина для Senior:**
- BFF (Backend For Frontend) — отдельный Gateway для каждого клиента (Web, Mobile)
- Gateway может конвертировать HttpOnly Cookie → JWT (безопасность)

---

## Вопрос 60: Circuit Breaker

**Определение:**
Паттерн отказоустойчивости — если внешний сервис падает, «предохранитель» размыкается и запросы к нему прекращаются.

```java
@CircuitBreaker(name = "externalApi", fallbackMethod = "fallback")
public String callExternalApi() {
    return restTemplate.getForObject("http://external/api", String.class);
}

public String fallback(Exception e) {
    return "default"; // возвращается, если внешний сервис недоступен
}
```

**Состояния:** CLOSED (норма) → OPEN (ошибки > порога) → HALF_OPEN (пробный запрос) → CLOSED/OPEN

**Аналогия:** Предохранитель в электрощитке — при коротком замыкании он отключает цепь, спасая проводку.

---

# Часть 5: Миграция / Tech Debt (10 вопросов)

---

## Вопрос 61: Java 8 → 21 — что изменилось

**Определение:**
Ключевые изменения:
- **Java 8:** Streams, Lambdas, Optional, java.time
- **Java 9–11:** Module System, HTTP Client, try-with-resources улучшения
- **Java 14–17:** Records, Sealed Classes, Pattern Matching
- **Java 21:** Virtual Threads (Project Loom), Record Patterns, Pattern Matching for switch

**Главная боль миграции:** `javax.*` → `jakarta.*` (Spring Boot 2 → 3).

---

## Вопрос 62: Angular 8 → 20 — ключевые изменения

**Определение:**
- **v9:** Ivy (новый компилятор, tree-shaking)
- **v12/13:** Удаление View Engine, отказ от IE11
- **v14/15:** Standalone Components, Typed Forms
- **v16/17:** Signals, новый Control Flow (@if/@for)
- **v18/20:** Zoneless, Resource API

---

## Вопрос 63: Стратегия zero-downtime migration

**Определение:**
Миграция без остановки работающей системы.

**Стратегия:**
1. **Strangler Fig:** новый функционал — на новом стеке, старый постепенно выводится
2. **Blue-Green Deployment:** два идентичных окружения, переключение трафика
3. **Feature Flags:** включение нового кода для отдельных пользователей
4. **Database Migration:** Backward-compatible миграции (не удалять колонки сразу)

---

## Вопрос 64: Technical debt measurement (SonarQube)

**Определение:**
Метрики SonarQube:

| Метрика | Что измеряет | Цель |
|---------|-------------|------|
| Coverage | Покрытие тестами | ≥ 80% |
| Duplications | Дублирование кода | < 3% |
| Code Smells | Запах кода | Устранять |
| Security Hotspots | Уязвимости | Zero critical |
| Technical Debt Ratio | % времени на исправление | < 5% |

**Процесс:** SonarLint (IDE) → SonarQube (CI/CD) → Quality Gate (блокировка PR).

---

## Вопрос 65: Strangler Fig Pattern

**Определение:**
Паттерн постепенной замены legacy-системы (см. вопрос 57).

**Как применять на практике:**
1. Идентифицируйте один модуль/функцию
2. Напишите тесты (Characterization Tests), чтобы зафиксировать поведение
3. Создайте Feature Flag
4. Реализуйте на новом стеке
5. Переключите трафик через Feature Flag
6. Удалите старый код

---

## Вопрос 66: Feature Flags

**Определение:**
Механизм включения/выключения фич без деплоя (см. вопрос 58).

**Gotcha:** 
- Всегда заводите задачу на удаление флага после стабилизации
- Не используйте флаги для временного отключения безопасности!

---

## Вопрос 67: Canary releases

**Определение:**
Постепенный rollout новой версии — сначала на 5% пользователей, потом на 20%, 50%, 100%.

```
v1 (старая): 100% трафика
         ↓
v2 (новая): 5% → v1: 95%
         ↓
v2: 50% → v1: 50%
         ↓
v2: 100%
```

**Аналогия:** Проба воды локтем перед купанием — сначала маленький тест, потом полное погружение.

---

## Вопрос 68: Rollback стратегия

**Определение:**
План действий при проблемах с релизом.

**Варианты:**
1. **Revert PR:** откат через git revert (быстро, безопасно для БД)
2. **Reroute traffic:** переключение обратно на старую версию (для Blue-Green)
3. **Feature Flag toggle:** отключить проблемный функционал
4. **Database rollback:** восстановление из бекапа (долго, опасно)

**Gotcha:** Rollback БД — самая опасная операция. Лучше forward-fix (исправить и деплоить).

---

## Вопрос 69: Dependency upgrades (Bill of Materials)

**Определение:**
Управление версиями зависимостей через BOM (Bill of Materials).

```xml
<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-dependencies</artifactId>
            <version>3.2.0</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
    </dependencies>
</dependencyManagement>
```

**Глубина для Senior:**
- Используйте **Dependabot** или **Renovate** для автоматических обновлений
- Всегда проверяйте changelog перед обновлением major-версии
- BOM гарантирует совместимость версий внутри фреймворка

---

## Вопрос 70: Performance regression testing

**Определение:**
Контроль производительности при изменениях кода.

**Инструменты:**
- **JMeter** / **Gatling** — нагрузочное тестирование
- **JMH (Java Microbenchmark Harness)** — микро-бенчмарки
- **Lighthouse** — производительность фронтенда

**Ключевые метрики:**

| Метрика | Бэкенд | Фронтенд |
|---------|--------|----------|
| Latency (p50, p95, p99) | ✅ | ✅ |
| Throughput (RPS) | ✅ | ❌ |
| Bundle size | ❌ | ✅ |
| Time to Interactive | ❌ | ✅ |
| Memory usage | ✅ | ✅ |

---

# Часть 6: Cloud / DevOps (10 вопросов)

---

## Вопрос 71: Docker multi-stage builds

**Определение:**
Dockerfile с несколькими стадиями для минимизации итогового образа.

```dockerfile
# Стадия 1: сборка
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn clean package

# Стадия 2: запуск (только JRE + jar)
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

**Зачем:** Финал — только JRE + jar, без JDK, без исходников, без инструментов сборки.

---

## Вопрос 72: Kubernetes — Pod, Service, Ingress

**Определение:**
- **Pod:** минимальная единица (1+ контейнеров)
- **Service:** стабильный IP/домен для доступа к Pod'ам
- **Ingress:** внешний HTTP-роутер (path-based routing, TLS)

```yaml
apiVersion: apps/v1
kind: Deployment
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: app
        image: myapp:latest
        ports:
        - containerPort: 8080
---
apiVersion: v1
kind: Service
spec:
  selector:
    app: myapp
  ports:
  - port: 80
    targetPort: 8080
```

**Аналогия:** Pod — квартира, Service — почтовый адрес дома, Ingress — консьерж, направляющий посетителей в нужную квартиру.

---

## Вопрос 73: Helm charts

**Определение:**
Пакетный менеджер для Kubernetes. Chart — шаблон с параметрами.

```yaml
# values.yaml
replicaCount: 3
image:
  repository: myapp
  tag: latest
```

```yaml
# templates/deployment.yaml (шаблон с параметрами)
apiVersion: apps/v1
kind: Deployment
spec:
  replicas: {{ .Values.replicaCount }}
```

**Gotcha:** Используйте Helm для повторяющихся шаблонов, не для кастомизации каждого микросервиса.

---

## Вопрос 74: CI/CD pipeline design

**Определение:**
Этапы автоматизации сборки и деплоя.

```
[ Commit ] → [ Build ] → [ Test ] → [ Sonar ] → [ Package ] → [ Deploy Dev ]
                                                                    ↓
                                                              [ Deploy Staging ]
                                                                    ↓
                                                              [ Deploy Prod ]
```

**Ключевые принципы:**
- Каждый этап — gate (если тесты не прошли → stop)
- Артефакт собирается один раз (build once, deploy anywhere)
- Dev/Staging/Prod — максимально идентичны

---

## Вопрос 75: Cloud vs on-premise tradeoffs

**Определение:**

| Критерий | Cloud (AWS/GCP/Azure) | On-premise |
|----------|----------------------|------------|
| CAPEX | Нет (pay-as-you-go) | Высокий (оборудование) |
| OPEX | Средний | Низкий (электричество) |
| Масштабирование | Мгновенно | Дни/недели |
| Безопасность | Shared responsibility | Полный контроль |
| Compliance | Сертификации (SOC2) | Под ваш аудит |

**Французский контекст:** Банки и госсектор часто выбирают on-premise или Sovereign Cloud (OVHcloud, Outscale) для соответствия RGPD.

---

## Вопрос 76: Auto-scaling strategies

**Определение:**
Автоматическое масштабирование приложения.

```yaml
# Horizontal Pod Autoscaler (Kubernetes)
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
spec:
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

**Стратегии:**
- **Reactive:** на основе метрик (CPU, memory, RPS)
- **Predictive:** на основе исторических данных (Proactive)
- **Scheduled:** по расписанию (например, увеличить в час пик)

---

## Вопрос 77: Blue-green deployment

**Определение:**
Два идентичных окружения (Blue и Green). Только одно активно.

```
┌──────────┐     ┌──────────┐
│  Blue    │     │  Green   │  ← новое окружение
│ (старая) │     │ (новая)  │
│ v1       │     │ v2       │
└────┬─────┘     └────┬─────┘
     │                │
     └── Load Balancer ──┘
            └── 100% трафика на Blue → switch → 100% на Green
```

**Аналогия:** Два лифта — пока один ремонтируется, второй работает. Пассажиров переключают на рабочий.

**Gotcha:** Нужно вдвое больше ресурсов. Для экономии используйте canary releases.

---

## Вопрос 78: Infrastructure as Code

**Определение:**
Управление инфраструктурой через код (YAML, HCL, JSON).

**Инструменты:**
- **Terraform (HashiCorp):** декларативное описание всей инфраструктуры
- **Ansible:** push-модель через SSH, безагентный
- **Pulumi:** IaC на Python/TypeScript/Go
- **CDK (Cloud Development Kit):** AWS IaC на TypeScript/Python

**Принцип:** Вся инфраструктура — в git. Никаких ручных изменений в консоли.

---

## Вопрос 79: Secrets management

**Определение:**
Безопасное хранение секретов (паролей, токенов, ключей).

**Плохо:**
```yaml
# application.properties — НИКОГДА!
db.password=supersecret
```

**Хорошо:**
```yaml
# Использовать HashiCorp Vault, AWS Secrets Manager, или Kubernetes Secrets
apiVersion: v1
kind: Secret
metadata:
  name: db-credentials
type: Opaque
data:
  password: <base64>
```

**Лучшая практика:** Внешний Secrets Manager (Vault, AWS SM), где секреты шифруются в покое и ротируются автоматически.

---

## Вопрос 80: Observability — 3 pillars

**Определение:**
Три столпа наблюдаемости:

| Pillar | Что | Инструменты |
|--------|-----|------------|
| **Logging** | Структурированные логи | ELK Stack, Loki, Datadog |
| **Metrics** | Числовые показатели (CPU, RPS, latency) | Prometheus + Grafana |
| **Tracing** | Сквозная трассировка запросов | Jaeger, Zipkin, OpenTelemetry |

**Глубина для Senior:**
- Structured logging: JSON-логи, не строки
- RED metrics: Rate, Errors, Duration (для каждого сервиса)
- Trace propagation: корреляция через `traceId` между микросервисами

**Аналогия:**
- **Logging:** Чёрный ящик самолёта — записи всего, что произошло
- **Metrics:** Приборная панель пилота — скорость, высота, топливо
- **Tracing:** Маршрут полёта на радаре — видно весь путь запроса

---

## Резюме главы

- 80 вопросов, покрывающих все ключевые домены: Java Core → Spring → Angular → Архитектура → Миграция → DevOps
- Каждый вопрос — 4 элемента: определение, глубина, аналогия, gotcha
- Для французского рынка особый акцент: виртуальные потоки, JWT, CodinGame, Clean Architecture
- Используйте аналогии из жизни — французские интервьюеры это ценят
- Запоминайте gotcha'и — это отличает Senior от Middle

**Совет:** Не пытайтесь выучить все 80 вопросов за раз. Разбейте на блоки по 5 вопросов в день. Через 2 недели вы будете готовы к любому интервью.

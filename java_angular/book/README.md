# Java & Angular: Полное руководство для Senior-интервью

> **Цель:** Структурированная книга для подготовки к позиции Senior Full-Stack Developer (Java + Angular).
> **Фокус:** Французский рынок (ESN, банки, госсектор), реальный опыт миграции legacy → modern.
> **Язык:** Русский

---

## Содержание

### Часть I — Фундамент (Core)

| Глава | Тема | Файл |
|-------|------|------|
| 1 | **Java Core** — типы, OOP, Collections, Streams, исключения, многопоточка, Virtual Threads | [part-01-fundamentals/01-java-core/](part-01-fundamentals/01-java-core/) |
| 1.1 | Типы, компиляция, JVM | |
| 1.2 | OOP: overloading/overriding, abstract/interface, access modifiers | |
| 1.3 | Collections & Streams API | |
| 1.4 | Exceptions, Generics, Records | |
| 1.5 | Multithreading & Virtual Threads | |
| 1.6 | N+1 проблема, JOIN FETCH, LATERAL JOIN | |
| 2 | **Spring Boot** — IoC/DI, REST, JPA, Security, AOP, Testing | [part-01-fundamentals/02-spring-boot/](part-01-fundamentals/02-spring-boot/) |
| 2.1 | IoC/DI, Bean Lifecycle, Component Scanning | |
| 2.2 | REST Controllers, Validation, Error Handling | |
| 2.3 | JPA & Hibernate: Entities, Fetch Strategies | |
| 2.4 | Spring Security & JWT | |
| 2.5 | AOP, Transactions | |
| 2.6 | Testing: JUnit 5, Mockito, Testcontainers | |
| 3 | **Angular** — компоненты, DI, формы, Signals, RxJS | [part-01-fundamentals/03-angular/](part-01-fundamentals/03-angular/) |
| 3.1 | Components, Templates, Control Flow | |
| 3.2 | DI, Services, HttpClient | |
| 3.3 | Reactive Forms & Validators | |
| 3.4 | Signals vs RxJS | |
| 3.5 | Interceptors, Guards, JWT | |
| 3.6 | RxJS операторы | |

### Часть II — История миграции (Your Story)

| Глава | Тема | Файл |
|-------|------|------|
| 4 | **Легаси-монолит** — архитектура "до", технический долг | [part-02-migration/04-legacy-monolith/](part-02-migration/04-legacy-monolith/) |
| 5 | **Agile для миграции** — Scrum, PI Planning, Risk Management | [part-02-migration/05-agile/](part-02-migration/05-agile/) |
| 6 | **Стратегия миграции** — Strangler Fig, Feature Toggles, CI/CD | [part-02-migration/06-strategy/](part-02-migration/06-strategy/) |
| 7 | **Java 8 → Java 21** — LTS evolution, Records, Virtual Threads, Jakarta EE | [part-02-migration/07-java-migration/](part-02-migration/07-java-migration/) |
| 8 | **Angular 8 → Angular 20** — Standalone, Signals, Control Flow | [part-02-migration/08-angular-migration/](part-02-migration/08-angular-migration/) |
| 9 | **Монолит → Микросервисы** — DDD, Kafka, Observability, Resilience4j | [part-02-migration/09-microservices/](part-02-migration/09-microservices/) |
| 10 | **Cloud для миграции** — Docker, K8s, AWS/Azure, CI/CD, DR | [part-02-migration/10-cloud/](part-02-migration/10-cloud/) |
| 11 | **Самопрезентация** — Pitch, ответы на вопросы про миграцию | [part-02-migration/11-pitch/](part-02-migration/11-pitch/) |

### Часть III — Senior-интервью (Франция)

| Глава | Тема | Файл |
|-------|------|------|
| 12 | **Модель самопрезентации** для ESN и прямых клиентов | [part-03-interview/12-self-presentation/](part-03-interview/12-self-presentation/) |
| 13 | **Топ-80 вопросов** с глубокими ответами | [part-03-interview/13-top-questions/](part-03-interview/13-top-questions/) |
| 14 | **Bridge-гайд**: из Node.js/Python/React в Java/Angular | [part-03-interview/14-bridge-guide/](part-03-interview/14-bridge-guide/) |
| 15 | **CodinGame / CoderPad** — стратегии для ESN-тестов | [part-03-interview/15-codingame/](part-03-interview/15-codingame/) |

### Часть IV — Практика

| Глава | Тема | Файл |
|-------|------|------|
| 16 | **Mini-Project: Task Tracker** — полный цикл | [part-04-practice/16-task-tracker/](part-04-practice/16-task-tracker/) |
| 17 | **Лабораторная: миграция монолита в микросервисы** | [part-04-practice/17-lab-migration/](part-04-practice/17-lab-migration/) |
| 18 | **Финальный чек-лист Senior-разработчика** + план 1/3/6 месяцев | [part-04-practice/18-checklist/](part-04-practice/18-checklist/) |

---

## Источники (извлечено из черновиков)

| Исходный файл | Строк | Использован в главах |
|---------------|-------|---------------------|
| `chapter-1.md` | 125 | 1 (Java Core) |
| `chapter-2.md` | 1263 | 1, 2, 3 (дубликат ch3) |
| `chapter-3.md` | 1560 | 1, 2, 3 (дубликат ch2) |
| `chapter-4.md` | 2086 | 2.4, 3.5, 1.6 |
| `chapter-5.md` | 808 | 4, 7, 8, 11 |
| `cir.md` | 166 | 1, 2, 3, 14 |
| `learning_table.md` | 66 | 1, 2, 3 (справочник) |
| `task.md` | 96 | 16 |

---

## Как читать

1. **Если мало времени (1 месяц):** Часть III (вопросы) + Глава 11 (pitch) → параллельно Часть I (пробелы)
2. **Средний темп (3 месяца):** Часть I целиком → Часть II (ваша история) → Часть III → Часть IV
3. **Максимум (6 месяцев):** Полный курс, все главы, лабораторные работы

---

*Статус: in progress — рефакторинг из черновиков в структурированную книгу*

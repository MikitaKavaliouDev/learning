# Глава 14: Мост — из Node.js/Python/React в Java/Angular

Эта глава — для тех, кто приходит в мир Java/Angular из других экосистем. Если ваш прошлый стек — Node.js, Python или React, многие концепции Java и Angular покажутся вам знакомыми, но перевёрнутыми с ног на голову.

Мы построим «мосты» между двумя мирами: проведём параллели между концепциями, которые вы уже знаете, и их аналогами в Java/Angular.

---

## 1. Сравнительная таблица концепций (шпаргалка)

| Вы знаете (JS/TS/React/Python) | Аналог в Java/Angular | Ключевое отличие |
|-------------------------------|----------------------|-------------------|
| Node.js Event Loop | Virtual Threads (Project Loom) | Event Loop — однопоточная асинхронность; Virtual Threads — многопоточная синхронность с лёгкими потоками |
| Express.js / Fastify | Spring Boot | Express — микрофреймворк; Spring Boot — полноценная платформа с IoC-контейнером |
| NestJS | Spring Boot (+@Module = IoC) | NestJS скопировал модульную архитектуру у Angular, что близко к Spring |
| FastAPI / Flask | Spring Boot / JAX-RS | Python — динамическая типизация, Java — строгая статика |
| Prisma / TypeORM | JPA / Hibernate | ORM на обеих сторонах, но Hibernate требует обязательного управления транзакциями |
| SQLAlchemy | JPA / Hibernate | Аналогично — ORM с Unit of Work паттерном |
| React / Vue | Angular | React — библиотека (библиотека); Angular — фреймворк (каркас) |
| JSX + ES-модули | HTML + `@Component` + `imports` | В React зависимости прозрачны через JSX; в Angular нужен массив `imports` для связи HTML и TS |
| `useState()`, `useMemo()` | `signal()`, `computed()` | Signals — мелкозернистая реактивность без Virtual DOM |
| `useEffect()` | `effect()` / `takeUntilDestroyed()` | В Angular эффекты — для синхронизации с внешним миром |
| Redux / Zustand | Сервис + `signal()` | NgRx не обязателен; часто хватает простого сервиса с сигналами |
| WebSocket / Server-Sent Events | SSE / WebSocket + Spring WebFlux | SSE — легче WebSocket для однонаправленных потоков |
| RabbitMQ / BullMQ | Spring AMQP / RabbitMQ | Аналогично, но Java использует `@RabbitListener` |
| Kafka.js | Spring Kafka + `@KafkaListener` | В Java — декларативные слушатели с авто-commit |
| Docker Compose | Docker Compose + Kubernetes | На Java-проектах часто добавляют K8s для оркестрации |
| pytest / jest | JUnit 5 + Mockito | JUnit — старейший тестовый фреймворк; Mockito — моки |
| ESLint + Prettier | SonarQube + Checkstyle | SonarQube — платформа, не просто линтер |
| `npm` / `yarn` | Maven / Gradle | Maven — как npm (декларативный XML), Gradle — мощнее, но сложнее |

---

## 2. Event Loop → Virtual Threads (главный мост)

### Как работает Event Loop в Node.js

Node.js — это **один поток** (single-threaded Event Loop), который эффективно переключается между задачами:

```
1. Прочитай файл     ──► Запрос в систему (I/O)
2. Пока ждёшь,       ──► Обслуживай следующий запрос (callback queue)
3. Файл загружен     ──► Выполни callback
```

**Аналогия из жизни:** Один сверхэффективный официант (Event Loop). Он быстро принимает заказы и отдаёт их на кухню. Если кухня занята, он не ждёт, а идёт к следующему столику.

**Плюс:** Минимальное потребление памяти (один поток).
**Минус:** CPU-интенсивные задачи блокируют весь сервер.

### Как работают Threads в традиционной Java

Классическая Java (до Virtual Threads) — **один поток на один запрос** (Thread-per-request):

```
Запрос 1 ──► Поток ОС 1 ──► Ждёт БД (блокировка)
Запрос 2 ──► Поток ОС 2 ──► Ждёт БД (блокировка)
Запрос 3 ──► Поток ОС 3 ──► Ждёт БД (блокировка)
```

**Аналогия из жизни:** Ресторан, где у каждого столика свой личный официант. Если столик думает над меню, официант стоит рядом и ждёт.

**Плюс:** Простая модель программирования (синхронный код).
**Минус:** Потоки ОС — тяжелый ресурс (~1 МБ на поток), нельзя создать 100 000 потоков.

### Как Virtual Threads (Project Loom) меняют всё

**Java 21+** — это гибридная модель: удобство синхронного кода + эффективность Event Loop:

```
Запрос 1 ──► VT 1 ──► Ждёт БД ──► VT паркуется ──► Физический поток свободен
Запрос 2 ──► VT 2 ──► Ждёт БД ──► VT паркуется 
Запрос 3 ──► VT 3 ──► (выполняется на освободившемся потоке ОС)
```

**Аналогия из жизни:** Ресторан нанимает актёров, которые мгновенно меняют маски. Если один гость читает меню, «актёр» мгновенно переключается на обслуживание соседа.

### Ключевое отличие для ответа на собеседовании

> *«В Node.js асинхронность встроена в язык — вы пишете `async/await` и коллбеки. В Java Virtual Threads позволяют писать **синхронный блокирующий код**, который под капотом ведёт себя как неблокирующий. JVM сама паркует виртуальный поток при I/O и переключает его на другой физический поток. Это даёт производительность Event Loop без необходимости писать асинхронный код.»*

---

## 3. Express/FastAPI → Spring Boot: от маршрутизации к IoC

### Express.js (знакомый мир)

```javascript
const express = require('express');
const app = express();

app.get('/users/:id', (req, res) => {
  res.json({ id: req.params.id, name: 'John' });
});

app.listen(3000);
```

**Философия:** Минимализм. Вы сами собираете приложение из middleware-функций. Каждый middleware — это функция `(req, res, next)`.

### Spring Boot (новый мир)

```java
@RestController
@RequestMapping("/users")
public class UserController {
    
    @GetMapping("/{id}")
    public User getUser(@PathVariable Long id) {
        return userService.findById(id);
    }
}
```

**Философия:** Декларативность + IoC. Вы объявляете, что это контроллер (`@RestController`), а Spring сам создаёт экземпляр, связывает зависимости и принимает запросы.

### Что происходит под капотом в Spring Boot:

1. **Component Scan:** Spring сканирует все классы в проекте
2. **Bean Creation:** Создаёт экземпляры классов с аннотациями `@Service`, `@Repository`, `@Component`
3. **Dependency Injection:** Автоматически внедряет зависимости через конструктор или поле
4. **Dispatcher Servlet:** Принимает HTTP-запрос и направляет в нужный контроллер

### Параллели с NestJS (если вы знакомы)

NestJS во многом скопировал архитектуру Angular/Spring:

```typescript
// NestJS — декораторы как в Angular
@Controller('users')
export class UserController {
  constructor(private userService: UserService) {}
  
  @Get(':id')
  getUser(@Param('id') id: string) { ... }
}
```

**Если вы знаете NestJS, вы уже знаете Spring Boot на 60%.** Та же модульная архитектура, те же декораторы, то же внедрение зависимостей.

---

## 4. Prisma / TypeORM / SQLAlchemy → JPA / Hibernate

### Сходство: все они — ORM

И Prisma, и JPA решают одну задачу: отображение реляционных таблиц на объекты в коде.

```prisma
// Prisma — декларативная схема
model User {
  id    Int     @id @default(autoincrement())
  email String  @unique
  posts Post[]
}
```

```java
// JPA — аннотации
@Entity
@Table(name = "users")
public class User {
    @Id
    @GeneratedValue
    private Long id;
    
    @Column(unique = true)
    private String email;
    
    @OneToMany(mappedBy = "user")
    private List<Post> posts;
}
```

### Различие №1: Генерация схемы vs код-ферст

| Prisma | JPA/Hibernate |
|--------|---------------|
| Схема в `schema.prisma` — единственный источник истины | Код Java — единственный источник истины |
| `prisma migrate` генерирует SQL миграции | `spring.jpa.hibernate.ddl-auto` генерирует схему |
| Миграции — отдельные SQL-файлы | Используется Flyway/Liquibase для миграций |

### Различие №2: N+1 проблема (идентична!)

В Prisma:
```typescript
const users = await prisma.user.findMany();
for (const user of users) {
  console.log(user.posts); // N+1! Каждый user.posts — отдельный запрос
}
```

В JPA:
```java
List<User> users = userRepository.findAll();
for (User user : users) {
    System.out.println(user.getPosts()); // N+1!
}
```

Решение в JPA — `JOIN FETCH`:
```java
@Query("SELECT u FROM User u LEFT JOIN FETCH u.posts")
List<User> findAllWithPosts();
```

### Различие №3: Транзакции

В Prisma транзакции — через `prisma.$transaction(...)`.
В JPA транзакции — через аннотацию:

```java
@Transactional
public void transferMoney(Long fromId, Long toId, BigDecimal amount) {
    Account from = accountRepo.findById(fromId).orElseThrow();
    Account to = accountRepo.findById(toId).orElseThrow();
    from.withdraw(amount);
    to.deposit(amount);
}
```

**Gotcha:** `@Transactional` не сработает при вызове метода внутри того же класса (self-invocation) — см. главу 1.

---

## 5. React → Angular: философские различия

### React — библиотека (Lego)

```jsx
import { Button } from './Button';

function Card() {
  return <Button />;
}
```

**Философия:** React — это просто функция, которая возвращает UI. Всё остальное (роутинг, стейт-менеджмент, HTTP-запросы) — выбор разработчика.

- JSX — это JavaScript (компилируется в `React.createElement`)
- Компоненты — просто функции
- Состояние — через хуки (`useState`, `useReducer`)
- Асинхронность — через промисы и `useEffect`

### Angular — фреймворк (готовый дом)

```typescript
import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-card',
  standalone: true,
  template: `<app-button />`
})
export class CardComponent {}
```

**Философия:** Angular — это целостная платформа со своим мнением о том, как должна быть устроена архитектура.

- Шаблоны — это HTML-строки (не JSX)
- Компоненты — классы с декораторами
- Состояние — через сигналы или RxJS
- Асинхронность — через RxJS (Observables)

### Ключевое отличие: зависимости в шаблонах

Почему в React хватает одного импорта, а в Angular — двух?

**В React:**
```jsx
import { Button } from './Button';
// <Button /> компилируется в React.createElement(Button)
// JS-код напрямую использует переменную Button — сборщик видит зависимость
```

**В Angular:**
```typescript
import { ButtonComponent } from './button.component';
// <app-button></app-button> — это текстовая строка!
// Сборщик НЕ ВИДИТ, что ButtonComponent используется в шаблоне
// Поэтому нужен imports: [ButtonComponent] — мост между TS и HTML
```

### Привычные React-концепции → Angular

| React | Angular |
|-------|---------|
| `useState(initial)` | `signal(initial)` |
| `useMemo(() => value, [deps])` | `computed(() => value)` |
| `useEffect(() => {...}, [])` | `effect(() => {...})` |
| `useEffect(() => { return cleanup }, [])` | `takeUntilDestroyed()` в конструкторе |
| `props: { name: string }` | `name = input<string>()` |
| `onChange: (v) => void` | `nameChange = output<string>()` |
| `useRef()` | `viewChild() / signal + model()` |
| `Context API` | `@Injectable()` сервис с сигналами |
| `React Router` | `RouterModule` с `provideRouter()` |
| `Formik / React Hook Form` | `ReactiveFormsModule` + `FormBuilder` |
| `styled-components / Tailwind` | Angular Material / Tailwind (не встроен) |
| `React.lazy()` | `loadComponent: () => import(...)` |

### Change Detection: Virtual DOM vs Signals

**React:** При изменении состояния перезапускается вся функция компонента, создаётся новый Virtual DOM, diff со старым → обновление реального DOM.

```typescript
// React — при setState перезапускается функция
function Counter() {
  const [count, setCount] = useState(0);
  return <div>{count}</div>;
}
```

**Angular с Signals:** При изменении сигнала обновляется строго тот узел DOM, который зависит от сигнала. Без Virtual DOM, без перезапуска компонента.

```typescript
// Angular — при count.set() обновляется только узел <span>
@Component({
  template: `<span>{{ count() }}</span>`
})
export class Counter {
  count = signal(0);
}
```

**Аналогия:** React — как перепечатка всей страницы документа при изменении одной буквы. Angular Signals — как исправление одной буквы в уже напечатанном документе.

---

## 6. RxJS для React-разработчика

Если вы знаете Promises из JavaScript, вот как они соотносятся с RxJS:

| JavaScript | RxJS |
|-----------|------|
| `Promise` (0-1 значение) | `Observable` (0-∞ значений во времени) |
| `Promise.resolve(value)` | `of(value)` |
| `Promise.reject(error)` | `throwError(() => error)` |
| `.then(value => {...})` | `.pipe(map(value => ...))` |
| `.catch(error => {...})` | `.pipe(catchError(error => ...))` |
| `Promise.all([p1, p2])` | `forkJoin([o1, o2])` — ждёт все |
| `Promise.race([p1, p2])` | `race([o1, o2])` — первый завершившийся |
| `async/await` | `.subscribe()` / `toSignal()` |
| `AbortController` | `takeUntil() / switchMap` (авто-отмена) |

### Аналогия из жизни (Promise vs Observable)

**Promise — это коробка с пиццей:** Вы заказали пиццу (отправили запрос). Курьер принёс коробку (Promise resolved). Вы открыли коробку и достали пиццу (значение). Одна коробка — одна пицца. Пицца не может «обновляться» или «приходить кусками».

**Observable — это YouTube канал:** Вы подписались на канал (.subscribe()). Канал выпускает видео во времени (эмитит значения). Вы можете отписаться в любой момент (unsubscribe). Видео продолжают выходить, пока автор не закроет канал (complete).

### Самый частый вопрос про RxJS на собеседовании

> *«Как избежать утечки памяти при подписке на Observable в Angular?»*

**Ответ Senior:**
- Для конечных потоков (HTTP-запросы) — отписка не нужна (они сами complete)
- Для бесконечных потоков (WebSocket, события) — используйте `takeUntilDestroyed()` или пайп `async` в шаблоне
- Никогда НЕ используйте `.subscribe()` в компоненте без механизма отписки

---

## 7. SQLAlchemy / Prisma → JPA: глубокое погружение

### Entity — это не просто DTO

```python
# SQLAlchemy — модель данных
class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True)
```

```java
// JPA — Entity
@Entity
@Table(name = "users")
public class User {
    @Id
    @GeneratedValue
    private Long id;
    
    @Column(unique = true)
    private String email;
}
```

### Ключевое отличие: Lazy Loading

В SQLAlchemy по умолчанию — lazy loading для отношений. В Hibernate — тоже.

Но есть **Gotcha:** в Hibernate, если вы обращаетесь к lazy-полю вне транзакции (после `@Transactional`), вы получите `LazyInitializationException`.

**Решение:** Или `JOIN FETCH`, или `@EntityGraph`, или держите транзакцию открытой.

### Criteria API — аналог Query Builders

В TypeScript/React вы используете:

```typescript
const query = prisma.user.findMany({
  where: { email: { contains: 'gmail' } },
  orderBy: { name: 'asc' },
  take: 10
});
```

В Java — Criteria API (если нужно строить запрос динамически):

```java
CriteriaBuilder cb = entityManager.getCriteriaBuilder();
CriteriaQuery<User> query = cb.createQuery(User.class);
Root<User> root = query.from(User.class);
query.where(cb.like(root.get("email"), "%gmail%"));
query.orderBy(cb.asc(root.get("name")));
List<User> users = entityManager.createQuery(query)
    .setMaxResults(10)
    .getResultList();
```

---

## 8. Python → Java: типизация и парадигмы

### Динамическая vs статическая типизация

```python
# Python — динамическая
def process(data):
    # data может быть чем угодно
    return data['key'] * 2  # AttributeError в рантайме
```

```java
// Java — статическая
public String process(Map<String, Object> data) {
    // Компилятор проверяет типы на этапе сборки
    Object value = data.get("key");
    return value.toString(); // ClassCastException только в рантайме
}
```

### Номинальная vs Структурная типизация

**Python (Duck Typing):** «Если это ходит как утка и крякает как утка — это утка». Если объект имеет методы `.quack()` и `.walk()`, он считается уткой, даже если класс называется `Dog`.

**Java (Nominal Typing):** «Если в паспорте написано „Утка“ — это утка». Класс должен явно указать `implements Duck`, даже если у него есть все нужные методы.

**Аналогия:** Паспортный контроль (Java) нужен документ именно государственного образца, против фейсконтроля в клубе (Python/TS): главное — быть в белых кроссовках.

### `try-with-resources` — аналог `with` в Python

```python
# Python
with open("file.txt") as f:
    content = f.read()
# Файл автоматически закрыт
```

```java
// Java (Java 7+)
try (BufferedReader br = new BufferedReader(new FileReader("file.txt"))) {
    String line = br.readLine();
} // Ресурс автоматически закрыт
```

### Records — аналог `@dataclass(frozen=True)`

```python
@dataclass(frozen=True)
class UserDTO:
    id: int
    email: str
```

```java
public record UserDTO(Long id, String email) {}
```

---

## 9. Docker Compose → K8s: разница в масштабе

На Python/Node.js проектах вы привыкли к Docker Compose:

```yaml
# docker-compose.yml
services:
  app:
    build: .
    ports:
      - "3000:3000"
  db:
    image: postgres:15
```

На Java enterprise-проектах (особенно во Франции) добавляется Kubernetes:

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: app
  template:
    spec:
      containers:
      - name: app
        image: registry/app:1.0
        ports:
        - containerPort: 8080
```

**Ключевое отличие для собеседования:**

| Docker Compose | Kubernetes |
|---------------|------------|
| Один хост | Кластер из многих хостов |
| Нет auto-scaling | Auto-scaling (HPA) |
| Нет self-healing | Self-healing (restart pods) |
| Нет Ingress | Ingress Controller (маршрутизация) |
| Идеально для dev/test | Стандарт для production |

---

## 10. План действий для перехода

### Неделя 1-2: Java Core
- Установите IntelliJ IDEA + JDK 21
- Пройдите Java Syntax на JetBrains Academy или Hyperskill
- Сфокусируйтесь на: типы, ООП, Collections, Streams, Optional

### Неделя 3-4: Spring Boot
- Создайте простой REST API (мини-проект из task.md)
- Настройте JPA с PostgreSQL через Spring Data JPA
- Добавьте `@Transactional` и поймите self-invocation

### Неделя 5-6: Angular
- `ng new my-app --standalone` — создайте standalone-приложение
- Разберитесь с Signals (`signal`, `computed`, `effect`)
- Настройте HTTP Interceptor для JWT

### Неделя 7-8: Связка и CodinGame
- Соедините Spring Boot + Angular в единое приложение
- Решите 10 задач на CodinGame (уровень Medium)
- Напишите свою самопрезентацию (Глава 12)

---

## Резюме главы

- **Event Loop → Virtual Threads:** синхронный код с производительностью async
- **Express → Spring Boot:** от middleware-функций к декларативным контроллерам с IoC
- **Prisma → JPA:** те же ORM-концепции, но с транзакциями через аннотации
- **React → Angular:** от библиотеки с JSX к фреймворку с HTML-шаблонами и Signals
- **Python → Java:** от утиной типизации к номинальной, от `with` к `try-with-resources`
- **Docker Compose → K8s:** от локальной разработки к промышленной оркестрации

Главный совет: не пытайтесь выучить всё сразу. Стройте мосты от того, что вы уже знаете, к новым концепциям. Вы удивитесь, как много общего между, казалось бы, разными мирами.

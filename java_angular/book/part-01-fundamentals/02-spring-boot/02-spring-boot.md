# Глава 2: Spring Boot — Мощь корпоративной разработки

---

## 2.1 IoC/DI и Bean Lifecycle

### Жизненная аналогия

Вместо того чтобы собирать холодильник, плиту и раковину вручную, соединяя их трубами (как в Node.js с Express), вы заказываете **готовую модульную кухню**. Вы вешаете ярлыки: «Мне нужен холодильник сюда» (`@Autowired` или внедрение через конструктор), и система сборки кухни (Spring IoC Container) сама привозит и подключает нужный прибор.

### Техническая глубина

**Inversion of Control (IoC)** — принцип, при котором фреймворк управляет жизненным циклом объектов, а не разработчик. **Dependency Injection (DI)** — способ реализации IoC, при котором зависимости «внедряются» в объект извне.

**ApplicationContext** — ядро Spring, управляющее жизненным циклом бинов (Beans):

```java
@Component
public class UserService {
    // Внедрение через конструктор (рекомендуемый способ)
    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }
}
```

### Жизненный цикл бина

```
Создание экземпляра → Заполнение полей → 
  → PostConstruct / afterPropertiesSet() → 
  → Бин готов к использованию →
  → PreDestroy / destroy()
```

### Scopes (Области видимости)

| Scope | Описание |
|:---|:---|
| `singleton` (по умолчанию) | Один экземпляр на всё приложение |
| `prototype` | Новый экземпляр при каждом внедрении/запросе |
| `request` | Один экземпляр на HTTP-запрос (для веб-приложений) |
| `session` | Один экземпляр на HTTP-сессию |

> **Gotcha:** Если внедрить `prototype`-бин в `singleton`, prototype создастся всего **один раз** при инициализации синглтона. Для корректной работы используйте `@Lookup` или `ObjectProvider<T>`.

---

## 2.2 Аннотации слоёв (@RestController, @Service, @Repository)

### Жизненная аналогия

Разные отделы в компании: бухгалтерия (Service), склад (Repository), менеджеры по работе с клиентами (Controller). У каждого своя зона ответственности, все работают согласованно.

### Техническая глубина

Все аннотации — специализированные версии `@Component`. Они служат маркерами для Spring Component Scanning:

| Аннотация | Слой | Роль | Дополнительный функционал |
|:---|:---|:---|:---|
| `@RestController` | Presentation | Принимает HTTP-запросы, возвращает JSON | Автоматическая сериализация в JSON (Jackson) |
| `@Service` | Business Logic | Содержит бизнес-логику | — |
| `@Repository` | Data Access | Работа с базой данных | Транслирует исключения БД в `DataAccessException` |

```java
@RestController
@RequestMapping("/api/users")
public class UserController { /* принимает запросы */ }

@Service
public class UserService { /* бизнес-логика */ }

@Repository
public interface UserRepository extends JpaRepository<User, Long> { /* данные */ }
```

> **Gotcha:** Spring Data JPA генерирует реализацию `JpaRepository` в рантайме через Dynamic Proxy. Вы пишете только интерфейс, Spring создаёт бин самостоятельно.

---

## 2.3 REST Controllers, Validation, Error Handling

### Жизненная аналогия

**Контроллер** — сортировщик на почте. Он читает адрес на конверте (URL, HTTP-метод) и передаёт письмо нужному сотруднику (сервису). **Глобальный обработчик ошибок** — подушка безопасности, которая перехватывает любые аварии и выплачивает компенсацию по стандарту.

### Техническая глубина

**Базовый контроллер:**

```java
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/{id}")
    public UserDto getUser(@PathVariable Long id) {
        return userService.findById(id);
    }

    @PostMapping
    public UserDto createUser(@Valid @RequestBody CreateUserRequest request) {
        return userService.create(request);
    }
}
```

**Валидация через `@Valid`:**

```java
public record CreateUserRequest(
    @NotBlank String name,
    @Email String email,
    @Min(18) int age
) {}
```

**Глобальный обработчик ошибок (`@ControllerAdvice`):**

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ErrorResponse handleNotFound(ResourceNotFoundException ex) {
        return new ErrorResponse("NOT_FOUND", ex.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ErrorResponse handleValidation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
            .map(e -> e.getField() + ": " + e.getDefaultMessage())
            .collect(Collectors.joining(", "));
        return new ErrorResponse("VALIDATION_ERROR", message);
    }
}

public record ErrorResponse(String errorCode, String message) {}
```

> **Gotcha:** `@RestController` автоматически сериализует возвращаемые объекты в JSON. Аннотация `@Valid` запускает валидацию полей DTO **до** выполнения метода контроллера.

---

## 2.4 JPA & Hibernate: Entities, Relationships, Fetch Strategies

### Жизненная аналогия

**Связь `@ManyToOne` / `@OneToMany`:** Обручальные кольца. Жених физически носит кольцо (Foreign Key — владеющая сторона). Невеста говорит «Я замужем» (`mappedBy`) — это обратная сторона.

### Техническая глубина

#### Базовые аннотации

```java
@Entity
@Table(name = "users")
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    private String email;
}
```

#### Связи и `mappedBy`

```java
@Entity
public class User {
    @Id @GeneratedValue
    private Long id;

    // Владеющая сторона — Post (там будет колонка user_id)
    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL)
    private List<Post> posts = new ArrayList<>();
}

@Entity
public class Post {
    @Id @GeneratedValue
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id") // Вот где физически хранится FK
    private User user;
}
```

> **Gotcha:** `mappedBy` указывает на **имя поля в Java-классе**, а не на имя колонки в БД. `mappedBy = "user"`, а не `mappedBy = "user_id"`. Если ошибиться — Hibernate упадёт при старте с `MappingException`. Если забыть `mappedBy` — Hibernate создаст лишнюю связующую таблицу!

### Fetch Strategies: LAZY vs EAGER

| Стратегия | Что происходит | Когда использовать |
|:---|:---|:---|
| `FetchType.LAZY` (по умолчанию для коллекций) | Данные загружаются только при обращении к геттеру | Почти всегда (экономит память и запросы) |
| `FetchType.EAGER` (по умолчанию для `@ManyToOne`) | Данные загружаются сразу вместе с родителем | Только когда связанные данные нужны всегда |

### Проблема N+1

```java
// Проблема: 1 запрос на пользователей + N запросов на посты каждого
List<User> users = userRepository.findAll();
for (User user : users) {
    System.out.println(user.getPosts().size());
}
```

**Решение — `JOIN FETCH`:**

```java
@Query("SELECT u FROM User u LEFT JOIN FETCH u.posts")
List<User> findAllWithPosts();
```

> **Gotcha:** LAZY-загрузка требует открытой сессии Hibernate. Если выйти из транзакции и попытаться получить `user.getPosts()`, получите `LazyInitializationException`.

---

## 2.5 Spring Security & JWT (Filter Chain)

### Жизненная аналогия (Многоуровневый досмотр в аэропорту)

Контроллер — это самолёт на взлётной полосе. Запрос пользователя проходит через **цепочку фильтров (Filter Chain)**:

1. **CORS Filter** — проверяет, из правильной ли страны (домена) прилетел пассажир.
2. **Custom JWT Filter** — проверяет паспорт (токен `Authorization: Bearer <JWT>`). Валидирует сигнатуру, расшифровывает имя и роли.
3. **Запись в журнал** — ставит штамп и сажает в транзитную зону (`SecurityContextHolder`).
4. **Authorization Filter** — сверяет роли перед посадкой: «В бизнес-класс пускаем только с ролью `ROLE_ADMIN`».

### Техническая реализация JWT-фильтра

```java
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(
        @NonNull HttpServletRequest request,
        @NonNull HttpServletResponse response,
        @NonNull FilterChain filterChain
    ) throws ServletException, IOException {

        final String authHeader = request.getHeader("Authorization");

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        final String jwt = authHeader.substring(7);
        final String userEmail = jwtService.extractUsername(jwt);

        if (userEmail != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            UserDetails userDetails = this.userDetailsService.loadUserByUsername(userEmail);

            if (jwtService.isTokenValid(jwt, userDetails)) {
                UsernamePasswordAuthenticationToken authToken =
                    new UsernamePasswordAuthenticationToken(
                        userDetails, null, userDetails.getAuthorities()
                    );
                authToken.setDetails(
                    new WebAuthenticationDetailsSource().buildDetails(request)
                );

                SecurityContextHolder.getContext().setAuthentication(authToken);
            }
        }

        filterChain.doFilter(request, response);
    }
}
```

### Настройка Security Config

```java
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthFilter;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http
            .csrf(AbstractHttpConfigurer::disable)
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**").permitAll()
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated()
            )
            .sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
            )
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
            .build();
    }
}
```

> **Подводный камень (SecurityContextHolder & ThreadLocal):** По умолчанию `SecurityContextHolder` хранит данные в `ThreadLocal`. Если внутри метода контроллера запустить асинхронную задачу в другом потоке (через `@Async` или виртуальные потоки), новый поток потеряет авторизацию. Решение: настроить `SecurityContextHolder.MODE_INHERITABLETHREADLOCAL` или пробрасывать контекст вручную.

---

## 2.6 AOP и Транзакции

### Жизненная аналогия

**АОП (Аспектно-ориентированное программирование):** Рамка металлоискателя на входе в здание. Каждый посетитель проходит через неё автоматически — внутри здания уже не нужно проверять каждого вручную.

**@Transactional:** Покупка квартиры. Вы нанимаете лицензированного агента (Proxy), который:
1. Открывает безопасный счёт (транзакцию в БД)
2. Проводит все операции
3. Если всё успешно — подписывает бумаги (commit)
4. Если ошибка — отзывает платежи (rollback)

### Техническая глубина

#### Как работает `@Transactional` под капотом

Spring создаёт **Proxy-обёртку** (через JDK Dynamic Proxy или CGLIB) вокруг бина. Когда внешний класс вызывает метод, вызов идёт на Proxy:

```java
@Service
public class PaymentService {

    @Transactional
    public void processPayment(Long orderId) {
        // Proxy открывает транзакцию, вызывает этот метод,
        // затем делает commit или rollback
    }
}
```

#### Проблема Self-Invocation

```java
@Service
public class UserService {
    public void methodA() {
        methodB(); // Вызов через this — Прокси не задействован!
    }

    @Transactional
    public void methodB() {
        // Транзакция НЕ откроется!
    }
}
```

**Причина:** Вызов `methodB()` происходит напрямую через `this`, минуя прокси-обёртку. Spring просто не знает, что метод нужно обернуть в транзакцию.

**Решения:**
1. Вынести `methodB()` в отдельный сервис (рекомендуется — чистая архитектура)
2. Self-injection: `@Autowired @Lazy private UserService self;` и вызывать `self.methodB()`

#### AOP для сквозного логирования

```java
@Aspect
@Component
public class LoggingAspect {

    @Around("execution(* com.example.service.*.*(..))")
    public Object logExecutionTime(ProceedingJoinPoint joinPoint) throws Throwable {
        long start = System.currentTimeMillis();
        Object result = joinPoint.proceed();
        long elapsed = System.currentTimeMillis() - start;
        log.info("{} выполнен за {} мс", joinPoint.getSignature(), elapsed);
        return result;
    }
}
```

> **Gotcha:** AOP-прокси работают только для публичных методов и только при вызове «снаружи» — через внедрённую ссылку, а не через `this`.

---

## 2.7 Тестирование (JUnit 5, Mockito, Testcontainers)

### Жизненная аналогия

**Юнит-тесты:** Вы проверяете каждый винтик в механизме отдельно, прежде чем собрать весь двигатель. **Интеграционные тесты:** Вы собираете двигатель и проверяете, как он работает в паре с настоящей трансмиссией.

### Техническая глубина

#### JUnit 5 + Mockito (Юнит-тесты)

```java
@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private UserService userService;

    @Test
    void shouldFindUserByEmail() {
        // Given
        User mockUser = new User(1L, "test@mail.com", "Test");
        when(userRepository.findByEmail("test@mail.com")).thenReturn(Optional.of(mockUser));

        // When
        UserDto result = userService.findByEmail("test@mail.com");

        // Then
        assertThat(result.email()).isEqualTo("test@mail.com");
        verify(userRepository).findByEmail("test@mail.com");
    }
}
```

#### Мокирование статических методов (Mockito 3.4+)

```java
@Test
void testLegacyStaticMethod() {
    try (MockedStatic<LegacyUtility> utilities = mockStatic(LegacyUtility.class)) {
        utilities.when(LegacyUtility::getGlobalStatus).thenReturn("ACTIVE");

        String result = myService.checkStatus();
        assertEquals("OK", result);
    }
}
```

#### Testcontainers (Интеграционные тесты)

Вместо H2 в памяти (которая ведёт себя иначе, чем PostgreSQL) используем **Testcontainers** — настоящую БД в Docker-контейнере:

```java
@Testcontainers
@SpringBootTest
class UserRepositoryIntegrationTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16")
        .withDatabaseName("testdb")
        .withUsername("test")
        .withPassword("test");

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired
    private UserRepository userRepository;

    @Test
    void shouldSaveAndFindUser() {
        User user = new User("test@mail.com", "Test");
        userRepository.save(user);

        Optional<User> found = userRepository.findByEmail("test@mail.com");

        assertThat(found).isPresent();
        assertThat(found.get().getEmail()).isEqualTo("test@mail.com");
    }
}
```

> **Gotcha:** Для интеграционных тестов БД всегда используйте Testcontainers, а не H2 в памяти. H2 имеет другой диалект SQL и не поддерживает многие фичи PostgreSQL (GIN-индексы, `tsvector`, специфичные функции).

---

## Резюме главы

Spring Boot — это не просто «фреймворк», а целая экосистема для корпоративной разработки:

1. **IoC/DI** — фреймворк управляет зависимостями, вы фокусируетесь на бизнес-логике
2. **Слои** — Controller (API) → Service (логика) → Repository (данные)
3. **JPA/Hibernate** — ORM с ленивой загрузкой, N+1 решается через `JOIN FETCH`
4. **Security** — JWT-фильтры в цепочке, `SecurityContextHolder` в `ThreadLocal`
5. **AOP** — сквозные аспекты (транзакции, логирование) через Proxy-обёртки
6. **Транзакции** — `@Transactional` с Self-Invocation-ловушкой
7. **Тестирование** — JUnit 5 + Mockito для юнитов, Testcontainers для интеграций

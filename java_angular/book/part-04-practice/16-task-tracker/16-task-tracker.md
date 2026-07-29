# Глава 16: Mini-Project — Task Tracker (Полный цикл)

> **Цель:** Создать полноценное Full-Stack приложение «Task Tracker» на стеке Java 21 + Spring Boot 3 + Angular 19, которое закрепляет все изученные концепты: JPA-связи, N+1, Records, Reactive Forms, Signals, RxJS live-search, JWT-безопасность.
> **Время выполнения:** 2–3 дня (по 4–6 часов)
> **Уровень:** Middle / Senior

---

## Схема проекта

```
[ Angular SPA ] ──(HTTP + JWT)──► [ Spring Boot API ] ──(JPA/Hibernate)──► [ PostgreSQL ]
  ├── Reactive Forms              ├── Controller + Validation              ├── Table: tasks
  ├── Signals (UI State)          ├── Services (Business logic)            └── Table: categories
  └── RxJS (Live Search)          └── JPA Repository (JOIN FETCH)
                                  └── JWT Filter Chain
```

---

## Шаг 1. Бэкенд (Spring Boot)

### 1.1. Инициализация проекта

Создайте проект через [Spring Initializr](https://start.spring.io/):

- **Project:** Maven
- **Language:** Java 21
- **Dependencies:**
  - Spring Web
  - Spring Data JPA
  - Spring Security
  - Validation (Jakarta Bean Validation)
  - PostgreSQL Driver (или H2 для dev)
  - Lombok
  - Spring Boot DevTools

### 1.2. Модели данных (Entities)

#### Category

```java
package com.tasktracker.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "categories")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Category {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String name;
}
```

#### Task

```java
package com.tasktracker.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "tasks")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Task {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TaskStatus status;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id", nullable = false)
    private Category category;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        if (this.status == null) {
            this.status = TaskStatus.TODO;
        }
    }
}
```

#### TaskStatus (ENUM)

```java
package com.tasktracker.model;

public enum TaskStatus {
    TODO, IN_PROGRESS, DONE
}
```

### 1.3. DTO Records с валидацией

```java
package com.tasktracker.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateTaskDTO(
    @NotBlank(message = "Название обязательно")
    @Size(min = 3, max = 255, message = "Название должно быть от 3 до 255 символов")
    String title,

    String description,

    @NotNull(message = "Категория обязательна")
    Long categoryId
) {}

public record UpdateTaskDTO(
    @Size(min = 3, max = 255)
    String title,

    String description,

    TaskStatus status,

    Long categoryId
) {}

public record TaskResponseDTO(
    Long id,
    String title,
    String description,
    String status,
    String categoryName,
    Long categoryId,
    LocalDateTime createdAt
) {}

public record CategoryDTO(
    Long id,
    String name
) {}
```

### 1.4. Repository с JOIN FETCH

```java
package com.tasktracker.repository;

import com.tasktracker.model.Task;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface TaskRepository extends JpaRepository<Task, Long> {

    @Query("SELECT t FROM Task t LEFT JOIN FETCH t.category")
    List<Task> findAllWithCategory();

    @Query("SELECT t FROM Task t LEFT JOIN FETCH t.category WHERE t.id = :id")
    java.util.Optional<Task> findByIdWithCategory(Long id);

    List<Task> findByTitleContainingIgnoreCase(String query);

    List<Task> findByCategoryId(Long categoryId);
}
```

**Разбор:** `JOIN FETCH` решает проблему N+1 (см. Главу 2.3). Вместо 1+N запросов выполняется один SQL с `LEFT JOIN`. Метод `findByTitleContainingIgnoreCase` использует механизм генерации запросов Spring Data (Parsing Query).

#### CategoryRepository

```java
package com.tasktracker.repository;

import com.tasktracker.model.Category;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CategoryRepository extends JpaRepository<Category, Long> {}
```

### 1.5. Service Layer

```java
package com.tasktracker.service;

import com.tasktracker.dto.*;
import com.tasktracker.model.*;
import com.tasktracker.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
@RequiredArgsConstructor
public class TaskService {

    private final TaskRepository taskRepository;
    private final CategoryRepository categoryRepository;

    @Transactional(readOnly = true)
    public List<TaskResponseDTO> getAllTasks() {
        return taskRepository.findAllWithCategory().stream()
            .map(this::toResponseDTO)
            .toList();
    }

    @Transactional(readOnly = true)
    public TaskResponseDTO getTaskById(Long id) {
        Task task = taskRepository.findByIdWithCategory(id)
            .orElseThrow(() -> new TaskNotFoundException(id));
        return toResponseDTO(task);
    }

    @Transactional
    public TaskResponseDTO createTask(CreateTaskDTO dto) {
        Category category = categoryRepository.findById(dto.categoryId())
            .orElseThrow(() -> new CategoryNotFoundException(dto.categoryId()));

        Task task = Task.builder()
            .title(dto.title())
            .description(dto.description())
            .status(TaskStatus.TODO)
            .category(category)
            .build();

        Task saved = taskRepository.save(task);
        return toResponseDTO(saved);
    }

    @Transactional
    public TaskResponseDTO updateTask(Long id, UpdateTaskDTO dto) {
        Task task = taskRepository.findByIdWithCategory(id)
            .orElseThrow(() -> new TaskNotFoundException(id));

        if (dto.title() != null) task.setTitle(dto.title());
        if (dto.description() != null) task.setDescription(dto.description());
        if (dto.status() != null) task.setStatus(dto.status());
        if (dto.categoryId() != null) {
            Category category = categoryRepository.findById(dto.categoryId())
                .orElseThrow(() -> new CategoryNotFoundException(dto.categoryId()));
            task.setCategory(category);
        }

        Task saved = taskRepository.save(task);
        return toResponseDTO(saved);
    }

    @Transactional
    public void deleteTask(Long id) {
        if (!taskRepository.existsById(id)) {
            throw new TaskNotFoundException(id);
        }
        taskRepository.deleteById(id);
    }

    @Transactional(readOnly = true)
    public List<TaskResponseDTO> searchTasks(String query) {
        return taskRepository.findByTitleContainingIgnoreCase(query).stream()
            .map(this::toResponseDTO)
            .toList();
    }

    private TaskResponseDTO toResponseDTO(Task task) {
        return new TaskResponseDTO(
            task.getId(),
            task.getTitle(),
            task.getDescription(),
            task.getStatus().name(),
            task.getCategory().getName(),
            task.getCategory().getId(),
            task.getCreatedAt()
        );
    }
}
```

#### Исключения

```java
package com.tasktracker.service;

public class TaskNotFoundException extends RuntimeException {
    public TaskNotFoundException(Long id) {
        super("Задача с ID " + id + " не найдена");
    }
}

public class CategoryNotFoundException extends RuntimeException {
    public CategoryNotFoundException(Long id) {
        super("Категория с ID " + id + " не найдена");
    }
}
```

### 1.6. Контроллер

```java
package com.tasktracker.controller;

import com.tasktracker.dto.*;
import com.tasktracker.service.TaskService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/tasks")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:4200")
public class TaskController {

    private final TaskService taskService;

    @GetMapping
    public ResponseEntity<List<TaskResponseDTO>> getAllTasks() {
        return ResponseEntity.ok(taskService.getAllTasks());
    }

    @GetMapping("/{id}")
    public ResponseEntity<TaskResponseDTO> getTaskById(@PathVariable Long id) {
        return ResponseEntity.ok(taskService.getTaskById(id));
    }

    @PostMapping
    public ResponseEntity<TaskResponseDTO> createTask(
            @Valid @RequestBody CreateTaskDTO dto) {
        TaskResponseDTO created = taskService.createTask(dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<TaskResponseDTO> updateTask(
            @PathVariable Long id,
            @Valid @RequestBody UpdateTaskDTO dto) {
        return ResponseEntity.ok(taskService.updateTask(id, dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTask(@PathVariable Long id) {
        taskService.deleteTask(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/search")
    public ResponseEntity<List<TaskResponseDTO>> searchTasks(
            @RequestParam String query) {
        return ResponseEntity.ok(taskService.searchTasks(query));
    }
}
```

### 1.7. Global Exception Handler

```java
package com.tasktracker.config;

import com.tasktracker.service.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(TaskNotFoundException.class)
    public ProblemDetail handleTaskNotFound(TaskNotFoundException ex) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(
            HttpStatus.NOT_FOUND, ex.getMessage());
        pd.setTitle("Задача не найдена");
        return pd;
    }

    @ExceptionHandler(CategoryNotFoundException.class)
    public ProblemDetail handleCategoryNotFound(CategoryNotFoundException ex) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(
            HttpStatus.NOT_FOUND, ex.getMessage());
        pd.setTitle("Категория не найдена");
        return pd;
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail handleValidationErrors(MethodArgumentNotValidException ex) {
        String errors = ex.getBindingResult().getFieldErrors().stream()
            .map(FieldError::getDefaultMessage)
            .collect(Collectors.joining(", "));
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(
            HttpStatus.BAD_REQUEST, errors);
        pd.setTitle("Ошибка валидации");
        return pd;
    }
}
```

### 1.8. JWT Security (Spring Security)

#### JwtService — генерация и валидация токенов

```java
package com.tasktracker.config.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Service
public class JwtService {

    private final SecretKey secretKey;
    private final long expirationMs;

    public JwtService(
            @Value("${jwt.secret}") String secret,
            @Value("${jwt.expiration-ms}") long expirationMs) {
        this.secretKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationMs = expirationMs;
    }

    public String generateToken(String username) {
        return Jwts.builder()
            .subject(username)
            .issuedAt(new Date())
            .expiration(new Date(System.currentTimeMillis() + expirationMs))
            .signWith(secretKey)
            .compact();
    }

    public String extractUsername(String token) {
        return Jwts.parser()
            .verifyWith(secretKey)
            .build()
            .parseSignedClaims(token)
            .getPayload()
            .getSubject();
    }

    public boolean isTokenValid(String token) {
        try {
            Jwts.parser().verifyWith(secretKey).build().parseSignedClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }
}
```

#### JwtAuthenticationFilter

```java
package com.tasktracker.config.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;

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
        final String username = jwtService.extractUsername(jwt);

        if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            UserDetails userDetails = this.userDetailsService.loadUserByUsername(username);

            if (jwtService.isTokenValid(jwt)) {
                UsernamePasswordAuthenticationToken authToken =
                    new UsernamePasswordAuthenticationToken(
                        userDetails, null, userDetails.getAuthorities());
                authToken.setDetails(
                    new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authToken);
            }
        }

        filterChain.doFilter(request, response);
    }
}
```

#### SecurityConfig

```java
package com.tasktracker.config.security;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthFilter;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .cors(cors -> {})
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**").permitAll()
                .requestMatchers("/api/**").authenticated()
                .anyRequest().permitAll()
            )
            .sessionManagement(session ->
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(
            AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }
}
```

#### AuthController (регистрация и вход)

```java
package com.tasktracker.controller;

import com.tasktracker.config.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;
    private final PasswordEncoder passwordEncoder;

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@RequestBody AuthRequest request) {
        authenticationManager.authenticate(
            new UsernamePasswordAuthenticationToken(
                request.email(), request.password()));

        String token = jwtService.generateToken(request.email());
        return ResponseEntity.ok(new AuthResponse(token, request.email()));
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@RequestBody AuthRequest request) {
        // В реальном проекте — сохранение пользователя в БД
        String token = jwtService.generateToken(request.email());
        return ResponseEntity.ok(new AuthResponse(token, request.email()));
    }
}

record AuthRequest(String email, String password) {}
record AuthResponse(String token, String email) {}
```

### 1.9. Application Properties

```properties
# application.yml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/tasktracker
    username: ${DB_USER:tasktracker}
    password: ${DB_PASSWORD:tasktracker}
  jpa:
    hibernate:
      ddl-auto: update
    show-sql: true
    properties:
      hibernate:
        format_sql: true
        dialect: org.hibernate.dialect.PostgreSQLDialect

server:
  port: 8080

jwt:
  secret: ${JWT_SECRET:my-super-secret-key-that-must-be-at-least-256-bits-long-for-hs256}
  expiration-ms: 3600000
```

---

## Шаг 2. Фронтенд (Angular)

### 2.1. Инициализация

```bash
ng new task-tracker --standalone --routing --style=css
cd task-tracker
npm install @angular/material @angular/forms
```

### 2.2. Модели (interfaces)

```typescript
// src/app/models/task.model.ts
export interface Task {
  id: number;
  title: string;
  description: string;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
  categoryName: string;
  categoryId: number;
  createdAt: string;
}

export interface CreateTaskDTO {
  title: string;
  description?: string;
  categoryId: number;
}

export interface Category {
  id: number;
  name: string;
}
```

### 2.3. Сервис для работы с API

```typescript
// src/app/services/task.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Task, CreateTaskDTO, Category } from '../models/task.model';

@Injectable({ providedIn: 'root' })
export class TaskService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:8080/api';

  getTasks(): Observable<Task[]> {
    return this.http.get<Task[]>(`${this.apiUrl}/tasks`);
  }

  getTaskById(id: number): Observable<Task> {
    return this.http.get<Task>(`${this.apiUrl}/tasks/${id}`);
  }

  createTask(dto: CreateTaskDTO): Observable<Task> {
    return this.http.post<Task>(`${this.apiUrl}/tasks`, dto);
  }

  deleteTask(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/tasks/${id}`);
  }

  searchTasks(query: string): Observable<Task[]> {
    return this.http.get<Task[]>(`${this.apiUrl}/tasks/search`, {
      params: { query }
    });
  }

  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.apiUrl}/categories`);
  }
}
```

### 2.4. Reactive Form для создания задачи

```typescript
// src/app/components/task-form/task-form.component.ts
import { Component, inject, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CreateTaskDTO } from '../../models/task.model';
import { TaskService } from '../../services/task.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-task-form',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  template: `
    <form [formGroup]="taskForm" (ngSubmit)="onSubmit()" class="task-form">
      <div class="form-group">
        <label for="title">Название задачи</label>
        <input
          id="title"
          type="text"
          formControlName="title"
          placeholder="Введите название..."
        />
        @if (titleControl?.invalid && titleControl?.touched) {
          <small class="error">Минимум 3 символа</small>
        }
      </div>

      <div class="form-group">
        <label for="description">Описание</label>
        <textarea
          id="description"
          formControlName="description"
          rows="3"
        ></textarea>
      </div>

      <div class="form-group">
        <label for="category">Категория</label>
        <select id="category" formControlName="categoryId">
          <option value="">Выберите категорию</option>
          @for (cat of categories(); track cat.id) {
            <option [value]="cat.id">{{ cat.name }}</option>
          }
        </select>
        @if (categoryControl?.invalid && categoryControl?.touched) {
          <small class="error">Категория обязательна</small>
        }
      </div>

      <button type="submit" [disabled]="taskForm.invalid">
        Создать задачу
      </button>
    </form>
  `,
  styles: [`
    .task-form { display: flex; flex-direction: column; gap: 1rem; max-width: 500px; }
    .form-group { display: flex; flex-direction: column; gap: 0.25rem; }
    .error { color: #e74c3c; font-size: 0.8rem; }
    input, textarea, select { padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; }
    button { padding: 0.5rem 1rem; background: #3498db; color: white; border: none;
             border-radius: 4px; cursor: pointer; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
  `]
})
export class TaskFormComponent {
  private fb = inject(FormBuilder);
  private taskService = inject(TaskService);

  taskCreated = output<Task>();
  categories = this.taskService.getCategories();

  taskForm = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(3)]],
    description: [''],
    categoryId: [0, Validators.required]
  });

  get titleControl() { return this.taskForm.get('title'); }
  get categoryControl() { return this.taskForm.get('categoryId'); }

  onSubmit() {
    if (this.taskForm.invalid) return;

    const dto: CreateTaskDTO = {
      title: this.taskForm.value.title!,
      description: this.taskForm.value.description || undefined,
      categoryId: this.taskForm.value.categoryId!
    };

    this.taskService.createTask(dto).subscribe(task => {
      this.taskCreated.emit(task);
      this.taskForm.reset();
    });
  }
}
```

### 2.5. Signals для UI State

```typescript
// src/app/components/task-list/task-list.component.ts
import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TaskService } from '../../services/task.service';
import { Task } from '../../models/task.model';
import { Subject, debounceTime, switchMap, filter, map } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-task-list',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Строка живого поиска -->
    <input
      type="text"
      placeholder="Поиск задач..."
      (input)="onSearch($event)"
    />

    <!-- Фильтр статуса -->
    <div class="filters">
      @for (filter of filters; track filter) {
        <button
          [class.active]="activeFilter() === filter"
          (click)="activeFilter.set(filter)"
        >
          {{ filterLabels[filter] }}
        </button>
      }
    </div>

    <!-- Индикатор загрузки -->
    @if (isLoading()) {
      <p class="loading">Загрузка...</p>
    }

    <!-- Ошибка -->
    @if (error()) {
      <p class="error">{{ error() }}</p>
    }

    <!-- Список задач -->
    <div class="task-grid">
      @for (task of filteredTasks(); track task.id) {
        <div class="task-card">
          <h3>{{ task.title }}</h3>
          <p>{{ task.description }}</p>
          <span class="category">{{ task.categoryName }}</span>
          <span class="status" [class]="task.status">{{ task.status }}</span>
          <button (click)="onDelete(task.id)">Удалить</button>
        </div>
      } @empty {
        <p>Задачи не найдены</p>
      }
    </div>
  `,
  styles: [`
    .task-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; }
    .task-card { border: 1px solid #ddd; border-radius: 8px; padding: 1rem; }
    .filters { display: flex; gap: 0.5rem; margin: 1rem 0; }
    .filters button.active { background: #3498db; color: white; }
    .loading { color: #7f8c8d; }
    .error { color: #e74c3c; }
  `]
})
export class TaskListComponent implements OnInit {
  private taskService = inject(TaskService);

  // Состояние UI через Signals
  activeFilter = signal<'ALL' | 'TODO' | 'DONE'>('ALL');
  isLoading = signal(false);
  error = signal<string | null>(null);

  // Источник данных из API (сигнал)
  private tasksSignal = signal<Task[]>([]);

  // Вычисляемый сигнал для фильтрации
  filteredTasks = computed(() => {
    const filter = this.activeFilter();
    const tasks = this.tasksSignal();
    if (filter === 'ALL') return tasks;
    return tasks.filter(t => t.status === filter);
  });

  // Subject для живого поиска
  private searchSubject = new Subject<string>();

  filters = ['ALL', 'TODO', 'DONE'] as const;
  filterLabels: Record<string, string> = {
    ALL: 'Все',
    TODO: 'К выполнению',
    DONE: 'Готово'
  };

  ngOnInit() {
    this.loadTasks();

    // Живой поиск с debounce
    this.searchSubject.pipe(
      map(e => (e.target as HTMLInputElement).value.trim()),
      filter(query => query.length === 0 || query.length > 2),
      debounceTime(300),
      switchMap(query => {
        this.isLoading.set(true);
        return query
          ? this.taskService.searchTasks(query)
          : this.taskService.getTasks();
      })
    ).subscribe({
      next: tasks => {
        this.tasksSignal.set(tasks);
        this.isLoading.set(false);
      },
      error: err => {
        this.error.set('Ошибка загрузки задач');
        this.isLoading.set(false);
      }
    });
  }

  loadTasks() {
    this.isLoading.set(true);
    this.taskService.getTasks().subscribe({
      next: tasks => {
        this.tasksSignal.set(tasks);
        this.isLoading.set(false);
      },
      error: err => {
        this.error.set('Не удалось загрузить задачи');
        this.isLoading.set(false);
      }
    });
  }

  onSearch(event: Event) {
    this.searchSubject.next(event);
  }

  onDelete(id: number) {
    this.taskService.deleteTask(id).subscribe(() => this.loadTasks());
  }
}
```

### 2.6. HTTP Interceptor для JWT

```typescript
// src/app/interceptors/auth.interceptor.ts
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  if (token) {
    const cloned = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
    return next(cloned);
  }

  return next(req);
};
```

#### Interceptor с Refresh Token (продвинутый)

```typescript
// src/app/interceptors/refresh.interceptor.ts
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { BehaviorSubject, catchError, filter, switchMap, take, throwError } from 'rxjs';

let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

export const refreshInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  return next(req).pipe(
    catchError((error) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        return handle401Error(req, next, authService);
      }
      return throwError(() => error);
    })
  );
};

function handle401Error(req: any, next: any, authService: AuthService) {
  if (!isRefreshing) {
    isRefreshing = true;
    refreshTokenSubject.next(null);

    return authService.refreshToken().pipe(
      switchMap((newTokens) => {
        isRefreshing = false;
        refreshTokenSubject.next(newTokens.accessToken);
        return next(injectToken(req, newTokens.accessToken));
      }),
      catchError((refreshError) => {
        isRefreshing = false;
        authService.logout();
        return throwError(() => refreshError);
      })
    );
  } else {
    return refreshTokenSubject.pipe(
      filter(token => token !== null),
      take(1),
      switchMap(token => next(injectToken(req, token!)))
    );
  }
}

function injectToken(req: any, token: string) {
  return req.clone({
    setHeaders: { Authorization: `Bearer ${token}` }
  });
}
```

### 2.7. Functional Guards

```typescript
// src/app/guards/auth.guard.ts
import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
  return false;
};
```

### 2.8. Регистрация Interceptors и Guards в `app.config.ts`

```typescript
// src/app/app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';
import { refreshInterceptor } from './interceptors/refresh.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([authInterceptor, refreshInterceptor])
    )
  ]
};
```

---

## Шаг 3. Тестирование

### 3.1. JUnit 5 для Service Layer

```java
package com.tasktracker.service;

import com.tasktracker.dto.*;
import com.tasktracker.model.*;
import com.tasktracker.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TaskServiceTest {

    @Mock private TaskRepository taskRepository;
    @Mock private CategoryRepository categoryRepository;

    private TaskService taskService;

    @BeforeEach
    void setUp() {
        taskService = new TaskService(taskRepository, categoryRepository);
    }

    @Test
    void getAllTasks_ShouldReturnList() {
        Category cat = new Category(1L, "Работа");
        Task task = Task.builder()
            .id(1L).title("Тест").status(TaskStatus.TODO).category(cat)
            .build();

        when(taskRepository.findAllWithCategory()).thenReturn(List.of(task));

        List<TaskResponseDTO> result = taskService.getAllTasks();

        assertThat(result).hasSize(1);
        assertThat(result.get(0).title()).isEqualTo("Тест");
        verify(taskRepository).findAllWithCategory();
    }

    @Test
    void createTask_ShouldThrow_WhenCategoryNotFound() {
        CreateTaskDTO dto = new CreateTaskDTO("Тест", null, 999L);
        when(categoryRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> taskService.createTask(dto))
            .isInstanceOf(CategoryNotFoundException.class);
    }
}
```

### 3.2. Angular TestBed для компонента

```typescript
// src/app/components/task-list/task-list.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TaskListComponent } from './task-list.component';
import { TaskService } from '../../services/task.service';
import { of } from 'rxjs';
import { Task } from '../../models/task.model';

describe('TaskListComponent', () => {
  let component: TaskListComponent;
  let fixture: ComponentFixture<TaskListComponent>;
  let mockTaskService: jasmine.SpyObj<TaskService>;

  const mockTasks: Task[] = [
    { id: 1, title: 'Задача 1', description: '', status: 'TODO',
      categoryName: 'Работа', categoryId: 1, createdAt: '2026-01-01' }
  ];

  beforeEach(async () => {
    mockTaskService = jasmine.createSpyObj('TaskService',
      ['getTasks', 'createTask', 'deleteTask', 'searchTasks']);
    mockTaskService.getTasks.and.returnValue(of(mockTasks));

    await TestBed.configureTestingModule({
      imports: [TaskListComponent],
      providers: [
        { provide: TaskService, useValue: mockTaskService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TaskListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('должен загружать задачи при инициализации', () => {
    expect(mockTaskService.getTasks).toHaveBeenCalled();
    expect(component.filteredTasks().length).toBe(1);
  });

  it('должен фильтровать задачи по статусу', () => {
    component.activeFilter.set('DONE');
    expect(component.filteredTasks().length).toBe(0);
  });
});
```

---

## Шаг 4. Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: tasktracker
      POSTGRES_USER: tasktracker
      POSTGRES_PASSWORD: tasktracker
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  api:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8080:8080"
    environment:
      DB_URL: jdbc:postgresql://db:5432/tasktracker
      DB_USER: tasktracker
      DB_PASSWORD: tasktracker
      JWT_SECRET: ${JWT_SECRET}
    depends_on:
      - db

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "4200:80"
    depends_on:
      - api

volumes:
  pgdata:
```

### Dockerfile для бэкенда

```dockerfile
# backend/Dockerfile
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -B
COPY src ./src
RUN mvn package -DskipTests

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

### Dockerfile для фронтенда

```dockerfile
# frontend/Dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .
RUN npm run build --prod

FROM nginx:alpine
COPY --from=build /app/dist/task-tracker/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

---

## Шаг 5. README проекта

```markdown
# Task Tracker

## Запуск

### Локально (dev)

**Бэкенд:**
```bash
cd backend
mvn spring-boot:run -Dspring-boot.run.profiles=dev
```

**Фронтенд:**
```bash
cd frontend
npm start
```

### Через Docker

```bash
docker compose up --build
```

Приложение будет доступно:
- Frontend: http://localhost:4200
- Backend API: http://localhost:8080/api
- Swagger: http://localhost:8080/swagger-ui.html

## API Endpoints

| Метод  | Путь                  | Описание          | Auth |
|--------|-----------------------|-------------------|------|
| GET    | /api/tasks            | Все задачи        | JWT  |
| GET    | /api/tasks/{id}       | Задача по ID      | JWT  |
| POST   | /api/tasks            | Создать задачу    | JWT  |
| PUT    | /api/tasks/{id}       | Обновить задачу   | JWT  |
| DELETE | /api/tasks/{id}       | Удалить задачу    | JWT  |
| GET    | /api/tasks/search?q=  | Поиск задач       | JWT  |
| POST   | /api/auth/login       | Вход              | -    |
| POST   | /api/auth/register    | Регистрация       | -    |

## Стек

- Java 21, Spring Boot 3.x, PostgreSQL 16
- Angular 19, Angular Material, RxJS
- Docker, Docker Compose
```

---

## Подводные камни и их решение

| Проблема | Решение |
|----------|---------|
| **CORS**: браузер блокирует запросы с `localhost:4200` на `localhost:8080` | `@CrossOrigin` на контроллере или глобальный `WebMvcConfigurer` |
| **N+1**: при загрузке списка задач Hibernate делает лишние запросы к категориям | Использовать `JOIN FETCH t.category` в `@Query` |
| **LazyInitializationException**: доступ к `task.category` вне транзакции | `@Transactional(readOnly = true)` в сервисе или `JOIN FETCH` |
| **Утечка памяти**: забытая подписка на Observable в Angular | Использовать `takeUntilDestroyed()` или `async` pipe |
| **Deadlock при Refresh Token**: несколько параллельных 401 отправляют N запросов обновления | Использовать семафор на `BehaviorSubject` (см. п. 2.6) |

---

## Итог

После выполнения этого проекта вы:

1. **Написали** полноценный REST API на Spring Boot с JPA, валидацией, JWT и обработкой ошибок.
2. **Построили** реактивный фронтенд на Angular 19 со Signals, RxJS, формами и интерцепторами.
3. **Решили** проблему N+1 через `JOIN FETCH`.
4. **Упаковали** приложение в Docker Compose для продакшн-запуска.
5. **Протестировали** сервисный слой с Mockito и компонент с TestBed.

Этот проект можно смело показывать на собеседовании как демонстрацию вашего Full-Stack уровня.

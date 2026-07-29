# Глава 3: Angular — Современный Enterprise Frontend

---

## 3.1 Components, Templates, Новый Control Flow

### Жизненная аналогия

**React vs Angular:**
- **React** — набор деталей Lego. Вы можете собрать из него всё что угодно, но вам нужно самому выбирать клей, трубы и проводку (библиотеки для роутинга, валидации форм, управления состоянием).
- **Angular** — готовый панельный дом. В нём уже проложены трубы, установлена сантехника и проведено электричество. Вы обязаны следовать его планировке, но вам не нужно думать о фундаменте.

### Standalone Components (Angular 14+)

#### Аналогия

**Старый подход с NgModule (Коммунальная квартира):** Все живут в общей коммуналке (`NgModule`). Если вам нужен чайник (`RouterLink` или `NgIf`), он должен быть зарегистрирован в общем списке имущества на кухне. Переезд в другой дом — адская боль.

**Новый Standalone-подход (Современная квартира-студия):** Вы живёте в автономной квартире со своей мини-кухней. Если нужен тостер — покупаете и ставите у себя (`imports: [RouterLink]`). Переезд в другой город — просто забираете всё с собой.

#### Техническая глубина

```typescript
@Component({
  selector: 'app-user-profile',
  standalone: true,                     // Независимый компонент
  imports: [CommonModule, RouterLink],  // Зависимости импортируются явно
  template: `
    <h2>{{ user.name }}</h2>
    <a [routerLink]="['/edit', user.id]">Редактировать</a>
  `
})
export class UserProfileComponent {
  user = input<User>();  // Signal Input
}
```

**Преимущества:**
1. **Tree Shaking** — неиспользуемые компоненты исключаются из бандла
2. **Упрощение архитектуры** — все зависимости видны в файле компонента
3. **Удобство тестирования** — не нужно настраивать фиктивные `NgModule`

### Новый Control Flow (Angular 17+)

Заменяет старые структурные директивы `*ngIf` / `*ngFor`:

```html
<!-- Новый синтаксис (v17+) -->
@if (isLoggedIn) {
  <p>Добро пожаловать, {{ username() }}!</p>
} @else {
  <button (click)="login()">Войти</button>
}

@for (item of items; track item.id) {
  <li>{{ item.name }}</li>
} @empty {
  <p>Список пуст</p>
}

@switch (role()) {
  @case ('admin') { <p>Панель администратора</p> }
  @case ('user') { <p>Профиль пользователя</p> }
  @default { <p>Доступ запрещён</p> }
}
```

> **Преимущество:** Встроен в ядро фреймворка, не требует импорта `CommonModule`, работает быстрее и компактнее старых директив.

---

## 3.2 DI и Services

### Жизненная аналогия

В Angular внедрение зависимостей работает так же, как в Spring Boot (и это не совпадение — Angular изначально проектировался под влиянием Java-фреймворков). Вы просто объявляете: «Мне нужен сервис», и Angular сам находит и предоставляет его экземпляр.

### Техническая глубина

```typescript
@Injectable({
  providedIn: 'root'  // Синглтон на всё приложение
})
export class AuthService {
  private isLoggedIn = signal(false);

  login() { this.isLoggedIn.set(true); }
  logout() { this.isLoggedIn.set(false); }
}
```

**Внедрение в компонент:**

```typescript
@Component({ ... })
export class LoginComponent {
  // Современный способ — inject()
  private authService = inject(AuthService);
  private router = inject(Router);

  onLogin() {
    this.authService.login();
    this.router.navigate(['/dashboard']);
  }
}
```

> **Gotcha:** `providedIn: 'root'` создаёт один экземпляр на всё приложение (синглтон). Если нужно изолировать экземпляр (например, отдельный сервис для каждого компонента), используйте `providedIn` на уровне компонента или модуля.

---

## 3.3 Reactive Forms

### Жизненная аналогия

Виртуальный пульт управления в кабине пилота. Вся форма, её состояние, значения и правила валидации описываются в TypeScript-классе. Кнопки и поля в HTML — просто физическое подключение к этому пульту.

### Техническая глубина

Реактивные формы (Typed Forms с Angular 14+) описываются полностью в коде:

```typescript
interface TaskForm {
  title: FormControl<string>;
  description: FormControl<string | null>;
  dueDate: FormControl<Date | null>;
}

@Component({ ... })
export class TaskFormComponent {
  private fb = inject(FormBuilder);

  form: FormGroup<TaskForm> = this.fb.group({
    title: this.fb.control('', { nonNullable: true, validators: [Validators.required] }),
    description: this.fb.control(null),
    dueDate: this.fb.control(null),
  });

  onSubmit() {
    if (this.form.valid) {
      console.log(this.form.getRawValue()); // Типобезопасный доступ
    }
  }
}
```

```html
<form [formGroup]="form" (ngSubmit)="onSubmit()">
  <input formControlName="title" placeholder="Название" />
  @if (form.controls.title.invalid && form.controls.title.touched) {
    <p class="error">Название обязательно</p>
  }
  <textarea formControlName="description" placeholder="Описание"></textarea>
  <button type="submit" [disabled]="form.invalid">Сохранить</button>
</form>
```

> **Gotcha:** С версии Angular 14 формы строго типизированы. Компилятор не позволит передать некорректный тип данных в поле формы. Используйте `NonNullableFormBuilder`, чтобы избежать `null` в полях, которые не могут быть пустыми.

---

## 3.4 Signals

### Жизненная аналогия

**Таблица Excel:** Изменение значения в одной ячейке мгновенно и точечно пересчитывает только зависимую формулу. Никакого пересчёта всего листа целиком.

### Техническая глубина

Сигналы (Angular 16+) — это мелкозернистая реактивность, где изменение сигнала обновляет строго тот узел в DOM, который от него зависит:

```typescript
@Component({
  selector: 'app-counter',
  template: `
    <p>Счётчик: {{ count() }}</p>
    <p>Удвоенный: {{ double() }}</p>
    <button (click)="increment()">+1</button>
  `
})
export class CounterComponent {
  count = signal(0);                    // Сигнал с начальным значением
  double = computed(() => this.count() * 2);  // Вычисляемый сигнал

  constructor() {
    effect(() => {
      // Эффект запускается при каждом изменении count
      console.log('Счётчик изменился:', this.count());
    });
  }

  increment() {
    this.count.update(n => n + 1);
  }
}
```

### Signals vs RxJS

| Критерий | Signal | Observable (RxJS) |
|:---|:---|:---|
| Природа | Синхронный контейнер значения | Асинхронный поток событий |
| Начальное значение | Обязательно | Не обязательно |
| Где использовать | UI-состояние (формы, модалки, фильтры) | Сеть (HTTP, WebSocket), сложные потоки |
| Отписка | Не требуется | Требуется (кроме конечных потоков) |
| Производительность | Мелкозернистое обновление DOM | Zone.js проверка изменений |

> **Gotcha:** В отличие от React, изменение сигнала **не вызывает повторный запуск всей функции компонента**. Angular обновляет строго тот текстовый узел в DOM, который зависит от этого сигнала. Массивы зависимостей не нужны — зависимости отслеживаются автоматически.

### Zoneless Angular (v18+)

С сигналами Angular может работать вообще без `zone.js`. В Zoneless-режиме вы обязаны использовать реактивность (сигналы, RxJS `async` pipe или явный `ChangeDetectorRef.markForCheck()`):

```typescript
// В Zoneless-режиме НЕ сработает:
export class MyComponent {
  name = 'Ivan'; // Обычная переменная, не сигнал!

  changeName() {
    setTimeout(() => {
      this.name = 'Petr'; // UI НЕ обновится!
    }, 1000);
  }
}

// А это сработает:
export class MyComponent {
  name = signal('Ivan');

  changeName() {
    setTimeout(() => {
      this.name.set('Petr'); // UI обновится точечно
    }, 1000);
  }
}
```

---

## 3.5 RxJS: Observable, Subscriber, операторы

### Жизненная аналогия

**YouTube-канал (Observable):** Блогер выпускает видео во времени. Вы (Subscriber) подписываетесь и получаете уведомления. Операторы (`map`, `filter`, `debounceTime`) — это фильтры очистки воды на трубе перед тем, как вода попадёт в стакан.

### Техническая глубина

#### Observable и Subscriber

```typescript
import { Observable } from 'rxjs';

// Создание потока
const observable = new Observable<number>(subscriber => {
  subscriber.next(1);
  subscriber.next(2);
  subscriber.next(3);
  subscriber.complete();
});

// Подписка
observable.subscribe({
  next: value => console.log(value),
  error: err => console.error(err),
  complete: () => console.log('Готово'),
});
```

#### Subject — активный канал связи

`Subject` — это гибрид: он одновременно умеет и генерировать события, и слушать их. Аналог `EventEmitter` из Node.js.

| Тип Subject | Аналогия | Когда использовать |
|:---|:---|:---|
| **Subject** | Прямой эфир по радио — слушатель слышит только то, что происходит после включения | Одноразовые события (logout, уведомления об ошибках) |
| **BehaviorSubject** | Умный термометр — при входе сразу видите текущую температуру | **90% случаев** — глобальное состояние приложения |
| **ReplaySubject** | Запись матча с отмоткой — подписавшись, получаете последние N событий | История чата, логи |
| **AsyncSubject** | Экзамен — оценка только в самом конце | Тяжёлые расчёты, инициализация |

#### Важнейшие операторы

```typescript
import { of, fromEvent, switchMap, debounceTime, map, filter, catchError } from 'rxjs';
import { ajax } from 'rxjs/ajax';

// switchMap — король операторов для API
// Автоматически отменяет предыдущий запрос при новом значении
searchInput.valueChanges.pipe(
  debounceTime(300),       // Ждём 300мс после последнего ввода
  filter(q => q.length >= 3), // Минимум 3 символа
  switchMap(query =>       // Отменяет предыдущий запрос, запускает новый
    ajax.getJSON(`/api/search?q=${query}`)
  ),
).subscribe(results => {
  this.searchResults.set(results);
});

// map, filter — как в Streams API Java
of(1, 2, 3, 4, 5).pipe(
  filter(n => n % 2 === 0),
  map(n => n * 10)
).subscribe(console.log); // 20, 40
```

> **Gotcha:** HTTP-запросы в Angular возвращают конечные потоки (один ответ → `complete`). От них не нужно отписываться — утечки не будет. Отписываться нужно от бесконечных потоков (WebSocket, интервалы, события).

---

## 3.6 HTTP Interceptors и Guards

### Жизненная аналогия

**Interceptor:** Охранник на входе, который проверяет пропуск (JWT-токен) и приклеивает на него наклейку `Authorization: Bearer...` перед тем, как пустить посетителя в здание. **Guard:** Контролёр у дверей конкретного кабинета, проверяющий, есть ли у вас доступ именно к этому отделу.

### Техническая глубина

#### Функциональный Interceptor (Angular 15+)

```typescript
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getAccessToken();

  if (token) {
    const cloned = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
    return next(cloned);
  }

  return next(req);
};
```

#### Refresh Token Interceptor (без дублирования запросов)

Один из самых частых вопросов: как избежать N параллельных запросов на обновление токена, когда N запросов одновременно получили 401?

```typescript
import { HttpInterceptorFn, HttpErrorResponse, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { BehaviorSubject, catchError, filter, switchMap, take, throwError } from 'rxjs';

let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

export const tokenRefreshInterceptor: HttpInterceptorFn = (req, next) => {
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

function handle401Error(req: HttpRequest<any>, next: HttpHandlerFn, authService: AuthService) {
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

function injectToken(req: HttpRequest<any>, token: string): HttpRequest<any> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}
```

#### Функциональный Guard (Angular 15+)

```typescript
import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

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

> **Gotcha:** При использовании `BehaviorSubject` в сценарии с refresh token: второй и третий запросы «зависают» в ожидании, подписавшись на `refreshTokenSubject`, фильтруя `null`, и возобновляются только когда появится новый токен. Это предотвращает множественные запросы на обновление и проблемы с Refresh Token Rotation.

---

## 3.7 Очистка ресурсов (takeUntilDestroyed, async pipe)

### Жизненная аналогия

Выключение электроприбора из розетки после завершения его использования. Если этого не сделать — прибор продолжит потреблять энергию (утечка памяти), что со временем приведёт к короткому замыканию.

### Техническая глубина

#### Проблема

В долгоживущих приложениях незакрытые подписки на бесконечные RxJS-потоки (WebSocket, интервалы, события) приводят к утечкам памяти. Компонент уничтожен, но подписка продолжает жить.

#### Решение А (Старый стиль)

```typescript
@Component({ ... })
export class ChatComponent implements OnInit, OnDestroy {
  private subscription = new Subscription();

  ngOnInit() {
    this.subscription.add(
      this.chatService.messages$.subscribe(msg => {
        this.messages.update(m => [...m, msg]);
      })
    );
  }

  ngOnDestroy() {
    this.subscription.unsubscribe(); // Ручная отписка
  }
}
```

#### Решение Б (Современный — `takeUntilDestroyed`)

```typescript
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({ ... })
export class ChatComponent {
  private messages = signal<Message[]>([]);

  constructor() {
    this.chatService.messages$.pipe(
      takeUntilDestroyed() // Автоматическая отписка при уничтожении компонента
    ).subscribe(msg => {
      this.messages.update(m => [...m, msg]);
    });
  }
}
```

#### Решение В (Лучшая практика — `async` pipe)

Самый безопасный способ — доверить управление подпиской Angular через пайп `async` в шаблоне. Angular сам подписывается при рендере и гарантированно отписывается при уничтожении:

```typescript
@Component({
  template: `
    @for (message of messages$ | async; track message.id) {
      <div>{{ message.text }}</div>
    }
  `
})
export class ChatComponent {
  messages$ = this.chatService.messages$;
}
```

> **Gotcha:** `async` pipe работает только с `Observable`. Если вы используете сигналы, отписка не требуется — сигналы сами управляют своим жизненным циклом.

### Обработка Optimistic Locking (HTTP 409)

Когда бэкенд возвращает `409 Conflict` (из-за оптимистической блокировки), фронтенд должен мягко предложить пользователю обновиться:

```typescript
saveTask() {
  this.taskService.updateTask(this.taskData).pipe(
    catchError((error) => {
      if (error.status === 409) {
        this.dialog.open(ConflictDialogComponent, {
          data: { message: 'Документ был изменён другим пользователем.' }
        });
        return EMPTY;
      }
      return throwError(() => error);
    })
  ).subscribe();
}
```

> **Gotcha:** Вместо полной перезагрузки страницы (`window.location.reload()`) делайте точечный перезапуск данных конкретного компонента. Это сохраняет состояние остального приложения.

---

## Резюме главы

Современный Angular (v17+) — это совершенно другой фреймворк по сравнению с тем, чем он был в версиях 8-12:

1. **Standalone Components** — больше никаких NgModule, каждый компонент самодостаточен
2. **Control Flow** — `@if`/`@for`/`@switch` вместо `*ngIf`/`*ngFor`
3. **Reactive Forms** — строго типизированы, вся логика в TypeScript
4. **Signals** — мелкозернистая реактивность без Zone.js
5. **RxJS** — Subject для событий, BehaviorSubject для состояния, операторы для трансформации потоков
6. **Interceptors** — функциональные, с поддержкой автоматического Refresh Token
7. **Очистка** — `takeUntilDestroyed` и `async` pipe для предотвращения утечек памяти

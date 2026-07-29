# Глава 8: Миграция Angular 8 → Angular 20

> «Angular 8 — это jQuery с TypeScript. Angular 20 — это reactive micro-frontend framework. Между ними — пропасть в 12 мажорных версий».

Миграция фронтенда с Angular 8 на Angular 20 — это не просто `ng update`. Это полная перестройка архитектуры приложения: от компилятора шаблонов до системы реактивности.

---

## 8.1. Timeline версий

Понимание мапы релизов критически важно для интервью.

```
Angular 8  (май 2019)  — View Engine, Ivy optional, Node 12
Angular 9  (фев 2020)  — Ivy по умолчанию (новый компилятор)
Angular 10 (июнь 2020) — Стабилизация Ivy, обновление TS
Angular 11 (нояб 2020) — HMR, CSS из коробки
Angular 12 (май 2021)  — View Engine deprecated, IE11 deprecated
Angular 13 (нояб 2021) — View Engine удалён, Webpack 5, ES2020
Angular 14 (июнь 2022) — Standalone Components (preview), Typed Forms
Angular 15 (нояб 2022) — Standalone Components (stable)
Angular 16 (май 2023)  — Signals (developer preview)
Angular 17 (нояб 2023) — New Control Flow (@if/@for), Signals (stable)
Angular 18 (май 2024)  — Zoneless (experimental), Resource API
Angular 19 (нояб 2024) — Zoneless (developer preview)
Angular 20 (май 2025)  — Zoneless (stable), Signal Forms
```

### Почему нельзя обновиться за один шаг

1. **Node.js версии:** Angular 8 требует Node 12, Angular 20 — Node 20+.
2. **RxJS v6 vs v7/v8:** Изменение API (удалён `.toPromise()`, новый объект-наблюдатель).
3. **TypeScript версии:** Angular 8 использует TS 3.x, Angular 20 — TS 5.6+.
4. **View Engine → Ivy:** Полная смена компилятора шаблонов.

### Наш путь миграции

```
Node 12          Node 14/16        Node 18          Node 20/22
Angular 8  →  Angular 9  →  Angular 12  →  Angular 15  →  Angular 17  →  Angular 20
              (Ivy Engine)   (Standalone    (Signals,      (Zoneless,
                              preview)       New Control    Signal Forms)
```

---

## 8.2. Переход на Ivy (Angular 9)

### Что такое View Engine и почему он был плох

View Engine — старый компилятор Angular, который:

- Генерировал гигантские JS-файлы с метаданными.
- Плохо работал Tree-Shaking (вырезание мёртвого кода).
- Требовал `ngcc` (Angular Compatibility Compiler) для совместимости библиотек.

### Что принёс Ivy (Angular 9)

Ivy — полностью переписанный компилятор:

1. **Tree-Shaking на уровне шаблонов** — если директива не используется в шаблоне, она не попадает в бандл.
2. **Инкрементальная компиляция** — сборка в 3-5 раз быстрее.
3. **Улучшенная отладка** — дебаг HTML-шаблонов в браузере.

### Сложности при переходе на Ivy

**Проблема 1: `ngcc` замедляет `npm install`**

```bash
# Ivy Compatibility Compiler пересобирает библиотеки под Ivy
# npm install мог занимать до 10 минут!
```

**Проблема 2: Строгая проверка типов в шаблонах**

Angular 9 включил `fullTemplateTypeCheck` — TypeScript начал проверять типы внутри HTML:

```html
<!-- Angular 8: молча проглатывало -->
<div>{{ user.name }}</div>
<!-- Если user может быть null — в v9 ошибка компиляции! -->
<!-- Решение: использовать optional chaining -->
<div>{{ user?.name }}</div>
```

**Проблема 3: Пропавшие библиотеки**

Старые библиотеки, скомпилированные под View Engine, требовали `ngcc`. Если библиотека была заброшена с 2018 года — она не компилировалась под Ivy.

**Решение:**

```typescript
// Замена заброшенных библиотек на современные аналоги
// Старый датапикер: ng2-date-picker (не обновляется с 2019)
// Новый датапикер: @angular/material-datepicker или @angular/cdk
import { MatDatepickerModule } from '@angular/material/datepicker';
```

---

## 8.3. Angular 10 → 11 → 12: Промежуточные версии

### Angular 10: Стабилизация Ivy

- Багфиксы Ivy, улучшение `ngcc`.
- Обновление TypeScript до 3.9.
- Подготовка к отказу от IE11.

### Angular 11: HMR и улучшения

- **Hot Module Replacement (HMR)** — горячая замена модулей без перезагрузки страницы.
- Шрифты и SVG из коробки (без копирования в assets).

### Angular 12: View Engine deprecated

- **Internet Explorer 11** объявлен deprecated (удалён в v13).
- **Webpack 5** — Module Federation для микрофронтендов.
- **Node.js 14+** — поддержка старых Node прекращена.

---

## 8.4. Angular 13: Удаление View Engine

### Что изменилось

Angular 13 полностью вырезал View Engine и `ngcc`:

- Все библиотеки **обязаны** быть скомпилированы под Ivy (Partial Compilation).
- Старые библиотеки, не перешедшие на Ivy, **перестали собираться**.
- Удалены полифилы для IE11 — бандл уменьшился на 10–15%.

### Наш опыт

```bash
# После обновления до Angular 13 сборка упала с ошибкой:
Error: The target entry-point "@angular/material" has missing dependencies:
 - @angular/forms (несовместимая версия)

# Решение: обновить Angular Material до версии 13+
ng update @angular/material@13
```

### ES2020 по умолчанию

Angular 13 начал собирать финальный бандл в стандарте **ES2020** (вместо ES2015):

```
ES2015: class MyComponent {} // 5 строк transpiled
ES2020: class MyComponent {} // 0 transpilation — нативная поддержка браузером
```

Это уменьшило размер бандла ещё на 7–10%.

---

## 8.5. Angular 14 → 15: Standalone Components

### Что такое NgModule и почему от него отказались

В старом Angular (v2–v13) компонент не мог существовать сам по себе — он должен быть «зарегистрирован» в `NgModule`:

```typescript
// Angular 8: NgModule — обязательный реестр
@NgModule({
  declarations: [UserProfileComponent],
  imports: [CommonModule, FormsModule],
})
export class UserModule {}
```

Проблемы:
- **Двойной импорт** (ES-import + declarations).
- **SharedModule анти-паттерн** — всё в один модуль, убивая Tree-Shaking.
- **Lazy Loading требовал NgModule** — плодились десятки ненужных файлов.

### Standalone Components (Angular 14 preview → 15 stable)

```typescript
// Angular 15+: компонент самодостаточен
@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [NgIf, AsyncPipe, ReactiveFormsModule],
  template: `
    @if (user()) {
      <h2>{{ user().name }}</h2>
    }
  `
})
export class UserProfileComponent {
  user = signal<User | null>(null);
}
```

### Рефакторинг NgModule → Standalone

Мы использовали **automated migration**:

```bash
# Angular CLI: автоматическая генерация standalone-компонентов
ng generate @angular/core:standalone
```

Что делает миграция:
1. Преобразует все `@Component({...})` в `standalone: true`.
2. Переносит зависимости из `NgModule.imports` в `@Component.imports`.
3. Обновляет `bootstrapModule` → `bootstrapApplication`.

### Typed Forms (Angular 14)

В Angular 8 все реактивные формы возвращали `any`:

```typescript
// Angular 8: тип any — опасный
const form = new FormGroup({
  name: new FormControl('')
});
const value = form.value; // any
const name = value.wrongField; // Ошибки нет — до runtime
```

Angular 14 ввёл строгую типизацию:

```typescript
// Angular 14+: строгая типизация
interface UserForm {
  name: FormControl<string>;
  email: FormControl<string | null>;
}

const form = new FormGroup<UserForm>({
  name: new FormControl('', { nonNullable: true }),
  email: new FormControl(null)
});

form.value.name; // string — тип известен на compile-time
form.value.wrongField; // Ошибка компиляции!
```

---

## 8.6. Angular 16 → 17: Signals и новый Control Flow

### Проблемы RxJS-стейта до Signals

До v16 единственным способом делать реактивный UI был RxJS:

```typescript
// Старый подход: BehaviorSubject + async pipe
export class UserService {
  private userSubject = new BehaviorSubject<User | null>(null);
  user$ = this.userSubject.asObservable();

  loadUser(id: number) {
    this.http.get<User>(`/api/users/${id}`)
      .subscribe(user => this.userSubject.next(user));
  }
}
```

Проблемы:
1. **Утечки памяти** — забытые `.subscribe()` без отписки.
2. **Избыточный бойлерплейт** — Subject → next → async pipe или subscribe.
3. **Асинхронные задержки** — гонка запросов, задержки обновления UI.

### Signals (Angular 16 preview → 17 stable)

Сигналы — это синхронный контейнер состояния с мелкозернистой реактивностью:

```typescript
const count = signal(0);
const doubleCount = computed(() => count() * 2);

effect(() => {
  console.log(`Count changed: ${count()}`);
});

count.set(5); // Точечно обновляет DOM, не перезапуская весь компонент
```

### Замена RxJS на Signals

**До (Angular 8):**

```typescript
export class ShoppingCartComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  ngOnInit() {
    this.cartService.items$
      .pipe(takeUntil(this.destroy$))
      .subscribe(items => this.items = items);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
```

**После (Angular 17+):**

```typescript
export class ShoppingCartComponent {
  readonly items = signal<Item[]>([]);

  constructor() {
    // Загрузка данных
    this.http.get<Item[]>('/api/cart')
      .subscribe(items => this.items.set(items));
  }
}
```

### Новый Control Flow (Angular 17)

**Старый синтаксис (`*ngIf`, `*ngFor`):**

```html
<div *ngIf="isLoaded; else loading">
  <ul>
    <li *ngFor="let user of users; trackBy: trackById">
      {{ user.name }}
    </li>
  </ul>
</div>
<ng-template #loading>Загрузка...</ng-template>
```

**Новый синтаксис (`@if`, `@for`):**

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

Преимущества:
- Встроен в компилятор — **не требует импорта `CommonModule`**.
- Работает быстрее — нет оберток `ng-template` в DOM.
- Читаемый синтаксис — `@if`/`@for`/`@switch` как в JSX.

---

## 8.7. Angular 18 → 20: Zoneless и Resource API

### Что такое Zone.js и почему от него отказались

Zone.js «патчила» все асинхронные операции браузера (setTimeout, fetch, события). При любом событии Zone.js запускала **полный Change Detection** по всему дереву компонентов.

**Аналогия:** Представьте охранника, который каждые 5 секунд бегает по всем 100 кабинетам и проверяет: «У вас что-то изменилось?». Это огромная трата ресурсов.

### Zoneless (Angular 18 experimental → 20 stable)

Благодаря Signals Angular точно знает, какой узел DOM зависит от какого сигнала. Zone.js больше не нужна:

```typescript
// app.config.ts — Zoneless setup
import { provideExperimentalZonelessChangeDetection } from '@angular/core';

export const appConfig: ApplicationConfig = {
  providers: [
    provideExperimentalZonelessChangeDetection()
  ]
};
```

**Что меняется для разработчика:**

В Zoneless-режиме **обязательно** использовать Signals или RxJS:

```typescript
// ❌ Старый код — НЕ работает в Zoneless
@Component({...})
export class MyComponent {
  name = 'Ivan'; // Обычная переменная, не сигнал!
  updateName() {
    this.name = 'Petr'; // Экран не обновится без Zone.js!
  }
}

// ✅ Новый код — работает в Zoneless
@Component({...})
export class MyComponent {
  name = signal('Ivan');
  updateName() {
    this.name.set('Petr'); // Точечное обновление DOM
  }
}
```

### Resource API (Angular 19+)

Новый способ загрузки данных без RxJS:

```typescript
@Component({
  template: `
    @if (userResource.isLoading()) {
      <p>Загрузка...</p>
    } @else {
      <h2>{{ userResource.value()?.name }}</h2>
    }
  `
})
export class UserProfileComponent {
  userId = signal<string>('1');

  userResource = resource({
    params: () => ({ id: this.userId() }),
    loader: async ({ params, abortSignal }) => {
      const response = await fetch(`/api/users/${params.id}`, {
        signal: abortSignal
      });
      return response.json();
    }
  });
}
```

Готовые статусы: `.isLoading()`, `.error()`, `.value()`, `.status()`.

---

## 8.8. RxJS: Эволюция и миграция

### Deprecated операторы в RxJS 7

| Старый (RxJS 6) | Новый (RxJS 7+) | Причина |
|----------------|----------------|---------|
| `.toPromise()` | `firstValueFrom()` / `lastValueFrom()` | Путаница между first/last |
| `.subscribe(success, error, complete)` | `.subscribe({ next, error, complete })` | Единый объект-наблюдатель |
| `.pipe(switchMap())` | `.pipe(switchMap())` (без изменений, но обновлён импорт) | — |
| `Observable.of()` | `of()` (standalone import) | Дерево-шейкабельные импорты |

### Миграция `.toPromise()` → `firstValueFrom()`

```typescript
// Angular 8 / RxJS 6
const user = await this.http.get('/api/user').toPromise();

// Angular 20 / RxJS 7
const user = await firstValueFrom(this.http.get('/api/user'));
```

### Pipeable operators (правильный путь)

```typescript
// Angular 8: старый импорт (still works, но не рекомендуется)
import 'rxjs/add/operator/map';

// Angular 20: tree-shakeable импорт
import { map, filter, switchMap } from 'rxjs/operators';
```

---

## 8.9. Build: Angular CLI Evolution

| Версия | Бандлер | Время сборки | Размер бандла |
|--------|---------|-------------|---------------|
| Angular 8 | Webpack 4 + View Engine | ~8 min | ~12 MB |
| Angular 12 | Webpack 5 + Ivy | ~4 min | ~8 MB |
| Angular 17 | Webpack 5 + Ivy + ESBuild | ~2 min | ~4 MB |
| Angular 20 | Vite / ESBuild (по умолчанию) | ~30 sec | ~2.5 MB |

### ESBuild в Angular 17+

Angular 17 переключил сборщик на ESBuild для production build:

```bash
# Angular CLI uses ESBuild automatically:
ng build --configuration production

# Результат:
✓ Browser application bundle generation complete.
Initial chunk files | Names         |  Raw size
main-HASH.js        | main          | 245.56 kB |
polyfills-HASH.js   | polyfills     | 34.65 kB  |
styles-HASH.css     | styles        | 15.78 kB  |
                     | Initial Total | 295.99 kB |
```

---

## 8.10. Шпаргалка для Senior-интервью

### Ключевые ответы

| Вопрос | Ответ |
|--------|-------|
| **«Почему нельзя ng update за один шаг?»** | Node.js версии, RxJS breaking changes, View Engine → Ivy, TypeScript мажорные версии |
| **«Самая сложная часть миграции?»** | Замена заброшенных библиотек, несовместимых с Ivy — пришлось переписывать часть UI |
| **«Что дал переход на Signals?** | Zoneless — убрали Zone.js, точечное обновление DOM, нет утечек памяти, производительность +40% |
| **«Что с NgModule?»** | Полностью отказались, все компоненты Standalone, lazy loading в одну строку |
| **«Размер бандла?»** | С 12 MB до 2.5 MB (деревья-шейкабельные импорты + ESBuild) |

---

> **Подводный камень (Gotcha):** Если на собеседовании вас спросят, почему Angular 10 и 11 «пропускают» в рассказе — отвечайте: «Это промежуточные стабилизирующие релизы. Команда Angular выпускает 2 мажорные версии в год. Мы упоминаем только milestone-версии: 9 (Ivy), 12/13 (Standalone preview), 15 (Standalone stable), 17 (Signals), 20 (Zoneless)».

---

**Что дальше:** В Главе 9 — разбиение монолита на микросервисы с DDD, API Gateway, брокерами сообщений и Observability.

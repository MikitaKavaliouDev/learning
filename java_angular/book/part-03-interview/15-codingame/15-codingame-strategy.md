# Глава 15: Стратегия CodinGame для ESN

Почти все крупные французские ESN (Capgemini, Sopra Steria, Devoteam, Atos) используют платформу **CodinGame** (или **CoderPad**) для предварительного технического отбора. Тест состоит из 2-3 алгоритмических задач и 10-15 MCQ (multiple-choice questions) по Java Core и Angular.

Эта глава — ваш тактический план: как подготовиться, какие задачи бывают, как распределять время и какие ошибки не допускать.

---

## 1. Как проходят тесты во французских ESN

### Общая схема отбора:

```
1. HR-звонок (15-20 мин)
     └── Французский рекрутер проверяет мотивацию и язык
2. Технический тест на CodinGame (60-90 мин)
     └── Алгоритмы + теория (Java / Angular)
3. Техническое интервью с лидом (1-2 часа)
     └── Архитектура, System Design, код-ревью
4. Финальное интервью с клиентом (1 час)
     └── Французский / Английский, soft skills
```

### Что конкретно бывает на этапе CodinGame:

| Тип задания | Количество | Время | Примеры |
|-------------|-----------|-------|---------|
| Алгоритмическая задача | 2-3 шт | 60 мин | «Температуры», «ASCII Art», «Skynet Revolution» |
| MCQ по Java | 10-15 шт | 15 мин | Overloading vs Overriding, Collections, Streams |
| MCQ по Angular | 5-10 шт | 15 мин | Subjects, Lifecycle Hooks, RxJS |

### Почему CodinGame, а не LeetCode?

Французские ESN используют CodinGame по нескольким причинам:
- **Интеграция с ATS (Greenhouse, Lever):** рекрутеры видят результаты сразу
- **Codingame Assessment:** платформа, которая проверяет задачи на 100+ тестовых кейсах
- **Языковая поддержка:** Java, TypeScript, Python — любой стек
- **Уровень сложности:** Medium, редко Hard — ESN не ищет олимпиадников

---

## 2. Типовые задачи по категориям

### Строки и массивы (50% задач)

1. **Температуры (Closest to Zero)** — самая популярная задача
   - Массив температур, найти ближайшую к 0
   - Если две равноудалены — выбрать положительную

2. **ASCII Art** — работа со строками и циклами
   - Преобразовать строку в ASCII-арт по заданному алфавиту

3. **Анаграммы** — проверка на перестановку символов
   - `listen` → `silent`

4. **Сжатие строк** — Run-length encoding
   - `"aaabbc"` → `"a3b2c1"`

5. **Палиндромы** — проверка зеркальности строки
   - `"radar"` → `true`

### Структуры данных (30% задач)

6. **Хэш-таблицы (HashMap)** — поиск дубликатов
   - Найти первый неповторяющийся символ в строке

7. **Стеки и очереди** — проверка скобочной последовательности
   - `"({[]})"` → `true`

8. **Связные списки** — разворот списка
   - Reverse linked list

9. **Бинарные деревья** — обходы (BFS/DFS)
   - Найти максимальную глубину дерева

10. **Графы** — поиск пути
    - BFS для поиска кратчайшего пути в лабиринте

### Динамическое программирование (15% задач)

11. **Fibonacci** — рекурсия + мемоизация

12. **Levenshtein Distance** — редакционное расстояние строк

13. **Рюкзак (Knapsack)** — задача о рюкзаке (редко, но бывает)

### Математика (5% задач)

14. **Решето Эратосфена** — поиск простых чисел

15. **Наибольший общий делитель (НОД)** — алгоритм Евклида

---

## 3. Стратегия «Сначала брутфорс → потом оптимизация → потом чистый код»

На собеседовании (и на CodinGame) важно показать **процесс мышления**, а не просто сдать задачу.

### Фаза 1: Брутфорс (первые 5 минут)

Напишите самое простое решение, которое приходит в голову. Даже если оно O(n²) или O(2ⁿ).

```java
// Брутфорс: найти ближайшую к нулю температуру
public static int closestToZero(int[] ts) {
    if (ts == null || ts.length == 0) return 0;
    int closest = ts[0];
    for (int t : ts) {
        if (Math.abs(t) < Math.abs(closest) || 
            (Math.abs(t) == Math.abs(closest) && t > closest)) {
            closest = t;
        }
    }
    return closest;
}
```

**Зачем:** Проверить, что вы понимаете условие и умеете писать код.

### Фаза 2: Оптимизация (следующие 10 минут)

Подумайте, как улучшить решение. Можно ли использовать другую структуру данных? Есть ли Streams API?

```java
// Оптимизированная версия с Streams API
public static int closestToZero(int[] ts) {
    return Arrays.stream(ts)
        .boxed()
        .min(Comparator.comparingInt(Math::abs)
            .thenComparing(Comparator.reverseOrder()))
        .orElse(0);
}
```

**Зачем:** Показать, что вы знаете современный Java.

### Фаза 3: Чистый код (оставшиеся 5 минут)

Добавьте обработку граничных случаев, осмысленные имена, JavaDoc.

```java
/**
 * Находит температуру, наиболее близкую к нулю.
 * Если две температуры равноудалены, возвращает положительную.
 * @param ts массив температур
 * @return ближайшая к нулю температура, или 0 если массив пуст
 */
public static int computeClosestToZero(int[] ts) {
    if (ts == null || ts.length == 0) {
        return 0;
    }
    
    return Arrays.stream(ts)
        .boxed()
        .min(Comparator.<Integer, Integer>comparing(Math::abs)
            .thenComparing(Comparator.reverseOrder()))
        .orElse(0);
}
```

---

## 4. Как распределять время (60 минут)

```
┌─────────────────────────────────────────────────────────┐
│ 60 минут на 2 задачи:                                    │
│                                                          │
│ Задача 1 (лёгкая)        ──── 25 минут                   │
│   ├── Чтение условия      5 мин                          │
│   ├── Решение (брутфорс)  10 мин                         │
│   ├── Оптимизация         5 мин                          │
│   └── Чистка кода         5 мин                          │
│                                                          │
│ Задача 2 (средняя)       ──── 30 минут                   │
│   ├── Чтение условия      5 мин                          │
│   ├── Решение            15 мин                          │
│   ├── Оптимизация         5 мин                          │
│   └── Чистка кода         5 мин                          │
│                                                          │
│ Резерв                   ──── 5 минут                    │
│   └── Проверка, компиляция, отправка                     │
└─────────────────────────────────────────────────────────┘
```

### Правила тайм-менеджмента:

1. **Не пишите код, не прочитав условие до конца.** CodinGame любит давать сноски внизу страницы
2. **Если застряли на 15 минут — переходите к следующей задаче.** Лучше сдать 2 задачи на 80%, чем 1 на 100%
3. **Оставьте 5 минут на проверку:** убедитесь, что код компилируется и проходит примеры из условия
4. **Не пытайтесь сдать задачу на 100% тестов.** CodinGame Assessment обычно пропускает при 70-80% успешных кейсов

---

## 5. Java-specific: Scanner, BufferedReader, выбор коллекции

### Ввод данных (чтение с консоли)

На CodinGame данные подаются через `System.in`. У вас есть два основных инструмента:

**Scanner (простой, медленный):**
```java
Scanner scanner = new Scanner(System.in);
int n = scanner.nextInt();          // читаем число
String s = scanner.nextLine();      // читаем строку
```

**BufferedReader (быстрый, рекомендуется):**
```java
BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
int n = Integer.parseInt(br.readLine());
String s = br.readLine();
```

**Gotcha:** После `scanner.nextInt()` или `scanner.next()` остаётся символ новой строки. Следующий `scanner.nextLine()` прочитает пустую строку. Всегда ставьте `scanner.nextLine()` после `nextInt()`.

```java
int n = scanner.nextInt();
scanner.nextLine(); // съедаем лишний перенос строки
String line = scanner.nextLine(); // теперь читаем нормально
```

### Выбор коллекции — шпаргалка

| Нужно | Java коллекция | Аналог в JS |
|-------|---------------|-------------|
| Упорядоченный список | `ArrayList<T>` | `Array` |
| Быстрый поиск по ключу | `HashMap<K, V>` | `Map` |
| Уникальные элементы | `HashSet<T>` | `Set` |
| FIFO очередь | `Queue<T>` / `LinkedList<T>` | Нет встроенного |
| LIFO стек | `Deque<T>` / `ArrayDeque<T>` | Нет встроенного |
| Сортированный набор | `TreeSet<T>` | Нет аналога |
| Сортированная пара ключ-значение | `TreeMap<K, V>` | Нет аналога |

### Правило выбора (для собеседования):

- **ArrayList** — 90% случаев (по индексу, перебор)
- **HashMap** — если нужен поиск по ключу за O(1)
- **HashSet** — если нужна уникальность элементов
- **ArrayDeque** — если нужен стек или очередь
- Избегайте `Vector`, `Stack`, `Hashtable` — они устаревшие (legacy)

---

## 6. Алгоритмы: что обязательно повторить

### Big O notation (оценка сложности)

| Алгоритм | Лучший случай | Средний | Худший |
|----------|---------------|---------|--------|
| Быстрая сортировка | O(n log n) | O(n log n) | O(n²) |
| Слиянием | O(n log n) | O(n log n) | O(n log n) |
| Пузырьковая | O(n) | O(n²) | O(n²) |
| Бинарный поиск | O(1) | O(log n) | O(log n) |
| Линейный поиск | O(1) | O(n) | O(n) |
| HashMap get/put | O(1) | O(1) | O(n) |
| ArrayList get | O(1) | O(1) | O(1) |
| ArrayList add | O(1) | O(1) | O(n) |

### Шпаргалка: структуры данных и их сложность

```
ArrayList:
  - get(index):        O(1) ← быстро
  - add(element):      O(1) ← быстро (конец списка)
  - add(index, elem):  O(n) ← медленно (сдвиг)
  - remove(index):     O(n) ← медленно (сдвиг)
  - contains(elem):    O(n) ← медленно (перебор)

LinkedList:
  - get(index):        O(n) ← медленно (перебор)
  - add(element):      O(1) ← очень быстро
  - remove(element):   O(1) ← очень быстро (если знаем узел)

HashMap:
  - put(key, value):   O(1) ← очень быстро
  - get(key):          O(1) ← очень быстро
  - containsKey(key):  O(1) ← очень быстро

HashSet:
  - add(element):      O(1) ← очень быстро
  - contains(elem):    O(1) ← очень быстро

TreeSet / TreeMap:
  - add/put:           O(log n) ← сбалансированное дерево
  - contains:          O(log n)
  - sorted order:      Автоматически
```

### Алгоритмы, которые нужно уметь писать с закрытыми глазами:

```java
// 1. Бинарный поиск (Binary Search)
int binarySearch(int[] arr, int target) {
    int left = 0, right = arr.length - 1;
    while (left <= right) {
        int mid = left + (right - left) / 2;
        if (arr[mid] == target) return mid;
        if (arr[mid] < target) left = mid + 1;
        else right = mid - 1;
    }
    return -1;
}

// 2. Разворот строки
String reverse(String s) {
    return new StringBuilder(s).reverse().toString();
}

// 3. Палиндром
boolean isPalindrome(String s) {
    int i = 0, j = s.length() - 1;
    while (i < j) {
        if (s.charAt(i) != s.charAt(j)) return false;
        i++; j--;
    }
    return true;
}

// 4. Проверка скобочной последовательности
boolean isValidBrackets(String s) {
    Map<Character, Character> map = Map.of(')', '(', ']', '[', '}', '{');
    Deque<Character> stack = new ArrayDeque<>();
    for (char c : s.toCharArray()) {
        if (map.containsValue(c)) {
            stack.push(c);
        } else if (stack.isEmpty() || stack.pop() != map.get(c)) {
            return false;
        }
    }
    return stack.isEmpty();
}
```

---

## 7. Типичные ошибки на CodinGame

### Ошибка 1: Не прочитали условие до конца
CodinGame иногда подсовывает задачи с двойным дном. Например: «Найти ближайшую к нулю температуру» — казалось бы, просто. Но в условии есть скрытое требование: «При равенстве отдавать предпочтение положительной температуре». Если не заметить — задача провалена.

**Решение:** Читайте условие 2 раза. Второй раз — ищите скрытые ограничения.

### Ошибка 2: Забыли обработать null или пустой ввод
```java
public static int closestToZero(int[] ts) {
    // ts может быть null или пустым!
    int closest = ts[0]; // NullPointerException!
}
```

**Решение:** Всегда проверяйте `null` и `.length == 0`.

### Ошибка 3: Неверный парсинг ввода
CodinGame подаёт данные построчно. Частая ошибка — прочитать все строки, но забыть про символ новой строки.

```java
// Неправильно:
int n = scanner.nextInt();
String[] lines = new String[n];
for (int i = 0; i < n; i++) {
    lines[i] = scanner.nextLine(); // Первая итерация прочитает пустую строку!
}

// Правильно:
int n = scanner.nextInt();
scanner.nextLine(); // Съедаем перенос строки
String[] lines = new String[n];
for (int i = 0; i < n; i++) {
    lines[i] = scanner.nextLine();
}
```

### Ошибка 4: Бесконечный цикл
Если ввод не соответствует ожидаемому формату, цикл может стать бесконечным.

**Решение:** Ограничьте количество итераций на этапе отладки.

### Ошибка 5: Использование HashMap без equals() и hashCode()
Если вы кладёте кастомный объект в HashMap или HashSet, убедитесь, что у него правильно переопределены `equals()` и `hashCode()`. Иначе объекты не будут найдены.

### Ошибка 6: Не смотрите на ограничения (Constraints)
CodinGame даёт ограничения:
```
0 < N < 100000
-1000 < температура < 1000
```

Если N может быть 100 000, ваш O(n²) алгоритм упадёт по времени. Выбирайте O(n log n) или O(n).

### Ошибка 7: Отправляете код с `System.out.println` для отладки
CodinGame проверяет `System.out`. Если вы оставили отладочную печать, тесты упадут.

**Решение:** Удалите все отладочные `System.out.println` перед отправкой.

### Ошибка 8: Не смотрите на количество тестов
CodinGame может иметь 20+ тестов, из которых видимы только 2-3 примера. Не думайте, что «у меня всё работает, раз примеры проходят». Проверьте граничные случаи.

---

## 8. MCQ по Java Core (что обязательно повторить)

На CodinGame Assessment есть блок MCQ (multiple-choice questions). Вот типичные темы:

### Java Core (топ-10 вопросов):
1. Overloading vs Overriding — разрешаются на каком этапе?
2. Abstract class vs Interface — что может иметь state?
3. Access modifiers — `protected` доступен где?
4. `String`, `StringBuilder`, `StringBuffer` — кто immutable?
5. `equals()` vs `==` — что сравнивает ссылки?
6. Checked vs Unchecked exceptions — `RuntimeException` какой?
7. Generics — что такое type erasure?
8. Collections — `HashMap` vs `TreeMap` vs `LinkedHashMap`
9. `==` для Integer (autoboxing) — `Integer.valueOf(127)` vs `128`
10. `static` — что можно вызывать в статическом контексте?

### Spring Boot (топ-5 вопросов):
1. `@Component` vs `@Service` vs `@Repository`
2. `@Transactional` — self-invocation проблема
3. `@Autowired` — constructor vs field injection
4. `@RequestMapping` vs `@GetMapping`
5. `@SpringBootApplication` — что внутри?

### Angular / RxJS (топ-5 вопросов):
1. Subject vs BehaviorSubject vs ReplaySubject
2. `async` pipe — отписывается ли автоматически?
3. `switchMap` vs `mergeMap` vs `concatMap`
4. `@Input()` и `@Output()` — Signals vs декораторы
5. Standalone Components — что такое `standalone: true`

---

## 9. Практические советы

### За день до теста:
- Решите 2-3 задачи на CodinGame (бесплатный тренажёр)
- Повторите Java Streams API: `map`, `filter`, `reduce`, `collect`
- Проверьте, что IntelliJ IDEA настроена под Java 21
- Скачайте шаблон класса Solution (CodinGame ожидает именно его)

### Шаблон Solution для CodinGame:

```java
import java.util.*;

public class Solution {
    public static void main(String args[]) {
        Scanner in = new Scanner(System.in);
        
        // Чтение ввода
        int n = in.nextInt();
        in.nextLine();
        
        // Решение
        String result = solve(n, in);
        
        // Вывод
        System.out.println(result);
    }
    
    public static String solve(int n, Scanner in) {
        // Ваша логика здесь
        return "answer";
    }
}
```

### За 30 минут до теста:
- Убедитесь, что интернет стабилен
- Закройте лишние вкладки браузера
- Откройте CodinGame в режиме тренажёра (разомнитесь)

### Во время теста:
1. Прочитайте ВСЕ задачи сразу (оцените сложность)
2. Начните с самой лёгкой (поднимите самооценку)
3. На каждую задачу — сначала прочитайте условие, потом пишите код
4. Используйте **BufferedReader** для производительного ввода
5. После решения — проверьте граничные случаи (null, пустой ввод, min/max значения)
6. Удалите отладочный вывод перед отправкой

---

## 10. Ресурсы для подготовки

### Бесплатные:
- **CodinGame** — тренажёр с задачами прошлых лет (бесплатно)
- **LeetCode** — задачи Easy/Medium на Java
- **HackerRank** — Java Domain (30 дней Java)
- **CodeSignal** — Arcade Mode

### Платные (но эффективные):
- **CodinGame Assessment** — симулятор реального теста
- **JetBrains Academy** — Java трек + алгоритмы
- **Алгосы на Java** — книга и курс от Яндекса

---

## Резюме главы

- Французские ESN используют CodinGame для первичного отбора — 2 задачи + MCQ
- Типовые задачи: строки, массивы, HashMap, BFS/DFS, динамика
- Стратегия: брутфорс → оптимизация → чистый код
- Тайм-менеджмент: 25 мин на лёгкую, 30 на среднюю, 5 на проверку
- Java-specific: используйте BufferedReader, проверяйте граничные случаи
- Типичные ошибки: невнимательное чтение условия, забытый `scanner.nextLine()`, отладочный вывод
- MCQ: повторите Overloading/Overriding, Collections, RxJS Subjects

**Главное правило:** CodinGame проверяет не столько гениальность, сколько базовую готовность. Если вы спокойно решаете 2 задачи средней сложности на Java за 60 минут — вы проходите.

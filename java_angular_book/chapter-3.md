# CHAPTER 3: The Engine Block
### *Modern Java Mechanics: Java 17/21, Concurrency, Virtual Threads & The Memory Model*

> If the engine block is poorly engineered, the whole airport crawls to a halt.

---

### 1. THE MENTAL MODEL — The Underground Service Tunnel

Imagine the airport's **underground service tunnel** — the single road that feeds every terminal, warehouse, and vault. Every passenger request, baggage scan, and payment must travel this road. How you staff that road determines whether the airport flows or freezes.

#### Act 1: The Old Fleet — Platform Threads (Heavy Trucks)

Before Java 21, every incoming request got its own **heavy diesel semi-truck**.

* **One request = One truck.** And one truck needs one **licensed driver** (an OS Kernel Thread) and one **full parking lane** (~1MB of stack memory) — even if it's only carrying a single envelope.
* **Why it hurts:** A real server has only ~2,000–5,000 lanes. At 3,000 trucks, the road gridlocks from lane-switching overhead (OS context switching).
* **The fatal wait:** When a truck backs into a loading dock to wait 200ms for a database reply, the driver turns off the engine and sleeps in the cabin. **The entire lane stays blocked.** No one else can use it.

```
 THE OLD ROAD: One Lane Per Truck (Platform Thread)

 Lane 1: [==== TRUCK 1 ====]  →  waiting at dock (BLOCKED, driver sleeping)
 Lane 2: [==== TRUCK 2 ====]  →  waiting at dock (BLOCKED)
 Lane 3: [==== TRUCK 3 ====]  →  driving
         ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
 Request 4 arrives →  ❌ NO LANE FREE → must wait outside
```

Three trucks waiting = three lanes wasted.

#### Act 2: The New Fleet — Virtual Threads (Drones on Carrier Carts)

Java 21 (Project Loom) replaces trucks with **a swarm of lightweight electric drones**.

* **One request = One drone.** A drone weighs almost nothing (a few kilobytes on the Heap, not a 1MB lane). You can launch **1,000,000** at once.
* **Drones share carrier carts.** Underneath, there are only ~16 carrier carts (OS Carrier Threads = your CPU cores). A drone *borrows* a cart only while it is moving.
* **The magic — stepping off:** When a drone reaches a loading dock and must wait for a reply, it **hops off the cart** and waits on the sidewalk. The cart **instantly picks up the next waiting drone**. No lane is ever blocked.

```
 THE NEW ROAD: Drones Share a Few Carts (Virtual Thread)

 Waiting Drones:  (o) (o) (o) (o) ... 1,000,000 — tiny, parked on sidewalk

 Carrier Cart 1:  [ (o) → driving ]  →  reaches dock → (o) hops OFF → Cart picks next (o)
 Carrier Cart 2:  [ (o) → driving ]  →  same
 ...
 Cart 16:         [ (o) → driving ]

 Result: ✔ Millions of tasks, ✔ Zero blocked lanes, ✔ Cart never sleeps
```

> **One-liner to remember:** Platform Thread *owns* the lane while waiting. Virtual Thread *releases* the lane while waiting.

#### Act 3: Where the Work Happens — Stack, Heap & Janitors

The tunnel needs two work areas:

```
 [Worker's Private Clipboard]          [Shared Cargo Floor]

  ┌─────────────────────┐              ┌─────────────────────────────┐
  │ STACK (per thread)  │              │ HEAP (shared by all)        │
  │                     │              │                             │
  │ • Your own notes    │              │ • All boxes (Objects) live  │
  │ • Method calls      │──reference──►│ • Anyone with a slip can    │
  │ • Local primitives  │              │   open/move a box           │
  │                     │              └─────────────────────────────┘
  │ Shredded when       │                        ▲
  │ method returns.     │                        │ abandoned boxes
  │ No cleaning needed. │              ┌─────────────────────┐
  └─────────────────────┘              │ JANITORS (GC)       │
                                       │ Sweep abandoned     │
                                       │ crates when no one  │
                                       │ holds a slip.       │
                                       └─────────────────────┘
```

* **Stack = Private clipboard.** Each worker (thread) has one. You write local variables and method calls on it. When the task ends, you shred that page. No janitor needed.
* **Heap = Shared cargo floor.** All objects sit here. Any thread with a reference can touch them.
* **Garbage Collector = Janitor fleet.** They find crates no one references anymore and clear space. (How they clean — see table in Mechanics below. You don't need the detail to picture the floor.)

#### Sidebar: ID Badges — Records & Sealed Classes

Not engine power, but engine *safety*. Two rules you can picture in 10 seconds:

* **Record = Data Receipt.** A shortcut to create a simple, read-only class that just holds data. One line `record Person(String name, int age)` gives you constructor + getters + `toString`/`equals`/`hashCode` automatically. No `setName()` — like a printed receipt, you can't erase it, you reprint a new one.
* **Sealed = VIP Guest List.** A class that controls exactly who can extend it. `sealed class Payment permits CreditCard, PayPal, Crypto` means only those 3 are allowed. `class Cash extends Payment` → ❌ compile error. No surprise 4th type can sneak in, so `switch` needs no `default`.

---

### 2. THE MECHANICS

#### 2.1 Java 17/21 Type System: Records, Sealed Classes & Pattern Matching

##### What is a Record?
> **In short:** A **Record** is a shortcut to create a simple, read-only class that just holds data.

Normally you write a lot of repetitive code (constructor, getters, `toString()`, `equals()`, `hashCode()`). A Record generates it all for you.

```java
public record Person(String name, int age) {}
```
With just this one line, you get:
* Private, final fields (`name` and `age`)
* A constructor to initialize them
* Methods to read them: `name()` and `age()` (no setters)
* Built-in `toString()`, `equals()`, and `hashCode()`

Like a **data receipt**: simple, fixed, just shows data. You cannot erase it — you print a new one.

##### What is a Sealed Class?
> **In short:** A **Sealed Class** controls exactly which other classes are allowed to extend it.

Normally any class can inherit unless marked `final` (blocks everyone). A sealed class is a **VIP guest list** — you decide who gets in.

```java
public sealed class Payment permits CreditCard, PayPal, Crypto {}

final class CreditCard extends Payment {}
final class PayPal extends Payment {}
final class Crypto extends Payment {}
// class Cash extends Payment → ❌ compile error — not on VIP list
```

##### Key Differences

| Feature | **Record** | **Sealed Class** |
| :--- | :--- | :--- |
| **Main Purpose** | To hold data with minimal boilerplate | To restrict class inheritance |
| **Problem solved** | Eliminates repetitive getters/constructors/`equals` | Prevents unauthorized subclasses, makes `switch` safe |
| **State** | Implicitly immutable (read-only) | Can hold any state |
| **Inheritance** | Cannot extend others (implicitly `final`) | Can be parent, but specifies its children |
| **Analogy** | **Data receipt** | **VIP list** |

##### Can they work together? Yes — and they often do!

Records make perfect children for sealed hierarchies:

```java
// Sealed interface guarantees Result is ONLY Success or Error
public sealed interface Result permits Success, Error {}

public record Success(String data) implements Result {}
public record Error(String message) implements Result {}

// No default needed — compiler proves you handled both
String handle(Result r) {
    return switch (r) {
        case Success s -> "OK: " + s.data();
        case Error e -> "FAIL: " + e.message();
    };
}
```

##### Banking Example (same idea, real domain):

```java
package com.astek.banking.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;

// 1. SEALED INTERFACE: Only these 3 types can exist. Compiler enforces it.
public sealed interface FinancialInstrument 
    permits FiatCurrency, CryptoAsset, CommodityContract {}

// 2. RECORD: Immutable badge. Validation runs once at creation, then never changes.
public record FiatCurrency(
    String currencyCode, 
    BigDecimal balance, 
    Instant lastAudited
) implements FinancialInstrument {

    // Compact Constructor: validation before the badge is laminated
    public FiatCurrency {
        Objects.requireNonNull(currencyCode, "Currency code cannot be null");
        Objects.requireNonNull(balance, "Balance cannot be null");
        if (balance.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Account balance cannot be negative!");
        }
        if (currencyCode.length() != 3) {
            throw new IllegalArgumentException("ISO code must be exactly 3 letters");
        }
    }
}

public record CryptoAsset(String walletAddress, BigDecimal coinAmount) implements FinancialInstrument {}
public record CommodityContract(String warehouseLotId, double metricTons) implements FinancialInstrument {}
```

##### Exhaustive Pattern Matching — no `default` needed:

```java
package com.astek.banking.service;

import com.astek.banking.domain.*;
import org.springframework.stereotype.Service;

@Service
public class SettlementAuditService {

    // Compiler guarantees: if you add a 4th FinancialInstrument later,
    // this switch FAILS TO COMPILE until you handle it. No runtime surprise.
    public String calculateAuditRisk(FinancialInstrument instrument) {
        return switch (instrument) {
            case FiatCurrency fiat when fiat.balance().compareTo(new java.math.BigDecimal("1000000")) > 0 ->
                "HIGH_VALUE_FIAT: Immediate central bank reporting required.";
            
            case FiatCurrency fiat -> 
                "STANDARD_FIAT: Cleared for SEPA / SWIFT.";
                
            case CryptoAsset crypto -> 
                "CRYPTO_VOLATILITY: Enhanced AML / On-chain inspection.";
                
            case CommodityContract commodity -> 
                "PHYSICAL_LOGISTICS: Verify vault slot: " + commodity.warehouseLotId();
        };
    }
}
```

> **Why it matters:** Records give you immutability + thread-safety for free. Sealed + `switch` turns "forgot to handle new type" from a production bug into a compile error.

---

#### 2.2 Concurrency Evolution: Project Loom & Virtual Threads (Java 21)

Before Java 21, high throughput meant reactive code (WebFlux/Reactor) — powerful but hard to read, hard to debug.

**Virtual Threads give you simple blocking code with reactive-scale performance.**

```java
package com.astek.logistics.concurrency;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.Executors;

@Slf4j
@Service
public class HighThroughputWarehouseScanner {

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(2))
            .build();

    // BEFORE Java 17: 50,000 trucks = OutOfMemoryError (no lanes left)
    // AFTER  Java 21: 50,000 drones = OK (all share 16 carts)
    public void scanAllDistributionNodes(List<String> nodeUrls) {
        // One lightweight drone per URL. No thread pool sizing needed.
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            
            for (String url : nodeUrls) {
                executor.submit(() -> {
                    log.info("Inspecting Node: {} on {}", url, Thread.currentThread());
                    
                    HttpRequest request = HttpRequest.newBuilder()
                            .uri(URI.create(url)).GET().build();

                    // BLOCKING call — but JVM does the magic:
                    // Drone hops OFF carrier cart while waiting. Cart runs next drone.
                    HttpResponse<String> response = httpClient.send(
                            request, HttpResponse.BodyHandlers.ofString());
                    
                    log.info("Received status {} from {}", response.statusCode(), url);
                    return response.body();
                });
            }
        } // executor.close() waits for all drones to finish
    }
}
```

**How the scheduler works:**
1. JVM keeps a `ForkJoinPool` of carrier carts (size = CPU cores).
2. Drone borrows a cart to run.
3. On blocking I/O (socket, DB), JVM saves the drone's state, parks it on the sidewalk, frees the cart.
4. When data arrives, scheduler puts the drone back on any free cart.

#### 2.3 The Java Memory Model (JMM) & Why `volatile` Matters

Each CPU core has its own **sticky note (L1/L2 cache)**. Without rules, Core 1's update stays on its sticky note — Core 2 never sees it on the shared whiteboard (Main RAM).

```
 Core 1: [ sticky note: balance = 500 ] ─┐
                                         ├─► Whiteboard (RAM): balance = 0  ❌ STALE!
 Core 2: [ sticky note: balance = 0   ] ─┘     Core 2 still sees old value
```

*Fix:* Tell everyone to use the whiteboard directly.

##### The `volatile` Keyword — "Always use the whiteboard"

Marking a field `volatile` means: **read/write straight to Main RAM, and don't reorder instructions around it.** It creates a Happens-Before guarantee.

```java
public class TerminalEmergencyShutdown {
    // volatile = everyone sees the change instantly. No stale sticky note.
    private volatile boolean shutdownRequested = false;

    public void triggerEmergencyStop() {
        this.shutdownRequested = true; // flushed directly to RAM
    }

    public void runRunwayMonitoring() {
        while (!shutdownRequested) {
            monitorSensors(); // CPU cannot cache this as "always false"
        }
        evacuateRunway();
    }

    private void monitorSensors() { /* check radar */ }
    private void evacuateRunway() { /* stop planes */ }
}
```

> **Crucial:** `volatile` fixes **visibility**, not **atomicity**. `count++` is 3 steps (read → add → write). Two drones doing it at once still collide. For counting, use `AtomicInteger` or `ReentrantLock`.

##### Quick Comparison: Janitor Strategies (GC)

| Feature | G1GC (Regional Janitors) | ZGC (Laser Scanners) |
|---|---|---|
| **How** | Splits warehouse into zones, cleans dirtiest zone incrementally | Color-coded lasers scan while workers keep moving |
| **Pause time** | ~100–200ms (still stops workers briefly) | **<1ms** even with 16TB heap |
| **When to use** | General apps, balanced throughput | SLA-critical: trading, settlements, real-time tracking |

Pick **ZGC** when a 4-second pause would miss a regulatory window.

---

### 3. THE ENTERPRISE PITFALLS

#### 💣 War Story: The Virtual Thread "Carrier Pinning" Disaster
* **Context:** Payment hub upgraded to Java 21 for 20,000 req/s.
* **The outage:** Latency jumped from 5ms → 45 seconds. JVM froze.
* **Root cause: Pinning.** A legacy util did blocking I/O inside `synchronized`:

```java
// ❌ PINS the drone to the cart — cart frozen for 500ms!
public class LegacyCryptoClient {
    private final Object lock = new Object();
    public byte[] signTransaction(byte[] payload) {
        synchronized (lock) { // Drone cannot hop off!
            return executeBlockingNetworkCall(payload); 
        }
    }
}
```
With only 16 carts, 16 pinned drones **exhausted the whole carrier pool**. The other 19,984 drones starved.

* **The fix:** Use `ReentrantLock` — it allows hopping off:

```java
// ✅ Drone hops off safely, cart stays free
public class ModernCryptoClient {
    private final ReentrantLock lock = new ReentrantLock();
    public byte[] signTransaction(byte[] payload) {
        lock.lock();
        try {
            return executeBlockingNetworkCall(payload); // unmounts cleanly
        } finally {
            lock.unlock();
        }
    }
}
```
> **Detect:** Run with `-Djdk.tracePinnedThreads=full` or check JFR event `jdk.VirtualThreadPinned`.

---

#### 💣 War Story: The 4.8-Second Settlement Freeze
* **Context:** Trading service on 64GB heap, default GC, at 9:00 AM market open.
* **Incident:** Short-lived DTOs triggered Full GC. **Stop-the-World pause: 4.8 seconds.** Clearing window missed, **€150,000 penalty.**
* **Fix:** Switch to Generational ZGC — sub-millisecond pauses regardless of heap size:
  ```bash
  -XX:+UseZGC -XX:+ZGenerational
  ```

---

### 4. THE INTERVIEW CHEAT SHEET

##### Q1: How do Virtual Threads differ from Platform Threads?
> **Platform Thread:** 1:1 wrapper around an OS thread. ~1MB stack, expensive lane-switch, blocks the OS lane on I/O.
> **Virtual Thread:** JVM-managed, KB stack on Heap, shares a `ForkJoinPool` of carriers. On blocking I/O, JVM unmounts it and reuses the carrier. Millions can run. Think: trucks owning lanes vs drones sharing carts.

##### Q2: What causes "Pinning" and how to fix it?
> Pinning = drone cannot hop off cart, so cart stays frozen. Happens inside `synchronized` or native JNI during blocking I/O. With 16 carts, 16 pinned = total freeze.
> **Detect:** `-Djdk.tracePinnedThreads=full` or JFR `jdk.VirtualThreadPinned`.
> **Fix:** Replace `synchronized` guarding I/O with `ReentrantLock`.

##### Q3: What does `volatile` and Happens-Before guarantee?
> Happens-Before = writes before an action are visible after it. `volatile` forces reads/writes to Main RAM (whiteboard), bypasses sticky-note caches, and prevents reordering around the barrier. It guarantees **visibility**, not **atomicity** — use `Atomic*` for `count++`.

##### Q4: What value do Records & Sealed Classes add?
> **Records (data receipt):** Immutable, read-only holders — one line replaces 60 lines of boilerplate (constructor/getters/`equals`/`toString`), thread-safe, validated at creation.
> **Sealed (VIP list):** Closed `permits` list of allowed children. With `switch` pattern matching, compiler enforces exhaustive handling — missing a case is a compile error, not a production bug.

##### Q5: G1GC vs Generational ZGC — when to pick ZGC?
> **G1GC:** Region-based, 100–200ms pauses, good throughput.
> **ZGC:** Concurrent with colored pointers + load barriers, **<1ms** pauses at any heap size, generational split for efficiency.
> Pick **ZGC** for ultra-low-latency, SLA-bound systems (settlements, trading, live logistics) where a multi-second pause violates regulation.

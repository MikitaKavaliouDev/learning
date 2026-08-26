# CHAPTER 7: The Aircraft Instrument Panel
### *Angular 14+ Core Architecture, Standalone Components, Lifecycle Hooks & Modern DI*

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    THE MODERN GLASS COCKPIT (ANGULAR 14+)                   │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │               AVIONICS DASHBOARD (Standalone Component)               │  │
│  │                                                                       │  │
│  │   ┌─────────────────────┐    ┌────────────────────────────────────┐   │  │
│  │   │   Altimeter Gauge   │    │      Radar HUD (Custom Directive)  │   │  │
│  │   │ (Child Standalone)  │    │      [Live Runway Telemetry Grid]  │   │  │
│  │   └──────────┬──────────┘    └─────────────────┬──────────────────┘   │  │
│  │              │                                 │                      │  │
│  │              ▼                                 ▼                      │  │
│  │     [ Pure Currency Pipe ]           [ Pure Distance Pipe ]           │  │
│  │     €1,450,000.00                    FL 380 (38,000 ft)               │  │
│  └──────────────┬─────────────────────────────────┬──────────────────────┘  │
│                 │                                 │                         │
│                 └────────────────┬────────────────┘                         │
│                                  │                                          │
│                                  ▼ inject()                                 │
│  ═══════════════════ ARINC 429 AVIONICS BUS (Hierarchical DI) ════════════  │
│                                  │                                          │
│     ┌────────────────────────────┴────────────────────────────┐             │
│     ▼                                                         ▼             │
│  [ TelemetryService ] (Root Singleton)             [ FlightSecurityService ]│
│  - Live Sensor WebSockets                          - Clearance Tokens & Role│
│  - Zero-Overhead Memory Footprint                  - Airfield Boundary Guard│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 1. THE MENTAL MODEL

Step inside the cockpit of a modern twin-engine jet airliner climbing through heavy turbulence at 35,000 feet.

In a vintage 1960s prop plane, the instrument panel was a rat's nest of physical copper vacuum tubes, mechanical gears, and 400 distinct analog dials hardwired into a single massive junction box in the cockpit floor. If a mechanical turn indicator jammed, an engineer had to tear out the entire dashboard (the legacy `NgModule`) just to replace one burned-out bulb.

**Modern Glass Cockpit Architecture (Angular 14+ Standalone Ecosystem)** revolutionizes the flight deck:

* **Standalone Components (Line-Replaceable Avionics Units - LRUs):** The primary flight display (PFD), the navigation radar, and the engine thrust gauges are self-contained, modular pods. They declare their own dependencies directly on their casing (`imports: [CommonModule, AltimeterComponent]`). You can swap out or lazy-load an instrument mid-flight without rewiring a central junction box (`NgModule`).
* **The Component Lifecycle (Pre-Flight, In-Flight & Post-Flight Checklists):** A flight instrument never displays live altitude before its sensors are powered and calibrated. 
  * `constructor()`: Assembling the metal casing on the factory floor (memory allocation).
  * `ngOnInit()`: Flipping the master battery switch and executing sensor calibration.
  * `ngOnChanges()`: Adjusting gauge needles when air pressure input data shifts.
  * `ngAfterViewInit()`: Ensuring the physical glass LCD screen has fully rendered before attaching high-refresh radar graphics.
  * `ngOnDestroy()`: Shutting down turbine telemetry listeners and cutting sensor power when the plane parks at the gate to prevent battery drain (memory leaks).
* **Hierarchical Dependency Injection (The Avionics Data Bus):** Instruments do not manufacture their own sensor data. They plug into the standardized avionics data harness using the modern `inject()` token mechanism. 
  * A service declared in `providedIn: 'root'` is the master pitot-static tube on the aircraft fuselage: every system on the plane reads the exact same calibrated airspeed.
  * A service provided at the `Component` level is an isolated battery backup dedicated strictly to the co-pilot’s auxiliary display.
* **Directives & Custom Pipes (Heads-Up Display HUD Transformers & Overlays):**
  * **Directives:** An infrared night-vision overlay projected directly onto the cockpit glass (`[appRunwayWarning]`), altering the behavior and appearance of existing components without rewriting them.
  * **Pipes:** A real-time unit converter on the HUD that transforms raw backend barometric millibars into human-readable flight levels (`1013.25 | flightLevel`) without altering the raw underlying sensor data.

---

### 2. THE MECHANICS

#### 2.1 The Standalone Revolution: Eliminating `NgModule`

In Angular 14+, components, directives, and pipes can be declared `standalone: true`. This removes intermediate `NgModule` boilerplate, makes dependencies explicit, enables optimal compiler tree-shaking, and simplifies component-based routing.

```
┌────────────────────────────────────────┐       ┌────────────────────────────────────────┐
│     LEGACY ANGULAR (v2 - v13)          │       │       MODERN ANGULAR (v14+)            │
│                                        │       │                                        │
│  [ SharedModule ] ◄── Bloated registry │       │  [ FlightTrackerComponent ]            │
│        ▲                               │       │  - standalone: true                    │
│        │ (Declares 60+ components)     │       │  - imports: [ GaugeComponent, Pipe ]   │
│  [ FlightModule ]                      │       │                                        │
│        ▲                               │       │  ✔ Direct, explicit dependencies       │
│        │                               │       │  ✔ Microsecond compilation & tree-shake│
│  [ CockpitComponent ]                  │       │  ✔ Granular lazy loading               │
└────────────────────────────────────────┘       └────────────────────────────────────────┘
```

---

#### 2.2 The Complete Angular Component Lifecycle Pipeline

Understanding the exact sequence of lifecycle hooks is critical to avoiding rendering inconsistencies and performance bottlenecks:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       ANGULAR COMPONENT LIFECYCLE                           │
│                                                                             │
│  [ 1. constructor() ]                                                       │
│       │  Plain TypeScript class instantiation. Inputs NOT initialized yet.  │
│       ▼                                                                     │
│  [ 2. ngOnChanges() ]                                                       │
│       │  Fires before ngOnInit (if inputs exist) and whenever @Input()      │
│       │  references change. Receives SimpleChanges map.                     │
│       ▼                                                                     │
│  [ 3. ngOnInit() ]                                                          │
│       │  Component initialized. Inputs are populated. Safe for HTTP/setup.  │
│       ▼                                                                     │
│  [ 4. ngDoCheck() ]                                                         │
│       │  Custom change detection hook; executes on every change check cycle.│
│       ▼                                                                     │
│  [ 5. ngAfterContentInit() ] ──► [ 6. ngAfterContentChecked() ]             │
│       │  Projected content (<ng-content>) rendered into the component.      │
│       ▼                                                                     │
│  [ 7. ngAfterViewInit() ]    ──► [ 8. ngAfterViewChecked() ]                │
│       │  Component's view and child views are fully loaded into the DOM.    │
│       │  (DOM manipulation / ViewChild references ready).                   │
│       ▼                                                                     │
│  [ 9. ngOnDestroy() ]                                                       │
│          Component teardown. Unsubscribe from streams, disconnect timers.   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

#### 2.3 Modern Dependency Injection: Constructor vs. `inject()`

Angular 14 introduced the `inject()` function, providing a functional, type-safe alternative to constructor parameter injection. It enables clean inheritance patterns and reusable injection utilities.

```typescript
import { Injectable, inject, InjectionToken } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface TelemetryConfig {
  updateFrequencyMs: number;
  telemetryEndpoint: string;
}

export const TELEMETRY_CONFIG = new InjectionToken<TelemetryConfig>('TELEMETRY_CONFIG', {
  providedIn: 'root',
  factory: () => ({
    updateFrequencyMs: 500,
    telemetryEndpoint: '/api/v1/telemetry'
  })
});

@Injectable({
  providedIn: 'root' // Singleton at application root level
})
export class TelemetryService {
  // Functional Dependency Injection (No constructor parameter pollution!)
  private readonly http = inject(HttpClient);
  private readonly config = inject(TELEMETRY_CONFIG);

  getAirspeedSensorStream(flightId: string): Observable<SensorReading> {
    return this.http.get<SensorReading>(`${this.config.telemetryEndpoint}/${flightId}/speed`);
  }
}
```

##### Hierarchical Injector Resolution:
When a component requests a dependency via `inject(Token)`, Angular traverses up the injector hierarchy:

1. **`ElementInjector`:** Looks at the component's own `providers` array $\rightarrow$ then its parent components' `providers` $\rightarrow$ up to the root DOM tree node.
2. **`EnvironmentInjector`:** If not found in the DOM hierarchy, checks the route providers $\rightarrow$ the root injector (`providedIn: 'root'`) $\rightarrow$ the platform injector.
3. If not found anywhere, throws `NullInjectorError: No provider for Token!` (unless decorated with `@Optional()` or `inject(Token, { optional: true })`).

---

#### 2.4 Production Implementation: The Flight Control Dashboard

Here is an enterprise-grade standalone component combining **Strict TypeScript interfaces**, **Standalone Architecture**, **Lifecycle Hooks**, **Directives**, and **Custom Pure Pipes**.

##### 1. Pure Transformation Pipe (`flight-level.pipe.ts`)
```typescript
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'flightLevel',
  standalone: true,
  pure: true // Evaluated ONLY when the input primitive reference changes
})
export class FlightLevelPipe implements PipeTransform {
  /**
   * Transforms raw altitude in feet to standard aviation Flight Level (FL)
   * Example: 38000 -> "FL 380", 4500 -> "4,500 ft (Transition Alt)"
   */
  transform(altitudeFeet: number | null | undefined): string {
    if (altitudeFeet == null || isNaN(altitudeFeet)) {
      return 'FL ---';
    }
    if (altitudeFeet >= 18000) {
      const fl = Math.round(altitudeFeet / 100);
      return `FL ${fl}`;
    }
    return `${altitudeFeet.toLocaleString('en-US')} ft`;
  }
}
```

##### 2. Custom Directive for Runway Status (`runway-clearance.directive.ts`)
```typescript
import { Directive, ElementRef, Input, OnChanges, SimpleChanges, inject, Renderer2 } from '@angular/core';

export type ClearanceStatus = 'CLEARED_LANDING' | 'HOLDING' | 'EMERGENCY_ABORT';

@Directive({
  selector: '[appRunwayClearance]',
  standalone: true
})
export class RunwayClearanceDirective implements OnChanges {
  private readonly el = inject(ElementRef);
  private readonly renderer = inject(Renderer2);

  @Input('appRunwayClearance') status!: ClearanceStatus;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['status']) {
      this.applySecurityStyling(this.status);
    }
  }

  private applySecurityStyling(status: ClearanceStatus): void {
    let bg = '#1e293b';
    let text = '#f8fafc';
    let border = '#475569';

    switch (status) {
      case 'CLEARED_LANDING':
        bg = '#065f46';
        border = '#10b981';
        break;
      case 'HOLDING':
        bg = '#854d0e';
        border = '#eab308';
        break;
      case 'EMERGENCY_ABORT':
        bg = '#991b1b';
        border = '#ef4444';
        break;
    }

    this.renderer.setStyle(this.el.nativeElement, 'backgroundColor', bg);
    this.renderer.setStyle(this.el.nativeElement, 'color', text);
    this.renderer.setStyle(this.el.nativeElement, 'border', `2px solid ${border}`);
    this.renderer.setStyle(this.el.nativeElement, 'borderRadius', '6px');
    this.renderer.setStyle(this.el.nativeElement, 'padding', '8px 12px');
    this.renderer.setStyle(this.el.nativeElement, 'fontWeight', 'bold');
  }
}
```

##### 3. Standalone Cockpit Instrument Component (`cockpit-panel.component.ts`)
```typescript
import { 
  Component, 
  OnInit, 
  OnChanges, 
  OnDestroy, 
  SimpleChanges, 
  Input, 
  ChangeDetectionStrategy,
  inject 
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FlightLevelPipe } from './flight-level.pipe';
import { RunwayClearanceDirective, ClearanceStatus } from './runway-clearance.directive';
import { TelemetryService } from './telemetry.service';
import { Subscription } from 'rxjs';

export interface AircraftFlightState {
  flightNumber: string;
  altitudeFeet: number;
  groundSpeedKnots: number;
  clearance: ClearanceStatus;
}

@Component({
  selector: 'app-cockpit-panel',
  standalone: true,
  imports: [CommonModule, FlightLevelPipe, RunwayClearanceDirective],
  template: `
    <div class="cockpit-container">
      <header class="panel-header">
        <h2>Primary Flight Telemetry Display</h2>
        <span class="flight-tag">{{ flightState.flightNumber }}</span>
      </header>

      <section class="instruments-grid">
        <div class="instrument-box">
          <label>Calibrated Altitude</label>
          <div class="reading-value">{{ flightState.altitudeFeet | flightLevel }}</div>
        </div>

        <div class="instrument-box">
          <label>Ground Speed</label>
          <div class="reading-value">{{ flightState.groundSpeedKnots }} kts</div>
        </div>

        <div class="instrument-box">
          <label>Air Traffic Clearance</label>
          <div [appRunwayClearance]="flightState.clearance" class="status-indicator">
            {{ flightState.clearance }}
          </div>
        </div>
      </section>
    </div>
  `,
  styleUrls: ['./cockpit-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CockpitPanelComponent implements OnInit, OnChanges, OnDestroy {
  // Injected via Modern Functional DI
  private readonly telemetryService = inject(TelemetryService);

  @Input({ required: true }) flightState!: AircraftFlightState;

  private sensorTelemetrySub?: Subscription;

  constructor() {
    // Phase 1: Memory allocated. @Input properties are NOT yet available!
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Phase 2: React to updated inputs from parent container
    if (changes['flightState'] && !changes['flightState'].firstChange) {
      console.log('Telemetry updated for:', this.flightState.flightNumber);
    }
  }

  ngOnInit(): void {
    // Phase 3: Component setup. Safe to access inputs and start telemetry stream
    this.sensorTelemetrySub = this.telemetryService
      .getAirspeedSensorStream(this.flightState.flightNumber)
      .subscribe({
        next: (reading) => console.log('Raw Avionics Feed:', reading),
        error: (err) => console.error('Avionics Bus Failure:', err)
      });
  }

  ngOnDestroy(): void {
    // Phase 9: Teardown logic. Prevents dangling listeners when the component unmounts
    this.sensorTelemetrySub?.unsubscribe();
  }
}
```

---

### 3. THE ENTERPRISE PITFALLS

#### 💣 War Story: The `ExpressionChangedAfterItHasBeenCheckedError` Altimeter Crash
* **Context:** An air traffic control terminal displaying live runway departure clearances.
* **The Disaster:** In development, the application continuously threw:
  ```
  ERROR Error: NG0100: ExpressionChangedAfterItHasBeenCheckedError: 
  Expression has changed after it was checked. Previous value: 'HOLDING'. Current value: 'CLEARED'.
  ```
* **The Root Cause:** A developer updated a parent component property inside a child component's `ngAfterViewInit` hook:

```typescript
// ❌ SILENT CORRUPTION / DEV EXCEPTION
@Component({ ... })
export class RadarWidgetComponent implements AfterViewInit {
  private parentPanel = inject(CockpitPanelComponent);

  ngAfterViewInit(): void {
    // MUTATING PARENT VIEW STATE AFTER PARENT CHANGE DETECTION HAS ALREADY RUN!
    this.parentPanel.flightState.clearance = 'CLEARED_LANDING';
  }
}
```

* **Why it breaks:** Angular runs change detection from top to bottom (unidirectional data flow). In development mode, Angular runs a second verification pass immediately after change detection. If a child mutated the parent state during `ngAfterViewInit`, the parent’s value in the second pass differs from the first pass, violating the unidirectional data flow contract.
* **The Architectural Fix:**
  1. **Best Practice:** Pass state downward using `@Input()` or reactive stream stores (`BehaviorSubject` / Signals), never mutate parent state upward during render hooks.
  2. **Asynchronous Deferral (If DOM measurement is mandatory):** Schedule the update in the next microtask queue using `Promise.resolve()` or `queueMicrotask()`:

```typescript
// ✅ THE FIX: Defer state update to next microtask tick
ngAfterViewInit(): void {
  queueMicrotask(() => {
    this.parentPanel.updateClearanceStatus('CLEARED_LANDING');
  });
}
```

---

#### 💣 War Story: The Impure Pipe Memory & CPU Meltdown
* **Context:** A high-frequency foreign exchange and trade settlement dashboard rendering 5,000 transactions simultaneously.
* **The Bug:** A custom calculation pipe was declared with `pure: false`:

```typescript
// ❌ THE SYSTEM DESTROYER: Impure Pipe on large data tables
@Pipe({
  name: 'calculateRiskScore',
  standalone: true,
  pure: false // Executes on EVERY single change detection cycle across the entire app!
})
export class RiskCalculationPipe implements PipeTransform {
  transform(transaction: Transaction): number {
    return heavyMathematicalRiskAnalysis(transaction); // Costly CPU operation!
  }
}
```

* **Why it blew up:** Whenever the user moved their mouse, clicked a tab, or an unrelated WebSocket tick arrived, Angular triggered a Change Detection cycle. The impure pipe executed `heavyMathematicalRiskAnalysis()` **5,000 times on every single frame**, pegging the client’s browser CPU at 100% and causing the browser tab to freeze.
* **The Rule:** **Pipes MUST be pure by default (`pure: true`).** A pure pipe executes only when its input primitive value changes or its input object reference identity changes. If complex computation is needed on unmutated data, compute it upfront in the Service layer or use memoization.

---

#### 💣 War Story: The Duplicate Service Instance via Provider Shadowing
* **Context:** A corporate banking multi-tab portal with a `UserSessionVaultService` that holds the active authorization token.
* **The Incident:** Users reported that updating their authentication credentials on the sub-account page silently failed to update the main transfer desk, resulting in recurrent `401 Unauthorized` errors.
* **The Root Cause: Provider Shadowing.**

```typescript
@Component({
  selector: 'app-sub-account-desk',
  standalone: true,
  // ❌ DISASTER: Providing a stateful service at Component level creates a SECOND instance!
  providers: [UserSessionVaultService], 
  template: `...`
})
export class SubAccountDeskComponent {
  // This gets an isolated, shadow instance of UserSessionVaultService!
  // Updates here NEVER reach the root application instance!
  private sessionVault = inject(UserSessionVaultService); 
}
```

* **The Rule:** **Stateful services intended as singletons across the application MUST use `providedIn: 'root'`. Never list stateful singleton services in a component's `providers: []` array unless you intentionally want an isolated instance scoped exclusively to that component and its children.**

---

### 4. THE INTERVIEW CHEAT SHEET

##### Q1: Why did Angular introduce Standalone Components in Angular 14+, and what benefits do they offer?
> **Answer:** Standalone components eliminate the conceptual overhead and boilerplate of `NgModule`s. 
> Key benefits include:
> 1. **Direct Dependency Declaration:** Components specify their own dependencies (`imports: [CommonModule, ChildComponent]`), making code self-documenting and easier to reason about.
> 2. **Superior Tree-Shaking:** The compiler can easily analyze unused components and drop them from the production build bundle.
> 3. **Simplified Routing & Lazy Loading:** Standalone components can be lazy-loaded directly in route definitions via `loadComponent: () => import('./path').then(m => m.MyComponent)` without requiring intermediate routing modules.

##### Q2: What is the exact execution order of Angular Lifecycle Hooks, and why is `ngOnInit` preferred over the `constructor` for initialization logic?
> **Answer:** 
> * **Execution Order:** `constructor` $\rightarrow$ `ngOnChanges` $\rightarrow$ `ngOnInit` $\rightarrow$ `ngDoCheck` $\rightarrow$ `ngAfterContentInit` $\rightarrow$ `ngAfterContentChecked` $\rightarrow$ `ngAfterViewInit` $\rightarrow$ `ngAfterViewChecked` $\rightarrow$ `ngOnDestroy`.
> * **Why `ngOnInit` over `constructor`:** The TypeScript `constructor` is invoked when the class is instantiated in memory by the JavaScript engine; at this point, Angular **has not yet bound `@Input()` properties or initialized DOM projections**. `ngOnInit` runs after Angular has completed input property bindings and dependency injection wiring, making it the proper place to perform setup logic, HTTP calls, and stream subscriptions.

##### Q3: What causes `ExpressionChangedAfterItHasBeenCheckedError` and how do you resolve it properly?
> **Answer:** This error occurs in **Development Mode** when Angular's unidirectional data flow contract is violated. Angular runs a change detection pass to update the DOM, followed immediately by a second verification pass in dev mode. If a child component's lifecycle hook (like `ngAfterViewInit` or `ngAfterContentInit`) alters a property bound in an ancestor component, the value in the verification pass differs from the render pass.
> * **Resolution:** Avoid updating parent state during view rendering hooks. Pass state downward via `@Input` or reactive streams. If DOM-driven state updates are unavoidable, defer the update to the next asynchronous tick via `queueMicrotask()` or `Promise.resolve()`.

##### Q4: How does Angular’s Hierarchical Dependency Injection resolve tokens, and what do `@Self`, `@SkipSelf`, `@Host`, and `@Optional` do?
> **Answer:** Angular uses a two-tier injector hierarchy: `ElementInjector` (component/directive DOM tree) and `EnvironmentInjector` (routes, root, platform). When resolving a token, it travels up from the element injector to the root environment injector.
> * `@Self()`: Restricts the lookup to the current element's injector only; fails if not found locally.
> * `@SkipSelf()`: Bypasses the local element injector and begins search at the parent injector.
> * `@Host()`: Limits the lookup to the current component or its host view boundary.
> * `@Optional()`: Prevents `NullInjectorError` by returning `null` if the dependency cannot be resolved anywhere in the tree.

##### Q5: What is the mechanical difference between a Pure Pipe and an Impure Pipe?
> **Answer:** 
> * **Pure Pipe (`pure: true`, default):** Angular invokes the pipe's `transform()` method **only** when the input argument changes. For primitives (strings, numbers, booleans), this means a value change; for objects and arrays, it checks **reference identity (`===`)**.
> * **Impure Pipe (`pure: false`):** Angular invokes the `transform()` method on **every single change detection cycle**, regardless of whether the input data changed. Impure pipes introduce heavy CPU overhead and must be avoided in performance-critical tables or high-frequency real-time dashboards.
```
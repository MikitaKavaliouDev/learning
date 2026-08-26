# CHAPTER 2: The Contract at the Counter
### *REST API Architecture, OpenAPI/Swagger & Standardized Enterprise Governance*

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                         THE OPENAPI CONTRACT (TREATY)                            │
│                                                                                  │
│   POST /api/v1/vault/transfers                                                   │
│   Header: Idempotency-Key: "uuid-9876-5432"                                      │
│   Payload: { "sourceIban": "FR76...", "targetIban": "DE89...", "amount": 5000 } │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                               ▼
   [ CUSTOMS COUNTER: ANGULAR ]                    [ UNDERGROUND VAULT: SPRING ]
   Auto-Generated TypeScript Client                @RestController Contract Validation
   - Type-safe models                              - @Valid / @NotNull enforcement
   - Reactive HTTP Interceptors                    - RFC 7807 Problem Details on error
   - Zero guesswork UI forms                       - Atomic Idempotency Filter
                 │                                               │
                 └───────────────────────┬───────────────────────┘
                                         ▼
                           [ HTTP STATUS STAMP CODES ]
                  201 Created │ 400 Bad Request │ 409 Conflict
```

---

### 1. THE MENTAL MODEL

Imagine stepping up to the International Border & Customs Checkpoint at a global transit hub.

Travelers from 180 countries arrive speaking different languages—some speak French (Angular), some speak German (React), some speak Japanese (Python data pipelines), and the customs border guards speak Latin (Java / Spring Boot).

If there are no rules, chaos erupts:
* One traveler writes their name on a napkin and shoves it through the window.
* Another yells their bank balance out loud.
* A third passenger asks: *"Is my visa approved?"* and the officer responds with a thumbs-up (HTTP 200), but whispers: *"Actually, you are under arrest"* (Error JSON inside a 200 OK).

**The OpenAPI Specification (Swagger) is the International Customs Treaty.**

* **The Resource URI (The Office Counter):** A noun, not a verb. You go to `/vault/accounts/FR761234`—you don't go to `/run_debit_and_transfer_funds_immediately`.
* **The HTTP Verbs (The Official Customs Actions):**
  * `GET` (*Inspect Documents*): Purely visual inspection. Looking at a passport never alters the traveler's citizenship (Safe & Idempotent).
  * `POST` (*Register New Traveler*): Submits an application for a brand-new biometric visa. Submitting it 5 times creates 5 distinct visa records (Unsafe & Non-Idempotent).
  * `PUT` (*Complete File Replacement*): Replaces the passenger’s entire registered file from scratch. Submitting the exact same replacement 10 times results in the identical final record (Idempotent).
  * `PATCH` (*Single Field Modification*): Updates only the traveler's registered phone number without altering anything else.
  * `DELETE` (*Revoke Entry Permit*): Cancels the entry permit. Doing it once revokes it; doing it five more times leaves it in the same revoked state (Idempotent).
* **The Idempotency Key (The Border Transaction Token):** When paying a €50,000 cargo customs fee, the payment slip has a unique embossed tracking number. If a lightning strike knocks out the power line mid-swipe, submitting the exact same slip 10 seconds later **will never charge the company twice**.

---

### 2. THE MECHANICS

#### 2.1 The Richardson Maturity Model: The Ladder to REST

```
  Level 3: HATEOAS (Hypermedia As The Engine Of Application State)
  ▲        Self-navigating APIs: Responses include URI links to available next actions.
  │
  Level 2: HTTP Verbs & Standard Status Codes  ◄── [ENTERPRISE INDUSTRY SWEET SPOT]
  ▲        Proper use of GET, POST, PUT, DELETE, 201 Created, 404 Not Found, 409 Conflict.
  │
  Level 1: Dedicated Resources (URIs)
  ▲        URIs represent distinct nouns (/api/v1/accounts/123 instead of /api/service).
  │
  Level 0: The Swamp of Plain Old XML/JSON (RPC)
           Single endpoint (e.g., /api/endpoint) using POST for every single operation.
```

---

#### 2.2 Enterprise API Controller with Spring Boot 3+ and OpenAPI 3.0 Documentation

In banking and supply chain systems, documentation is not an afterthought written in a wiki; **the code itself produces the validated contract.**

```java
package com.astek.banking.vault.controller;

import com.astek.banking.vault.dto.TransferRequest;
import com.astek.banking.vault.dto.TransferResponse;
import com.astek.banking.vault.service.PaymentVaultService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.headers.Header;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;

@RestController
@RequestMapping("/api/v1/vault/transfers")
@RequiredArgsConstructor
@Tag(name = "Vault Transfers API", description = "High-security financial ledger transfers & settlements")
public class VaultTransferController {

    private final PaymentVaultService paymentVaultService;

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(
        summary = "Execute atomic wire transfer",
        description = "Debits source account and credits target account with strict idempotency guarantees.",
        responses = {
            @ApiResponse(
                responseCode = "201", 
                description = "Transfer successfully executed and settled.",
                headers = @Header(name = "Location", description = "URI to access the created transaction receipt")
            ),
            @ApiResponse(
                responseCode = "400", 
                description = "Invalid payload or validation failure",
                content = @Content(schema = @Schema(implementation = ProblemDetail.class))
            ),
            @ApiResponse(
                responseCode = "409", 
                description = "Idempotency conflict: A transfer with this Idempotency-Key is currently processing or already executed.",
                content = @Content(schema = @Schema(implementation = ProblemDetail.class))
            ),
            @ApiResponse(
                responseCode = "422", 
                description = "Unprocessable Entity: Insufficient funds in source account",
                content = @Content(schema = @Schema(implementation = ProblemDetail.class))
            )
        }
    )
    public ResponseEntity<TransferResponse> executeTransfer(
            @Parameter(description = "Unique client-generated UUID to prevent duplicate execution on network retry", required = true)
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            
            @Valid @RequestBody TransferRequest request) {

        TransferResponse response = paymentVaultService.processTransfer(idempotencyKey, request);
        
        URI location = URI.create("/api/v1/vault/transfers/" + response.transactionId());
        return ResponseEntity.created(location).body(response);
    }
}
```

---

#### 2.3 Global Exception Handling & RFC 7807 (Problem Details)

Gone are the days of returning custom, arbitrary error JSON maps. **Spring Boot 3 natively adopts RFC 7807 Problem Details** for HTTP APIs.

```java
package com.astek.banking.vault.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.net.URI;
import java.time.Instant;
import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalApiExceptionHandler {

    @ExceptionHandler(InsufficientFundsException.class)
    public ProblemDetail handleInsufficientFunds(InsufficientFundsException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.UNPROCESSABLE_ENTITY, 
                ex.getMessage()
        );
        problem.setTitle("Insufficient Account Balance");
        problem.setType(URI.create("https://bank.astek.com/errors/insufficient-funds"));
        problem.setProperty("accountId", ex.getAccountId());
        problem.setProperty("currentBalance", ex.getCurrentBalance());
        problem.setProperty("attemptedAmount", ex.getAttemptedAmount());
        problem.setProperty("timestamp", Instant.now());
        return problem;
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail handleValidationErrors(MethodArgumentNotValidException ex) {
        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
        problem.setTitle("Validation Constraint Violation");
        problem.setType(URI.create("https://bank.astek.com/errors/validation-failure"));

        String fieldErrors = ex.getBindingResult().getFieldErrors().stream()
                .map(err -> String.format("Field '%s': %s", err.getField(), err.getDefaultMessage()))
                .collect(Collectors.joining("; "));

        problem.setDetail(fieldErrors);
        problem.setProperty("timestamp", Instant.now());
        return problem;
    }
}
```

##### Output RFC 7807 Standard Error JSON Payload:
```json
{
  "type": "https://bank.astek.com/errors/insufficient-funds",
  "title": "Insufficient Account Balance",
  "status": 422,
  "detail": "Account FR7630006000011234567890189 has €120.00, which is insufficient for a transfer of €5,000.00",
  "accountId": "FR7630006000011234567890189",
  "currentBalance": 120.00,
  "attemptedAmount": 5000.00,
  "timestamp": "2026-08-24T07:45:00.123Z"
}
```

---

#### 2.4 Angular Frontend Integration: Strongly-Typed HTTP Interceptors

In Angular 14+, frontend clients consume these standardized contracts using **HttpInterceptors** to inject Idempotency keys, attach bearer tokens, and centrally parse RFC 7807 errors.

```typescript
import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

export interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail: string;
  [key: string]: any;
}

@Injectable()
export class ApiContractInterceptor implements HttpInterceptor {

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    let headers = request.headers;

    // Automatically append Idempotency-Key on mutating write operations (POST, PUT)
    if (request.method === 'POST' || request.method === 'PUT') {
      if (!headers.has('Idempotency-Key')) {
        headers = headers.set('Idempotency-Key', uuidv4());
      }
    }

    const modifiedReq = request.clone({ headers });

    return next.handle(modifiedReq).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.error && error.error.type && error.error.status) {
          const problem: ProblemDetail = error.error;
          console.error(`[API Error ${problem.status}] ${problem.title}: ${problem.detail}`);
          return throwError(() => problem);
        }
        return throwError(() => error);
      })
    );
  }
}
```

---

### 3. THE ENTERPRISE PITFALLS

#### 💣 War Story: The "HTTP 200 with Hidden Error" Deception
* **Context:** A high-value logistics inventory synchronization service between warehouses and central accounting.
* **The Anti-Pattern Code:**
  ```java
  // ❌ DISASTER: Returning 200 OK for business/system crashes
  @PostMapping("/sync")
  public ResponseEntity<Map<String, Object>> syncStock() {
      try {
          inventoryService.recalculate();
          return ResponseEntity.ok(Map.of("status", "SUCCESS"));
      } catch (Exception e) {
          // Returning 200 OK with error payload!
          return ResponseEntity.ok(Map.of("status", "FAILED", "error", e.getMessage()));
      }
  }
  ```
* **Why It Destroyed the System:**
  1. **Resilience4j Circuit Breakers:** The Circuit Breaker monitors HTTP status codes. Since every request returned `200 OK`, the Circuit Breaker remained `CLOSED` during an 8-hour database outage, continuing to bombard the dying DB.
  2. **API Gateways & Cloud Monitors:** Azure Application Insights reported 100% health (0 errors) while millions of euros in stock orders silently vanished.
  3. **Frontend Caching:** Angular HTTP caching interceptors cached the "FAILED" response as a valid cached resource for all future users.
* **Rule:** **Never violate HTTP semantics. If an operation fails, return a 4xx or 5xx status code.**

---

#### 💣 War Story: The Accidental Triple-Debit Payment (Missing Idempotency)
* **Context:** Mobile corporate banking application executing international wire transfers.
* **The Incident:** A corporate treasurer clicked *"Authorize €1,000,000 Transfer"*. The bank’s backend server debited the account, but during the return flight of the HTTP response, a cellular tower disconnected. The mobile app received a `TimeoutException`.
* **The Human Behavior:** Believing the transfer had failed, the treasurer clicked the button two more times.
* **The Result:** Three independent `POST` requests were processed. **€3,000,000 was debited instead of €1,000,000.**
* **The Architectural Fix:** Implement an **Idempotency Filter** using Redis distributed locking:

```
[ POST /transfers (Idempotency-Key: X) ]
                   │
                   ▼
       [ Redis Check: Key X exists? ]
        ├── YES (State: IN_PROGRESS) ──► Return 409 Conflict ("Transaction already processing")
        ├── YES (State: COMPLETED)   ──► Return Cached Original 201 Response (Zero DB side-effects)
        └── NO                       ──► Set Redis Key X (IN_PROGRESS) ──► Execute DB Transfer
                                                                       ──► Set Key X (COMPLETED)
```

---

### 4. THE INTERVIEW CHEAT SHEET

##### Q1: What makes an HTTP method "Safe" versus "Idempotent"? Classify GET, POST, PUT, PATCH, and DELETE.
> **Answer:** 
> * **Safe:** The method produces no side effects on the server state (read-only). 
> * **Idempotent:** Executing the request $N$ times with the same parameters produces the exact same server state as executing it once ($f(f(x)) = f(x)$).
> * **Classification:**
>   * `GET`: Safe & Idempotent.
>   * `PUT`: Unsafe (modifies state), but **Idempotent** (replacing a resource with identical payload leaves identical state).
>   * `DELETE`: Unsafe, but **Idempotent** (deleting resource #42 leaves it deleted whether called 1 time or 10 times; returns 204 or 404, but state remains identical).
>   * `POST`: Unsafe & **Non-Idempotent** (calling $N$ times creates $N$ records).
>   * `PATCH`: Unsafe & generally **Non-Idempotent** (e.g., `PATCH { "increment": 5 }`), though it can be implemented idempotently depending on payload design.

##### Q2: How does Spring Boot 3 handle standardized REST API errors using RFC 7807 (`ProblemDetail`)?
> **Answer:** Spring Boot 3 / Spring Framework 6 introduces the native `ProblemDetail` specification class conforming to **RFC 7807**. Instead of constructing custom error DTOs, developers return `ProblemDetail` from `@RestControllerAdvice` methods. It standardizes key diagnostic fields (`type`, `title`, `status`, `detail`, `instance`) and allows arbitrary key-value custom properties via `.setProperty("key", value)`. It can be globally activated for all standard Spring exceptions via `spring.mvc.problemdetails.enabled=true`.

##### Q3: How do you handle API Versioning in an enterprise banking environment? Compare URI vs Header versioning.
> **Answer:** 
> * **URI Versioning (`/api/v1/accounts`):** Highly visible, easy to route at the API Gateway level (Azure API Management / NGINX), simple for documentation in Swagger, and easy to cache in CDNs. Recommended for external public contracts.
> * **Header / Content Negotiation Versioning (`Accept: application/vnd.bank.v1+json` or `X-API-Version: 1`):** Keeps URIs clean and truly RESTful (identifying the resource rather than the version), but is harder to route, cannot be tested directly in a browser address bar, and complicates caching proxy configurations.
> In high-stakes banking/logistics, **URI Versioning for major breaking versions** combined with additive non-breaking backward compatibility is the industry standard.

##### Q4: What is the Richardson Maturity Model, and why do most production architectures stop at Level 2?
> **Answer:** The model ranks REST compliance from Level 0 (single RPC endpoint over HTTP) to Level 3 (HATEOAS with hypermedia navigational links). Most enterprise systems stop at **Level 2 (HTTP Verbs + Status Codes)** because Level 3 (HATEOAS) adds heavy payload serialization overhead, introduces complex coupling to hypermedia link parsers on frontend clients (like Angular), and yields limited ROI compared to strongly typed OpenAPI client generation schemas.

##### Q5: How do you design and enforce Idempotency in non-idempotent endpoints like `POST /payments`?
> **Answer:** By requiring a unique client-generated header: `Idempotency-Key` (UUIDv4). 
> 1. An API Gateway or Spring Filter intercepts the incoming request and attempts an atomic `SETNX` in Redis on the key with a TTL (e.g., 24 hours).
> 2. If the key exists with status `PROCESSING`, return `409 Conflict` or `425 Too Early`.
> 3. If the key exists with status `COMPLETED`, return the cached response body and status code immediately without touching the database.
> 4. If the key is new, proceed with the transactional business logic, save the execution result into Redis, and return the `201 Created` response.
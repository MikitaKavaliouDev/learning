# CHAPTER 6: The Guard Dogs & Keycards
### *Spring Security 6, OAuth2, JWT & Zero-Trust Banking Defense*

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 OAUTH2 & JWT HIGH-SECURITY BORDER CONTROL                   │
│                                                                             │
│  [ Traveler (Angular App) ]                                                 │
│        │                                                                    │
│        │ 1. Present Credentials (User/Pass + MFA)                           │
│        ▼                                                                    │
│  [ Identity Provider / Central Customs (Keycloak / Azure Entra ID) ]        │
│        │                                                                    │
│        │ 2. Issue Cryptographically Signed Biometric Passport (JWT)         │
│        ▼                                                                    │
│  [ Traveler holds JWT ] ── Bearer Token ──► [ Spring Security Filter Chain ]│
│                                                       │                     │
│               ┌───────────────────────────────────────┴───────────────┐     │
│               ▼                                                       ▼     │
│      [ Verify Signature ]                                    [ Parse Roles ]│
│      (Validates against IdP JWKS Public Key)                 (Extract Scopes│
│               │                                               & Authorities)│
│               └───────────────────────┬───────────────────────────────┘     │
│                                       ▼                                     │
│                        [ SecurityContextHolder ]                            │
│                                       │                                     │
│                                       ▼                                     │
│                   [ @PreAuthorize: Armed Guard at Door ]                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 1. THE MENTAL MODEL

If the database is the subterranean gold vault, you cannot rely on an honor system to protect it. You do not place a sign on the door saying: *"Please only take what belongs to you."*

In an insecure architecture, systems rely on **Perimeter Defense** (the airport fence). Once a person walks past the front gate, every door inside the building is unlocked. If a baggage handler sneaks into the baggage terminal, they can walk unimpeded into the Air Traffic Control Tower and fly an Airbus A380.

**Modern Banking Architecture demands Zero-Trust Defense.**
Every single room, elevator, corridor, and safety deposit box verifies your credentials independently, on every single request.

* **Authentication vs. Authorization (Who You Are vs. Where You Can Go):**
  * **Authentication ($401\text{ Unauthorized}$):** Presenting your biometric passport at border control. The border guard verifies your identity: *"You are indeed Alexandre Dupont."*
  * **Authorization ($403\text{ Forbidden}$):** Walking up to the Runway 09R Service Gate. The guard checks your badge: *"We know you are Alexandre Dupont, but you do not hold a Tier-3 Airfield Security Clearance. Access Denied."*
* **The Identity Provider (The Central Passport Bureau / Keycloak / Azure Entra ID):** The sovereign authority that stamps and signs passports. It issues tamper-proof cryptographic tokens (**JWTs**).
* **The JSON Web Token (The Biometric Digital Passport):**
  * **Header:** The type of passport and encryption algorithm used (e.g., `RS256`).
  * **Payload (Claims):** The traveler's identity (`sub`), clearance level (`roles: ["ROLE_VAULT_OPERATOR"]`), and passport expiration date (`exp`).
  * **Signature:** A cryptographic seal stamped by the Identity Provider’s private key. The airport guards only need the Identity Provider’s **Public Key (JWKS)** to verify the seal’s authenticity in microseconds without calling the Passport Bureau over the phone for every passenger.
* **The Spring Security Filter Chain (The Checkpoint Corridors):** A series of armed guards standing in a single-file corridor. 
  * Guard 1 disables outdated protocols (CSRF disabled for stateless REST).
  * Guard 2 verifies CORS flight origins.
  * Guard 3 validates the JWT cryptographic signature.
  * Guard 4 extracts claims and converts them into security clearances (`GrantedAuthority`).
  * Only when all guards nod does the request reach your `@RestController`.

---

### 2. THE MECHANICS

#### 2.1 Spring Security 6 Component Architecture (Spring Boot 3+)

Spring Security 6 eliminates deprecated configuration adapters (`WebSecurityConfigurerAdapter`) in favor of a **Component-Based Security Filter Chain DSL**.

```java
package com.astek.banking.security.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity(prePostEnabled = true) // Activates @PreAuthorize / @PostAuthorize
public class EnterpriseSecurityConfiguration {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            // 1. STATELESS ARCHITECTURE: No HTTP Session cookies created or used
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            
            // 2. CSRF: Disabled strictly because we are stateless REST using Bearer tokens
            .csrf(csrf -> csrf.disable())
            
            // 3. CORS: Enforce strict origin filtering
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            
            // 4. URL AUTHORIZATION RULES
            .authorizeHttpRequests(auth -> auth
                // Public Swagger/OpenAPI endpoints
                .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                // Public Health Check for Kubernetes Liveness probes
                .requestMatchers(HttpMethod.GET, "/actuator/health/**").permitAll()
                // Strict Role-based endpoint boundaries
                .requestMatchers("/api/v1/vault/admin/**").hasRole("VAULT_ADMIN")
                .requestMatchers("/api/v1/logistics/**").hasAnyRole("SUPPLY_MANAGER", "VAULT_ADMIN")
                // All other business endpoints require authenticated identity
                .anyRequest().authenticated()
            )
            
            // 5. OAUTH2 RESOURCE SERVER (JWT Validation)
            .oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt.jwtAuthenticationConverter(customJwtAuthenticationConverter()))
            );

        return http.build();
    }

    /**
     * Converts Keycloak / Azure AD claims into Spring Security GrantedAuthorities.
     * Keycloak nests roles inside: resource_access -> {client_id} -> roles: ["VAULT_ADMIN"]
     */
    @Bean
    public Converter<Jwt, ? extends AbstractAuthenticationToken> customJwtAuthenticationConverter() {
        JwtAuthenticationConverter jwtConverter = new JwtAuthenticationConverter();
        
        jwtConverter.setJwtGrantedAuthoritiesConverter(jwt -> {
            // Standard OAuth2 Scopes (e.g., "SCOPE_read", "SCOPE_write")
            JwtGrantedAuthoritiesConverter defaultScopesConverter = new JwtGrantedAuthoritiesConverter();
            Collection<GrantedAuthority> defaultAuthorities = defaultScopesConverter.convert(jwt);

            // Extract custom realm/client roles from Keycloak JWT payload
            Collection<GrantedAuthority> customRoles = extractKeycloakRoles(jwt);

            return Stream.concat(
                    defaultAuthorities != null ? defaultAuthorities.stream() : Stream.empty(),
                    customRoles.stream()
            ).collect(Collectors.toSet());
        });

        return jwtConverter;
    }

    @SuppressWarnings("unchecked")
    private Collection<GrantedAuthority> extractKeycloakRoles(Jwt jwt) {
        Map<String, Object> realmAccess = jwt.getClaim("realm_access");
        if (realmAccess == null || !realmAccess.containsKey("roles")) {
            return Collections.emptyList();
        }

        List<String> roles = (List<String>) realmAccess.get("roles");
        return roles.stream()
                .map(roleName -> new SimpleGrantedAuthority("ROLE_" + roleName))
                .collect(Collectors.toList());
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of("https://portal.bank.astek.com", "https://logistics.astek.com"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "Idempotency-Key"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
```

---

#### 2.2 Method-Level Security & Domain-Level Access Control (BOLA Defense)

URL matching alone cannot verify whether an authenticated user is allowed to touch a specific bank account record. **We combine `@PreAuthorize` with custom Spring Expression Language (SpEL) security evaluators.**

```java
package com.astek.banking.vault.service;

import com.astek.banking.vault.dto.TransferRequest;
import com.astek.banking.vault.dto.TransferReceipt;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;

@Service
public class SecureTransferService {

    /**
     * DOMAIN-LEVEL SECURITY:
     * 1. Requires ROLE_TELLER or ROLE_CUSTOMER
     * 2. Calls AccountSecurityEvaluator bean to verify the authenticated user OWNS the source IBAN
     * 3. Enforces transfer amount business threshold limits
     */
    @PreAuthorize("""
        hasRole('VAULT_ADMIN') or 
        (hasRole('CUSTOMER') and 
         @accountSecurityEvaluator.isAccountOwner(authentication, #request.sourceIban()) and
         #request.amount() <= 50000.00)
    """)
    public TransferReceipt executeSecureTransfer(TransferRequest request) {
        // Business logic runs ONLY after all security gates pass
        return new TransferReceipt("TX-998822", request.amount(), "SETTLED");
    }
}
```

##### The Security Evaluator Component:
```java
package com.astek.banking.security;

import com.astek.banking.vault.repository.BankAccountRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

@Component("accountSecurityEvaluator")
@RequiredArgsConstructor
public class AccountSecurityEvaluator {

    private final BankAccountRepository bankAccountRepository;

    public boolean isAccountOwner(Authentication authentication, String iban) {
        if (!(authentication.getPrincipal() instanceof Jwt jwt)) {
            return false;
        }

        // Extract authenticated User Subject UUID from JWT claims
        String authenticatedUserId = jwt.getSubject();

        // Verify in database that this specific IBAN belongs to this user ID
        return bankAccountRepository.findByIban(iban)
                .map(account -> account.getOwnerUserId().equals(authenticatedUserId))
                .orElse(false);
    }
}
```

---

#### 2.3 Mutual TLS (mTLS): Zero-Trust Machine-to-Machine Encryption

Inside a banking cluster, **traffic between microservices cannot travel over unencrypted plain HTTP.**

```
[ Service A (Payment Microservice) ] ◄════════════════════════════► [ Service B (Ledger Microservice) ]
  1. Presents its TLS Certificate                                     1. Presents its TLS Certificate
  2. Verifies Service B Certificate                                   2. Verifies Service A Certificate
  3. Establishes Encrypted Channel                                    3. Establishes Encrypted Channel
```

* **Standard TLS (One-Way):** The client verifies the server’s certificate (e.g., browser connecting to `https://google.com`).
* **mTLS (Mutual TLS Two-Way):** Both the client and the server present and cryptographically verify each other's certificates against a shared **Enterprise Certificate Authority (CA)** before a single byte of application data is transmitted.

---

### 3. THE ENTERPRISE PITFALLS

#### 💣 War Story: The Broken Object Level Authorization (BOLA / IDOR) Wire Fraud
* **Context:** An online commercial banking portal.
* **The Incident:** An attacker logged into Account A (`sub: "user-111"`), opened developer tools, and sent a `POST /api/v1/transfers` with a payload specifying source account `FR76-USER-222` (belonging to another corporation).
* **The Vulnerability:** The developer had written:
  ```java
  // ❌ DISASTER: Only checked IF the user was authenticated, not WHAT they owned!
  @PostMapping("/transfers")
  @PreAuthorize("isAuthenticated()")
  public ResponseEntity<Void> transfer(@RequestBody TransferRequest request) {
      bankService.transfer(request.getSourceIban(), request.getTargetIban(), request.getAmount());
      return ResponseEntity.ok().build();
  }
  ```
* **The Consequence:** The bank processed an unauthorized wire transfer of €4,200,000.
* **The Rule:** **Authentication $\neq$ Authorization. Never rely on client-submitted identifiers without asserting entity ownership against the authenticated JWT principal.**

---

#### 💣 War Story: The "Alg: None" Cryptographic Bypass
* **Context:** An international supply chain customs clearance system.
* **The Incident:** An attacker intercepted a JWT, decoded the Base64 header, changed `"alg": "RS256"` to `"alg": "none"`, modified the payload role to `"ROLE_CUSTOMS_DIRECTOR"`, removed the signature completely, and forwarded the token.
* **The Disaster:** A legacy, misconfigured JWT parsing library accepted unsigned tokens when `"alg": "none"` was present, granting the attacker root administrative access to import unsanctioned industrial containers.
* **The Fix:** Modern Spring Security Resource Server strictly rejects tokens that do not match the explicitly configured cryptographic algorithm (e.g., `JWSAlgorithm.RS256`) and forces signature verification against a trusted **JWKS URI (`spring.security.oauth2.resourceserver.jwt.jwk-set-uri`)**.

---

### 4. THE INTERVIEW CHEAT SHEET

##### Q1: How has Spring Security 6 fundamentally changed its configuration model compared to older versions?
> **Answer:** Spring Security 6 completely removes legacy adapters like `WebSecurityConfigurerAdapter` and method overrides. Configuration is now entirely **component-based using `@Bean` definitions** returning a `SecurityFilterChain`. 
> Furthermore, it replaces method chaining with **Lambda DSLs** (`http.authorizeHttpRequests(auth -> auth...)`), improving readability, preventing configuration leaking, and enforcing immutability.

##### Q2: What is the fundamental difference between OAuth2 Scopes and Spring Security Roles?
> **Answer:** 
> * **OAuth2 Scopes (Delegated Permissions):** Define what the *client application* is allowed to do on behalf of the user (e.g., `SCOPE_read:account`, `SCOPE_payment:create`). They represent technical consent granted to an application.
> * **Spring Security Roles / Authorities (User Clearances):** Define what the *actual end-user* is authorized to perform within the business domain (e.g., `ROLE_VAULT_ADMIN`, `ROLE_TELLER`). 
> In enterprise systems, Spring converts Scopes to `SCOPE_` authorities and Realm Roles to `ROLE_` authorities for granular access evaluations.

##### Q3: Why is CSRF protection disabled in stateless REST microservices, and when must it remain enabled?
> **Answer:** 
> * **CSRF (Cross-Site Request Forgery)** attacks rely on the browser automatically attaching ambient credentials (such as Session Cookies or HTTP Basic Auth headers) to malicious third-party cross-origin requests.
> * In **Stateless REST APIs using Bearer JWTs in the `Authorization` header**, browsers do *not* automatically attach the token on cross-origin requests; the frontend JavaScript code must explicitly supply it. Therefore, CSRF protection is redundant and can be safely disabled (`csrf.disable()`).
> * CSRF **must remain enabled** if the application uses cookies (such as `JSESSIONID` or `HttpOnly` refresh tokens) to maintain authentication state.

##### Q4: What is Broken Object Level Authorization (BOLA / IDOR) and how is it mitigated in Spring Boot?
> **Answer:** BOLA (formerly Insecure Direct Object References) occurs when an endpoint accepts a resource ID (e.g., `/accounts/{iban}`) and validates that the caller is logged in, but fails to verify that the logged-in user is the legitimate owner of that specific resource. 
> * **Mitigation:** Use method security with `@PreAuthorize` combined with a SpEL evaluator (e.g., `@PreAuthorize("@securityEvaluator.isOwner(authentication, #id)")`), or enforce tenancy/ownership constraints directly inside SQL queries (`WHERE id = :id AND owner_id = :authenticatedUserId`).

##### Q5: How does a Spring Boot OAuth2 Resource Server validate incoming JWT tokens without calling the Authorization Server on every request?
> **Answer:** The Resource Server uses **Asymmetric Cryptography**. 
> 1. At startup, Spring fetches the Authorization Server’s public keys via the **JWKS (JSON Web Key Set) endpoint**.
> 2. When a JWT arrives in the `Authorization: Bearer <token>` header, Spring parses the token's header to identify the key ID (`kid`).
> 3. It uses the corresponding cached public key to verify the cryptographic signature locally in memory ($O(1)$ CPU operation).
> 4. It validates standard claims locally: expiration time (`exp`), not before (`nbf`), issuer (`iss`), and audience (`aud`). Zero network calls to the Authorization Server are needed during normal request execution.
# Architectural Decision Record (ADR) 001: OAuth2 & OIDC Authentication and Authorization Specification

* **Status:** Accepted
* **Author:** Dr. Marcus Cole (Principal Software Architect)
* **Date:** 2025-02-25
* **Target Audience:** Security Engineers, Backend Microservices Developers, API Gateway Maintainers

---

## 1. Context and Problem Statement

As our enterprise microservices ecosystem scales, we require a robust, standardized, and secure authentication and authorization mechanism. Ad-hoc token mechanisms or direct credential passing expose our services to severe security vulnerabilities, lack fine-grained access control (Scopes/Claims), and impede secure service-to-service communication.

We need a comprehensive Architecture Decision Record (ADR) defining our OAuth 2.0 and OpenID Connect (OIDC) implementation, covering protocol flows, endpoint specifications, cryptographic token schemas (JWT), and mandatory security rules across all tiers of the architecture.

---

## 2. Decision Drivers

1. **Security & Cryptographic Integrity:** Tokens must be cryptographically signed, verifiable offline by API gateways or microservices via public keys (JWKS), and time-limited.
2. **Standardization:** Strict compliance with RFC 6749 (OAuth 2.0), RFC 7519 (JWT), RFC 7636 (PKCE), and OpenID Connect Core 1.0.
3. **Zero-Trust Microservices:** Internal services must validate caller identities and permissions without relying on network perimeter security.
4. **Auditability & Revocation:** Support for opaque reference tokens for high-sensitivity sessions or short-lived stateless JWTs with robust revocation strategies.

---

## 3. Architectural Design

### 3.1 Overview of Supported Grants

| Grant Type | Standard RFC | Use Case | Security Requirements |
| :--- | :--- | :--- | :--- |
| **Authorization Code with PKCE** | RFC 6749 / RFC 7636 | Single Page Apps (SPAs), Mobile Apps, Native Clients | Mandatory `code_challenge`, `code_challenge_method=S256` |
| **Client Credentials** | RFC 6749 (§4.4) | Machine-to-Machine (M2M) Microservices | Mutual TLS (mTLS) or Client Secret + Scopes |
| **Refresh Token** | RFC 6749 (§6) | Long-lived session management | Token rotation, sliding windows, binding to client ID |

---

### 3.2 Endpoint Specifications

The Authorization Server exposes the following standard endpoints under `https://auth.enterprise.internal/oauth/v2`:

#### 1. Authorization Endpoint (`GET /authorize`)
* **Purpose:** Authenticates the user and obtains user consent.
* **Query Parameters:**
  * `response_type=code` (Required)
  * `client_id` (Required)
  * `redirect_uri` (Required, exact match against registered URIs)
  * `scope` (Required space-delimited list of requested scopes)
  * `state` (Required CSRF mitigation token, min 128-bit entropy)
  * `code_challenge` (Required for PKCE)
  * `code_challenge_method=S256` (Required for PKCE)

#### 2. Token Endpoint (`POST /token`)
* **Purpose:** Exchanges authorization codes, refresh tokens, or client credentials for access and ID tokens.
* **Content-Type:** `application/x-www-form-urlencoded`
* **Parameters (Authorization Code Flow):**
  * `grant_type=authorization_code`
  * `client_id`
  * `code`
  * `redirect_uri`
  * `code_verifier` (PKCE verification)
* **Parameters (Client Credentials Flow):**
  * `grant_type=client_credentials`
  * `client_id`
  * `client_secret` (or mTLS client certificate)
  * `scope`

#### 3. JWKS Endpoint (`GET /.well-known/jwks.json`)
* **Purpose:** Exposes public keys (JSON Web Key Set) used by resource servers and API gateways to cryptographically verify JWT signatures offline.

---

### 3.3 Token Schemas & Cryptographic Specifications

#### Access Token (JWT Profile - RFC 7519)
* **Algorithm:** `RS256` (RSA Signature with SHA-256) or `ES256` (ECDSA using P-256 and SHA-256).
* **Lifetime (`exp`):** Maximum **15 minutes**.
* **Payload Claim Structure:**
```json
{
  "iss": "https://auth.enterprise.internal",
  "sub": "usr_9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "aud": "https://api.enterprise.internal",
  "exp": 1740531600,
  "nbf": 1740530700,
  "iat": 1740530700,
  "jti": "jwt_d8f7e6a5-4c3b-2a1f-0e9d-8c7b6a5f4e3d",
  "client_id": "client_spa_portal_v1",
  "scope": "openid profile read:orders write:orders",
  "roles": ["CUSTOMER", "PREMIUM_TIER"]
}
```

#### Refresh Token
* **Format:** Opaque cryptographic random string (min 256 bits entropy generated via CSPRNG).
* **Lifetime (`exp`):** Maximum **7 days** (with sliding expiration and automatic token rotation upon each exchange).
* **Storage:** Stored hashed (Argon2id) in the Authorization Server database; never stored in plaintext. Client-side storage restricted to encrypted `HttpOnly`, `Secure`, `SameSite=Strict` cookies (for web clients) or secure platform keychains (for native mobile apps).

---

### 3.4 Security Rules & Threat Mitigations

1. **Mandatory PKCE:** The plain authorization code grant without PKCE is strictly prohibited. All clients (including confidential clients where feasible) must implement PKCE (`code_challenge_method=S256`).
2. **Token Replay & Theft Prevention:**
   * Access tokens are short-lived (15 min) to minimize exposure windows if leaked.
   * Refresh token rotation is enforced: presenting an already-used refresh token invalidates the entire token family immediately and triggers a security alert.
3. **Transport Layer Security (TLS):**
   * All endpoints must enforce TLS 1.3 exclusively (TLS 1.2 permitted only as a strict legacy fallback with secure cipher suites like `TLS_AES_256_GCM_SHA384`).
   * HTTP to HTTPS redirection is mandatory; HSTS header (`Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`) must be set on all responses.
4. **CORS & Redirect URI Validation:**
   * Exact string matching is required for `redirect_uri` validation (wildcards in path or domain are prohibited).
   * CORS headers on the token endpoint must restrict `Access-Control-Allow-Origin` to trusted client origins.
5. **Rate Limiting & Brute Force Defense:**
   * The `/token` and `/authorize` endpoints are protected by sliding-window rate limiters (max 5 failed attempts per IP/client per minute) backed by Redis.

---

## 5. Consequences

* **Positive:**
  * High security posture adhering to modern OAuth 2.1 and OIDC security baselines.
  * Stateless validation at microservice API gateways via JWKS caching reduces auth-server bottlenecking.
  * Robust protection against CSRF, authorization code injection, and token replay.
* **Negative / Trade-offs:**
  * Increased client-side complexity in implementing PKCE and token refresh loops.
  * Short access token lifetimes require reliable clock synchronization across microservices (NTP mandated across all host clusters).

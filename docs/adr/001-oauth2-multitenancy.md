# ADR-001: OAuth2 Multi-Tenant Architecture with PostgreSQL Session Persistence and Redis Rate Limiting

## Status
Accepted

## Context
As AgentForge scales its microservices ecosystem to support multiple isolated enterprise tenants securely and reliably, we require a robust authentication, authorization, rate-limiting, and session management architecture. 

Key architectural requirements:
1. **Multi-Tenancy Support**: Strict tenant isolation across all layers (API, application logic, and database schemas/partitioning) adhering to OAuth2 / OIDC standards.
2. **Session Persistence**: Reliable, scalable, and queryable session storage backed by PostgreSQL to ensure auditability, persistence across gateway restarts, and relational integrity.
3. **High-Performance Rate Limiting**: Distributed rate limiting enforced via Redis utilizing token-bucket / sliding-window algorithms to protect downstream microservices from denial-of-service and noisy-neighbor tenant abuse.

---

## Decision

### 1. OAuth2 & Multi-Tenancy Architecture
- **Protocol**: OAuth 2.0 with JSON Web Tokens (JWT) for stateless service-to-service and client-to-API authentication, coupled with opaque reference tokens for high-security user sessions.
- **Tenant Context Propagation**: 
  - Every incoming request must provide a valid OAuth2 bearer token containing standard claims (`sub`, `iss`, `client_id`) along with custom multi-tenant claims (`tenant_id`, `org_roles`).
  - The API Gateway validates tokens against the Auth Provider, injects the `X-Tenant-ID` HTTP header downstream, and propagates the tenant context through asynchronous message buses and database transaction scopes.
- **Data Isolation**: PostgreSQL Row-Level Security (RLS) is mandated across shared-schema tables, supplemented by schema-per-tenant strategies for enterprise tier clients requiring physical isolation.

### 2. PostgreSQL Session Persistence
- **Storage Strategy**: User sessions, active refresh tokens, and consent grants are persisted in a dedicated PostgreSQL `sessions` cluster.
- **Schema Design**:
  - `sessions` table includes indexes on `session_id`, `tenant_id`, and `user_id`.
  - Automatic partition management by `tenant_id` and expiry timestamps (`expires_at`) using time-based partitioning extensions (e.g., `pg_partman`) to facilitate efficient TTL cleanups.
- **Audit & Revocation**: Immediate token revocation lists and session auditing logs are recorded relationally for compliance and security forensics.

### 3. Redis Rate Limiting
- **Architecture**: Redis Cluster deployed with master-replica replication across availability zones.
- **Algorithm**: Sliding Window Counter / Token Bucket implemented via Lua scripts in Redis to guarantee atomicity and sub-millisecond evaluation latency.
- **Key Structure**: 
  - Rate limit keys are scoped by tenant and tier: `{tenant_id}:{tier}:{endpoint_category}` (e.g., `tenant_99482:enterprise:api_v1`).
- **Headers**: Standard HTTP rate limit response headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`) are injected by the API Gateway on every response.

---

## Consequences

### Positive
- **Security & Compliance**: Strong tenant isolation prevents cross-tenant data leaks and satisfies strict enterprise compliance frameworks (SOC2, ISO 27001).
- **Resilience & Scalability**: Redis handles high-frequency rate-limiting checks without saturating primary databases, while PostgreSQL session persistence ensures durability across service restarts.
- **Observability**: Centralized session auditing and structured rate-limiting metrics provide clear operational insights into tenant usage patterns.

### Negative / Trade-offs
- **Complexity**: Managing database migrations with RLS and Redis cluster topologies introduces operational overhead.
- **Latency Overhead**: Validating opaque tokens against PostgreSQL session stores adds a small latency penalty compared to pure JWT validation, mitigated via local L1 caching in the API Gateway.

---

## Compliance & Verification
- Automated integration tests verify tenant isolation boundaries in PostgreSQL.
- Load testing (k6) validates Redis rate limiter accuracy under high concurrency.
- Security scanners audit OAuth2 scopes and token propagation mechanisms.

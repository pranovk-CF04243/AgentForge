# AgentForge Architectural Specification: Multi-Tenant RBAC, API Keys, and Audit Infrastructure

## Executive Summary
This document establishes the production-grade architectural specification for the AgentForge enterprise control plane, detailing the PostgreSQL multi-tenant database schema, RBAC permissions model, cryptographic API key issuance protocol, and Kafka distributed event schemas (`audit.events.v1`).

---

## 1. PostgreSQL Database Schema Specification

The core identity, multi-tenancy, RBAC, and audit logging schema is implemented in `backend/migrations/001_initial_schema.sql`.

### Entity Relationship Model
- **Organizations (Tenants)**: Root entity representing corporate tenants with isolated data and settings (`organizations`).
- **Users**: Individuals or service accounts tied to an organization (`users`).
- **Roles**: Tenant-scoped or global RBAC roles (`roles`).
- **Permissions**: Atomic resource/action pairs (`permissions`).
- **Role Permissions**: Many-to-many relationship between roles and permissions (`role_permissions`).
- **User Roles**: Many-to-many relationship between users and roles (`user_roles`).
- **API Keys**: Programmatic authentication tokens with secure hashing, prefix indexing, and scope restriction (`api_keys`).
- **Audit Logs**: Immutable enterprise compliance audit trail (`audit_logs`).

---

## 2. REST API Specification (OpenAPI 3.0)

The comprehensive REST API contract is specified in `backend/api/openapi.yaml`. It adheres to RESTful conventions, returning structured JSON error payloads and requiring bearer or API key authentication for all control plane operations.

### Key Endpoints:
- `POST /v1/organizations`: Provision a new tenant organization.
- `GET /v1/organizations/{orgId}`: Retrieve organization metadata.
- `GET /v1/organizations/{orgId}/roles`: List tenant roles and assigned permissions.
- `POST /v1/organizations/{orgId}/roles`: Create a custom RBAC role.
- `GET /v1/organizations/{orgId}/api-keys`: List organization API keys.
- `POST /v1/organizations/{orgId}/api-keys`: Issue a new API key (returns raw secret once).
- `DELETE /v1/organizations/{orgId}/api-keys/{keyId}`: Revoke an API key.
- `GET /v1/organizations/{orgId}/audit-logs`: Query immutable audit trail with filtering.

---

## 3. Kafka Distributed Event Schema: `audit.events.v1`

All state-changing operations emit CloudEvents-compliant asynchronous audit events to the Kafka topic `audit.events.v1`. The JSON schema is defined in `backend/kafka/audit.events.v1.json`.

### Event Structure Example:
```json
{
  "specversion": "1.0",
  "type": "ai.agentforge.audit.api_key.created",
  "source": "agentforge-control-plane",
  "event_id": "c3734a71-80f4-42b8-933e-5e87a2d3b412",
  "timestamp": "2025-09-17T18:00:00Z",
  "organization_id": "a1b2c3d4-e5f6-7890-abcd-ef0123456789",
  "actor": {
    "actor_id": "f9e8d7c6-b5a4-3210-fedc-ba9876543210",
    "actor_type": "user",
    "actor_email": "admin@enterprise.com"
  },
  "action": "api_key.created",
  "resource": {
    "resource_type": "api_key",
    "resource_id": "12345678-1234-1234-1234-1234567890ab"
  },
  "status": "success",
  "context": {
    "ip_address": "192.168.1.100",
    "user_agent": "AgentForge-CLI/1.0.0",
    "request_id": "req_xyz98765"
  },
  "metadata": {
    "key_name": "Production CI/CD Key",
    "scopes": ["agents:execute", "metrics:read"]
  }
}
```

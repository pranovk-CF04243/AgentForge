# AgentForge Payment Gateway Architecture & Integration Design

Author: Dr. Marcus Cole, Principal Software Architect  
Status: Approved & Production-Ready  

---

## 1. Executive Summary & Architecture Overview

The AgentForge Payment Gateway integrates Stripe as our primary payment processor for handling subscription billing, pay-as-you-go credit purchases, and enterprise invoicing. The architecture is designed around high availability, idempotency, event-driven webhook processing, and secure cryptographic verification.

### Key Architectural Pillars:
1. **Idempotency & Fault Tolerance**: All mutating endpoints (`/payments/intents`) and webhook handlers enforce idempotency using unique request keys and Stripe event IDs stored in PostgreSQL with ACID guarantees.
2. **Event-Driven Webhook Processing**: Webhook delivery is decoupled via an asynchronous worker queue (or Kafka/Redis streams) to guarantee zero message loss and prevent Stripe webhook timeout failures (Stripe requires a `200 OK` within 3 seconds).
3. **Cryptographic Verification**: Incoming Stripe webhooks are rigorously verified using Stripe signature headers (`Stripe-Signature`) against our webhook signing secret.
4. **State Machine Integrity**: Payment and subscription states follow a strict, validated state machine (Pending -> Processing -> Succeeded / Failed / Refunded).

---

## 2. Stripe Checkout & Payment Flow (Sequence Diagram)

```mermaid
sequenceDiagram
    autonumber
    actor Client as Frontend Client
    participant API as AgentForge API Gateway
    participant DB as PostgreSQL Database
    participant Stripe as Stripe API
    participant WhWorker as Webhook Worker

    Note over Client, Stripe: Step 1: Payment Intent Creation
    Client->>API: POST /v1/payments/intents (amount, currency, plan_id)
    activate API
    API->>DB: Check/Create Customer Mapping
    API->>Stripe: Create PaymentIntent (amount, currency, metadata)
    Stripe-->>API: Return PaymentIntent (id, client_secret, status=requires_payment_method)
    API->>DB: Insert payment_transactions record (status=pending)
    API-->>Client: Return { client_secret, payment_intent_id }
    deactivate API

    Note over Client, Stripe: Step 2: Client-Side Confirmation
    Client->>Stripe: confirmCardPayment(client_secret, payment_method_data)
    activate Stripe
    Stripe-->>Client: Payment Succeeded / Requires Action (3D Secure)
    deactivate Stripe

    Note over Client, Stripe: Step 3: Webhook Notification & Fulfillment
    Stripe->>API: POST /v1/payments/webhook (payment_intent.succeeded)
    activate API
    API->>API: Verify Stripe-Signature header
    API->>WhWorker: Enqueue event for async processing
    API-->>Stripe: 200 OK (Immediate acknowledgment)
    deactivate API

    activate WhWorker
    WhWorker->>DB: Check if event_id already processed (Idempotency check)
    WhWorker->>DB: BEGIN TRANSACTION
    WhWorker->>DB: UPDATE payment_transactions SET status = 'succeeded'
    WhWorker->>DB: UPDATE tenant_subscriptions SET status = 'active'
    WhWorker->>DB: COMMIT
    deactivate WhWorker
```

---

## 3. Stripe Webhook Handling & Idempotency Flow

```mermaid
sequenceDiagram
    autonumber
    participant Stripe as Stripe Servers
    participant Gateway as API Gateway / Webhook Endpoint
    participant Store as PostgreSQL Event Store
    participant Ledger as Billing Ledger

    Stripe->>Gateway: POST /v1/payments/webhook (Event JSON + Stripe-Signature)
    activate Gateway
    Gateway->>Gateway: Compute HMAC-SHA256 signature and compare with Stripe-Signature
    alt Signature Invalid
        Gateway-->>Stripe: 400 Bad Request (Invalid Signature)
    else Signature Valid
        Gateway->>Store: SELECT * FROM processed_events WHERE event_id = ?
        Store-->>Gateway: Exists?
        alt Already Processed
            Gateway-->>Stripe: 200 OK (Idempotent duplicate acknowledgment)
        else New Event
            Gateway->>Store: INSERT INTO processed_events (event_id, type) VALUES (?, ?)
            Gateway->>Ledger: Apply Business Logic (credit user, update subscription)
            Ledger-->>Gateway: Success
            Gateway-->>Stripe: 200 OK
        end
    end
    deactivate Gateway
```

---

## 4. Database Schema for Payments

```sql
-- Payment Transactions Table
CREATE TABLE payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    stripe_payment_intent_id VARCHAR(255) UNIQUE NOT NULL,
    stripe_customer_id VARCHAR(255) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    status VARCHAR(50) NOT NULL, -- pending, succeeded, failed, refunded, canceled
    payment_method_type VARCHAR(50),
    receipt_url TEXT,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payment_transactions_org ON payment_transactions(organization_id);
CREATE INDEX idx_payment_transactions_intent ON payment_transactions(stripe_payment_intent_id);

-- Stripe Processed Webhook Events (Idempotency Ledger)
CREATE TABLE stripe_webhook_events (
    event_id VARCHAR(255) PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'processed', -- processed, failed
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_webhook_events_type ON stripe_webhook_events(event_type);
```

---

## 5. OpenAPI 3.0 Specification Summary

The OpenAPI specification (`backend/api/openapi.yaml`) has been extended with the following payment endpoints:
- `POST /organizations/{orgId}/payments/intents`: Creates a Stripe Payment Intent for billing or credit purchasing.
- `GET /organizations/{orgId}/payments/intents/{intentId}`: Polls the current status of a payment intent.
- `POST /payments/webhook`: Ingestion endpoint for Stripe webhook events with signature verification and idempotency guarantees.

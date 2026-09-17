-- =====================================================================
-- AgentForge Enterprise Architecture: Payment Gateway Database Schema
-- Stripe Integration Schema (Users, Transactions, Webhook Event Logs)
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. PAYMENT CUSTOMERS (Mapping organizations/users to Stripe Customers)
-- =====================================================================
CREATE TABLE IF NOT EXISTS payment_customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    stripe_customer_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    default_payment_method_id VARCHAR(255),
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_org_stripe_customer UNIQUE (organization_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_customers_org ON payment_customers(organization_id);
CREATE INDEX IF NOT EXISTS idx_payment_customers_stripe_id ON payment_customers(stripe_customer_id);

-- =====================================================================
-- 2. PAYMENT TRANSACTIONS (Intents, Charges, Invoices)
-- =====================================================================
CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    stripe_payment_intent_id VARCHAR(255) UNIQUE NOT NULL,
    stripe_customer_id VARCHAR(255) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    status VARCHAR(50) NOT NULL, -- pending, requires_action, succeeded, failed, refunded, canceled
    payment_method_type VARCHAR(50), -- card, us_bank_account, etc.
    receipt_url TEXT,
    error_message TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_org ON payment_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_intent ON payment_transactions(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);

-- =====================================================================
-- 3. TENANT SUBSCRIPTIONS (SaaS Recurring Billing)
-- =====================================================================
CREATE TABLE IF NOT EXISTS tenant_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    stripe_subscription_id VARCHAR(255) UNIQUE NOT NULL,
    stripe_price_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL, -- incomplete, incomplete_expired, trialings, active, past_due, canceled, unpaid
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    canceled_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_org ON tenant_subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_stripe_id ON tenant_subscriptions(stripe_subscription_id);

-- =====================================================================
-- 4. STRIPE WEBHOOK EVENTS (Idempotency Ledger for Event Delivery)
-- =====================================================================
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
    event_id VARCHAR(255) PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'processed', -- processed, failed, pending
    error_message TEXT,
    processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON stripe_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON stripe_webhook_events(status);

-- =====================================================================
-- 5. AUTOMATED TRIGGER FOR updated_at TIMESTAMPS
-- =====================================================================
CREATE TRIGGER update_payment_customers_modtime
    BEFORE UPDATE ON payment_customers
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_payment_transactions_modtime
    BEFORE UPDATE ON payment_transactions
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_tenant_subscriptions_modtime
    BEFORE UPDATE ON tenant_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

COMMIT;

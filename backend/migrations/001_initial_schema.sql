-- =====================================================================
-- AgentForge Enterprise Architecture: Core Identity, RBAC, API Keys & Audit
-- PostgreSQL Schema & Migration
-- =====================================================================

BEGIN;

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================================
-- 1. ORGANIZATIONS (Tenants)
-- =====================================================================
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    tier VARCHAR(50) NOT NULL DEFAULT 'standard', -- e.g. standard, enterprise
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);

-- =====================================================================
-- 2. USERS (Multi-tenant users bound to organizations or global)
-- =====================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_service_account BOOLEAN NOT NULL DEFAULT FALSE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_org_id ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- =====================================================================
-- 3. ROLES (RBAC definitions per organization or global)
-- =====================================================================
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE, -- NULL for system-wide roles
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_org_role_name UNIQUE (organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_roles_org_id ON roles(organization_id);

-- =====================================================================
-- 4. PERMISSIONS (Granular capability registry)
-- =====================================================================
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resource VARCHAR(100) NOT NULL, -- e.g., 'org', 'agent', 'api_key', 'audit'
    action VARCHAR(100) NOT NULL,   -- e.g., 'read', 'write', 'delete', 'execute'
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_resource_action UNIQUE (resource, action)
);

CREATE INDEX IF NOT EXISTS idx_permissions_resource ON permissions(resource);

-- =====================================================================
-- 5. ROLE_PERMISSIONS (Mapping roles to permissions)
-- =====================================================================
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (role_id, permission_id)
);

-- =====================================================================
-- 6. USER_ROLES (Mapping users to roles)
-- =====================================================================
CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id)
);

-- =====================================================================
-- 7. API_KEYS (Programmatic access credentials with secure hashing)
-- =====================================================================
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- creator or owner
    name VARCHAR(255) NOT NULL,
    key_prefix VARCHAR(16) NOT NULL, -- First 16 chars for display & identification (e.g. 'af_live_9x8d7f...')
    key_hash VARCHAR(255) NOT NULL,  -- Cryptographic hash of the full secret key
    scopes TEXT[] NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_org_id ON api_keys(organization_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);

-- =====================================================================
-- 8. AUDIT_LOGS (Immutable enterprise audit trail)
-- =====================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    actor_email VARCHAR(255),
    actor_type VARCHAR(50) NOT NULL DEFAULT 'user', -- 'user', 'api_key', 'system'
    action VARCHAR(150) NOT NULL, -- e.g. 'organization.created', 'api_key.revoked', 'agent.executed'
    resource_type VARCHAR(100) NOT NULL, -- e.g. 'organization', 'api_key', 'agent'
    resource_id VARCHAR(255),
    ip_address VARCHAR(45),
    user_agent TEXT,
    request_id VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'success', -- 'success', 'failure', 'denied'
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- High-performance indices for audit log querying and compliance searches
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_id ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- =====================================================================
-- 9. AUTOMATED TRIGGER FOR updated_at TIMESTAMPS
-- =====================================================================
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_organizations_modtime
    BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_users_modtime
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_roles_modtime
    BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_api_keys_modtime
    BEFORE UPDATE ON api_keys
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

COMMIT;

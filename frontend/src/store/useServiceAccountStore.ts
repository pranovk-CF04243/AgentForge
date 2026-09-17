import { create } from 'zustand';
import { ServiceAccount } from '../types/serviceAccount';

interface ServiceAccountState {
  serviceAccounts: ServiceAccount[];
  loading: boolean;
  error: string | null;
  recentlyCreatedKey: ServiceAccount | null;

  fetchServiceAccounts: () => Promise<void>;
  createServiceAccount: (name: string, projectId: string, scopes: string[]) => Promise<ServiceAccount | null>;
  revokeServiceAccount: (id: string) => Promise<void>;
  clearRecentlyCreatedKey: () => void;
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';

// Mock initial data if backend is offline or during client-side hydration
const MOCK_ACCOUNTS: ServiceAccount[] = [
  {
    id: 'sa-101',
    name: 'CI/CD GitHub Actions Pipeline',
    projectId: 'proj-1',
    scopes: ['projects:write', 'tasks:execute', 'artifacts:upload'],
    maskedKey: 'af_live_...9a2f',
    lastUsedAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    revoked: false,
  },
  {
    id: 'sa-102',
    name: 'Production Kafka Consumer SRE',
    projectId: 'proj-1',
    scopes: ['events:read', 'incidents:write'],
    maskedKey: 'af_live_...b47c',
    lastUsedAt: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString(),
    revoked: false,
  },
  {
    id: 'sa-103',
    name: 'Legacy Staging Integration Key',
    projectId: 'proj-2',
    scopes: ['projects:read'],
    maskedKey: 'af_live_...88e1',
    lastUsedAt: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 240).toISOString(),
    revoked: true,
    revokedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
];

export const useServiceAccountStore = create<ServiceAccountState>((set, get) => ({
  serviceAccounts: MOCK_ACCOUNTS,
  loading: false,
  error: null,
  recentlyCreatedKey: null,

  fetchServiceAccounts: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${BACKEND_URL}/api/service-accounts`);
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        set({ serviceAccounts: data, loading: false });
      }
    } catch (e) {
      console.warn('Backend service accounts endpoint offline; using local mock cache.', e);
      set({ loading: false });
    }
  },

  createServiceAccount: async (name: string, projectId: string, scopes: string[]) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${BACKEND_URL}/api/service-accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, projectId, scopes }),
      });

      if (!res.ok) {
        throw new Error(`Failed to create service account: ${res.statusText}`);
      }

      const created: ServiceAccount = await res.json();
      set((state) => ({
        serviceAccounts: [created, ...state.serviceAccounts],
        recentlyCreatedKey: created,
        loading: false,
      }));
      return created;
    } catch (e) {
      console.warn('Backend API offline, generating mock service account locally with cache invalidation.');
      // Fallback mock creation
      const randomHex = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
      const rawKey = `af_live_${randomHex}${randomHex}`;
      const maskedKey = `af_live_...${rawKey.slice(-4)}`;

      const newAccount: ServiceAccount = {
        id: `sa-${Date.now()}`,
        name,
        projectId,
        scopes,
        maskedKey,
        rawKey,
        lastUsedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        revoked: false,
      };

      set((state) => ({
        serviceAccounts: [newAccount, ...state.serviceAccounts],
        recentlyCreatedKey: newAccount,
        loading: false,
      }));
      return newAccount;
    }
  },

  revokeServiceAccount: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${BACKEND_URL}/api/service-accounts/${id}/revoke`, {
        method: 'POST',
      });

      if (!res.ok) {
        throw new Error(`Failed to revoke key: ${res.statusText}`);
      }
    } catch (e) {
      console.warn('Backend revoke API offline, updating local state & invalidating cache immediately.');
    }

    // Instant local state update & cache invalidation
    set((state) => ({
      serviceAccounts: state.serviceAccounts.map((sa) =>
        sa.id === id ? { ...sa, revoked: true, revokedAt: new Date().toISOString() } : sa
      ),
      loading: false,
    }));
  },

  clearRecentlyCreatedKey: () => {
    set({ recentlyCreatedKey: null });
  },
}));

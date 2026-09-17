export interface ServiceAccount {
  id: string;
  name: string;
  projectId: string;
  scopes: string[];
  maskedKey: string;
  rawKey?: string; // shown once upon creation
  lastUsedAt?: string;
  createdAt: string;
  revoked: boolean;
  revokedAt?: string;
}

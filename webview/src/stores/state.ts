import { writable } from 'svelte/store';
import type { Stats, AuditEntry, ProfileInfo } from '../lib/types';

const defaultStats: Stats = {
  totalScans: 0,
  piiFound: 0,
  secretsFound: 0,
  promptsBlocked: 0,
  commandsBlocked: 0,
};

export const stats = writable<Stats>(defaultStats);
export const events = writable<AuditEntry[]>([]);
export const connected = writable(false);
export const logoUri = writable('');
export const profile = writable<ProfileInfo | undefined>(undefined);
export const openItems = writable<Record<number, boolean>>({});

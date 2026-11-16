/**
 * Raidu API integration: token reader and remote validation.
 *
 * Security:
 * - Token read from ~/.raidu/token (0600 perms), NOT from settings.json
 * - No shell commands (uses execFileSync with array args)
 * - Token never appears in process list as part of a shell string
 * - Input capped to prevent sending huge payloads
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { debug } from './audit';
import type { BlockReport, EvidenceVerdict } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const API_BASE = process.env.RAIDU_API_BASE || 'https://sandbox.raidu.com';
const TOKEN_FILE = path.join(os.homedir(), '.raidu', 'token');
const MAX_API_INPUT = 100_000;

// ---------------------------------------------------------------------------
// Token reader (secure file, not settings.json)
// ---------------------------------------------------------------------------

export function hasToken(): boolean {
  return getToken() !== null;
}

function getToken(): string | null {
  try {
    const token = fs.readFileSync(TOKEN_FILE, 'utf-8').trim();
    return token || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Settings reader (for non-secret values like workspaceId, environmentId)
// ---------------------------------------------------------------------------

function getSettingsDir(): string | null {
  switch (process.platform) {
    case 'darwin':
      return path.join(os.homedir(), 'Library', 'Application Support', 'Cursor', 'User');
    case 'linux':
      return path.join(os.homedir(), '.config', 'Cursor', 'User');
    case 'win32':
      return path.join(process.env.APPDATA || '', 'Cursor', 'User');
    default:
      return null;
  }
}

export function readSetting(key: string): string | null {
  try {
    const dir = getSettingsDir();
    if (!dir) return null;
    const p = path.join(dir, 'settings.json');
    return JSON.parse(fs.readFileSync(p, 'utf-8'))[key] || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// API validation
// ---------------------------------------------------------------------------

export interface APIValidationResult {
  passed: boolean;
  entities?: Array<{ type: string; start?: number; end?: number; confidence?: number }>;
  sanitizedInput?: string;
  summary?: { pii?: number; pci?: number; phi?: number; secrets?: number };
  processingTimeMs?: number;
  /** Whether Tower stored the violation row (newer servers only). */
  evidence?: EvidenceVerdict;
}

export function validateViaAPI(input: string): APIValidationResult | null {
  const token = getToken();
  if (!token) {
    debug('API: no token, skipping');
    return null;
  }

  const safeInput = input.slice(0, MAX_API_INPUT);
  const envId = readSetting('raidu.environmentId');

  const body = JSON.stringify({ input: safeInput });
  const url = `${API_BASE}/api/guardrails/ide/validate`;
  const startMs = performance.now();

  debug(`API: POST ${url} (${body.length}B, env=${envId || 'none'})`);

  try {
    const result = execFileSync(
      'curl',
      [
        '-fsSL',
        '-X',
        'POST',
        '-H',
        `Authorization: Bearer ${token}`,
        '-H',
        'Content-Type: application/json',
        '-d',
        body,
        url,
      ],
      { timeout: 8000, encoding: 'utf-8' as BufferEncoding, stdio: ['pipe', 'pipe', 'pipe'] },
    );

    const latencyMs = (performance.now() - startMs).toFixed(0);
    const parsed = JSON.parse(result as string);

    debug(
      `API: ${latencyMs}ms | passed=${parsed.passed} | entities=${parsed.entities?.length || 0} | sanitized=${!!parsed.sanitizedInput} | serverMs=${parsed.processingTimeMs || '?'}`,
    );
    debug(`API: response=${JSON.stringify(parsed)}`);

    return parsed;
  } catch (err: unknown) {
    const latencyMs = (performance.now() - startMs).toFixed(0);
    debug(`API: FAILED after ${latencyMs}ms | ${(err as Error).message?.slice(0, 150)}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Block reports (called from the detached flusher, never from a hook directly)
// ---------------------------------------------------------------------------

/**
 * POST a batch of block reports. Returns per-report verdicts in request order,
 * or null on any failure (no token, network, non-2xx), so the caller requeues.
 */
export function postBlockReports(reports: BlockReport[]): EvidenceVerdict[] | null {
  const token = getToken();
  if (!token || reports.length === 0) return null;

  const url = `${API_BASE}/api/guardrails/ide/report`;
  const body = JSON.stringify({ reports });

  try {
    const result = execFileSync(
      'curl',
      [
        '-fsSL',
        '-X',
        'POST',
        '-H',
        `Authorization: Bearer ${token}`,
        '-H',
        'Content-Type: application/json',
        '--data-binary',
        '@-',
        url,
      ],
      // Body over stdin, not argv: keeps it out of the process list.
      { input: body, timeout: 15000, encoding: 'utf-8' as BufferEncoding, stdio: ['pipe', 'pipe', 'pipe'] },
    );
    const parsed = JSON.parse(result as string) as { results?: EvidenceVerdict[] };
    if (!Array.isArray(parsed.results)) return null;
    return parsed.results;
  } catch (err: unknown) {
    debug(`API: report FAILED | ${(err as Error).message?.slice(0, 150)}`);
    return null;
  }
}

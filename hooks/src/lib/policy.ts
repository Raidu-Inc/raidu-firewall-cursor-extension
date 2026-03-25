/**
 * Policy management: file sensitivity, command blocking, glob matching.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { LOG_DIR } from './audit';
import type { Policy } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const POLICY_CACHE = path.join(LOG_DIR, 'policy.json');

export const DEFAULT_POLICY: Policy = {
  files: {
    blocked: [
      '.env',
      '.env.local',
      '.env.production',
      '.env.staging',
      '.env.development',
      '*.env',
      'credentials*',
      'secrets*',
      '*.pem',
      '*.key',
      '*.p12',
      '*.pfx',
      '*.jks',
      '*.keystore',
      'id_rsa',
      'id_ed25519',
      'id_ecdsa',
      '.netrc',
      '.pgpass',
      '.npmrc',
      '.pypirc',
      '.aws/*',
      '.aws/credentials',
      '.ssh/*',
      '.kube/*',
      '.kube/config',
      'docker-compose*.yml',
      'docker-compose*.yaml',
    ],
    allowed: ['.env.example', '.env.sample', '.env.template'],
  },
  commands: {
    blocked: [
      'printenv',
      'env$',
      'set$',
      'echo.*\\$.*KEY',
      'echo.*\\$.*SECRET',
      'echo.*\\$.*TOKEN',
      'echo.*\\$.*PASSWORD',
    ],
  },
};

// ---------------------------------------------------------------------------
// Policy loader
// ---------------------------------------------------------------------------

export function getPolicy(): Policy {
  let policy = { ...DEFAULT_POLICY, files: { ...DEFAULT_POLICY.files, blocked: [...DEFAULT_POLICY.files.blocked] } };

  // Try API-cached policy
  try {
    const cached = JSON.parse(fs.readFileSync(POLICY_CACHE, 'utf-8'));
    if (cached?.files?.blocked && Array.isArray(cached.files.blocked) && cached.files.blocked.length > 0) {
      policy = cached as Policy;
    }
  } catch {}

  // Merge .cursorignore if it exists in the project
  const projectDir = process.env.CURSOR_PROJECT_DIR || process.cwd();
  try {
    const content = fs.readFileSync(path.join(projectDir, '.cursorignore'), 'utf-8');
    const existing = new Set(policy.files.blocked);
    for (const line of content.split('\n')) {
      const p = line.trim();
      if (p && !p.startsWith('#') && !existing.has(p)) {
        policy.files.blocked.push(p);
        existing.add(p);
      }
    }
  } catch {}

  return policy;
}

// ---------------------------------------------------------------------------
// Glob / sensitivity helpers
// ---------------------------------------------------------------------------

export function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // escape regex specials (not *)
    .replace(/\*/g, '.*'); // convert glob * to regex .*
  return new RegExp(escaped, 'i');
}

export function isSensitiveFile(filePath: string): string | null {
  const policy = getPolicy();
  const name = path.basename(filePath);

  for (const p of policy.files.allowed || []) {
    if (globToRegex(p).test(name) || globToRegex(p).test(filePath)) return null;
  }
  for (const p of policy.files.blocked) {
    if (globToRegex(p).test(name) || globToRegex(p).test(filePath)) return p;
  }
  return null;
}

export function checkToolInputForSensitiveFiles(toolInput: Record<string, unknown>): string | null {
  const policy = getPolicy();

  if (toolInput.file_path) {
    const hit = isSensitiveFile(toolInput.file_path as string);
    if (hit) return `Blocked access to ${path.basename(toolInput.file_path as string)} (policy: ${hit})`;
  }

  if (toolInput.glob) {
    for (const p of policy.files.blocked) {
      if (globToRegex(p).test(toolInput.glob as string))
        return `Blocked search for sensitive files (${toolInput.glob})`;
    }
  }

  if (toolInput.command) {
    for (const p of policy.files.blocked) {
      if (globToRegex(p).test(toolInput.command as string)) return `Blocked shell access to ${p}`;
    }
    for (const p of policy.commands.blocked) {
      try {
        if (new RegExp(p, 'i').test(toolInput.command as string)) return `Blocked command (policy: ${p})`;
      } catch {}
    }
  }

  return null;
}

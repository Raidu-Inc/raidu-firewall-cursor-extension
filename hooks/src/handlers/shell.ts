/**
 * Handlers: beforeShellExecution, afterShellExecution
 */

import { audit, incStat } from '../lib/audit';
import { allow, deny, ids } from '../lib/helpers';
import { entitySummary, formatEntities, scanText, scanTextLocal } from '../lib/redaction';
import type { HookEvent, HookResponse } from '../lib/types';

// ---------------------------------------------------------------------------
// Exfiltration patterns (same as tool-use, needed for shell handler)
// ---------------------------------------------------------------------------

const EXFIL_PATTERNS: RegExp[] = [/curl\s+.*(-d|--data)/i, /wget\s+.*--post/i, /scp\s+.*@/, /rsync\s+.*@/, /nc\s+-/];

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export function handleBeforeShellExecution(event: HookEvent): HookResponse {
  const cmd = event.command || '';
  const { entities } = scanText(cmd);
  if (entities.length > 0) {
    incStat('commandsBlocked');
    audit({
      event: 'beforeShellExecution',
      action: 'blocked',
      command: cmd.slice(0, 500),
      entities: entitySummary(entities),
      ...ids(event),
    });
    return deny(`Blocked command. Contains ${formatEntities(entities)}.`);
  }
  if (EXFIL_PATTERNS.some((p) => p.test(cmd))) {
    incStat('commandsBlocked');
    audit({
      event: 'beforeShellExecution',
      action: 'blocked',
      command: cmd.slice(0, 500),
      reason: 'data exfiltration',
      ...ids(event),
    });
    return deny('Blocked command. Data exfiltration pattern detected.');
  }
  audit({ event: 'beforeShellExecution', action: 'allowed', command: cmd.slice(0, 200), ...ids(event) });
  return allow();
}

export function handleAfterShellExecution(event: HookEvent): HookResponse {
  const { entities } = scanTextLocal(event.output || '');
  const action = entities.length > 0 ? 'leak_detected' : 'logged';
  if (entities.length > 0) incStat('piiFound', entities.length);
  audit({
    event: 'afterShellExecution',
    action,
    command: (event.command || '').slice(0, 200),
    entities: entities.length > 0 ? entitySummary(entities) : undefined,
    ...ids(event),
  });
  return allow();
}

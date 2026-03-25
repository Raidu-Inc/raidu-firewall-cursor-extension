/**
 * Handler: preToolUse
 *
 * Blocks sensitive FILE ACCESS by name pattern only (not content scanning).
 * Scans shell commands for secrets and exfiltration patterns.
 *
 * We do NOT scan file content because:
 * - Source code triggers false positives (PERSON, NRP in class/function names)
 * - Reading file content adds latency
 * - File protection is by name pattern (.env, credentials, keys)
 * - Prompt content is scanned separately by beforeSubmitPrompt
 */

import { audit, incStat } from '../lib/audit';
import { allow, deny, ids } from '../lib/helpers';
import { checkToolInputForSensitiveFiles } from '../lib/policy';
import { entitySummary, formatEntities, scanText } from '../lib/redaction';
import type { HookEvent, HookResponse } from '../lib/types';

const EXFIL_PATTERNS: RegExp[] = [/curl\s+.*(-d|--data)/i, /wget\s+.*--post/i, /scp\s+.*@/, /rsync\s+.*@/, /nc\s+-/];

export function handlePreToolUse(event: HookEvent): HookResponse {
  const tool = event.tool_name || '';
  const input = event.tool_input || {};

  // Block sensitive file access by NAME PATTERN only (no content scanning)
  const hit = checkToolInputForSensitiveFiles(input);
  if (hit) {
    incStat('commandsBlocked');
    audit({ event: 'preToolUse', action: 'blocked', tool, reason: hit, ...ids(event) });
    return deny(hit);
  }

  // Scan Shell/Bash commands for secrets + exfiltration
  if ((tool === 'Shell' || tool === 'Bash') && input.command) {
    incStat('totalScans');
    const { entities } = scanText(input.command as string);
    if (entities.length > 0) {
      incStat('piiFound', entities.length);
      incStat('commandsBlocked');
      audit({
        event: 'preToolUse',
        action: 'blocked',
        tool,
        command: (input.command as string).slice(0, 500),
        entities: entitySummary(entities),
        ...ids(event),
      });
      return deny(`Blocked command. Contains ${formatEntities(entities)}.`);
    }
    if (EXFIL_PATTERNS.some((p) => p.test(input.command as string))) {
      incStat('commandsBlocked');
      audit({
        event: 'preToolUse',
        action: 'blocked',
        tool,
        command: (input.command as string).slice(0, 500),
        reason: 'data exfiltration',
        ...ids(event),
      });
      return deny('Blocked command. Data exfiltration pattern detected.');
    }
  }

  audit({ event: 'preToolUse', action: 'allowed', tool, ...ids(event) });
  return allow();
}

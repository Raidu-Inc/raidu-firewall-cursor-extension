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
import { findSensitiveToolAccess } from '../lib/policy';
import { entitySummary, formatEntities, scanText } from '../lib/redaction';
import { reportBlock, reportScanBlockIfUnrecorded } from '../lib/report';
import type { HookEvent, HookResponse } from '../lib/types';

const EXFIL_PATTERNS: RegExp[] = [/curl\s+.*(-d|--data)/i, /wget\s+.*--post/i, /scp\s+.*@/, /rsync\s+.*@/, /nc\s+-/];

export function handlePreToolUse(event: HookEvent): HookResponse {
  const tool = event.tool_name || '';
  const input = event.tool_input || {};

  // Block sensitive file access by NAME PATTERN only (no content scanning)
  const hit = findSensitiveToolAccess(input);
  if (hit) {
    incStat('commandsBlocked');
    audit({ event: 'preToolUse', action: 'blocked', tool, reason: hit.message, ...ids(event) });
    reportBlock(event, {
      event: 'preToolUse',
      kind: hit.kind,
      detector: 'local',
      tool,
      rule: hit.rule,
      fileName: hit.fileName,
    });
    return deny(hit.message);
  }

  // Scan Shell/Bash commands for secrets + exfiltration
  if ((tool === 'Shell' || tool === 'Bash') && input.command) {
    incStat('totalScans');
    const scan = scanText(input.command as string);
    const { entities } = scan;
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
      reportScanBlockIfUnrecorded(event, scan, { event: 'preToolUse', tool });
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
      reportBlock(event, { event: 'preToolUse', kind: 'exfiltration', detector: 'local', tool });
      return deny('Blocked command. Data exfiltration pattern detected.');
    }
  }

  audit({ event: 'preToolUse', action: 'allowed', tool, ...ids(event) });
  return allow();
}

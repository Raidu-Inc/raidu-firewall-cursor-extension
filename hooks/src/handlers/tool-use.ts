/**
 * Handler: preToolUse
 * Checks all tool types for sensitive files, scans Read content,
 * Shell secrets + exfiltration.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { audit, incStat } from '../lib/audit';
import { allow, deny, ids } from '../lib/helpers';
import { checkToolInputForSensitiveFiles } from '../lib/policy';
import { entitySummary, formatEntities, MAX_SCAN_SIZE, scanText } from '../lib/redaction';
import type { HookEvent, HookResponse } from '../lib/types';

// ---------------------------------------------------------------------------
// Exfiltration patterns (kept in this handler per spec)
// ---------------------------------------------------------------------------

const EXFIL_PATTERNS: RegExp[] = [/curl\s+.*(-d|--data)/i, /wget\s+.*--post/i, /scp\s+.*@/, /rsync\s+.*@/, /nc\s+-/];

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export function handlePreToolUse(event: HookEvent): HookResponse {
  const tool = event.tool_name || '';
  const input = event.tool_input || {};

  // Check all tool types for sensitive file access
  const hit = checkToolInputForSensitiveFiles(input);
  if (hit) {
    incStat('commandsBlocked');
    audit({ event: 'preToolUse', action: 'blocked', tool, reason: hit, ...ids(event) });
    return deny(hit);
  }

  // Scan Read tool file content
  if (tool === 'Read' && input.file_path) {
    try {
      const stat = fs.statSync(input.file_path as string);
      if (stat.size < MAX_SCAN_SIZE) {
        const { entities } = scanText(fs.readFileSync(input.file_path as string, 'utf-8'));
        if (entities.length > 0) {
          incStat('piiFound', entities.length);
          incStat('commandsBlocked');
          audit({
            event: 'preToolUse',
            action: 'blocked',
            tool,
            filePath: input.file_path,
            entities: entitySummary(entities),
            ...ids(event),
          });
          return deny(
            `Blocked reading ${path.basename(input.file_path as string)}. Contains ${formatEntities(entities)}.`,
          );
        }
      }
    } catch {}
  }

  // Scan Shell commands for secrets + exfiltration
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

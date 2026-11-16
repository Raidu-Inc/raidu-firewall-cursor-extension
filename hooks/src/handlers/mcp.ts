/**
 * Handler: beforeMCPExecution
 */

import { audit, incStat } from '../lib/audit';
import { allow, deny, ids } from '../lib/helpers';
import { entitySummary, formatEntities, scanText } from '../lib/redaction';
import { reportScanBlockIfUnrecorded } from '../lib/report';
import type { HookEvent, HookResponse } from '../lib/types';

export function handleBeforeMCPExecution(event: HookEvent): HookResponse {
  const inputStr = typeof event.tool_input === 'string' ? event.tool_input : JSON.stringify(event.tool_input || '');
  const scan = scanText(inputStr);
  const { entities } = scan;
  if (entities.length > 0) {
    incStat('commandsBlocked');
    audit({
      event: 'beforeMCPExecution',
      action: 'blocked',
      tool: event.tool_name,
      entities: entitySummary(entities),
      ...ids(event),
    });
    reportScanBlockIfUnrecorded(event, scan, { event: 'beforeMCPExecution', tool: event.tool_name });
    return deny(`Blocked MCP tool ${event.tool_name}. Input contains ${formatEntities(entities)}.`);
  }
  audit({ event: 'beforeMCPExecution', action: 'allowed', tool: event.tool_name, ...ids(event) });
  return allow();
}

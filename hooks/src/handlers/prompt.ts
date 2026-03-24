/**
 * Handler: beforeSubmitPrompt
 * Uses unified scanText() which calls API first, local fallback.
 */

import { audit, incStat } from '../lib/audit';
import { allow, denyPrompt, ids } from '../lib/helpers';
import { copyToClipboard, entitySummary, formatEntities, redactText, scanText } from '../lib/redaction';
import type { HookEvent, HookResponse } from '../lib/types';

export function handleBeforeSubmitPrompt(event: HookEvent): HookResponse {
  const prompt = event.prompt || '';
  if (!prompt) return allow();
  incStat('totalScans');

  // scanText calls API first (if connected), falls back to local regex
  const result = scanText(prompt);

  if (result.entities.length > 0) {
    incStat('piiFound', result.entities.length);
    incStat('promptsBlocked');

    // Use API sanitized version if available, otherwise local redaction
    const safeVersion = result.sanitizedInput || redactText(prompt, result.entities);
    if (safeVersion !== prompt) copyToClipboard(safeVersion);

    audit({
      event: 'beforeSubmitPrompt',
      action: 'blocked',
      source: result.source,
      entities: entitySummary(result.entities),
      scanTimeMs: result.scanTimeMs,
      ...ids(event),
    });

    return denyPrompt(
      `Detected ${formatEntities(result.entities)} in your prompt. A compliant version is in your clipboard. Press Cmd+V.`,
    );
  }

  audit({
    event: 'beforeSubmitPrompt',
    action: 'allowed',
    source: result.source,
    scanTimeMs: result.scanTimeMs,
    ...ids(event),
  });
  return allow();
}

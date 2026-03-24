/**
 * Deny / Allow response helpers and event ID extractor.
 */

import type { HookEvent, HookResponse } from './types';

export function deny(msg: string): HookResponse {
  return { permission: 'deny', user_message: `Raidu Firewall: ${msg}` };
}

export function denyPrompt(msg: string): HookResponse {
  return { continue: false, user_message: `Raidu Firewall: ${msg}` };
}

export function allow(): HookResponse {
  return {};
}

export function ids(event: HookEvent): { conversationId?: string; generationId?: string } {
  return { conversationId: event.conversation_id, generationId: event.generation_id };
}

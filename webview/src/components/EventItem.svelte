<script lang="ts">
  import type { AuditEntry } from '../lib/types';
  import { openItems } from '../stores/state';

  export let entry: AuditEntry;
  export let index: number;

  const ICON_MAP: Record<string, string> = {
    beforeSubmitPrompt: '💬',
    preToolUse: '⚙',
    afterShellExecution: '💻',
    afterFileEdit: '✏',
    beforeReadFile: '📄',
    afterAgentResponse: '🤖',
    beforeMCPExecution: '🔌',
    beforeTabFileRead: '↹',
    subagentStart: '🔀',
    beforeShellExecution: '💻',
  };

  const BADGE_CLASS: Record<string, string> = {
    blocked: 'badge-red',
    allowed: 'badge-green',
    leak_detected: 'badge-orange',
    secret_written: 'badge-orange',
    leak_in_response: 'badge-orange',
    logged: 'badge-green',
  };

  $: icon = ICON_MAP[entry.event] || '\uD83D\uDCCB';
  $: badgeClass = BADGE_CLASS[entry.action] || 'badge-green';
  $: expanded = $openItems[index] || false;

  function toggle() {
    openItems.update(items => {
      const next = { ...items };
      next[index] = !next[index];
      return next;
    });
  }

  function relativeTime(ts: string): string {
    const diff = (Date.now() - new Date(ts).getTime()) / 1000;
    if (diff < 60) return `${Math.floor(diff)}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(ts).toLocaleDateString();
  }

  function subtitle(e: AuditEntry): string {
    if (e.filePath) return e.filePath.split('/').pop() || e.filePath;
    if (e.command) return e.command.length > 60 ? e.command.slice(0, 57) + '...' : e.command;
    if (e.reason) return e.reason;
    if (e.entities && e.entities.length > 0) {
      return e.entities.map(en => en.type.replace(/_/g, ' ').toLowerCase()).join(', ');
    }
    if (e.tool) return e.tool;
    return '';
  }

  function eventTitle(e: AuditEntry): string {
    const names: Record<string, string> = {
      beforeSubmitPrompt: 'Prompt Scan',
      preToolUse: 'Tool Use',
      afterShellExecution: 'Shell Output',
      afterFileEdit: 'File Edit',
      beforeReadFile: 'File Read',
      afterAgentResponse: 'Agent Response',
      beforeMCPExecution: 'MCP Execution',
      beforeTabFileRead: 'Tab File Read',
      subagentStart: 'Subagent Start',
      beforeShellExecution: 'Shell Execution',
    };
    return names[e.event] || e.event;
  }

  function detailEntries(e: AuditEntry): [string, string][] {
    const pairs: [string, string][] = [];
    if (e.event) pairs.push(['Event', e.event]);
    if (e.action) pairs.push(['Action', e.action]);
    if (e.tool) pairs.push(['Tool', e.tool]);
    if (e.filePath) pairs.push(['File', e.filePath]);
    if (e.command) pairs.push(['Command', e.command]);
    if (e.reason) pairs.push(['Reason', e.reason]);
    if (e.source) pairs.push(['Source', e.source]);
    if (e.subagentType) pairs.push(['Subagent', e.subagentType]);
    if (e.scanTimeMs !== undefined) pairs.push(['Scan Time', `${e.scanTimeMs}ms`]);
    if (e.entities && e.entities.length > 0) {
      pairs.push(['Entities', e.entities.map(en => `${en.type} (${en.score.toFixed(2)})`).join(', ')]);
    }
    if (e.timestamp) pairs.push(['Timestamp', new Date(e.timestamp).toLocaleString()]);
    if (e.conversationId) pairs.push(['Conversation', e.conversationId]);
    if (e.generationId) pairs.push(['Generation', e.generationId]);
    return pairs;
  }
</script>

<div class="event-item" class:expanded on:click={toggle} on:keydown={e => e.key === 'Enter' && toggle()} role="button" tabindex="0">
  <div class="event-row">
    <span class="event-icon">{icon}</span>
    <div class="event-content">
      <div class="event-header">
        <span class="event-title">{eventTitle(entry)}</span>
        <span class="event-time">{relativeTime(entry.timestamp)}</span>
      </div>
      <div class="event-meta">
        {#if subtitle(entry)}
          <span class="event-subtitle">{subtitle(entry)}</span>
        {/if}
        <span class="badge {badgeClass}">{entry.action.replace(/_/g, ' ')}</span>
      </div>
    </div>
  </div>

  {#if expanded}
    <div class="event-detail">
      {#each detailEntries(entry) as [key, val]}
        <div class="detail-row">
          <span class="detail-key">{key}</span>
          <span class="detail-val">{val}</span>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .event-item {
    padding: 8px 12px;
    border-bottom: 1px solid var(--vscode-widget-border, rgba(255,255,255,0.06));
    cursor: pointer;
    transition: background 0.1s;
  }
  .event-item:hover {
    background: var(--vscode-list-hoverBackground, rgba(255,255,255,0.04));
  }
  .event-row {
    display: flex;
    gap: 8px;
    align-items: flex-start;
  }
  .event-icon {
    font-size: 14px;
    flex-shrink: 0;
    margin-top: 1px;
  }
  .event-content {
    flex: 1;
    min-width: 0;
  }
  .event-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 4px;
  }
  .event-title {
    font-size: 12px;
    font-weight: 500;
    color: var(--vscode-foreground);
  }
  .event-time {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    flex-shrink: 0;
    font-family: var(--vscode-editor-font-family);
  }
  .event-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 2px;
  }
  .event-subtitle {
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }
  .badge {
    font-size: 9px;
    padding: 1px 5px;
    border-radius: 3px;
    font-weight: 600;
    text-transform: uppercase;
    flex-shrink: 0;
    letter-spacing: 0.3px;
  }
  .badge-green {
    background: rgba(63, 185, 80, 0.15);
    color: var(--ok, #3fb950);
  }
  .badge-red {
    background: rgba(226, 85, 85, 0.15);
    color: var(--err, #e25555);
  }
  .badge-orange {
    background: rgba(232, 163, 23, 0.15);
    color: var(--warn, #e8a317);
  }
  .event-detail {
    margin-top: 8px;
    padding: 8px;
    border-radius: 4px;
    background: var(--vscode-editor-background);
    font-size: 11px;
  }
  .detail-row {
    display: flex;
    gap: 8px;
    padding: 3px 0;
    border-bottom: 1px solid var(--vscode-widget-border, rgba(255,255,255,0.04));
  }
  .detail-row:last-child {
    border-bottom: none;
  }
  .detail-key {
    color: var(--vscode-descriptionForeground);
    min-width: 70px;
    flex-shrink: 0;
    font-weight: 500;
  }
  .detail-val {
    color: var(--vscode-foreground);
    font-family: var(--vscode-editor-font-family);
    word-break: break-all;
  }
</style>

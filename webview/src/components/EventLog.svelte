<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { AuditEntry } from '../lib/types';
  import EventItem from './EventItem.svelte';
  import EmptyState from './EmptyState.svelte';

  export let events: AuditEntry[];

  const dispatch = createEventDispatcher<{ refresh: void }>();
</script>

<div class="event-log">
  <div class="section-header">
    <span class="section-title">Activity</span>
    <button class="refresh-btn" on:click={() => dispatch('refresh')} title="Refresh">
      &#x21BB;
    </button>
  </div>

  <div class="event-list">
    {#if events.length === 0}
      <EmptyState icon="✓" text="No activity yet. Raidu is monitoring your AI interactions." />
    {:else}
      {#each events as entry, i (entry.timestamp + i)}
        <EventItem {entry} index={i} />
      {/each}
    {/if}
  </div>
</div>

<style>
  .event-log {
    padding: 0 12px 12px;
  }
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid var(--vscode-widget-border, rgba(255,255,255,0.06));
    margin-bottom: 4px;
  }
  .section-title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--vscode-descriptionForeground);
  }
  .refresh-btn {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    font-size: 14px;
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 3px;
    line-height: 1;
  }
  .refresh-btn:hover {
    background: var(--vscode-list-hoverBackground, rgba(255,255,255,0.04));
    color: var(--vscode-foreground);
  }
  .event-list {
    overflow-y: auto;
    max-height: calc(100vh - 240px);
  }
</style>

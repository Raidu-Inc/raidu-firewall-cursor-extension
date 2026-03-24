<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Stats } from '../lib/types';
  import StatCard from './StatCard.svelte';

  export let stats: Stats;
  export let connected: boolean;
  export let profile: { email?: string; name?: string; org?: string; plan?: string; workspace?: string; environment?: string } | undefined = undefined;

  const dispatch = createEventDispatcher<{ logout: void }>();

  $: blocked = stats.promptsBlocked + stats.commandsBlocked;
</script>

<div class="dashboard">
  <div class="header">
    <span class="status-dot" class:on={connected} class:off={!connected}></span>
    <span class="header-title">Raidu Firewall</span>
  </div>

  {#if profile}
    <div class="profile">
      <div class="profile-name">{profile.name || profile.email || 'User'}</div>
      <div class="profile-details">
        {#if profile.org}<span class="profile-org">{profile.org}</span>{/if}
        {#if profile.plan}<span class="profile-plan">{profile.plan}</span>{/if}
      </div>
      {#if profile.workspace}
        <div class="profile-workspace">{profile.workspace}{#if profile.environment} / {profile.environment}{/if}</div>
      {/if}
    </div>
  {/if}

  <div class="stats-grid">
    <StatCard value={stats.totalScans} label="Scanned" />
    <StatCard value={stats.piiFound} label="PII" colorClass={stats.piiFound > 0 ? 'warn' : ''} />
    <StatCard value={stats.secretsFound} label="Secrets" colorClass={stats.secretsFound > 0 ? 'error' : ''} />
    <StatCard value={blocked} label="Blocked" colorClass={blocked > 0 ? 'error' : ''} />
  </div>

  <div class="connection-bar">
    <span class="connection-text">
      {connected ? 'Connected' : 'Disconnected'}
    </span>
    <button class="disconnect-btn" on:click={() => dispatch('logout')}>
      Disconnect
    </button>
  </div>
</div>

<style>
  .dashboard {
    padding: 12px;
  }
  .header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }
  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .status-dot.on {
    background: var(--ok, #3fb950);
    box-shadow: 0 0 6px var(--ok, #3fb950);
  }
  .status-dot.off {
    background: var(--err, #e25555);
  }
  .header-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--vscode-foreground);
  }

  .profile {
    padding: 8px 10px;
    margin-bottom: 10px;
    background: var(--vscode-editor-background);
    border-radius: 4px;
    border-left: 3px solid var(--ok, #3fb950);
  }
  .profile-name {
    font-size: 12px;
    font-weight: 600;
    color: var(--vscode-foreground);
  }
  .profile-details {
    display: flex;
    gap: 8px;
    margin-top: 3px;
    font-size: 10px;
  }
  .profile-org {
    color: var(--vscode-descriptionForeground);
  }
  .profile-plan {
    color: var(--ok, #3fb950);
    text-transform: uppercase;
    font-weight: 600;
    letter-spacing: 0.5px;
  }
  .profile-workspace {
    margin-top: 3px;
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    font-family: var(--vscode-editor-font-family);
  }

  .stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr;
    gap: 6px;
    margin-bottom: 12px;
  }
  .connection-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 10px;
    border-radius: 4px;
    background: var(--vscode-editor-background);
    font-size: 11px;
  }
  .connection-text {
    color: var(--vscode-descriptionForeground);
  }
  .disconnect-btn {
    background: none;
    border: 1px solid var(--vscode-button-secondaryBackground, #3a3d41);
    color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
    border-radius: 3px;
    padding: 2px 8px;
    font-size: 11px;
    font-family: var(--vscode-font-family);
    cursor: pointer;
  }
  .disconnect-btn:hover {
    background: var(--vscode-button-secondaryHoverBackground, #45484d);
  }
</style>

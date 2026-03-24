<script lang="ts">
  import { onMount } from 'svelte';
  import { vscode } from './lib/vscode';
  import type { UpdateMessage } from './lib/types';
  import { stats, events, connected, logoUri, profile } from './stores/state';

  import Welcome from './components/Welcome.svelte';
  import Dashboard from './components/Dashboard.svelte';
  import EventLog from './components/EventLog.svelte';

  function handleMessage(event: MessageEvent) {
    const msg = event.data as UpdateMessage;
    if (msg.type === 'update') {
      stats.set(msg.stats);
      events.set(msg.events);
      connected.set(msg.connected);
      logoUri.set(msg.logoUri);
      profile.set(msg.profile);
    }
  }

  function handleLogin() {
    vscode.postMessage({ type: 'login' });
  }

  function handleLogout() {
    vscode.postMessage({ type: 'logout' });
  }

  function handleRefresh() {
    vscode.postMessage({ type: 'refresh' });
  }

  onMount(() => {
    window.addEventListener('message', handleMessage);
    vscode.postMessage({ type: 'ready' });

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  });
</script>

<main>
  {#if !$connected}
    <Welcome logoUri={$logoUri} on:login={handleLogin} />
  {:else}
    <Dashboard stats={$stats} connected={$connected} profile={$profile} on:logout={handleLogout} />
    <EventLog events={$events} on:refresh={handleRefresh} />
  {/if}
</main>

<style>
  :global(*) {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  :global(body) {
    background: var(--vscode-sideBar-background);
    color: var(--vscode-sideBar-foreground);
    font-family: var(--vscode-font-family);
    font-size: 12px;
    --ok: #3fb950;
    --warn: #e8a317;
    --err: #e25555;
  }
  main {
    min-height: 100vh;
  }
</style>

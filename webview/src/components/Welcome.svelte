<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let logoUri: string;

  const dispatch = createEventDispatcher<{ login: void }>();
</script>

<div class="welcome">
  {#if logoUri}
    <img class="logo" src={logoUri} alt="Raidu" width="56" height="56" />
  {/if}
  <h2 class="title">Raidu Firewall</h2>
  <p class="desc">
    AI governance and data protection for your development environment.
    Connect to monitor scans, detect PII leaks, and enforce security policies.
  </p>
  <button class="connect-btn" on:click={() => dispatch('login')}>
    Connect to Raidu
  </button>
  <span class="subtitle">Sign in with your Raidu account</span>
</div>

<style>
  .welcome {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px 16px;
    text-align: center;
    min-height: 300px;
  }
  .logo {
    border-radius: 12px;
    margin-bottom: 16px;
  }
  .title {
    font-size: 16px;
    font-weight: 600;
    color: var(--vscode-foreground);
    margin: 0 0 8px 0;
  }
  .desc {
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
    line-height: 1.5;
    margin: 0 0 20px 0;
    max-width: 260px;
  }
  .connect-btn {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    border-radius: 4px;
    padding: 8px 20px;
    font-size: 13px;
    font-family: var(--vscode-font-family);
    cursor: pointer;
    font-weight: 500;
  }
  .connect-btn:hover {
    background: var(--vscode-button-hoverBackground);
  }
  .subtitle {
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    margin-top: 8px;
  }
</style>

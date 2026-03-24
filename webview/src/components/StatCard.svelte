<script lang="ts">
  export let value: number;
  export let label: string;
  export let colorClass: 'warn' | 'error' | '' = '';
</script>

<div class="stat-card">
  <span class="stat-value" class:warn={colorClass === 'warn'} class:error={colorClass === 'error'}>
    {value.toLocaleString()}
  </span>
  <span class="stat-label">{label}</span>
</div>

<style>
  .stat-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 10px 6px;
    border-radius: 6px;
    background: var(--vscode-editor-background);
    min-width: 0;
  }
  .stat-value {
    font-size: 20px;
    font-weight: 700;
    font-family: var(--vscode-editor-font-family);
    color: var(--vscode-foreground);
    line-height: 1.2;
  }
  .stat-value.warn {
    color: var(--warn, #e8a317);
  }
  .stat-value.error {
    color: var(--err, #e25555);
  }
  .stat-label {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    margin-top: 2px;
    text-align: center;
  }
</style>

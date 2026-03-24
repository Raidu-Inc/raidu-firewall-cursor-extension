<script lang="ts">
  export let icon: string;
  export let text: string;
</script>

<div class="empty">
  <span class="empty-icon">{icon}</span>
  <span class="empty-text">{text}</span>
</div>

<style>
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px 16px;
    text-align: center;
  }
  .empty-icon {
    font-size: 32px;
    margin-bottom: 8px;
  }
  .empty-text {
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
    line-height: 1.5;
  }
</style>

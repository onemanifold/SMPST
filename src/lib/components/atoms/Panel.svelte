<script lang="ts">
  /**
   * Panel - Atomic Component
   *
   * A container component with optional header and collapsible behavior.
   */
  import { createEventDispatcher } from 'svelte';

  export let title = '';
  export let collapsible = false;
  export let collapsed = false;
  export let variant: 'default' | 'elevated' | 'bordered' = 'default';
  export let padding: 'none' | 'sm' | 'md' | 'lg' = 'md';

  const dispatch = createEventDispatcher();

  function toggleCollapse() {
    if (collapsible) {
      collapsed = !collapsed;
      dispatch('toggle', { collapsed });
    }
  }
</script>

<div class="panel panel-{variant}">
  {#if title || $$slots.header}
    <div class="panel-header" class:collapsible on:click={toggleCollapse}>
      <slot name="header">
        <h3 class="panel-title">{title}</h3>
      </slot>
      {#if collapsible}
        <button class="collapse-btn" type="button" aria-label={collapsed ? 'Expand' : 'Collapse'}>
          {collapsed ? '▼' : '▲'}
        </button>
      {/if}
      <slot name="header-actions" />
    </div>
  {/if}

  {#if !collapsed}
    <div class="panel-content padding-{padding}">
      <slot />
    </div>
  {/if}

  {#if $$slots.footer}
    <div class="panel-footer">
      <slot name="footer" />
    </div>
  {/if}
</div>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  /* Variants */
  .panel-default {
    background: var(--color-bg-primary);
  }

  .panel-elevated {
    background: var(--color-bg-secondary);
    box-shadow: var(--shadow-md);
  }

  .panel-bordered {
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border);
  }

  /* Header */
  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-2) var(--spacing-4);
    background: var(--color-bg-tertiary);
    border-bottom: 1px solid var(--color-border-subtle);
  }

  .panel-header.collapsible {
    cursor: pointer;
    user-select: none;
  }

  .panel-header.collapsible:hover {
    background: var(--color-bg-hover);
  }

  .panel-title {
    margin: 0;
    font-size: var(--font-size-md);
    font-weight: var(--font-weight-medium);
    color: var(--color-text-primary);
  }

  .collapse-btn {
    background: transparent;
    border: none;
    color: var(--color-text-secondary);
    cursor: pointer;
    padding: var(--spacing-1);
    font-size: var(--font-size-sm);
  }

  /* Content */
  .panel-content {
    flex: 1;
    overflow: auto;
  }

  .padding-none {
    padding: 0;
  }

  .padding-sm {
    padding: var(--spacing-2);
  }

  .padding-md {
    padding: var(--spacing-4);
  }

  .padding-lg {
    padding: var(--spacing-6);
  }

  /* Footer */
  .panel-footer {
    padding: var(--spacing-3) var(--spacing-4);
    background: var(--color-bg-tertiary);
    border-top: 1px solid var(--color-border-subtle);
  }
</style>

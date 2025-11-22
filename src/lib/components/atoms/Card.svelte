<script lang="ts">
  /**
   * Card - Atomic Component
   *
   * A simple card container for content grouping.
   */
  export let variant: 'default' | 'elevated' | 'outlined' | 'interactive' = 'default';
  export let padding: 'none' | 'sm' | 'md' | 'lg' = 'md';
  export let clickable = false;
</script>

<div
  class="card card-{variant} padding-{padding}"
  class:clickable
  role={clickable ? 'button' : undefined}
  tabindex={clickable ? 0 : undefined}
  on:click
  on:keydown={(e) => e.key === 'Enter' && clickable && e.currentTarget.click()}
>
  <slot />
</div>

<style>
  .card {
    border-radius: var(--radius-lg);
    transition: all var(--transition-fast);
  }

  /* Variants */
  .card-default {
    background: var(--color-bg-secondary);
  }

  .card-elevated {
    background: var(--color-bg-secondary);
    box-shadow: var(--shadow-md);
  }

  .card-outlined {
    background: transparent;
    border: 1px solid var(--color-border);
  }

  .card-interactive {
    background: var(--color-bg-secondary);
    border: 1px solid transparent;
  }

  .card-interactive:hover {
    background: var(--color-bg-tertiary);
    border-color: var(--color-border);
  }

  /* Clickable */
  .clickable {
    cursor: pointer;
  }

  .clickable:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
  }

  .clickable:active {
    transform: translateY(0);
  }

  /* Padding */
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
</style>

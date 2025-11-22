<script lang="ts">
  /**
   * IconButton - Atomic Component
   *
   * A square button for icon-only actions (play, pause, step, reset, etc.)
   */
  import { createEventDispatcher } from 'svelte';

  export let variant: 'default' | 'primary' | 'danger' = 'default';
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let disabled = false;
  export let active = false;
  export let title = '';

  const dispatch = createEventDispatcher();

  function handleClick(event: MouseEvent) {
    if (!disabled) {
      dispatch('click', event);
    }
  }
</script>

<button
  class="icon-btn icon-btn-{variant} icon-btn-{size}"
  class:active
  {disabled}
  {title}
  on:click={handleClick}
>
  <slot />
</button>

<style>
  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--transition-normal);
    border: 1px solid var(--color-border-strong);
    background: var(--color-bg-hover);
    color: var(--color-text-primary);
  }

  /* Sizes */
  .icon-btn-sm {
    width: 24px;
    height: 24px;
    font-size: var(--font-size-sm);
  }

  .icon-btn-md {
    width: 32px;
    height: 32px;
    font-size: var(--font-size-lg);
  }

  .icon-btn-lg {
    width: 40px;
    height: 40px;
    font-size: var(--font-size-xl);
  }

  /* Variants */
  .icon-btn-default:hover:not(:disabled) {
    background: var(--color-bg-active);
    border-color: var(--color-accent);
  }

  .icon-btn-primary {
    background: var(--color-accent);
    color: var(--color-text-inverse);
    border-color: var(--color-accent);
  }

  .icon-btn-primary:hover:not(:disabled) {
    background: var(--color-accent-hover);
    border-color: var(--color-accent-hover);
  }

  .icon-btn-danger {
    background: var(--color-error);
    color: var(--color-text-inverse);
    border-color: var(--color-error);
  }

  .icon-btn-danger:hover:not(:disabled) {
    background: var(--color-error-hover, #d32f2f);
    border-color: var(--color-error-hover, #d32f2f);
  }

  /* Active state */
  .icon-btn.active {
    background: var(--color-accent);
    color: var(--color-text-inverse);
    border-color: var(--color-accent);
  }

  /* Disabled state */
  .icon-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
</style>

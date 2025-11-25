<script lang="ts">
  /**
   * Input - Atomic Component
   *
   * A reusable input component with label and error state support.
   */
  import { createEventDispatcher } from 'svelte';

  export let value: string | number = '';
  export let type: 'text' | 'number' | 'email' | 'password' | 'search' = 'text';
  export let label = '';
  export let placeholder = '';
  export let disabled = false;
  export let error = '';
  export let hint = '';
  export let id = '';
  export let name = '';
  export let min: number | undefined = undefined;
  export let max: number | undefined = undefined;
  export let step: number | undefined = undefined;
  export let size: 'sm' | 'md' | 'lg' = 'md';

  const dispatch = createEventDispatcher();

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    value = type === 'number' ? Number(target.value) : target.value;
    dispatch('input', { value });
  }

  function handleChange(event: Event) {
    dispatch('change', { value });
  }
</script>

<div class="input-wrapper" class:has-error={!!error}>
  {#if label}
    <label for={id} class="input-label">{label}</label>
  {/if}

  <input
    {id}
    {name}
    {type}
    {value}
    {placeholder}
    {disabled}
    {min}
    {max}
    {step}
    class="input input-{size}"
    on:input={handleInput}
    on:change={handleChange}
    on:focus
    on:blur
    on:keydown
  />

  {#if error}
    <span class="input-error">{error}</span>
  {:else if hint}
    <span class="input-hint">{hint}</span>
  {/if}
</div>

<style>
  .input-wrapper {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-1);
  }

  .input-label {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    font-weight: var(--font-weight-medium);
  }

  .input {
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-family: inherit;
    transition: border-color var(--transition-fast);
  }

  .input:focus {
    outline: none;
    border-color: var(--color-accent);
  }

  .input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .input::placeholder {
    color: var(--color-text-muted);
  }

  /* Sizes */
  .input-sm {
    padding: var(--spacing-1) var(--spacing-2);
    font-size: var(--font-size-xs);
  }

  .input-md {
    padding: var(--spacing-1) var(--spacing-2);
    font-size: var(--font-size-base);
  }

  .input-lg {
    padding: var(--spacing-2) var(--spacing-3);
    font-size: var(--font-size-md);
  }

  /* Error state */
  .has-error .input {
    border-color: var(--color-error);
  }

  .has-error .input:focus {
    border-color: var(--color-error);
  }

  .input-error {
    font-size: var(--font-size-xs);
    color: var(--color-error);
  }

  .input-hint {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }
</style>

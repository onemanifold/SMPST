<script lang="ts">
  /**
   * Select - Atomic Component
   *
   * A reusable select/dropdown component with label support.
   */
  import { createEventDispatcher } from 'svelte';

  export let value: string = '';
  export let options: Array<{ value: string; label: string; disabled?: boolean }> = [];
  export let label = '';
  export let placeholder = '';
  export let disabled = false;
  export let id = '';
  export let name = '';
  export let size: 'sm' | 'md' | 'lg' = 'md';

  const dispatch = createEventDispatcher();

  function handleChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    value = target.value;
    dispatch('change', { value });
  }
</script>

<div class="select-wrapper">
  {#if label}
    <label for={id} class="select-label">{label}</label>
  {/if}

  <select
    {id}
    {name}
    {value}
    {disabled}
    class="select select-{size}"
    on:change={handleChange}
  >
    {#if placeholder}
      <option value="" disabled>{placeholder}</option>
    {/if}
    {#each options as option}
      <option value={option.value} disabled={option.disabled}>
        {option.label}
      </option>
    {/each}
  </select>
</div>

<style>
  .select-wrapper {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-1);
  }

  .select-label {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    font-weight: var(--font-weight-medium);
  }

  .select {
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-family: inherit;
    cursor: pointer;
    transition: border-color var(--transition-fast);
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%239d9d9d' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right var(--spacing-2) center;
    padding-right: var(--spacing-8);
  }

  .select:focus {
    outline: none;
    border-color: var(--color-accent);
  }

  .select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .select option:disabled {
    color: var(--color-text-muted);
  }

  /* Sizes */
  .select-sm {
    padding: var(--spacing-1) var(--spacing-2);
    font-size: var(--font-size-xs);
  }

  .select-md {
    padding: var(--spacing-1) var(--spacing-2);
    font-size: var(--font-size-sm);
  }

  .select-lg {
    padding: var(--spacing-2) var(--spacing-3);
    font-size: var(--font-size-md);
  }
</style>

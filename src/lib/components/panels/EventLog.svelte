<script lang="ts">
  import { executionEvents, messageEvents, choiceEvents, recursionEvents, parallelEvents } from '$lib/stores/simulation';
  import type { CFGExecutionEvent } from '../../../core/simulation/types';

  // Event type filter toggles
  let showMessages = true;
  let showChoices = true;
  let showRecursion = true;
  let showParallel = true;
  let showOther = true;

  // Filtered events based on toggles
  $: filteredEvents = $executionEvents.filter(event => {
    switch (event.type) {
      case 'message': return showMessages;
      case 'choice': return showChoices;
      case 'recursion': return showRecursion;
      case 'parallel': return showParallel;
      default: return showOther;
    }
  });

  function getEventIcon(type: string): string {
    switch (type) {
      case 'message': return '📨';
      case 'choice': return '🔀';
      case 'recursion': return '🔄';
      case 'parallel': return '⚡';
      case 'subprotocol': return '📦';
      case 'state-change': return '➡️';
      default: return '•';
    }
  }

  function formatEvent(event: CFGExecutionEvent): string {
    switch (event.type) {
      case 'message':
        return `${event.from} → ${event.to}: ${event.label}${event.payloadType ? `(${event.payloadType})` : ''}`;
      case 'choice':
        return `Choice ${event.choiceIndex + 1}${event.choiceLabel ? ` (${event.choiceLabel})` : ''} by ${event.decidingRole}`;
      case 'recursion':
        return `${event.action} ${event.label}${event.iteration !== undefined ? ` (iteration ${event.iteration})` : ''}`;
      case 'parallel':
        return `${event.action}${event.branches ? ` (${event.branches} branches)` : ''}`;
      case 'subprotocol':
        return `${event.action} ${event.protocol}(${event.roleArguments.join(', ')})`;
      case 'state-change':
        return `${event.fromNode} → ${event.toNode}`;
      default:
        return JSON.stringify(event);
    }
  }

  function getEventClass(type: string): string {
    switch (type) {
      case 'message': return 'event-message';
      case 'choice': return 'event-choice';
      case 'recursion': return 'event-recursion';
      case 'parallel': return 'event-parallel';
      case 'subprotocol': return 'event-subprotocol';
      case 'state-change': return 'event-state';
      default: return 'event-default';
    }
  }
</script>

<div class="event-log">
  <div class="event-log-header">
    <h4>Execution Events ({filteredEvents.length})</h4>
    <div class="event-filters">
      <label class="filter-toggle">
        <input type="checkbox" bind:checked={showMessages} />
        <span class="filter-label">
          <span class="filter-icon">📨</span>
          Messages ({$messageEvents.length})
        </span>
      </label>
      <label class="filter-toggle">
        <input type="checkbox" bind:checked={showChoices} />
        <span class="filter-label">
          <span class="filter-icon">🔀</span>
          Choices ({$choiceEvents.length})
        </span>
      </label>
      <label class="filter-toggle">
        <input type="checkbox" bind:checked={showRecursion} />
        <span class="filter-label">
          <span class="filter-icon">🔄</span>
          Recursion ({$recursionEvents.length})
        </span>
      </label>
      <label class="filter-toggle">
        <input type="checkbox" bind:checked={showParallel} />
        <span class="filter-label">
          <span class="filter-icon">⚡</span>
          Parallel ({$parallelEvents.length})
        </span>
      </label>
    </div>
  </div>

  <div class="event-list">
    {#if filteredEvents.length === 0}
      <div class="event-placeholder">
        {#if $executionEvents.length === 0}
          <p>No events yet. Step through the simulation to see execution events.</p>
        {:else}
          <p>No events match current filters.</p>
        {/if}
      </div>
    {:else}
      {#each filteredEvents as event, index}
        <div class="event {getEventClass(event.type)}">
          <span class="event-number">{index + 1}</span>
          <span class="event-icon">{getEventIcon(event.type)}</span>
          <span class="event-description">{formatEvent(event)}</span>
          <span class="event-timestamp">{event.timestamp}ms</span>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .event-log {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #1e1e1e;
    overflow: hidden;
  }

  .event-log-header {
    padding: 8px 12px;
    background: #2d2d2d;
    border-bottom: 1px solid #333;
  }

  .event-log-header h4 {
    margin: 0 0 8px 0;
    font-size: 13px;
    font-weight: 500;
    color: #ccc;
  }

  .event-filters {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .filter-toggle {
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    font-size: 11px;
    color: #888;
    transition: color 0.2s;
  }

  .filter-toggle:hover {
    color: #ccc;
  }

  .filter-toggle input[type="checkbox"] {
    cursor: pointer;
  }

  .filter-label {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .filter-icon {
    font-size: 12px;
  }

  .event-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }

  .event {
    display: grid;
    grid-template-columns: 32px 24px 1fr auto;
    gap: 8px;
    align-items: center;
    padding: 6px 8px;
    margin-bottom: 2px;
    border-radius: 3px;
    font-size: 12px;
    transition: background 0.15s;
  }

  .event:hover {
    background: #2d2d2d;
  }

  .event-number {
    color: #666;
    font-family: monospace;
    font-size: 11px;
    text-align: right;
  }

  .event-icon {
    font-size: 14px;
  }

  .event-description {
    color: #ccc;
    font-family: 'Consolas', 'Monaco', monospace;
  }

  .event-timestamp {
    color: #666;
    font-family: monospace;
    font-size: 10px;
    white-space: nowrap;
  }

  /* Event type colors */
  .event-message {
    border-left: 3px solid #4a9eff;
  }

  .event-message .event-icon {
    color: #4a9eff;
  }

  .event-choice {
    border-left: 3px solid #ffa64a;
  }

  .event-choice .event-icon {
    color: #ffa64a;
  }

  .event-recursion {
    border-left: 3px solid #9d4aff;
  }

  .event-recursion .event-icon {
    color: #9d4aff;
  }

  .event-parallel {
    border-left: 3px solid #ffeb3b;
  }

  .event-parallel .event-icon {
    color: #ffeb3b;
  }

  .event-subprotocol {
    border-left: 3px solid #4aff9d;
  }

  .event-subprotocol .event-icon {
    color: #4aff9d;
  }

  .event-state {
    border-left: 3px solid #666;
  }

  .event-state .event-icon {
    color: #666;
  }

  .event-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #666;
    font-style: italic;
    font-size: 13px;
    padding: 20px;
    text-align: center;
  }

  .event-placeholder p {
    margin: 0;
  }
</style>

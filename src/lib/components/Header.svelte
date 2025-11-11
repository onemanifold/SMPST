<script lang="ts">
  import {
    Header,
    HeaderNav,
    HeaderUtilities,
    HeaderAction,
    HeaderActionLink,
    Button,
    InlineNotification
  } from 'carbon-components-svelte';
  import { Play, Add, Document, Restart, SkipForward, Pause } from 'carbon-icons-svelte';
  import { parseStatus, simulationState, mockParse, editorContent } from '../stores/editor';
  import { protocolExamples } from '../data/examples';
  import type { ProtocolExample } from '../data/examples';

  let showProtocolMenu = false;
  let notificationMessage = '';
  let notificationType: 'success' | 'error' | 'warning' | 'info' = 'info';
  let showNotification = false;

  function handleLoadProtocol(example: ProtocolExample) {
    editorContent.set(example.code);
    showProtocolMenu = false;
    showMessage('success', `Loaded: ${example.name}`);
  }

  function handleNew() {
    editorContent.set('');
    showMessage('info', 'New protocol created');
  }

  function handleParse() {
    mockParse($editorContent);
    setTimeout(() => {
      if ($parseStatus === 'success') {
        showMessage('success', 'Protocol parsed successfully');
      } else if ($parseStatus === 'error') {
        showMessage('error', 'Parse failed');
      }
    }, 600);
  }

  function handleStart() {
    simulationState.update(s => ({ ...s, running: true, step: 0 }));
    showMessage('info', 'Simulation started');
  }

  function handlePause() {
    simulationState.update(s => ({ ...s, running: false }));
    showMessage('info', 'Simulation paused');
  }

  function handleStep() {
    simulationState.update(s => ({ ...s, step: s.step + 1 }));
  }

  function handleReset() {
    simulationState.update(s => ({ ...s, running: false, step: 0 }));
    showMessage('info', 'Simulation reset');
  }

  function showMessage(type: typeof notificationType, message: string) {
    notificationType = type;
    notificationMessage = message;
    showNotification = true;
    setTimeout(() => {
      showNotification = false;
    }, 3000);
  }

  $: canSimulate = $parseStatus === 'success';
</script>

<Header company="Scribble MPST" platformName="IDE">
  <HeaderNav>
    <div class="protocol-menu">
      <Button kind="ghost" on:click={() => showProtocolMenu = !showProtocolMenu}>
        <Document />
        Protocols
      </Button>
      {#if showProtocolMenu}
        <div class="protocol-dropdown">
          <div class="dropdown-header">Example Protocols</div>
          {#each protocolExamples as example}
            <button class="dropdown-item" on:click={() => handleLoadProtocol(example)}>
              <div class="item-title">{example.name}</div>
              <div class="item-desc">{example.description}</div>
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <Button kind="ghost" size="sm" on:click={handleNew}>
      <Add />
      New
    </Button>
  </HeaderNav>

  <div slot="skip-to-content" />

  <HeaderUtilities>
    <!-- Simulation Controls -->
    <div class="sim-controls">
      <Button
        kind="tertiary"
        size="sm"
        iconDescription="Start"
        icon={Play}
        disabled={$simulationState.running || !canSimulate}
        on:click={handleStart}
      />
      <Button
        kind="tertiary"
        size="sm"
        iconDescription="Pause"
        icon={Pause}
        disabled={!$simulationState.running}
        on:click={handlePause}
      />
      <Button
        kind="tertiary"
        size="sm"
        iconDescription="Step"
        icon={SkipForward}
        disabled={$simulationState.running || !canSimulate}
        on:click={handleStep}
      />
      <Button
        kind="tertiary"
        size="sm"
        iconDescription="Reset"
        icon={Restart}
        disabled={!canSimulate}
        on:click={handleReset}
      />
    </div>

    <Button kind="primary" size="sm" disabled={$parseStatus === 'parsing'} on:click={handleParse}>
      Parse & Verify
    </Button>
  </HeaderUtilities>
</Header>

{#if showNotification}
  <div class="notification-container">
    <InlineNotification
      kind={notificationType}
      title={notificationMessage}
      hideCloseButton={false}
      on:close={() => showNotification = false}
    />
  </div>
{/if}

<style>
  .protocol-menu {
    position: relative;
  }

  .protocol-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    width: 320px;
    background: var(--cds-ui-01);
    border: 1px solid var(--cds-ui-03);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    z-index: 9999;
    max-height: 400px;
    overflow-y: auto;
  }

  .dropdown-header {
    padding: 0.75rem 1rem;
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--cds-text-02);
    border-bottom: 1px solid var(--cds-ui-03);
  }

  .dropdown-item {
    width: 100%;
    padding: 0.75rem 1rem;
    border: none;
    background: transparent;
    text-align: left;
    cursor: pointer;
    transition: background 0.1s;
  }

  .dropdown-item:hover {
    background: var(--cds-ui-03);
  }

  .item-title {
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--cds-text-01);
    margin-bottom: 0.25rem;
  }

  .item-desc {
    font-size: 0.75rem;
    color: var(--cds-text-02);
  }

  .sim-controls {
    display: flex;
    gap: 0.25rem;
  }

  .notification-container {
    position: fixed;
    top: 4rem;
    right: 1rem;
    z-index: 10000;
    max-width: 400px;
  }
</style>

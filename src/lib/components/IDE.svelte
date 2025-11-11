<script lang="ts">
  import { Tabs, Tab, TabContent } from 'carbon-components-svelte';
  import Header from './Header.svelte';
  import CodeEditor from './CodeEditor.svelte';
  import Visualizer from './Visualizer.svelte';
  import OutputPanel from './OutputPanel.svelte';
  import { viewMode, projectionData, outputPanelCollapsed } from '../stores/editor';

  let editorWidth = 45; // percentage
  let outputHeight = 30; // percentage

  $: effectiveOutputHeight = $outputPanelCollapsed ? 'auto' : `${outputHeight}%`;
  let isDraggingHorizontal = false;
  let isDraggingVertical = false;

  $: roles = $projectionData.map(p => p.role);
  $: selectedIndex = $viewMode === 'global' ? 0 : roles.indexOf($viewMode) + 1;

  function handleTabChange(event: CustomEvent<{ selectedIndex: number }>) {
    const index = event.detail.selectedIndex;
    if (index === 0) {
      viewMode.set('global');
    } else {
      const role = roles[index - 1];
      if (role) {
        viewMode.set(role);
      }
    }
  }

  function handleHorizontalDragStart() {
    isDraggingHorizontal = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  function handleVerticalDragStart() {
    isDraggingVertical = true;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }

  function handleMouseMove(e: MouseEvent) {
    if (isDraggingHorizontal) {
      const container = document.querySelector('.main-content');
      if (container) {
        const rect = container.getBoundingClientRect();
        const newWidth = ((e.clientX - rect.left) / rect.width) * 100;
        editorWidth = Math.max(20, Math.min(80, newWidth));
      }
    }
    if (isDraggingVertical) {
      const container = document.querySelector('.workspace');
      if (container) {
        const rect = container.getBoundingClientRect();
        const newHeight = ((rect.bottom - e.clientY) / rect.height) * 100;
        outputHeight = Math.max(20, Math.min(60, newHeight));
      }
    }
  }

  function handleMouseUp() {
    isDraggingHorizontal = false;
    isDraggingVertical = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }
</script>

<svelte:window on:mousemove={handleMouseMove} on:mouseup={handleMouseUp} />

<div class="ide">
  <Header />

  <div class="main-content">
    <div class="workspace">
      <Tabs selected={selectedIndex} on:change={handleTabChange}>
        <Tab label="Global Protocol" />
        {#each roles as role}
          <Tab label={role} />
        {/each}

        <svelte:fragment slot="content">
          <TabContent>
            <div class="tab-panel">
              <div class="top-section">
                <div class="editor-section" style="width: {editorWidth}%">
                  <CodeEditor />
                </div>

                <div
                  class="horizontal-resizer"
                  on:mousedown={handleHorizontalDragStart}
                  role="separator"
                  aria-orientation="vertical"
                ></div>

                <div class="visualizer-section" style="width: {100 - editorWidth}%">
                  <Visualizer />
                </div>
              </div>

              <div
                class="vertical-resizer"
                on:mousedown={handleVerticalDragStart}
                role="separator"
                aria-orientation="horizontal"
              ></div>

              <div class="bottom-section" style="height: {effectiveOutputHeight}">
                <OutputPanel />
              </div>
            </div>
          </TabContent>

          {#each roles as role}
            <TabContent>
              <div class="tab-panel">
                <div class="top-section">
                  <div class="editor-section" style="width: {editorWidth}%">
                    <CodeEditor />
                  </div>

                  <div
                    class="horizontal-resizer"
                    on:mousedown={handleHorizontalDragStart}
                    role="separator"
                    aria-orientation="vertical"
                  ></div>

                  <div class="visualizer-section" style="width: {100 - editorWidth}%">
                    <Visualizer />
                  </div>
                </div>

                <div
                  class="vertical-resizer"
                  on:mousedown={handleVerticalDragStart}
                  role="separator"
                  aria-orientation="horizontal"
                ></div>

                <div class="bottom-section" style="height: {effectiveOutputHeight}">
                  <OutputPanel />
                </div>
              </div>
            </TabContent>
          {/each}
        </svelte:fragment>
      </Tabs>
    </div>
  </div>
</div>

<style>
  .ide {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100%;
    overflow: hidden;
    background: var(--cds-ui-background);
  }

  .main-content {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .workspace {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
  }

  .tab-panel {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 8rem);
  }

  .top-section {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .editor-section {
    min-width: 200px;
    overflow: hidden;
  }

  .visualizer-section {
    min-width: 200px;
    overflow: hidden;
  }

  .bottom-section {
    min-height: 150px;
    overflow: hidden;
  }

  .horizontal-resizer {
    width: 4px;
    background: var(--cds-ui-03);
    cursor: col-resize;
    transition: background 0.2s;
    flex-shrink: 0;
  }

  .horizontal-resizer:hover,
  .horizontal-resizer:focus {
    background: var(--cds-interactive-01);
    outline: none;
  }

  .vertical-resizer {
    height: 4px;
    background: var(--cds-ui-03);
    cursor: row-resize;
    transition: background 0.2s;
    flex-shrink: 0;
  }

  .vertical-resizer:hover,
  .vertical-resizer:focus {
    background: var(--cds-interactive-01);
    outline: none;
  }

  :global(.bx--tabs) {
    background: var(--cds-ui-01) !important;
  }

  :global(.bx--tab-content) {
    padding: 0 !important;
  }
</style>

<script lang="ts">
  import { Accordion, AccordionItem, Tabs, Tab, TabContent, Tag } from 'carbon-components-svelte';
  import { activeTab, parseStatus, verificationResult, projectionData, parseError, outputPanelCollapsed } from '../stores/editor';

  $: selectedIndex = $activeTab === 'verification' ? 0 : $activeTab === 'projection' ? 1 : 2;

  function handleTabChange(event: CustomEvent<{ selectedIndex: number }>) {
    const tabs: Array<typeof $activeTab> = ['verification', 'projection', 'errors'];
    activeTab.set(tabs[event.detail.selectedIndex]);
  }
</script>

<Accordion>
  <AccordionItem title="Output Panel" open={!$outputPanelCollapsed} on:toggle={(e) => outputPanelCollapsed.set(!e.detail.open)}>
    <Tabs selected={selectedIndex} on:change={handleTabChange}>
      <Tab label="Verification" />
      <Tab label="Projection" />
      <Tab label={`Errors${$parseError ? ' (1)' : ''}`} />

      <svelte:fragment slot="content">
        <TabContent>
          <div class="content-section">
            {#if $parseStatus === 'success' && $verificationResult}
              <div class="result-grid">
                <div class="result-card" class:success={$verificationResult.deadlockFree}>
                  <div class="result-icon">{$verificationResult.deadlockFree ? '✓' : '✗'}</div>
                  <div class="result-label">Deadlock-Free</div>
                  <Tag type={$verificationResult.deadlockFree ? 'green' : 'red'}>
                    {$verificationResult.deadlockFree ? 'Pass' : 'Fail'}
                  </Tag>
                </div>
                <div class="result-card" class:success={$verificationResult.livenessSatisfied}>
                  <div class="result-icon">{$verificationResult.livenessSatisfied ? '✓' : '✗'}</div>
                  <div class="result-label">Liveness</div>
                  <Tag type={$verificationResult.livenessSatisfied ? 'green' : 'red'}>
                    {$verificationResult.livenessSatisfied ? 'Pass' : 'Fail'}
                  </Tag>
                </div>
                <div class="result-card" class:success={$verificationResult.safetySatisfied}>
                  <div class="result-icon">{$verificationResult.safetySatisfied ? '✓' : '✗'}</div>
                  <div class="result-label">Safety</div>
                  <Tag type={$verificationResult.safetySatisfied ? 'green' : 'red'}>
                    {$verificationResult.safetySatisfied ? 'Pass' : 'Fail'}
                  </Tag>
                </div>
              </div>
              {#if $verificationResult.warnings.length > 0}
                <div class="warnings-section">
                  <h4>Warnings</h4>
                  {#each $verificationResult.warnings as warning}
                    <Tag type="yellow">{warning}</Tag>
                  {/each}
                </div>
              {/if}
            {:else}
              <p class="empty-message">Parse a protocol to see verification results</p>
            {/if}
          </div>
        </TabContent>

        <TabContent>
          <div class="content-section">
            {#if $parseStatus === 'success' && $projectionData.length > 0}
              {#each $projectionData as projection}
                <div class="projection-card">
                  <h4>{projection.role}</h4>
                  <div class="projection-details">
                    <div class="detail-item">
                      <strong>States:</strong>
                      <span>{projection.states.join(', ')}</span>
                    </div>
                    <div class="detail-item">
                      <strong>Transitions:</strong>
                      <div class="transitions-list">
                        {#each projection.transitions as transition}
                          <div class="transition-item">
                            {transition.from} → {transition.to}: <code>{transition.label}</code>
                          </div>
                        {/each}
                      </div>
                    </div>
                  </div>
                </div>
              {/each}
            {:else}
              <p class="empty-message">Parse a protocol to see projections</p>
            {/if}
          </div>
        </TabContent>

        <TabContent>
          <div class="content-section">
            {#if $parseError}
              <Tag type="red" size="lg">{$parseError}</Tag>
            {:else}
              <Tag type="green" size="lg">✓ No errors</Tag>
            {/if}
          </div>
        </TabContent>
      </svelte:fragment>
    </Tabs>
  </AccordionItem>
</Accordion>

<style>
  .content-section {
    padding: 1rem;
    min-height: 200px;
  }

  .result-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .result-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 1.5rem 1rem;
    background: var(--cds-ui-01);
    border: 1px solid var(--cds-ui-03);
    border-radius: 4px;
  }

  .result-card.success {
    border-color: var(--cds-support-02);
    background: var(--cds-ui-01);
  }

  .result-icon {
    font-size: 2rem;
    color: var(--cds-text-02);
  }

  .result-card.success .result-icon {
    color: var(--cds-support-02);
  }

  .result-label {
    font-size: 0.875rem;
    color: var(--cds-text-01);
    font-weight: 600;
  }

  .empty-message {
    color: var(--cds-text-02);
    font-size: 0.875rem;
    text-align: center;
    padding: 3rem;
  }

  .projection-card {
    background: var(--cds-ui-01);
    border: 1px solid var(--cds-ui-03);
    border-radius: 4px;
    padding: 1rem;
    margin-bottom: 1rem;
  }

  .projection-card h4 {
    color: var(--cds-interactive-01);
    font-weight: 600;
    margin-bottom: 0.75rem;
  }

  .projection-details {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .detail-item {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .detail-item strong {
    color: var(--cds-text-02);
    font-size: 0.75rem;
    text-transform: uppercase;
  }

  .transitions-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .transition-item {
    font-size: 0.875rem;
    color: var(--cds-text-01);
    padding: 0.5rem;
    background: var(--cds-ui-background);
    border-radius: 4px;
  }

  .transition-item code {
    color: var(--cds-interactive-01);
    font-family: 'IBM Plex Mono', monospace;
  }

  .warnings-section {
    margin-top: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .warnings-section h4 {
    color: var(--cds-text-01);
    font-size: 0.875rem;
    font-weight: 600;
  }

  :global(.bx--accordion__content) {
    padding: 0 !important;
  }
</style>

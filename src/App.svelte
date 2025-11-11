<script lang="ts">
  import IDE from './lib/components/IDE.svelte';

  let appTitle = "Scribble MPST IDE";
  let showIDE = false;

  function launchIDE() {
    showIDE = true;
  }

  function backToHome() {
    showIDE = false;
  }
</script>

{#if showIDE}
  <div class="ide-container">
    <button class="back-button" on:click={backToHome}>← Back to Info</button>
    <IDE />
  </div>
{:else}
  <main class="container">
    <h1>{appTitle}</h1>
    <p class="subtitle">
      Modern Multiparty Session Type IDE with CFG-based verification
    </p>

    <button class="launch-button" on:click={launchIDE}>
      🚀 Launch IDE
    </button>

    <div class="info-box">
      <h2>Architecture Overview</h2>
      <p>This IDE follows a layered architecture:</p>
      <ol>
        <li><strong>Parser</strong> - Scribble source → AST</li>
        <li><strong>CFG Builder</strong> - AST → Control Flow Graph</li>
        <li><strong>Verification</strong> - CFG analysis for deadlock, liveness, etc.</li>
        <li><strong>Projection</strong> - CFG → CFSM per role</li>
        <li><strong>Runtime</strong> - CFSM → State Machine execution</li>
        <li><strong>Code Generation</strong> - State Machine → TypeScript/JavaScript</li>
      </ol>
    </div>

    <div class="features">
      <h2>Features</h2>
      <div class="feature-grid">
        <div class="feature-card">
          <div class="feature-icon">📝</div>
          <h3>Protocol Editor</h3>
          <p>Write Scribble protocols with syntax highlighting</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">📚</div>
          <h3>Protocol Library</h3>
          <p>Example protocols ready to load and explore</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">📊</div>
          <h3>Visualization</h3>
          <p>Interactive CFG and CFSM graph views</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">✓</div>
          <h3>Verification</h3>
          <p>Deadlock detection and safety checks</p>
        </div>
      </div>
    </div>

    <div class="status">
      <p>✅ Mock UI ready for testing</p>
      <p>✅ All core layers implemented</p>
      <p>🔧 Integration in progress</p>
    </div>
  </main>
{/if}

<style>
  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
  }

  h1 {
    font-size: 3rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .subtitle {
    font-size: 1.2rem;
    color: #9ca3af;
    margin-bottom: 2rem;
  }

  .launch-button {
    display: block;
    margin: 2rem auto;
    padding: 1rem 2.5rem;
    font-size: 1.25rem;
    font-weight: 600;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  .launch-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 16px rgba(102, 126, 234, 0.4);
  }

  .info-box {
    background: #1f2937;
    border: 1px solid #374151;
    border-radius: 8px;
    padding: 1.5rem;
    margin-bottom: 2rem;
  }

  .info-box h2 {
    margin-top: 0;
    color: #f3f4f6;
  }

  .info-box ol {
    line-height: 1.8;
    color: #d1d5db;
  }

  .info-box strong {
    color: #f9fafb;
  }

  .features {
    margin-bottom: 2rem;
  }

  .features h2 {
    color: #f3f4f6;
    margin-bottom: 1.5rem;
  }

  .feature-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1.5rem;
  }

  .feature-card {
    background: #1f2937;
    border: 1px solid #374151;
    border-radius: 8px;
    padding: 1.5rem;
    transition: all 0.2s;
  }

  .feature-card:hover {
    border-color: #667eea;
    transform: translateY(-2px);
  }

  .feature-icon {
    font-size: 2.5rem;
    margin-bottom: 1rem;
  }

  .feature-card h3 {
    color: #f3f4f6;
    margin: 0 0 0.5rem 0;
    font-size: 1.125rem;
  }

  .feature-card p {
    color: #9ca3af;
    margin: 0;
    font-size: 0.875rem;
    line-height: 1.5;
  }

  .status {
    padding: 1rem;
    background: #064e3b;
    border: 1px solid #047857;
    border-radius: 8px;
  }

  .status p {
    margin: 0.5rem 0;
    color: #d1fae5;
  }

  .ide-container {
    position: relative;
    height: 100vh;
    width: 100%;
  }

  .back-button {
    position: absolute;
    top: 1rem;
    left: 1rem;
    z-index: 1000;
    padding: 0.5rem 1rem;
    background: rgba(31, 41, 55, 0.95);
    border: 1px solid #4b5563;
    border-radius: 6px;
    color: #d1d5db;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    backdrop-filter: blur(8px);
  }

  .back-button:hover {
    background: rgba(55, 65, 81, 0.95);
    border-color: #667eea;
    color: #f3f4f6;
  }
</style>

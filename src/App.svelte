<script lang="ts">
  let appTitle = "Scribble MPST IDE";
</script>

<main class="container">
  <h1>{appTitle}</h1>
  <p class="subtitle">
    Modern Multiparty Session Type IDE with CFG-based verification
  </p>

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

  <div class="status">
    <p>✅ Vite + Svelte + TypeScript configured</p>
    <p>⏳ Parser, CFG, and verification layers coming soon...</p>
  </div>
</main>

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
</style>

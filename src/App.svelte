<script lang="ts">
  let appTitle = "Scribble MPST";
</script>

<main>
  <h1>{appTitle}</h1>
  <p>Multiparty Session Type Protocol Implementation</p>

  <section>
    <h2>About</h2>
    <p>
      This project implements a complete backend for Scribble multiparty session type protocols,
      including parsing, verification, projection, and code generation.
    </p>
  </section>

  <section>
    <h2>Core Components</h2>
    <ul>
      <li><strong>Parser</strong> - Scribble protocol language parser (Chevrotain-based)</li>
      <li><strong>CFG Builder</strong> - Control Flow Graph construction from AST</li>
      <li><strong>Verification</strong> - Deadlock detection, liveness, and safety analysis</li>
      <li><strong>Projection</strong> - Local protocol generation per role</li>
      <li><strong>Code Generation</strong> - TypeScript code generation from projections</li>
    </ul>
  </section>

  <section>
    <h2>Status</h2>
    <p>Backend implementation complete. UI implementation pending.</p>
    <p>See <code>UI_SPECIFICATION.md</code> for detailed UI requirements.</p>
  </section>
</main>

<style>
  main {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  }

  h1 {
    font-size: 2.5rem;
    margin-bottom: 0.5rem;
  }

  h2 {
    font-size: 1.5rem;
    margin-top: 2rem;
    margin-bottom: 1rem;
  }

  section {
    margin-bottom: 2rem;
  }

  ul {
    line-height: 1.8;
  }

  code {
    background: #f4f4f4;
    padding: 0.2em 0.4em;
    border-radius: 3px;
    font-family: 'Courier New', monospace;
  }
</style>

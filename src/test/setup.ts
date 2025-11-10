import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/svelte';

// Extend Vitest's expect method with Testing Library assertions
// expect.extend(matchers);

// Cleanup after each test case (e.g., clearing jsdom)
afterEach(() => {
  cleanup();
});

import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/svelte';

// Auto-cleanup after each test for Svelte component tests
afterEach(() => {
  cleanup();
});

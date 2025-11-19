import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/svelte';
import '@testing-library/jest-dom/vitest';

// Auto-cleanup after each test for Svelte component tests
afterEach(() => {
  cleanup();
});

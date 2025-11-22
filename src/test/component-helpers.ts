import { expect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extend Vitest's expect with jest-dom matchers for component tests
// Import this file at the top of component test files to enable DOM matchers
expect.extend(matchers);

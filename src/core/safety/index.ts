/**
 * Safety Module - "Less is More" MPST Implementation
 *
 * Exports all safety-related types and implementations for
 * bottom-up multiparty session types.
 *
 * @reference Scalas, A., & Yoshida, N. (2019). Less is More: Multiparty
 *            Session Types Revisited. POPL 2019.
 */

// Types
export type {
  TypingContext,
  CFSMInstance,
  SafetyProperty,
  SafetyCheckResult,
  SafetyViolation,
  ViolationType,
  Communication,
  EnabledCommunications,
} from './types';

// Safety checker implementations
export { BasicSafety } from './safety-checker';

// Context reducer
export { ContextReducer } from './context-reducer';

// Utilities
export { createInitialContext } from './utils';

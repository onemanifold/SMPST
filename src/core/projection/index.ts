/**
 * Projection Module Exports
 *
 * Provides CFG-based projection to CFSM state machines.
 * CFG/CFSM is the single source of truth for all semantics.
 *
 * Pipeline: Global Protocol → CFG → CFSM → Scribble Text
 *
 * See ENRICHED_CFSM_DESIGN.md for architectural decisions.
 */

// CFG-based projection (generates CFSMs with full type preservation)
export { project, projectAll } from './projector';
export type {
  CFSM,
  CFSMState,
  CFSMTransition,
  CFSMAction,
  SendAction,
  ReceiveAction,
  ProjectionResult,
  ProjectionError,
} from './types';

// CFSM serialization to Scribble local protocol text
export { serializeCFSM } from '../serializer/cfsm-serializer';
export type { CFSMSerializerOptions } from '../serializer/cfsm-serializer';

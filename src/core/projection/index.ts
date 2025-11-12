/**
 * Projection Module Exports
 *
 * This module provides both CFG-based (CFSM) and AST-based (textual local protocol)
 * projection capabilities for Scribble protocols.
 */

// CFG-based projection (existing - generates CFSMs for monitoring/verification)
export { project, projectAll } from './projector';
export type {
  CFSM,
  CFSMState,
  CFSMTransition,
  CFSMAction,
  SendAction,
  ReceiveAction,
  ProjectionResult as CFSMProjectionResult,
  ProjectionError as CFSMProjectionError,
} from './types';

// AST-based projection (new - generates textual local protocols)
export {
  projectToLocalProtocols,
  projectForRole,
  isRoleInvolved,
  getRoles,
  validateWellFormedness,
} from './ast-projector';
export type {
  ProjectionResult as ASTProjectionResult,
  ProjectionError as ASTProjectionError,
  ProjectionOptions,
} from './ast-projector';

// Local protocol serialization
export {
  serializeLocalProtocol,
  serializeAll,
  prettyPrint,
} from '../serializer/local-serializer';
export type { SerializerOptions } from '../serializer/local-serializer';

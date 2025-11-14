/**
 * DMst Runtime Module
 *
 * Unified exports for dynamically updatable MPST runtime support.
 *
 * Provides:
 * - Dynamic participant instantiation
 * - Invitation protocol synchronization
 * - Protocol call stack management
 * - Extended simulation with DMst features
 */

// Runtime types and functions
export {
  type DynamicParticipant,
  type DynamicParticipantRegistry,
  type ParticipantCreationEvent,
  type InvitationCompleteEvent,
  type ProtocolCallFrame,
  type ProtocolCallStack,
  type DMstSimulationState,
  createDMstSimulationState,
  createDynamicParticipant,
  sendInvitation,
  completeInvitation,
  isParticipantReady,
  getAllActiveParticipants,
  allParticipantsTerminated,
  detectDMstDeadlock,
  pushProtocolCall,
  popProtocolCall,
  getCurrentProtocolCall,
} from '../dmst-runtime';

// Simulator
export { DMstSimulator } from '../dmst-simulator';

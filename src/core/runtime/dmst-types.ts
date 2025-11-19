/**
 * DMst Runtime Type Extensions
 *
 * Extends the base runtime types (types.ts) with DMst-specific events and traces.
 * Follows the same observer pattern as classic MPST.
 */

import type {
  TraceEvent as BaseTraceEvent,
  ExecutionObserver as BaseExecutionObserver,
  ExecutionTrace as BaseExecutionTrace,
} from './types';
import type {
  ParticipantCreationEvent,
  InvitationCompleteEvent,
} from './dmst-runtime';

// ============================================================================
// DMst Trace Events
// ============================================================================

/**
 * DMst trace event type
 *
 * Extends base TraceEvent with DMst-specific events:
 * - participant-creation: Dynamic participant created
 * - invitation-complete: Invitation protocol completed
 */
export type DMstTraceEvent =
  | BaseTraceEvent
  | ParticipantCreationEvent
  | InvitationCompleteEvent;

/**
 * DMst execution trace
 *
 * Extends base ExecutionTrace with DMst-specific event types
 * Uses the generic parameter to properly type the events array
 */
export interface DMstExecutionTrace extends BaseExecutionTrace<DMstTraceEvent> {
  // events: DMstTraceEvent[] is inherited from BaseExecutionTrace<DMstTraceEvent>
}

/**
 * Observer for DMst execution events
 *
 * Extends base ExecutionObserver with DMst-specific event handlers
 */
export interface DMstExecutionObserver extends BaseExecutionObserver {
  /**
   * Called when a dynamic participant is created
   */
  onParticipantCreation?(event: ParticipantCreationEvent): void;

  /**
   * Called when invitation protocol completes
   */
  onInvitationComplete?(event: InvitationCompleteEvent): void;
}

// ============================================================================
// Exports
// ============================================================================

export type {
  ParticipantCreationEvent,
  InvitationCompleteEvent,
} from './dmst-runtime';

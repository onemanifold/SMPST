/**
 * Async Channel Implementation
 *
 * FIFO message channels with MPST semantics:
 * - Send is ASYNCHRONOUS (non-blocking) - message queued, sender continues
 * - Receive BLOCKS until message available
 *
 * Based on MPST (Multiparty Session Types) formal semantics.
 */

import type { Message } from './cfsm-simulator-types';

/**
 * One end of a bidirectional channel
 * Supports async send (non-blocking) and receive (blocking)
 */
export interface ChannelEnd {
  /**
   * Send a message - ASYNCHRONOUS (returns immediately)
   * Message is queued for receiver
   */
  send(message: Message): Promise<void>;

  /**
   * Receive a message - BLOCKS until message available
   */
  receive(): Promise<Message>;

  /**
   * Check if a message is available without consuming it
   * Returns true if receive() would return immediately (not block)
   *
   * @deprecated With bisimulation coordinator, use event-driven coordination
   * via `onIncoming` handlers instead of polling with `hasMessage()`.
   * This method is kept for backward compatibility with DistributedSimulator
   * and sequential stepping patterns.
   */
  hasMessage(): boolean;
}

/**
 * Callback for incoming message interception (bisimulation coordination)
 * Called when a message is about to be received, before atomic processing.
 * This provides the pause point for CFG validation.
 */
export type IncomingMessageHandler = (message: Message) => Promise<void>;

/**
 * Options for channel creation
 */
export interface ChannelOptions {
  /**
   * Handler called when a message is about to be received on either end
   * Provides pause point for bisimulation coordination
   * The handler can determine which role is receiving from message.to
   */
  onIncoming?: IncomingMessageHandler;
}

/**
 * Create a bidirectional async channel with MPST semantics
 * Returns two ends - what you send on one end is received on the other
 *
 * @param options Optional handlers for incoming message interception
 */
export function createChannel(options?: ChannelOptions): [ChannelEnd, ChannelEnd] {
  // Each end has its own inbox (queue + waiters)
  const inboxA = {
    queue: [] as Message[],
    waiters: [] as Array<(msg: Message) => void>
  };

  const inboxB = {
    queue: [] as Message[],
    waiters: [] as Array<(msg: Message) => void>
  };

  // Factory: creates an end that receives from myInbox, sends to peerInbox
  const makeEnd = (
    myInbox: typeof inboxA,
    peerInbox: typeof inboxB,
    onIncoming?: IncomingMessageHandler
  ): ChannelEnd => ({
    async send(message: Message): Promise<void> {
      // Check if peer is waiting
      const waiter = peerInbox.waiters.shift();
      if (waiter) {
        // Direct delivery to waiting receiver
        waiter(message);
      } else {
        // Queue for later
        peerInbox.queue.push(message);
      }
      // IMPORTANT: Return immediately - async send (MPST semantics)
    },

    async receive(): Promise<Message> {
      // Check if message already queued
      let msg = myInbox.queue.shift();
      if (!msg) {
        // Wait for sender to deliver
        msg = await new Promise<Message>(resolve => {
          myInbox.waiters.push(resolve);
        });
      }

      // Interception point for bisimulation coordination
      // If handler exists, call it with the message BEFORE returning
      // This provides the pause point for CFG validation
      if (onIncoming) {
        await onIncoming(msg);
      }

      return msg;
    },

    hasMessage(): boolean {
      // Return true if a message is available (receive would not block)
      return myInbox.queue.length > 0;
    }
  });

  // Create both ends - symmetric with same handler
  // endA receives from inboxA, sends to inboxB
  // endB receives from inboxB, sends to inboxA
  const endA = makeEnd(inboxA, inboxB, options?.onIncoming);
  const endB = makeEnd(inboxB, inboxA, options?.onIncoming);

  return [endA, endB];
}

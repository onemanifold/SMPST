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
}

/**
 * Create a bidirectional async channel with MPST semantics
 * Returns two ends - what you send on one end is received on the other
 */
export function createChannel(): [ChannelEnd, ChannelEnd] {
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
    peerInbox: typeof inboxB
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
      const msg = myInbox.queue.shift();
      if (msg) {
        return msg;
      }

      // Wait for sender to deliver
      return new Promise(resolve => {
        myInbox.waiters.push(resolve);
      });
    }
  });

  // Create both ends - cross-wired
  // endA receives from inboxA, sends to inboxB
  // endB receives from inboxB, sends to inboxA
  const endA = makeEnd(inboxA, inboxB);
  const endB = makeEnd(inboxB, inboxA);

  return [endA, endB];
}

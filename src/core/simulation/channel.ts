/**
 * Async Channel Implementation
 *
 * Pure async communication primitives using promise chains.
 * Each channel has two ends - send on one end blocks until receive on the other.
 *
 * Based on CSP (Communicating Sequential Processes) and Go channels.
 */

import type { Message } from './cfsm-simulator-types';

/**
 * Message cell in the promise chain
 * [message, acknowledgment, nextPromise]
 */
type MessageCell = [Message, () => void, MessagePromise];
type MessagePromise = Promise<MessageCell>;

/**
 * One end of a bidirectional channel
 * Supports async send/receive with blocking semantics
 */
export interface ChannelEnd {
  /**
   * Send a message - blocks until the other end receives it
   */
  send(message: Message): Promise<void>;

  /**
   * Receive a message - blocks until the other end sends one
   */
  receive(): Promise<Message>;
}

/**
 * Create a bidirectional async channel
 * Returns two ends - what you send on one end is received on the other
 */
export function createChannel(): [ChannelEnd, ChannelEnd] {
  // Shared state for both promise chains
  // Chain A: endA sends, endB receives
  // Chain B: endB sends, endA receives
  const stateA = {
    chain: null as unknown as MessagePromise,
    resolve: null as unknown as (cell: MessageCell) => void
  };

  const stateB = {
    chain: null as unknown as MessagePromise,
    resolve: null as unknown as (cell: MessageCell) => void
  };

  // Initialize the promise chains
  stateA.chain = new Promise<MessageCell>(resolve => {
    stateA.resolve = resolve;
  });

  stateB.chain = new Promise<MessageCell>(resolve => {
    stateB.resolve = resolve;
  });

  // Factory: creates an end that sends on sendState, receives on recvState
  const makeEnd = (
    sendState: typeof stateA,
    recvState: typeof stateB
  ): ChannelEnd => ({
    async send(message: Message): Promise<void> {
      // Create acknowledgment promise
      let ack: () => void;
      const ackPromise = new Promise<void>(resolve => {
        ack = resolve;
      });

      // Create next promise in chain
      const nextPromise: MessagePromise = new Promise(resolve => {
        sendState.resolve = resolve;
      });

      // Resolve current promise with [message, ack, next]
      sendState.resolve([message, ack!, nextPromise]);
      sendState.chain = nextPromise;

      // Block until receiver acknowledges
      await ackPromise;
    },

    async receive(): Promise<Message> {
      // Wait for message on receive chain
      const [message, ack, nextPromise] = await recvState.chain;

      // Advance to next promise in chain
      recvState.chain = nextPromise;

      // Acknowledge sender (unblocks their send)
      ack();

      return message;
    }
  });

  // Create both ends - cross-wired
  // endA sends on stateA, receives on stateB
  // endB sends on stateB, receives on stateA
  const endA = makeEnd(stateA, stateB);
  const endB = makeEnd(stateB, stateA);

  return [endA, endB];
}

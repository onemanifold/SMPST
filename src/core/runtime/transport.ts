/**
 * Message Transport Implementations
 *
 * Provides pluggable message delivery mechanisms.
 * Default: InMemoryTransport (FIFO queues for testing/simulation)
 */

import type { Message, MessageTransport, MessageListener } from './types';

/**
 * In-memory message transport using PER-PAIR FIFO queues
 * Follows MPST formal semantics: queue(sender → receiver) for each pair
 * Perfect for testing and local simulation
 */
export class InMemoryTransport implements MessageTransport {
  // Per-pair FIFO queues: "sender->receiver" → Message[]
  // Follows Honda, Yoshida, Carbone (2008) formal semantics
  private queues: Map<string, Message[]> = new Map();
  private listeners: Set<MessageListener> = new Set();

  /**
   * Get queue key for sender-receiver pair
   */
  private getQueueKey(sender: string, receiver: string): string {
    return `${sender}->${receiver}`;
  }

  /**
   * Send a message to one or more recipients
   * Appends to queue(sender → receiver) for each recipient
   */
  async send(message: Message): Promise<void> {
    const recipients = Array.isArray(message.to) ? message.to : [message.to];

    for (const recipient of recipients) {
      const queueKey = this.getQueueKey(message.from, recipient);
      if (!this.queues.has(queueKey)) {
        this.queues.set(queueKey, []);
      }
      this.queues.get(queueKey)!.push(message);
    }

    // Notify listeners
    this.listeners.forEach(listener => listener(message));
  }

  /**
   * Receive next message for a role (FIFO)
   * Checks all queues where role is receiver, returns first available
   * Non-blocking: returns undefined if all queues empty
   */
  async receive(role: string): Promise<Message | undefined> {
    // Scan all sender->role queues for first available message
    for (const [queueKey, queue] of this.queues.entries()) {
      if (queueKey.endsWith(`->${role}`) && queue.length > 0) {
        return queue.shift();
      }
    }
    return undefined;
  }

  /**
   * Check if any messages are waiting for role
   * Checks all queues where role is receiver
   */
  hasMessage(role: string): boolean {
    for (const [queueKey, queue] of this.queues.entries()) {
      if (queueKey.endsWith(`->${role}`) && queue.length > 0) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get all pending messages for role (without consuming them)
   * Returns messages from all sender->role queues
   */
  getPendingMessages(role: string): Message[] {
    const messages: Message[] = [];
    for (const [queueKey, queue] of this.queues.entries()) {
      if (queueKey.endsWith(`->${role}`)) {
        messages.push(...queue);
      }
    }
    return messages;
  }

  /**
   * Subscribe to message events
   */
  onMessage(listener: MessageListener): void {
    this.listeners.add(listener);
  }

  /**
   * Unsubscribe from message events
   */
  offMessage(listener: MessageListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Clear all queues (useful for testing)
   */
  clear(): void {
    this.queues.clear();
  }

  /**
   * Get queue depth for a role (debugging)
   */
  getQueueDepth(role: string): number {
    const queue = this.queues.get(role);
    return queue ? queue.length : 0;
  }

  /**
   * Synchronous receive for simulation purposes
   * Avoids async/await complexity when using in synchronous simulators
   * Returns undefined if no message available
   */
  receiveSync(role: string): Message | undefined {
    // Scan all sender->role queues for first available message
    for (const [queueKey, queue] of this.queues.entries()) {
      if (queueKey.endsWith(`->${role}`) && queue.length > 0) {
        const msg = queue.shift();
        // Note: We don't notify listeners in sync mode
        // This is intentional to avoid async side effects
        return msg;
      }
    }
    return undefined;
  }
}

/**
 * Create a new in-memory transport
 */
export function createInMemoryTransport(): MessageTransport {
  return new InMemoryTransport();
}

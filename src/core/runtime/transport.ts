/**
 * Message Transport Implementations
 *
 * Provides pluggable message delivery mechanisms.
 * Default: InMemoryTransport (FIFO queues for testing/simulation)
 */

import type { Message, MessageTransport, MessageListener } from './types';

/**
 * In-memory message transport using FIFO queues
 * Perfect for testing and local simulation
 */
export class InMemoryTransport implements MessageTransport {
  private queues: Map<string, Message[]> = new Map();
  private listeners: Set<MessageListener> = new Set();

  /**
   * Send a message to one or more recipients
   */
  async send(message: Message): Promise<void> {
    const recipients = Array.isArray(message.to) ? message.to : [message.to];

    for (const recipient of recipients) {
      if (!this.queues.has(recipient)) {
        this.queues.set(recipient, []);
      }
      this.queues.get(recipient)!.push(message);
    }

    // Notify listeners
    this.listeners.forEach(listener => listener(message));
  }

  /**
   * Receive next message for a role (FIFO)
   * Non-blocking: returns undefined if queue empty
   */
  async receive(role: string): Promise<Message | undefined> {
    const queue = this.queues.get(role);
    if (!queue || queue.length === 0) {
      return undefined;
    }
    return queue.shift();
  }

  /**
   * Check if any messages are waiting for role
   */
  hasMessage(role: string): boolean {
    const queue = this.queues.get(role);
    return queue !== undefined && queue.length > 0;
  }

  /**
   * Get all pending messages (without consuming them)
   */
  getPendingMessages(role: string): Message[] {
    const queue = this.queues.get(role);
    return queue ? [...queue] : [];
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
}

/**
 * Create a new in-memory transport
 */
export function createInMemoryTransport(): MessageTransport {
  return new InMemoryTransport();
}

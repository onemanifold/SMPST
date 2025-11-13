/**
 * Dexie database wrapper for protocol persistence
 * Provides IndexedDB storage for saved protocols
 */
import Dexie, { type Table } from 'dexie';

export interface SavedProtocol {
  id?: number;
  name: string;
  code: string;
  timestamp: number;
}

export class ProtocolDatabase extends Dexie {
  protocols!: Table<SavedProtocol, number>;

  constructor() {
    super('SMPSTProtocolDB');

    this.version(1).stores({
      protocols: '++id, name, timestamp'
    });
  }
}

// Lazy singleton instance
let db: ProtocolDatabase | null = null;

function getDB(): ProtocolDatabase {
  if (!db) {
    db = new ProtocolDatabase();
  }
  return db;
}

// Database operations
export const protocolDB = {
  async getAll(): Promise<SavedProtocol[]> {
    return await getDB().protocols.orderBy('timestamp').reverse().toArray();
  },

  async add(protocol: Omit<SavedProtocol, 'id'>): Promise<number> {
    return await getDB().protocols.add(protocol);
  },

  async get(id: number): Promise<SavedProtocol | undefined> {
    return await getDB().protocols.get(id);
  },

  async update(id: number, changes: Partial<SavedProtocol>): Promise<number> {
    return await getDB().protocols.update(id, changes);
  },

  async delete(id: number): Promise<void> {
    await getDB().protocols.delete(id);
  },

  async clear(): Promise<void> {
    await getDB().protocols.clear();
  }
};

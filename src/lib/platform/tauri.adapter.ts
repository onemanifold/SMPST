/**
 * Tauri Platform Adapter
 *
 * Implementation for Tauri desktop environments.
 * Uses Tauri APIs for native functionality.
 *
 * Note: This is a placeholder that will be fully implemented
 * when Tauri is integrated. For now, it falls back to web behavior.
 */

import type {
  PlatformAdapter,
  PlatformInfo,
  SaveFileOptions,
  OpenFileOptions,
} from './types';
import { WebAdapter } from './web.adapter';

// Tauri API types (will be imported from @tauri-apps/api when available)
interface TauriAPI {
  dialog: {
    save: (options?: any) => Promise<string | null>;
    open: (options?: any) => Promise<string | string[] | null>;
  };
  fs: {
    writeTextFile: (path: string, content: string) => Promise<void>;
    readTextFile: (path: string) => Promise<string>;
  };
  clipboard: {
    writeText: (text: string) => Promise<void>;
    readText: () => Promise<string | null>;
  };
  path: {
    appDataDir: () => Promise<string>;
  };
  window: {
    appWindow: {
      setTitle: (title: string) => Promise<void>;
      minimize: () => Promise<void>;
      toggleMaximize: () => Promise<void>;
      close: () => Promise<void>;
    };
  };
  os: {
    type: () => Promise<string>;
  };
}

// Check if Tauri is available
function getTauriAPI(): TauriAPI | null {
  if (typeof window !== 'undefined' && '__TAURI__' in window) {
    return (window as any).__TAURI__ as TauriAPI;
  }
  return null;
}

export class TauriAdapter implements PlatformAdapter {
  private readonly webFallback: WebAdapter;
  private readonly tauri: TauriAPI | null;
  private info: PlatformInfo | null = null;

  constructor() {
    this.webFallback = new WebAdapter();
    this.tauri = getTauriAPI();
  }

  private async initInfo(): Promise<PlatformInfo> {
    if (this.info) return this.info;

    if (this.tauri) {
      const osType = await this.tauri.os.type();
      const osMap: Record<string, PlatformInfo['os']> = {
        'Darwin': 'macos',
        'Windows_NT': 'windows',
        'Linux': 'linux',
      };

      this.info = {
        name: 'tauri',
        version: '1.0.0', // TODO: Get from Tauri
        isDesktop: true,
        isMobile: false,
        os: osMap[osType] || 'unknown',
      };
    } else {
      this.info = {
        ...this.webFallback.getInfo(),
        name: 'web',
      };
    }

    return this.info;
  }

  // ========================================
  // Platform Info
  // ========================================

  getInfo(): PlatformInfo {
    // Return cached or default, async init happens elsewhere
    return this.info || this.webFallback.getInfo();
  }

  isDesktop(): boolean {
    return this.tauri !== null;
  }

  hasNativeFS(): boolean {
    return this.tauri !== null;
  }

  // ========================================
  // File Operations
  // ========================================

  async saveFile(
    content: string,
    filename: string,
    options?: SaveFileOptions
  ): Promise<boolean> {
    if (!this.tauri) {
      return this.webFallback.saveFile(content, filename, options);
    }

    try {
      const path = await this.tauri.dialog.save({
        defaultPath: options?.defaultPath || filename,
        filters: options?.filters?.map(f => ({
          name: f.name,
          extensions: f.extensions,
        })),
        title: options?.title || 'Save File',
      });

      if (!path) return false;

      await this.tauri.fs.writeTextFile(path, content);
      return true;
    } catch (err) {
      console.error('Failed to save file:', err);
      return false;
    }
  }

  async openFile(
    options?: OpenFileOptions
  ): Promise<{ name: string; content: string } | null> {
    if (!this.tauri) {
      return this.webFallback.openFile(options);
    }

    try {
      const path = await this.tauri.dialog.open({
        multiple: false,
        filters: options?.filters?.map(f => ({
          name: f.name,
          extensions: f.extensions,
        })),
        title: options?.title || 'Open File',
      });

      if (!path || Array.isArray(path)) return null;

      const content = await this.tauri.fs.readTextFile(path);
      const name = path.split(/[/\\]/).pop() || 'unknown';
      return { name, content };
    } catch (err) {
      console.error('Failed to open file:', err);
      return null;
    }
  }

  async openFiles(
    options?: OpenFileOptions
  ): Promise<Array<{ name: string; content: string }>> {
    if (!this.tauri) {
      return this.webFallback.openFiles(options);
    }

    try {
      const paths = await this.tauri.dialog.open({
        multiple: true,
        filters: options?.filters?.map(f => ({
          name: f.name,
          extensions: f.extensions,
        })),
        title: options?.title || 'Open Files',
      });

      if (!paths) return [];

      const pathArray = Array.isArray(paths) ? paths : [paths];
      const results = await Promise.all(
        pathArray.map(async (path) => {
          const content = await this.tauri!.fs.readTextFile(path);
          const name = path.split(/[/\\]/).pop() || 'unknown';
          return { name, content };
        })
      );

      return results;
    } catch (err) {
      console.error('Failed to open files:', err);
      return [];
    }
  }

  // ========================================
  // Clipboard
  // ========================================

  async copyToClipboard(text: string): Promise<boolean> {
    if (!this.tauri) {
      return this.webFallback.copyToClipboard(text);
    }

    try {
      await this.tauri.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      return false;
    }
  }

  async readFromClipboard(): Promise<string | null> {
    if (!this.tauri) {
      return this.webFallback.readFromClipboard();
    }

    try {
      return await this.tauri.clipboard.readText();
    } catch (err) {
      console.error('Failed to read from clipboard:', err);
      return null;
    }
  }

  // ========================================
  // Storage
  // ========================================

  async getStoragePath(): Promise<string | null> {
    if (!this.tauri) return null;

    try {
      return await this.tauri.path.appDataDir();
    } catch (err) {
      console.error('Failed to get storage path:', err);
      return null;
    }
  }

  // ========================================
  // Window Management
  // ========================================

  async setWindowTitle(title: string): Promise<void> {
    if (!this.tauri) {
      return this.webFallback.setWindowTitle(title);
    }

    await this.tauri.window.appWindow.setTitle(title);
  }

  async minimizeWindow(): Promise<void> {
    if (!this.tauri) return;
    await this.tauri.window.appWindow.minimize();
  }

  async toggleMaximize(): Promise<void> {
    if (!this.tauri) {
      return this.webFallback.toggleMaximize();
    }
    await this.tauri.window.appWindow.toggleMaximize();
  }

  async closeWindow(): Promise<void> {
    if (!this.tauri) {
      return this.webFallback.closeWindow();
    }
    await this.tauri.window.appWindow.close();
  }
}

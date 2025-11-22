/**
 * Web Platform Adapter
 *
 * Implementation for browser environments (GitHub Pages, etc.)
 * Uses standard Web APIs and graceful fallbacks.
 */

import type {
  PlatformAdapter,
  PlatformInfo,
  SaveFileOptions,
  OpenFileOptions,
} from './types';

// Detect OS from user agent
function detectOS(): PlatformInfo['os'] {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('win')) return 'windows';
  if (ua.includes('mac')) return 'macos';
  if (ua.includes('linux')) return 'linux';
  if (ua.includes('android')) return 'android';
  if (ua.includes('iphone') || ua.includes('ipad')) return 'ios';
  return 'unknown';
}

// Check for File System Access API support
function hasFileSystemAccess(): boolean {
  return 'showSaveFilePicker' in window && 'showOpenFilePicker' in window;
}

export class WebAdapter implements PlatformAdapter {
  private readonly info: PlatformInfo;

  constructor() {
    this.info = {
      name: 'web',
      version: '1.0.0',
      isDesktop: !('ontouchstart' in window),
      isMobile: 'ontouchstart' in window,
      os: detectOS(),
    };
  }

  // ========================================
  // Platform Info
  // ========================================

  getInfo(): PlatformInfo {
    return this.info;
  }

  isDesktop(): boolean {
    return false; // Web is never considered "desktop" for native features
  }

  hasNativeFS(): boolean {
    return hasFileSystemAccess();
  }

  // ========================================
  // File Operations
  // ========================================

  async saveFile(
    content: string,
    filename: string,
    options?: SaveFileOptions
  ): Promise<boolean> {
    // Try File System Access API first (Chrome, Edge)
    if (hasFileSystemAccess()) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: filename,
          types: options?.filters?.map(f => ({
            description: f.name,
            accept: {
              'text/plain': f.extensions.map(e => `.${e}`),
            },
          })),
        });

        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();
        return true;
      } catch (err) {
        // User cancelled or API error, fall through to download
        if ((err as Error).name === 'AbortError') {
          return false;
        }
      }
    }

    // Fallback: Download via anchor element
    try {
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return true;
    } catch (err) {
      console.error('Failed to save file:', err);
      return false;
    }
  }

  async openFile(
    options?: OpenFileOptions
  ): Promise<{ name: string; content: string } | null> {
    // Try File System Access API first
    if (hasFileSystemAccess()) {
      try {
        const [handle] = await (window as any).showOpenFilePicker({
          multiple: false,
          types: options?.filters?.map(f => ({
            description: f.name,
            accept: {
              'text/plain': f.extensions.map(e => `.${e}`),
            },
          })),
        });

        const file = await handle.getFile();
        const content = await file.text();
        return { name: file.name, content };
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return null;
        }
      }
    }

    // Fallback: File input
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = options?.filters
        ?.flatMap(f => f.extensions.map(e => `.${e}`))
        .join(',') || '.scribble,.txt';

      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }

        const content = await file.text();
        resolve({ name: file.name, content });
      };

      input.oncancel = () => resolve(null);
      input.click();
    });
  }

  async openFiles(
    options?: OpenFileOptions
  ): Promise<Array<{ name: string; content: string }>> {
    // Try File System Access API first
    if (hasFileSystemAccess()) {
      try {
        const handles = await (window as any).showOpenFilePicker({
          multiple: true,
          types: options?.filters?.map(f => ({
            description: f.name,
            accept: {
              'text/plain': f.extensions.map(e => `.${e}`),
            },
          })),
        });

        const results = await Promise.all(
          handles.map(async (handle: any) => {
            const file = await handle.getFile();
            const content = await file.text();
            return { name: file.name, content };
          })
        );

        return results;
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return [];
        }
      }
    }

    // Fallback: File input with multiple
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.accept = options?.filters
        ?.flatMap(f => f.extensions.map(e => `.${e}`))
        .join(',') || '.scribble,.txt';

      input.onchange = async () => {
        const files = Array.from(input.files || []);
        const results = await Promise.all(
          files.map(async (file) => ({
            name: file.name,
            content: await file.text(),
          }))
        );
        resolve(results);
      };

      input.oncancel = () => resolve([]);
      input.click();
    });
  }

  // ========================================
  // Clipboard
  // ========================================

  async copyToClipboard(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      // Fallback for older browsers
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        return true;
      } catch {
        console.error('Failed to copy to clipboard:', err);
        return false;
      }
    }
  }

  async readFromClipboard(): Promise<string | null> {
    try {
      return await navigator.clipboard.readText();
    } catch (err) {
      console.error('Failed to read from clipboard:', err);
      return null;
    }
  }

  // ========================================
  // Storage
  // ========================================

  async getStoragePath(): Promise<string | null> {
    return null; // No native storage path on web
  }

  // ========================================
  // Window Management (no-ops on web)
  // ========================================

  async setWindowTitle(title: string): Promise<void> {
    document.title = title;
  }

  async minimizeWindow(): Promise<void> {
    // No-op on web
  }

  async toggleMaximize(): Promise<void> {
    // Try fullscreen as alternative
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
    }
  }

  async closeWindow(): Promise<void> {
    // Can't close window on web without opener
    window.close();
  }
}

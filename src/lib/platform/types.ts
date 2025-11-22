/**
 * Platform Adapter Types
 *
 * Defines the interface for platform-specific operations.
 * Implementations exist for Web (GitHub Pages) and Tauri (Desktop).
 */

export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface SaveFileOptions {
  defaultPath?: string;
  filters?: FileFilter[];
  title?: string;
}

export interface OpenFileOptions {
  multiple?: boolean;
  filters?: FileFilter[];
  title?: string;
}

export interface PlatformInfo {
  name: 'web' | 'tauri';
  version: string;
  isDesktop: boolean;
  isMobile: boolean;
  os?: 'windows' | 'macos' | 'linux' | 'ios' | 'android' | 'unknown';
}

/**
 * Platform Adapter Interface
 *
 * All platform-specific functionality goes through this interface.
 * This allows the app to work on both web and desktop without
 * conditional logic scattered throughout the codebase.
 */
export interface PlatformAdapter {
  // ========================================
  // Platform Info
  // ========================================

  /** Get platform information */
  getInfo(): PlatformInfo;

  /** Check if running in desktop environment */
  isDesktop(): boolean;

  /** Check if native file system access is available */
  hasNativeFS(): boolean;

  // ========================================
  // File Operations
  // ========================================

  /**
   * Save content to a file
   * - Web: Uses download or File System Access API
   * - Tauri: Uses native save dialog
   */
  saveFile(content: string, filename: string, options?: SaveFileOptions): Promise<boolean>;

  /**
   * Open and read a file
   * - Web: Uses file input or File System Access API
   * - Tauri: Uses native open dialog
   */
  openFile(options?: OpenFileOptions): Promise<{ name: string; content: string } | null>;

  /**
   * Open multiple files
   * - Web: Uses file input with multiple attribute
   * - Tauri: Uses native open dialog with multiple selection
   */
  openFiles(options?: OpenFileOptions): Promise<Array<{ name: string; content: string }>>;

  // ========================================
  // Clipboard
  // ========================================

  /** Copy text to clipboard */
  copyToClipboard(text: string): Promise<boolean>;

  /** Read text from clipboard */
  readFromClipboard(): Promise<string | null>;

  // ========================================
  // Storage
  // ========================================

  /**
   * Get persistent storage path (Tauri only)
   * Returns null on web
   */
  getStoragePath(): Promise<string | null>;

  // ========================================
  // Window Management (Desktop only)
  // ========================================

  /** Set window title */
  setWindowTitle(title: string): Promise<void>;

  /** Minimize window */
  minimizeWindow(): Promise<void>;

  /** Maximize/restore window */
  toggleMaximize(): Promise<void>;

  /** Close window */
  closeWindow(): Promise<void>;
}

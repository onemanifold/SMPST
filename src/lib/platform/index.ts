/**
 * Platform Module
 *
 * Auto-detects the current platform and exports the appropriate adapter.
 * This provides a unified interface for platform-specific functionality.
 *
 * Usage:
 * ```typescript
 * import { platform } from '$lib/platform';
 *
 * // Save a file (works on both web and desktop)
 * await platform.saveFile(code, 'protocol.scribble');
 *
 * // Check platform
 * if (platform.isDesktop()) {
 *   // Desktop-specific UI
 * }
 * ```
 */

import type { PlatformAdapter } from './types';
import { WebAdapter } from './web.adapter';
import { TauriAdapter } from './tauri.adapter';

// Export types
export type { PlatformAdapter, PlatformInfo, FileFilter, SaveFileOptions, OpenFileOptions } from './types';

// Detect and create appropriate adapter
function createPlatformAdapter(): PlatformAdapter {
  // Check if running in Tauri
  if (typeof window !== 'undefined' && '__TAURI__' in window) {
    return new TauriAdapter();
  }

  // Default to web
  return new WebAdapter();
}

/**
 * Platform adapter singleton
 *
 * Automatically detects the current platform (Web or Tauri)
 * and provides the appropriate implementation.
 */
export const platform: PlatformAdapter = createPlatformAdapter();

/**
 * Re-export adapters for testing or explicit usage
 */
export { WebAdapter } from './web.adapter';
export { TauriAdapter } from './tauri.adapter';

/**
 * Scribble file filter for file dialogs
 */
export const SCRIBBLE_FILE_FILTER = {
  name: 'Scribble Protocol',
  extensions: ['scribble', 'scrb'],
};

/**
 * All supported file filters
 */
export const ALL_FILE_FILTERS = [
  SCRIBBLE_FILE_FILTER,
  { name: 'Text Files', extensions: ['txt'] },
  { name: 'All Files', extensions: ['*'] },
];

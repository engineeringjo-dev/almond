import { config } from '../config';
import { createMemoryBackend } from './memory';
import { createOdooBackend } from './odoo';
import type { Backend } from './types';

/** One switch, mirroring the app's DATA_SOURCE. */
export function createBackend(): Backend {
  return config.DATA_SOURCE === 'odoo' ? createOdooBackend() : createMemoryBackend();
}
export type { Backend } from './types';

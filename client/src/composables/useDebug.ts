import { useSettings } from './useSettings';

/**
 * Debug logging utility that respects the user's debug preference.
 *
 * Usage:
 *   const debug = useDebug('ComponentName');
 *   debug.log('Something happened', data);
 *   debug.error('Error occurred', error);
 *   debug.warn('Warning message');
 */
export function useDebug(context: string) {
  const { preferences } = useSettings();

  function log(...args: any[]): void {
    if (preferences.value.debug) {
      console.log(`[${context}]`, ...args);
    }
  }

  function error(...args: any[]): void {
    if (preferences.value.debug) {
      console.error(`[${context}]`, ...args);
    }
  }

  function warn(...args: any[]): void {
    if (preferences.value.debug) {
      console.warn(`[${context}]`, ...args);
    }
  }

  function info(...args: any[]): void {
    if (preferences.value.debug) {
      console.info(`[${context}]`, ...args);
    }
  }

  function group(label: string): void {
    if (preferences.value.debug) {
      console.group(`[${context}] ${label}`);
    }
  }

  function groupEnd(): void {
    if (preferences.value.debug) {
      console.groupEnd();
    }
  }

  function table(data: any): void {
    if (preferences.value.debug) {
      console.log(`[${context}]`);
      console.table(data);
    }
  }

  function time(label: string): void {
    if (preferences.value.debug) {
      console.time(`[${context}] ${label}`);
    }
  }

  function timeEnd(label: string): void {
    if (preferences.value.debug) {
      console.timeEnd(`[${context}] ${label}`);
    }
  }

  return {
    log,
    error,
    warn,
    info,
    group,
    groupEnd,
    table,
    time,
    timeEnd,
    enabled: () => preferences.value.debug,
  };
}

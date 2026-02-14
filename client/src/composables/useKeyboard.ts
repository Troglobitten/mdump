import type { KeyboardShortcut } from '@mdump/shared';

type ShortcutHandler = () => void;

const handlers: Map<string, ShortcutHandler> = new Map();

function getShortcutKey(e: KeyboardEvent): string {
  const parts: string[] = [];

  if (e.ctrlKey || e.metaKey) parts.push('ctrl');
  if (e.shiftKey) parts.push('shift');
  if (e.altKey) parts.push('alt');

  // Normalize key name
  if (!e.key) return '';
  let key = e.key.toLowerCase();
  if (key === ' ') key = 'space';
  if (key === 'escape') key = 'esc';

  parts.push(key);

  return parts.join('+');
}

function shortcutToKey(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];

  if (shortcut.ctrl || shortcut.meta) parts.push('ctrl');
  if (shortcut.shift) parts.push('shift');
  if (shortcut.alt) parts.push('alt');

  parts.push(shortcut.key.toLowerCase());

  return parts.join('+');
}

export function useKeyboard() {
  function handleKeydown(e: KeyboardEvent): void {
    // Ignore if typing in an input
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      // But still allow some shortcuts like Ctrl+S
      const key = getShortcutKey(e);
      if (!['ctrl+s', 'ctrl+w'].includes(key)) {
        return;
      }
    }

    const key = getShortcutKey(e);
    const handler = handlers.get(key);

    if (handler) {
      e.preventDefault();
      handler();
    }
  }

  function registerShortcut(shortcut: KeyboardShortcut | string, handler: ShortcutHandler): () => void {
    const key = typeof shortcut === 'string' ? shortcut : shortcutToKey(shortcut);
    handlers.set(key, handler);

    return () => {
      handlers.delete(key);
    };
  }

  function registerShortcuts(
    shortcuts: Array<{ shortcut: KeyboardShortcut | string; handler: ShortcutHandler }>
  ): () => void {
    const unsubscribers = shortcuts.map(({ shortcut, handler }) =>
      registerShortcut(shortcut, handler)
    );

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }

  function setupGlobalListener(): () => void {
    window.addEventListener('keydown', handleKeydown);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
    };
  }

  return {
    registerShortcut,
    registerShortcuts,
    setupGlobalListener,
  };
}

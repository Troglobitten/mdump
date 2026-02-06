import type { KeyboardShortcut } from '@mdump/shared';

export const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  {
    key: 'n',
    ctrl: true,
    action: 'newNote',
    description: 'Create new note',
  },
  {
    key: 's',
    ctrl: true,
    action: 'save',
    description: 'Save current note',
  },
  {
    key: 'w',
    ctrl: true,
    action: 'closeTab',
    description: 'Close current tab',
  },
  {
    key: 'b',
    ctrl: true,
    action: 'toggleSidebar',
    description: 'Toggle sidebar',
  },
  {
    key: 'f',
    ctrl: true,
    action: 'focusSearch',
    description: 'Focus search bar',
  },
  {
    key: ',',
    ctrl: true,
    action: 'openSettings',
    description: 'Open settings',
  },
  {
    key: 'Tab',
    ctrl: true,
    action: 'nextTab',
    description: 'Switch to next tab',
  },
  {
    key: 'Tab',
    ctrl: true,
    shift: true,
    action: 'prevTab',
    description: 'Switch to previous tab',
  },
];

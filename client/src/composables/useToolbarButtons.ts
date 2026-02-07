import { onUnmounted, type Ref, watch } from 'vue';

export interface ToolbarButton {
  id: string;
  title: string;
  icon: string;
  onClick: () => void;
}

const CUSTOM_ATTR = 'data-custom-toolbar';

// Wysimark toolbar button styles (styled component zx)
const BUTTON_STYLES: Partial<CSSStyleDeclaration> = {
  boxSizing: 'border-box',
  position: 'relative',
  display: 'inline-block',
  verticalAlign: 'top',
  fontSize: '1.25em',
  marginTop: '0.25em',
  height: '2em',
  padding: '0.375em',
  borderRadius: '0.25em',
  textAlign: 'center',
  color: 'var(--shade-500)',
  cursor: 'pointer',
  border: '1px solid transparent',
};

// Wysimark toolbar divider styles (styled component Ix/$x)
const DIVIDER_STYLES: Partial<CSSStyleDeclaration> = {
  display: 'inline-block',
  verticalAlign: 'top',
  marginTop: '0.5em',
  height: '1.5em',
  width: '1px',
  marginLeft: '0.25em',
  marginRight: '0.25em',
};

function createButtonEl(button: ToolbarButton): HTMLDivElement {
  const btn = document.createElement('div');
  btn.setAttribute('data-item-type', 'button');
  btn.setAttribute(CUSTOM_ATTR, button.id);
  btn.title = button.title;
  Object.assign(btn.style, BUTTON_STYLES);
  btn.innerHTML = button.icon;
  btn.addEventListener('mouseenter', () => { btn.style.backgroundColor = 'var(--shade-100)'; });
  btn.addEventListener('mouseleave', () => { btn.style.backgroundColor = 'transparent'; });
  btn.addEventListener('click', button.onClick);
  return btn;
}

function createDividerEl(): HTMLDivElement {
  const divider = document.createElement('div');
  divider.setAttribute('data-item-type', 'divider');
  divider.setAttribute(CUSTOM_ATTR, 'divider');
  Object.assign(divider.style, DIVIDER_STYLES);
  const line = document.createElement('div');
  Object.assign(line.style, { height: '100%', borderLeft: '1px solid var(--shade-200)' } as Partial<CSSStyleDeclaration>);
  divider.appendChild(line);
  return divider;
}

/**
 * Manages custom buttons injected into the Wysimark toolbar.
 *
 * Handles the MutationObserver + debounce to (re-)inject buttons after the
 * toolbar renders or re-renders (e.g. on window resize).  All registered
 * buttons are grouped after a single divider, in registration order.
 */
export function useToolbarButtons(editorWrapRef: Ref<HTMLElement | null>) {
  const buttons = new Map<string, ToolbarButton>();
  let observer: MutationObserver | null = null;
  let injectTimeout: ReturnType<typeof setTimeout> | null = null;

  function inject() {
    if (!editorWrapRef.value || buttons.size === 0) return;

    // Already injected — nothing to do
    if (editorWrapRef.value.querySelector(`[${CUSTOM_ATTR}]`)) return;

    // Find the toolbar inner container (Rx) via existing Wysimark buttons
    const firstButton = editorWrapRef.value.querySelector('[data-item-type="button"]');
    const toolbarInner = firstButton?.parentElement;
    if (!toolbarInner) return;

    toolbarInner.appendChild(createDividerEl());
    for (const button of buttons.values()) {
      toolbarInner.appendChild(createButtonEl(button));
    }
  }

  function scheduleInject() {
    if (injectTimeout) clearTimeout(injectTimeout);
    injectTimeout = setTimeout(inject, 150);
  }

  function startObserving() {
    if (observer) observer.disconnect();
    if (!editorWrapRef.value) return;

    observer = new MutationObserver(scheduleInject);
    observer.observe(editorWrapRef.value, { childList: true, subtree: true });
    scheduleInject();
  }

  // Start observing once the ref is populated (handles v-if/v-else toggling)
  watch(editorWrapRef, (el) => {
    if (el) startObserving();
  }, { immediate: true });

  function registerButton(button: ToolbarButton) {
    buttons.set(button.id, button);
    // Re-inject immediately if toolbar is already in the DOM
    if (editorWrapRef.value) {
      // Remove existing custom buttons so they get re-created in order
      editorWrapRef.value.querySelectorAll(`[${CUSTOM_ATTR}]`).forEach(el => el.remove());
      scheduleInject();
    }
  }

  onUnmounted(() => {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (injectTimeout) {
      clearTimeout(injectTimeout);
    }
  });

  return { registerButton };
}

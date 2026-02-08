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
  transition: 'all 100ms',
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

// Wysimark tooltip label styles (styled component Nx)
const TOOLTIP_LABEL_STYLES: Partial<CSSStyleDeclaration> = {
  position: 'fixed',
  zIndex: '10',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif',
  fontSize: '0.875em',
  lineHeight: '1.5em',
  padding: '0 0.5em',
  color: '#f0f0f0',
  background: '#333',
  borderRadius: '0.25em',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
};

// Wysimark tooltip arrow styles (styled component Wx)
const TOOLTIP_ARROW_STYLES: Partial<CSSStyleDeclaration> = {
  position: 'fixed',
  zIndex: '10',
  width: '0',
  height: '0',
  borderLeft: '0.375em solid transparent',
  borderRight: '0.375em solid transparent',
  borderTop: '0.375em solid #333',
  pointerEvents: 'none',
};

// Active tooltip elements (shared across all buttons, only one visible at a time)
let tooltipLabel: HTMLDivElement | null = null;
let tooltipArrow: HTMLSpanElement | null = null;

function showTooltip(btn: HTMLElement, title: string) {
  if (!tooltipLabel) {
    tooltipLabel = document.createElement('div');
    Object.assign(tooltipLabel.style, TOOLTIP_LABEL_STYLES);
    document.body.appendChild(tooltipLabel);
  }
  if (!tooltipArrow) {
    tooltipArrow = document.createElement('span');
    Object.assign(tooltipArrow.style, TOOLTIP_ARROW_STYLES);
    document.body.appendChild(tooltipArrow);
  }

  const rect = btn.getBoundingClientRect();

  tooltipLabel.textContent = title;
  tooltipLabel.style.left = `${rect.left}px`;
  tooltipLabel.style.top = `calc(${rect.top}px - 2em)`;
  tooltipLabel.style.display = '';

  tooltipArrow.style.left = `calc(${rect.left + rect.width / 2}px - 0.375em)`;
  tooltipArrow.style.top = `calc(${rect.top}px - 0.5em)`;
  tooltipArrow.style.display = '';
}

function hideTooltip() {
  if (tooltipLabel) tooltipLabel.style.display = 'none';
  if (tooltipArrow) tooltipArrow.style.display = 'none';
}

function createButtonEl(button: ToolbarButton): HTMLDivElement {
  const btn = document.createElement('div');
  btn.setAttribute('data-item-type', 'button');
  btn.setAttribute(CUSTOM_ATTR, button.id);
  Object.assign(btn.style, BUTTON_STYLES);
  btn.innerHTML = button.icon;
  btn.addEventListener('mouseenter', () => {
    btn.style.backgroundColor = 'var(--blue-100)';
    btn.style.color = 'var(--shade-700)';
    showTooltip(btn, button.title);
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.backgroundColor = 'transparent';
    btn.style.color = 'var(--shade-500)';
    hideTooltip();
  });
  btn.addEventListener('mousedown', (e) => e.preventDefault());
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
    // Clean up tooltip elements from document.body
    if (tooltipLabel) {
      tooltipLabel.remove();
      tooltipLabel = null;
    }
    if (tooltipArrow) {
      tooltipArrow.remove();
      tooltipArrow = null;
    }
  });

  return { registerButton };
}

import { ref, readonly } from 'vue';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

const toasts = ref<Toast[]>([]);
let toastId = 0;

export function useToast() {
  function addToast(message: string, type: ToastType = 'info', duration: number = 3000): string {
    const id = `toast-${++toastId}`;

    const toast: Toast = {
      id,
      message,
      type,
      duration,
    };

    toasts.value.push(toast);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }

    return id;
  }

  function removeToast(id: string): void {
    const index = toasts.value.findIndex((t) => t.id === id);
    if (index !== -1) {
      toasts.value.splice(index, 1);
    }
  }

  function success(message: string, duration?: number): string {
    return addToast(message, 'success', duration);
  }

  function error(message: string, duration?: number): string {
    return addToast(message, 'error', duration ?? 5000);
  }

  function warning(message: string, duration?: number): string {
    return addToast(message, 'warning', duration);
  }

  function info(message: string, duration?: number): string {
    return addToast(message, 'info', duration);
  }

  function clear(): void {
    toasts.value = [];
  }

  return {
    toasts: readonly(toasts),
    addToast,
    removeToast,
    success,
    error,
    warning,
    info,
    clear,
  };
}

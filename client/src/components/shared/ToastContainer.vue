<script setup lang="ts">
import { inject } from 'vue';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-vue-next';
import type { useToast, ToastType } from '@/composables/useToast';

const toast = inject<ReturnType<typeof useToast>>('toast')!;

const icons: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};
</script>

<template>
  <div class="toast-container">
    <TransitionGroup name="toast">
      <div
        v-for="item in toast.toasts.value"
        :key="item.id"
        class="toast"
        :class="`toast-${item.type}`"
      >
        <component :is="icons[item.type]" class="w-5 h-5" />
        <span class="flex-1">{{ item.message }}</span>
        <button
          class="p-1 hover:opacity-70 transition-opacity"
          @click="toast.removeToast(item.id)"
        >
          <X class="w-4 h-4" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active {
  animation: slide-in-from-right 0.3s ease-out;
}

.toast-leave-active {
  animation: slide-out-to-right 0.3s ease-in;
}

@keyframes slide-out-to-right {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(100%);
    opacity: 0;
  }
}
</style>

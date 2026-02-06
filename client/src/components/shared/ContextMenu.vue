<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';

interface MenuItem {
  label?: string;
  action?: () => void;
  danger?: boolean;
  separator?: boolean;
}

const open = defineModel<boolean>('open', { default: false });

const props = defineProps<{
  position: { x: number; y: number };
  items: MenuItem[];
}>();

const menuRef = ref<HTMLDivElement | null>(null);
const adjustedPosition = ref({ x: 0, y: 0 });
let justOpened = false;

watch([open, () => props.position], () => {
  if (open.value) {
    justOpened = true;
    requestAnimationFrame(() => { justOpened = false; });
  }
  if (open.value) {
    // Adjust position to stay within viewport
    const menuWidth = 200;
    const menuHeight = props.items.length * 40;

    let x = props.position.x;
    let y = props.position.y;

    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 10;
    }

    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 10;
    }

    adjustedPosition.value = { x, y };
  }
});

function handleItemClick(item: MenuItem) {
  if (item.action) {
    item.action();
  }
  open.value = false;
}

function handleClickOutside(e: MouseEvent) {
  if (justOpened) return;
  if (menuRef.value && !menuRef.value.contains(e.target as Node)) {
    open.value = false;
  }
}

function handleEscape(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    open.value = false;
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
  document.addEventListener('contextmenu', handleClickOutside);
  document.addEventListener('keydown', handleEscape);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  document.removeEventListener('contextmenu', handleClickOutside);
  document.removeEventListener('keydown', handleEscape);
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      ref="menuRef"
      class="context-menu"
      :style="{
        left: `${adjustedPosition.x}px`,
        top: `${adjustedPosition.y}px`,
      }"
    >
      <template v-for="(item, index) in items" :key="index">
        <div v-if="item.separator" class="context-menu-separator"></div>
        <div
          v-else
          class="context-menu-item"
          :class="{ danger: item.danger }"
          @click="handleItemClick(item)"
        >
          {{ item.label }}
        </div>
      </template>
    </div>
  </Teleport>
</template>

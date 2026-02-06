<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { X, ChevronLeft, ChevronRight, PanelLeft } from 'lucide-vue-next';
import { useTabs } from '@/composables/useTabs';
import draggable from 'vuedraggable';

const props = defineProps<{
  sidebarCollapsed: boolean;
}>();

const emit = defineEmits<{
  toggleSidebar: [];
}>();

const { tabs, activeTabPath, setActiveTab, closeTab, forceCloseTab, reorderTabs } = useTabs();

const dragging = ref(false);
const scrollContainer = ref<HTMLDivElement | null>(null);
const showLeftArrow = ref(false);
const showRightArrow = ref(false);

let resizeObserver: ResizeObserver | null = null;

function checkOverflow() {
  const el = scrollContainer.value;
  if (!el) return;
  showLeftArrow.value = el.scrollLeft > 0;
  showRightArrow.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
}

function scrollLeft() {
  scrollContainer.value?.scrollBy({ left: -200, behavior: 'smooth' });
}

function scrollRight() {
  scrollContainer.value?.scrollBy({ left: 200, behavior: 'smooth' });
}

function handleTabClick(path: string) {
  setActiveTab(path);
}

function handleCloseTab(path: string, e: MouseEvent) {
  e.stopPropagation();
  const closed = closeTab(path);

  if (!closed) {
    // Tab has unsaved changes, confirm before closing
    if (confirm('This note has unsaved changes. Close anyway?')) {
      forceCloseTab(path);
    }
  }
}

function handleMiddleClick(path: string, e: MouseEvent) {
  if (e.button === 1) {
    e.preventDefault();
    handleCloseTab(path, e);
  }
}

function handleDragEnd() {
  dragging.value = false;
}

function handleDragChange(event: { moved?: { oldIndex: number; newIndex: number } }) {
  if (event.moved) {
    reorderTabs(event.moved.oldIndex, event.moved.newIndex);
  }
}

onMounted(() => {
  const el = scrollContainer.value;
  if (el) {
    el.addEventListener('scroll', checkOverflow);
    resizeObserver = new ResizeObserver(checkOverflow);
    resizeObserver.observe(el);
  }
  nextTick(checkOverflow);
});

onUnmounted(() => {
  const el = scrollContainer.value;
  if (el) {
    el.removeEventListener('scroll', checkOverflow);
  }
  resizeObserver?.disconnect();
});

watch(() => tabs.value.length, () => {
  nextTick(checkOverflow);
});
</script>

<template>
  <div class="tab-bar">
    <button
      v-if="props.sidebarCollapsed"
      class="btn btn-ghost btn-xs btn-square flex-shrink-0"
      title="Toggle Sidebar (Ctrl+B)"
      @click="emit('toggleSidebar')"
    >
      <PanelLeft class="w-4 h-4" />
    </button>

    <button
      v-if="showLeftArrow"
      class="btn btn-ghost btn-xs btn-square flex-shrink-0"
      @click="scrollLeft"
    >
      <ChevronLeft class="w-3 h-3" />
    </button>

    <div ref="scrollContainer" class="flex-1 overflow-hidden min-w-0">
      <draggable
        :list="[...tabs]"
        item-key="path"
        class="flex items-center gap-1"
        ghost-class="opacity-50"
        @start="dragging = true"
        @end="handleDragEnd"
        @change="handleDragChange"
      >
        <template #item="{ element: tab }">
          <div
            class="tab"
            :class="{ active: activeTabPath === tab.path, dirty: tab.isDirty }"
            @click="handleTabClick(tab.path)"
            @mousedown="handleMiddleClick(tab.path, $event)"
          >
            <span class="tab-name truncate max-w-32">{{ tab.name }}</span>
            <button
              class="tab-close"
              title="Close"
              @click="handleCloseTab(tab.path, $event)"
            >
              <X class="w-3 h-3" />
            </button>
          </div>
        </template>
      </draggable>
    </div>

    <button
      v-if="showRightArrow"
      class="btn btn-ghost btn-xs btn-square flex-shrink-0"
      @click="scrollRight"
    >
      <ChevronRight class="w-3 h-3" />
    </button>
  </div>
</template>

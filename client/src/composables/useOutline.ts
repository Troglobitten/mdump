import { ref, readonly } from 'vue';

export interface OutlineItem {
  level: number;
  text: string;
  id: string;
}

const headings = ref<OutlineItem[]>([]);

export function useOutline() {
  function updateHeadings(items: OutlineItem[]) {
    headings.value = items;
  }

  function clearHeadings() {
    headings.value = [];
  }

  function scrollToHeading(id: string) {
    const el = document.querySelector(`#${CSS.escape(id)}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return { headings: readonly(headings), updateHeadings, clearHeadings, scrollToHeading };
}

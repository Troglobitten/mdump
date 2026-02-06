import { ref, readonly, computed } from 'vue';
import type { SearchResult } from '@mdump/shared';
import { searchApi } from '@/api/client';

const query = ref('');
const results = ref<SearchResult[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const isSearching = ref(false);
const scope = ref<string | null>(null);

let searchTimeout: ReturnType<typeof setTimeout> | null = null;
const SEARCH_DEBOUNCE = 300;

export function useSearch() {
  const hasResults = computed(() => results.value.length > 0);
  const hasQuery = computed(() => query.value.trim().length > 0);

  async function search(searchQuery: string, scope?: string): Promise<SearchResult[]> {
    if (!searchQuery.trim()) {
      results.value = [];
      return [];
    }

    loading.value = true;
    error.value = null;

    try {
      const searchResults = await searchApi.search(searchQuery, scope);
      results.value = searchResults;
      return searchResults;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Search failed';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  function debouncedSearch(searchQuery: string, searchScope?: string): void {
    query.value = searchQuery;

    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    if (!searchQuery.trim()) {
      results.value = [];
      isSearching.value = false;
      return;
    }

    isSearching.value = true;
    const effectiveScope = searchScope ?? scope.value ?? undefined;

    searchTimeout = setTimeout(async () => {
      try {
        await search(searchQuery, effectiveScope);
      } finally {
        isSearching.value = false;
      }
    }, SEARCH_DEBOUNCE);
  }

  function clearSearch(): void {
    query.value = '';
    results.value = [];
    isSearching.value = false;

    if (searchTimeout) {
      clearTimeout(searchTimeout);
      searchTimeout = null;
    }
  }

  function setQuery(newQuery: string): void {
    query.value = newQuery;
  }

  function setScope(folderPath: string | null): void {
    scope.value = folderPath;
    // Re-search with new scope if there's an active query
    if (query.value.trim()) {
      debouncedSearch(query.value);
    }
  }

  function clearScope(): void {
    setScope(null);
  }

  return {
    query: readonly(query),
    results: readonly(results),
    loading: readonly(loading),
    error: readonly(error),
    isSearching: readonly(isSearching),
    scope: readonly(scope),
    hasResults,
    hasQuery,
    search,
    debouncedSearch,
    clearSearch,
    setQuery,
    setScope,
    clearScope,
  };
}

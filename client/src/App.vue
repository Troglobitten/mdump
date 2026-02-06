<script setup lang="ts">
import { ref, onMounted, watch, provide } from 'vue';
import { useAuth } from '@/composables/useAuth';
import { useSettings } from '@/composables/useSettings';
import { useTheme } from '@/composables/useTheme';
import { useWebSocket } from '@/composables/useWebSocket';
import { useKeyboard } from '@/composables/useKeyboard';
import { useToast } from '@/composables/useToast';
import LoginPage from '@/components/auth/LoginPage.vue';
import SetupPage from '@/components/auth/SetupPage.vue';
import MainLayout from '@/components/layout/MainLayout.vue';
import ToastContainer from '@/components/shared/ToastContainer.vue';

const { checkStatus, isAuthenticated, needsSetup, loading: authLoading } = useAuth();
const { loadPreferences } = useSettings();
const { initTheme } = useTheme();
const { connect: connectWs, disconnect: disconnectWs } = useWebSocket();
const { setupGlobalListener } = useKeyboard();
const toast = useToast();

const initialized = ref(false);

// Provide toast globally
provide('toast', toast);

onMounted(async () => {
  // Set up global keyboard listener
  setupGlobalListener();

  try {
    // Check auth status first
    const status = await checkStatus();

    if (status.authenticated) {
      // Load preferences and connect WebSocket
      const prefs = await loadPreferences();
      initTheme(prefs.theme);
      connectWs();
    } else {
      // Just init theme from localStorage
      initTheme();
    }
  } catch (error) {
    console.error('Initialization error:', error);
    toast.error('Failed to initialize app');
  } finally {
    initialized.value = true;
  }
});

// Watch for auth changes
watch(isAuthenticated, (authenticated) => {
  if (authenticated) {
    loadPreferences().then((prefs) => {
      initTheme(prefs.theme);
    });
    connectWs();
  } else {
    disconnectWs();
  }
});
</script>

<template>
  <div class="h-full w-full">
    <!-- Loading state -->
    <div
      v-if="!initialized || authLoading"
      class="h-full w-full flex items-center justify-center bg-base-100"
    >
      <div class="flex flex-col items-center gap-4">
        <span class="loading loading-spinner loading-lg text-primary"></span>
        <span class="text-base-content/60">Loading...</span>
      </div>
    </div>

    <!-- Setup page (first run) -->
    <SetupPage v-else-if="needsSetup" />

    <!-- Login page -->
    <LoginPage v-else-if="!isAuthenticated" />

    <!-- Main app -->
    <MainLayout v-else />

    <!-- Toast notifications -->
    <ToastContainer />
  </div>
</template>

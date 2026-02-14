<script setup lang="ts">
import { ref, inject, watch } from 'vue';
import { X } from 'lucide-vue-next';
import { useSettings } from '@/composables/useSettings';
import { useTheme } from '@/composables/useTheme';
import { useAuth } from '@/composables/useAuth';
import { settingsApi } from '@/api/client';
import type { useToast } from '@/composables/useToast';

const open = defineModel<boolean>('open', { default: false });

const { preferences, setTheme, setAutoSaveEnabled, setAutoSaveDebounce, setExternalChangeWarning, setPaperSize, setVerticalSpacing, setFontScale, setPageWidthMode, setPrintFontScale, setPrintVerticalSpacing, setDebug } = useSettings();
const { availableThemes, currentTheme } = useTheme();
const { changePassword, version } = useAuth();
const toast = inject<ReturnType<typeof useToast>>('toast')!;

const activeTab = ref<'appearance' | 'editor' | 'print' | 'account' | 'storage'>('appearance');

// Password change
const currentPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const changingPassword = ref(false);

// Image cache
const cacheSize = ref(0);
const loadingCache = ref(false);
const clearingCache = ref(false);

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

async function loadCacheSize() {
  loadingCache.value = true;
  try {
    const info = await settingsApi.getImageCacheInfo();
    cacheSize.value = info.size;
  } catch {
    // ignore
  } finally {
    loadingCache.value = false;
  }
}

async function handleClearCache() {
  clearingCache.value = true;
  try {
    const result = await settingsApi.clearImageCache();
    cacheSize.value = 0;
    toast.success(`Cleared ${result.deletedFiles} cached image(s)`);
  } catch {
    toast.error('Failed to clear cache');
  } finally {
    clearingCache.value = false;
  }
}

watch(activeTab, (tab) => {
  if (tab === 'storage') loadCacheSize();
});

async function handleThemeChange(e: Event) {
  const theme = (e.target as HTMLSelectElement).value;
  await setTheme(theme);
}

async function handleAutoSaveToggle(e: Event) {
  const enabled = (e.target as HTMLInputElement).checked;
  await setAutoSaveEnabled(enabled);
}

async function handleAutoSaveDebounce(e: Event) {
  const value = parseInt((e.target as HTMLInputElement).value, 10);
  if (value >= 500 && value <= 10000) {
    await setAutoSaveDebounce(value);
  }
}

async function handleDebugToggle(e: Event) {
  const enabled = (e.target as HTMLInputElement).checked;
  await setDebug(enabled);
  if (enabled) {
    toast.info('Debug logging enabled - check browser console');
  }
}

async function handlePaperSizeChange(e: Event) {
  const size = (e.target as HTMLSelectElement).value;
  await setPaperSize(size);
}

async function handleVerticalSpacingChange(e: Event) {
  const spacing = (e.target as HTMLSelectElement).value as 'default' | 'compact' | 'comfortable';
  await setVerticalSpacing(spacing);
}

async function handleFontScaleChange(e: Event) {
  const scale = parseInt((e.target as HTMLSelectElement).value, 10);
  await setFontScale(scale);
}

async function handlePageWidthToggle(e: Event) {
  const enabled = (e.target as HTMLInputElement).checked;
  await setPageWidthMode(enabled);
}

async function handlePrintFontScaleChange(e: Event) {
  const scale = parseInt((e.target as HTMLSelectElement).value, 10);
  await setPrintFontScale(scale);
}

async function handlePrintVerticalSpacingChange(e: Event) {
  const spacing = (e.target as HTMLSelectElement).value as 'default' | 'compact' | 'comfortable';
  await setPrintVerticalSpacing(spacing);
}

async function handleExternalWarningToggle(e: Event) {
  const enabled = (e.target as HTMLInputElement).checked;
  await setExternalChangeWarning(enabled);
}

async function handleChangePassword() {
  if (!currentPassword.value || !newPassword.value || !confirmPassword.value) {
    toast.warning('Please fill in all fields');
    return;
  }

  if (newPassword.value !== confirmPassword.value) {
    toast.warning('New passwords do not match');
    return;
  }

  if (newPassword.value.length < 8) {
    toast.warning('New password must be at least 8 characters');
    return;
  }

  changingPassword.value = true;
  try {
    await changePassword(currentPassword.value, newPassword.value, confirmPassword.value);
    toast.success('Password changed successfully');
    currentPassword.value = '';
    newPassword.value = '';
    confirmPassword.value = '';
  } catch (error) {
    toast.error('Failed to change password');
  } finally {
    changingPassword.value = false;
  }
}

function close() {
  open.value = false;
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-backdrop" @click.self="close">
      <div class="modal-content">
        <!-- Header -->
        <div class="flex items-center justify-between p-4 border-b border-base-300">
          <h2 class="text-lg font-semibold">Settings</h2>
          <button class="btn btn-ghost btn-sm btn-square" @click="close">
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Tabs -->
        <div class="tabs tabs-bordered px-4">
          <button
            class="tab"
            :class="{ 'tab-active': activeTab === 'appearance' }"
            @click="activeTab = 'appearance'"
          >
            Appearance
          </button>
          <button
            class="tab"
            :class="{ 'tab-active': activeTab === 'editor' }"
            @click="activeTab = 'editor'"
          >
            Editor
          </button>
          <button
            class="tab"
            :class="{ 'tab-active': activeTab === 'print' }"
            @click="activeTab = 'print'"
          >
            Print
          </button>
          <button
            class="tab"
            :class="{ 'tab-active': activeTab === 'account' }"
            @click="activeTab = 'account'"
          >
            Account
          </button>
          <button
            class="tab"
            :class="{ 'tab-active': activeTab === 'storage' }"
            @click="activeTab = 'storage'"
          >
            Storage
          </button>
        </div>

        <!-- Content -->
        <div class="p-4 space-y-4">
          <!-- Appearance -->
          <div v-if="activeTab === 'appearance'" class="space-y-4">
            <div class="form-control">
              <label class="label">
                <span class="label-text">Theme</span>
              </label>
              <select
                class="select select-bordered w-full"
                :value="currentTheme"
                @change="handleThemeChange"
              >
                <option v-for="theme in availableThemes" :key="theme" :value="theme">
                  {{ theme }}
                </option>
              </select>
            </div>

            <div class="form-control">
              <label class="label">
                <span class="label-text">Font Size</span>
              </label>
              <select
                class="select select-bordered w-full"
                :value="preferences.fontScale"
                @change="handleFontScaleChange"
              >
                <option :value="50">50%</option>
                <option :value="75">75%</option>
                <option :value="100">100% (Default)</option>
                <option :value="150">150%</option>
                <option :value="200">200%</option>
              </select>
            </div>

            <div class="form-control">
              <label class="label">
                <span class="label-text">Vertical Spacing</span>
              </label>
              <select
                class="select select-bordered w-full"
                :value="preferences.verticalSpacing"
                @change="handleVerticalSpacingChange"
              >
                <option value="compact">Compact</option>
                <option value="default">Default</option>
                <option value="comfortable">Comfortable</option>
              </select>
            </div>

            <div class="form-control">
              <label class="label cursor-pointer">
                <span class="label-text">Line wrapping</span>
                <input
                  type="checkbox"
                  class="toggle toggle-primary"
                  :checked="preferences.pageWidthMode"
                  @change="handlePageWidthToggle"
                />
              </label>
              <label class="label">
                <span class="label-text-alt">Constrain editor width to match the selected paper size</span>
              </label>
            </div>
          </div>

          <!-- Editor -->
          <div v-if="activeTab === 'editor'" class="space-y-4">
            <div class="form-control">
              <label class="label cursor-pointer">
                <span class="label-text">Auto-save enabled</span>
                <input
                  type="checkbox"
                  class="toggle toggle-primary"
                  :checked="preferences.autoSave.enabled"
                  @change="handleAutoSaveToggle"
                />
              </label>
            </div>

            <div class="form-control">
              <label class="label">
                <span class="label-text">Auto-save delay (ms)</span>
              </label>
              <input
                type="number"
                class="input input-bordered w-full"
                :value="preferences.autoSave.debounceMs"
                min="500"
                max="10000"
                step="500"
                @change="handleAutoSaveDebounce"
              />
              <label class="label">
                <span class="label-text-alt">500-10000ms</span>
              </label>
            </div>

            <div class="form-control">
              <label class="label cursor-pointer">
                <span class="label-text">Warn on external file changes</span>
                <input
                  type="checkbox"
                  class="toggle toggle-primary"
                  :checked="preferences.externalChangeWarning"
                  @change="handleExternalWarningToggle"
                />
              </label>
            </div>

            <div class="divider"></div>

            <div class="form-control">
              <label class="label cursor-pointer">
                <span class="label-text">
                  Debug logging
                  <span class="text-xs text-base-content/60 ml-2">(Console output for troubleshooting)</span>
                </span>
                <input
                  type="checkbox"
                  class="toggle toggle-primary"
                  :checked="preferences.debug"
                  @change="handleDebugToggle"
                />
              </label>
            </div>
          </div>

          <!-- Print -->
          <div v-if="activeTab === 'print'" class="space-y-4">
            <div class="form-control">
              <label class="label">
                <span class="label-text">Paper Size</span>
              </label>
              <select
                class="select select-bordered w-full"
                :value="preferences.paperSize"
                @change="handlePaperSizeChange"
              >
                <option value="A4">A4</option>
                <option value="Letter">US Letter</option>
                <option value="Legal">US Legal</option>
                <option value="A3">A3</option>
                <option value="A5">A5</option>
              </select>
            </div>

            <div class="form-control">
              <label class="label">
                <span class="label-text">Font Size</span>
              </label>
              <select
                class="select select-bordered w-full"
                :value="preferences.printFontScale"
                @change="handlePrintFontScaleChange"
              >
                <option :value="50">50%</option>
                <option :value="75">75%</option>
                <option :value="100">100% (Default)</option>
                <option :value="150">150%</option>
                <option :value="200">200%</option>
              </select>
            </div>

            <div class="form-control">
              <label class="label">
                <span class="label-text">Vertical Spacing</span>
              </label>
              <select
                class="select select-bordered w-full"
                :value="preferences.printVerticalSpacing"
                @change="handlePrintVerticalSpacingChange"
              >
                <option value="compact">Compact</option>
                <option value="default">Default</option>
                <option value="comfortable">Comfortable</option>
              </select>
            </div>
          </div>

          <!-- Account -->
          <div v-if="activeTab === 'account'" class="space-y-4">
            <h3 class="font-medium">Change Password</h3>

            <div class="form-control">
              <label class="label">
                <span class="label-text">Current Password</span>
              </label>
              <input
                v-model="currentPassword"
                type="password"
                class="input input-bordered w-full"
                autocomplete="current-password"
              />
            </div>

            <div class="form-control">
              <label class="label">
                <span class="label-text">New Password</span>
              </label>
              <input
                v-model="newPassword"
                type="password"
                class="input input-bordered w-full"
                autocomplete="new-password"
              />
            </div>

            <div class="form-control">
              <label class="label">
                <span class="label-text">Confirm New Password</span>
              </label>
              <input
                v-model="confirmPassword"
                type="password"
                class="input input-bordered w-full"
                autocomplete="new-password"
              />
            </div>

            <button
              class="btn btn-primary"
              :disabled="changingPassword"
              @click="handleChangePassword"
            >
              <span v-if="changingPassword" class="loading loading-spinner loading-sm"></span>
              {{ changingPassword ? 'Changing...' : 'Change Password' }}
            </button>
          </div>

          <!-- Storage -->
          <div v-if="activeTab === 'storage'" class="space-y-4">
            <h3 class="font-medium">Image Cache</h3>
            <p class="text-sm opacity-70">
              Resized images are cached on the server to avoid re-processing.
            </p>

            <div class="flex items-center gap-4">
              <div class="stat-value text-lg">
                <span v-if="loadingCache" class="loading loading-spinner loading-sm"></span>
                <span v-else>{{ formatBytes(cacheSize) }}</span>
              </div>
              <button
                class="btn btn-warning btn-sm"
                :disabled="clearingCache || cacheSize === 0"
                @click="handleClearCache"
              >
                <span v-if="clearingCache" class="loading loading-spinner loading-sm"></span>
                {{ clearingCache ? 'Clearing...' : 'Clear Image Cache' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-between p-4 border-t border-base-300">
          <span v-if="version" class="text-xs opacity-50">v{{ version }}</span>
          <button class="btn" @click="close">Close</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

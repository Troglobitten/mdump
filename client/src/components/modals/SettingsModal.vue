<script setup lang="ts">
import { ref, inject } from 'vue';
import { X } from 'lucide-vue-next';
import { useSettings } from '@/composables/useSettings';
import { useTheme } from '@/composables/useTheme';
import { useAuth } from '@/composables/useAuth';
import type { useToast } from '@/composables/useToast';

const open = defineModel<boolean>('open', { default: false });

const { preferences, setTheme, setAutoSaveEnabled, setAutoSaveDebounce, setExternalChangeWarning } = useSettings();
const { availableThemes, currentTheme } = useTheme();
const { changePassword } = useAuth();
const toast = inject<ReturnType<typeof useToast>>('toast')!;

const activeTab = ref<'appearance' | 'editor' | 'security'>('appearance');

// Password change
const currentPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const changingPassword = ref(false);

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
            :class="{ 'tab-active': activeTab === 'security' }"
            @click="activeTab = 'security'"
          >
            Security
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
          </div>

          <!-- Security -->
          <div v-if="activeTab === 'security'" class="space-y-4">
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
        </div>

        <!-- Footer -->
        <div class="flex justify-end p-4 border-t border-base-300">
          <button class="btn" @click="close">Close</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

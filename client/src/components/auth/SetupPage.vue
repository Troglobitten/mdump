<script setup lang="ts">
import { ref, inject } from 'vue';
import { useAuth } from '@/composables/useAuth';
import type { useToast } from '@/composables/useToast';

const { setup, loading, error } = useAuth();
const toast = inject<ReturnType<typeof useToast>>('toast')!;

const username = ref('');
const password = ref('');
const confirmPassword = ref('');

async function handleSubmit() {
  if (!username.value || !password.value || !confirmPassword.value) {
    toast.warning('Please fill in all fields');
    return;
  }

  if (username.value.length < 3) {
    toast.warning('Username must be at least 3 characters');
    return;
  }

  if (password.value.length < 8) {
    toast.warning('Password must be at least 8 characters');
    return;
  }

  if (password.value !== confirmPassword.value) {
    toast.warning('Passwords do not match');
    return;
  }

  try {
    await setup({
      username: username.value,
      password: password.value,
      confirmPassword: confirmPassword.value,
    });
    toast.success('Setup complete! Welcome to mdump.');
  } catch (err) {
    // Error is already set in useAuth
  }
}
</script>

<template>
  <div class="min-h-full flex items-center justify-center bg-base-200 p-4">
    <div class="card bg-base-100 shadow-xl w-full max-w-md">
      <div class="card-body">
        <h1 class="card-title text-2xl justify-center mb-2">Welcome to mdump</h1>
        <p class="text-center text-base-content/60 mb-6">
          Create your account to get started
        </p>

        <form @submit.prevent="handleSubmit" class="space-y-4">
          <div class="form-control">
            <label class="label">
              <span class="label-text">Username</span>
            </label>
            <input
              v-model="username"
              type="text"
              placeholder="Choose a username"
              class="input input-bordered w-full"
              autocomplete="username"
              autofocus
            />
            <label class="label">
              <span class="label-text-alt">At least 3 characters</span>
            </label>
          </div>

          <div class="form-control">
            <label class="label">
              <span class="label-text">Password</span>
            </label>
            <input
              v-model="password"
              type="password"
              placeholder="Choose a password"
              class="input input-bordered w-full"
              autocomplete="new-password"
            />
            <label class="label">
              <span class="label-text-alt">At least 8 characters</span>
            </label>
          </div>

          <div class="form-control">
            <label class="label">
              <span class="label-text">Confirm Password</span>
            </label>
            <input
              v-model="confirmPassword"
              type="password"
              placeholder="Confirm your password"
              class="input input-bordered w-full"
              autocomplete="new-password"
            />
          </div>

          <div v-if="error" class="alert alert-error">
            <span>{{ error }}</span>
          </div>

          <button
            type="submit"
            class="btn btn-primary w-full"
            :disabled="loading"
          >
            <span v-if="loading" class="loading loading-spinner loading-sm"></span>
            {{ loading ? 'Creating account...' : 'Create Account' }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

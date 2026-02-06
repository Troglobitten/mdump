<script setup lang="ts">
import { ref, inject } from 'vue';
import { useAuth } from '@/composables/useAuth';
import type { useToast } from '@/composables/useToast';

const { login, loading, error } = useAuth();
const toast = inject<ReturnType<typeof useToast>>('toast')!;

const username = ref('');
const password = ref('');

async function handleSubmit() {
  if (!username.value || !password.value) {
    toast.warning('Please enter username and password');
    return;
  }

  try {
    await login({ username: username.value, password: password.value });
    toast.success('Welcome back!');
  } catch (err) {
    // Error is already set in useAuth
  }
}
</script>

<template>
  <div class="min-h-full flex items-center justify-center bg-base-200 p-4">
    <div class="card bg-base-100 shadow-xl w-full max-w-md">
      <div class="card-body">
        <h1 class="card-title text-2xl justify-center mb-2">mdump</h1>
        <p class="text-center text-base-content/60 mb-6">Sign in to your notes</p>

        <form @submit.prevent="handleSubmit" class="space-y-4">
          <div class="form-control">
            <label class="label">
              <span class="label-text">Username</span>
            </label>
            <input
              v-model="username"
              type="text"
              placeholder="Enter username"
              class="input input-bordered w-full"
              autocomplete="username"
              autofocus
            />
          </div>

          <div class="form-control">
            <label class="label">
              <span class="label-text">Password</span>
            </label>
            <input
              v-model="password"
              type="password"
              placeholder="Enter password"
              class="input input-bordered w-full"
              autocomplete="current-password"
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
            {{ loading ? 'Signing in...' : 'Sign In' }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

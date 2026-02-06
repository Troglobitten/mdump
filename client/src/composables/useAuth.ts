import { ref, computed, readonly } from 'vue';
import type { AuthStatus, LoginCredentials, SetupCredentials } from '@mdump/shared';
import { authApi } from '@/api/client';

const authStatus = ref<AuthStatus | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

export function useAuth() {
  const isAuthenticated = computed(() => authStatus.value?.authenticated ?? false);
  const isSetupComplete = computed(() => authStatus.value?.setupComplete ?? false);
  const needsSetup = computed(() => !authStatus.value?.setupComplete);

  async function checkStatus(): Promise<AuthStatus> {
    loading.value = true;
    error.value = null;

    try {
      const status = await authApi.getStatus();
      authStatus.value = status;
      return status;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to check auth status';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function setup(credentials: SetupCredentials): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      await authApi.setup(credentials);
      authStatus.value = {
        authenticated: true,
        setupComplete: true,
      };
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Setup failed';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function login(credentials: LoginCredentials): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      await authApi.login(credentials);
      authStatus.value = {
        ...authStatus.value!,
        authenticated: true,
      };
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Login failed';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function logout(): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      await authApi.logout();
      authStatus.value = {
        ...authStatus.value!,
        authenticated: false,
      };
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Logout failed';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function changePassword(
    currentPassword: string,
    newPassword: string,
    confirmPassword: string
  ): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      await authApi.changePassword(currentPassword, newPassword, confirmPassword);
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Password change failed';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  return {
    authStatus: readonly(authStatus),
    isAuthenticated,
    isSetupComplete,
    needsSetup,
    loading: readonly(loading),
    error: readonly(error),
    checkStatus,
    setup,
    login,
    logout,
    changePassword,
  };
}

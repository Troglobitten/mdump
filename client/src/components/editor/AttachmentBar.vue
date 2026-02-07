<script setup lang="ts">
import { ref, onMounted, inject } from 'vue';
import { Paperclip, X, Link, Upload } from 'lucide-vue-next';
import { uploadApi } from '@/api/client';
import type { AttachmentInfo } from '@mdump/shared';
import type { useToast } from '@/composables/useToast';

const props = defineProps<{
  filePath: string;
}>();

const toast = inject<ReturnType<typeof useToast>>('toast')!;
const confirm = inject<(title: string, message: string, onConfirm: () => void) => void>('confirm')!;

const attachments = ref<AttachmentInfo[]>([]);
const expanded = ref(false);
const uploading = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);

async function loadAttachments() {
  try {
    attachments.value = await uploadApi.listAttachments(props.filePath);
  } catch {
    // Silently fail — no attachments folder yet
    attachments.value = [];
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function handleUpload(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = input.files;
  if (!files || files.length === 0) return;

  uploading.value = true;
  try {
    for (const file of files) {
      await uploadApi.upload(props.filePath, file);
    }
    toast.success('File(s) uploaded');
    await loadAttachments();
  } catch {
    toast.error('Failed to upload file');
  } finally {
    uploading.value = false;
    input.value = '';
  }
}

function handleDelete(attachment: AttachmentInfo) {
  confirm(
    'Delete Attachment',
    `Are you sure you want to delete "${attachment.filename}"? This cannot be undone.`,
    async () => {
      try {
        const urlPath = attachment.url.replace('/api/files/', '');
        await uploadApi.deleteAttachment(decodeURIComponent(urlPath));
        toast.success('Attachment deleted');
        await loadAttachments();
      } catch {
        toast.error('Failed to delete attachment');
      }
    }
  );
}

async function handleCopyLink(attachment: AttachmentInfo) {
  const fullUrl = attachment.url;
  try {
    await navigator.clipboard.writeText(fullUrl);
    toast.success('Link copied');
  } catch {
    // Clipboard API unavailable (non-HTTPS) — use fallback
    const textarea = document.createElement('textarea');
    textarea.value = fullUrl;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    toast.success('Link copied');
  }
}

function handleDownload(attachment: AttachmentInfo) {
  window.open(attachment.url, '_blank');
}

function handleDrop(e: DragEvent) {
  e.preventDefault();
  const files = e.dataTransfer?.files;
  if (!files || files.length === 0) return;

  uploading.value = true;
  const uploadPromises = Array.from(files).map((file) =>
    uploadApi.upload(props.filePath, file)
  );
  Promise.all(uploadPromises)
    .then(() => {
      toast.success('File(s) uploaded');
      loadAttachments();
    })
    .catch(() => {
      toast.error('Failed to upload file');
    })
    .finally(() => {
      uploading.value = false;
    });
}

onMounted(loadAttachments);

defineExpose({ loadAttachments });
</script>

<template>
  <div
    class="border-b border-base-300 bg-base-200/30"
    @drop.prevent="handleDrop"
    @dragover.prevent
  >
    <!-- Toggle bar -->
    <button
      class="flex items-center gap-2 w-full px-4 py-1.5 text-xs text-base-content/60 hover:text-base-content transition-colors"
      @click="expanded = !expanded"
    >
      <Paperclip class="w-3 h-3" />
      <span>Attachments ({{ attachments.length }})</span>
      <span class="ml-auto text-[10px]">{{ expanded ? 'Hide' : 'Show' }}</span>
    </button>

    <!-- Expanded content -->
    <div v-if="expanded" class="px-4 pb-2">
      <!-- Attachment chips -->
      <div class="flex flex-wrap gap-1.5 mb-2" v-if="attachments.length > 0">
        <div
          v-for="att in attachments"
          :key="att.filename"
          class="flex items-center gap-1 px-2 py-1 rounded-md bg-base-200 text-xs group"
        >
          <span
            class="cursor-pointer hover:underline truncate max-w-32"
            :title="att.filename"
            @click="handleDownload(att)"
          >
            {{ att.filename }}
          </span>
          <span class="text-base-content/40">{{ formatSize(att.size) }}</span>
          <button
            class="p-0.5 rounded hover:bg-base-300 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Copy link"
            @click.stop="handleCopyLink(att)"
          >
            <Link class="w-3 h-3" />
          </button>
          <button
            class="p-0.5 rounded hover:bg-error/20 hover:text-error opacity-0 group-hover:opacity-100 transition-opacity"
            title="Delete"
            @click.stop="handleDelete(att)"
          >
            <X class="w-3 h-3" />
          </button>
        </div>
      </div>

      <div v-else class="text-xs text-base-content/40 mb-2">
        No attachments. Drop files here or click upload.
      </div>

      <!-- Upload button -->
      <button
        class="btn btn-ghost btn-xs gap-1"
        :disabled="uploading"
        @click="fileInputRef?.click()"
      >
        <Upload class="w-3 h-3" />
        {{ uploading ? 'Uploading...' : 'Upload file' }}
      </button>
      <input
        ref="fileInputRef"
        type="file"
        class="hidden"
        multiple
        @change="handleUpload"
      />
    </div>
  </div>
</template>

import { createServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import { readFileSync, accessSync, constants as fsConstants } from 'fs';
import app from './app.js';
import { PORT, NOTES_DIR, DATA_DIR, HTTPS_ENABLED, TLS_CERT, TLS_KEY } from './config/constants.js';
import { ensureNotesDir } from './services/fileService.js';
import { buildIndex } from './services/searchService.js';
import { initWatcher, closeWatcher } from './services/watcherService.js';
import { loadSettings } from './services/settingsService.js';

function createAppServer() {
  if (!HTTPS_ENABLED) {
    return { server: createServer(app), protocol: 'http' as const };
  }

  // Validate cert and key files are readable
  try {
    accessSync(TLS_CERT, fsConstants.R_OK);
  } catch {
    console.error(`TLS certificate not found or not readable at: ${TLS_CERT}`);
    console.warn('Falling back to HTTP');
    return { server: createServer(app), protocol: 'http' as const };
  }

  try {
    accessSync(TLS_KEY, fsConstants.R_OK);
  } catch {
    console.error(`TLS key not found or not readable at: ${TLS_KEY}`);
    console.warn('Falling back to HTTP');
    return { server: createServer(app), protocol: 'http' as const };
  }

  try {
    const cert = readFileSync(TLS_CERT);
    const key = readFileSync(TLS_KEY);
    return { server: createHttpsServer({ cert, key }, app), protocol: 'https' as const };
  } catch (err) {
    console.error('Failed to read TLS certificate/key:', err);
    console.warn('Falling back to HTTP');
    return { server: createServer(app), protocol: 'http' as const };
  }
}

async function main(): Promise<void> {
  console.log('Starting mdump server...');
  console.log(`Data directory: ${DATA_DIR}`);
  console.log(`Notes directory: ${NOTES_DIR}`);

  // Ensure notes directory exists
  await ensureNotesDir();

  // Load settings
  await loadSettings();

  // Build search index
  console.log('Building search index...');
  await buildIndex();

  // Create HTTP or HTTPS server
  const { server, protocol } = createAppServer();

  // Initialize file watcher and WebSocket
  initWatcher(server);

  // Start server
  server.listen(PORT, () => {
    console.log(`Server running on ${protocol}://localhost:${PORT}${protocol === 'https' ? ' (TLS enabled)' : ''}`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`\n${signal} received, shutting down gracefully...`);

    await closeWatcher();

    server.close((err) => {
      if (err) {
        console.error('Error closing server:', err);
        process.exit(1);
      }
      console.log('Server closed');
      process.exit(0);
    });

    // Force exit after timeout
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

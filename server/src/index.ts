import { createServer } from 'http';
import app from './app.js';
import { PORT, NOTES_DIR, DATA_DIR } from './config/constants.js';
import { ensureNotesDir } from './services/fileService.js';
import { buildIndex } from './services/searchService.js';
import { initWatcher, closeWatcher } from './services/watcherService.js';
import { loadSettings } from './services/settingsService.js';

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

  // Create HTTP server
  const server = createServer(app);

  // Initialize file watcher and WebSocket
  initWatcher(server);

  // Start server
  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
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

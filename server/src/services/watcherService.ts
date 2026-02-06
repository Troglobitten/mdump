import chokidar, { FSWatcher } from 'chokidar';
import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import type { FileChangeEvent, FileEventType } from '@mdump/shared';
import { NOTES_DIR, WS_PING_INTERVAL } from '../config/constants.js';
import { getRelativePath, isHiddenPath, isMarkdownFile } from '../utils/paths.js';
import { indexFile, removeFromIndex, saveIndex } from './searchService.js';

let watcher: FSWatcher | null = null;
let wss: WebSocketServer | null = null;
const clients: Set<WebSocket> = new Set();

/**
 * Initialize the file watcher and WebSocket server
 */
export function initWatcher(server: Server): void {
  // Initialize WebSocket server
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('WebSocket client connected');

    ws.on('close', () => {
      clients.delete(ws);
      console.log('WebSocket client disconnected');
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clients.delete(ws);
    });

    // Send ping to keep connection alive
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      } else {
        clearInterval(pingInterval);
      }
    }, WS_PING_INTERVAL);

    ws.on('close', () => clearInterval(pingInterval));
  });

  // Initialize file watcher
  watcher = chokidar.watch(NOTES_DIR, {
    ignored: [
      /node_modules/,
      /\.git/,
      /(^|[/\\])\../,  // Hidden files (but we handle .folder/ separately)
    ],
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 500,
      pollInterval: 100,
    },
  });

  watcher.on('add', (path) => handleFileEvent('created', path));
  watcher.on('change', (path) => handleFileEvent('modified', path));
  watcher.on('unlink', (path) => handleFileEvent('deleted', path));

  watcher.on('error', (error) => {
    console.error('Watcher error:', error);
  });

  console.log('File watcher initialized');
}

/**
 * Handle a file system event
 */
async function handleFileEvent(type: FileEventType, fullPath: string): Promise<void> {
  const relativePath = getRelativePath(fullPath);

  // Skip hidden paths and non-markdown files
  if (isHiddenPath(relativePath) || !isMarkdownFile(fullPath)) {
    return;
  }

  console.log(`File ${type}: ${relativePath}`);

  // Update search index
  try {
    if (type === 'deleted') {
      await removeFromIndex(relativePath);
    } else {
      await indexFile(relativePath);
    }
    // Save index periodically (debounced in production)
    await saveIndex();
  } catch (error) {
    console.error('Failed to update search index:', error);
  }

  // Broadcast to all connected clients
  broadcastEvent({
    type,
    path: relativePath,
  });
}

/**
 * Broadcast an event to all connected WebSocket clients
 */
export function broadcastEvent(event: FileChangeEvent): void {
  const message = JSON.stringify(event);

  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

/**
 * Close the watcher and WebSocket server
 */
export async function closeWatcher(): Promise<void> {
  if (watcher) {
    await watcher.close();
    watcher = null;
  }

  if (wss) {
    for (const client of clients) {
      client.close();
    }
    clients.clear();
    wss.close();
    wss = null;
  }

  console.log('File watcher closed');
}

/**
 * Get the number of connected clients
 */
export function getClientCount(): number {
  return clients.size;
}

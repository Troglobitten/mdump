import express, { type Express } from 'express';
import session from 'express-session';
import FileStore from 'session-file-store';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
import { resolve, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

import {
  SESSION_SECRET,
  SESSION_MAX_AGE,
  SESSIONS_DIR,
  CONFIG_DIR,
  IS_PRODUCTION,
  HTTPS_ENABLED,
} from './config/constants.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { checkSetup } from './middleware/auth.js';

import authRoutes from './routes/auth.js';
import fileRoutes from './routes/files.js';
import folderRoutes from './routes/folders.js';
import uploadRoutes from './routes/upload.js';
import searchRoutes from './routes/search.js';
import settingsRoutes from './routes/settings.js';

// Create Express app
const app: Express = express();

// Ensure required directories exist
if (!existsSync(CONFIG_DIR)) {
  mkdirSync(CONFIG_DIR, { recursive: true });
}
if (!existsSync(SESSIONS_DIR)) {
  mkdirSync(SESSIONS_DIR, { recursive: true });
}

// Session store
const FileStoreSession = FileStore(session);

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: IS_PRODUCTION
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'blob:'],
            connectSrc: ["'self'", 'ws:', 'wss:'],
          },
        }
      : false,
    hsts: HTTPS_ENABLED, // Only send HSTS header when TLS is active
  })
);

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Session middleware
app.use(
  session({
    store: new FileStoreSession({
      path: SESSIONS_DIR,
      ttl: SESSION_MAX_AGE / 1000,
      retries: 0,
    }),
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: HTTPS_ENABLED, // Only set secure cookies when TLS is active
      httpOnly: true,
      sameSite: 'strict',
      maxAge: SESSION_MAX_AGE,
    },
  })
);

// API routes
app.use('/api/auth', authRoutes);

// Apply setup check to protected routes
app.use('/api/files', checkSetup, fileRoutes);
app.use('/api/folders', checkSetup, folderRoutes);
app.use('/api/upload', checkSetup, uploadRoutes);
app.use('/api/search', checkSetup, searchRoutes);
app.use('/api/settings', checkSetup, settingsRoutes);

// Serve static files from client build in production
if (IS_PRODUCTION) {
  const clientDist = resolve(process.cwd(), '../client/dist');

  if (existsSync(clientDist)) {
    app.use(express.static(clientDist));

    // SPA fallback - serve index.html for all non-API routes
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        next();
        return;
      }
      res.sendFile(join(clientDist, 'index.html'));
    });
  }
}

// Error handling
app.use('/api/*', notFoundHandler);
app.use(errorHandler);

export default app;

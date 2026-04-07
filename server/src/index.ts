import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// Route imports
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import clientRoutes from './routes/clients.js';
import noteRoutes from './routes/notes.js';
import curriculumRoutes from './routes/curriculum.js';
import exportRoutes from './routes/export.js';
import adminRoutes from './routes/admin.js';
import slackRoutes from './routes/slack.js';
import { scheduleHeartbeat } from './slack/heartbeat.js';

// Middleware imports
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { generalLimiter } from './middleware/rateLimit.js';

// Initialize Prisma
export const prisma = new PrismaClient();

// Create Express app
const app = express();

// ===========================================
// GLOBAL MIDDLEWARE
// ===========================================

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(requestLogger);

// Global rate limiting (100 requests per minute)
app.use('/api', generalLimiter);

// ===========================================
// API ROUTES
// ===========================================

// Health check (includes database connectivity)
app.get('/api/health', async (req, res) => {
  try {
    // Check database connectivity
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      database: 'disconnected',
      timestamp: new Date().toISOString()
    });
  }
});

// Auth routes (no auth required)
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/users', userRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/clients', noteRoutes); // Notes are nested under clients
app.use('/api/curriculum', curriculumRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/admin', adminRoutes);

// Slack routes (uses Slack signature verification)
app.use('/api/slack', slackRoutes);

// ===========================================
// STATIC FRONTEND (production)
// ===========================================

const distPath = path.join(__dirname, '../../dist');
app.use(express.static(distPath));

// SPA fallback — serve index.html for any non-API route
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// ===========================================
// ERROR HANDLING
// ===========================================

app.use(errorHandler);

// API 404 handler
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ===========================================
// SERVER STARTUP
// ===========================================

const PORT = process.env.PORT || 3001;

async function seedIfEmpty() {
  const userCount = await prisma.user.count();
  if (userCount > 0) return;

  console.log('Empty database — seeding default users...');
  const hash = await bcrypt.hash('coach123', 12);
  const users = [
    { email: 'greg@mastermind.com', name: 'Greg Esman', role: 'ADMIN' },
    { email: 'shane@mastermind.com', name: 'Shane', role: 'COACH' },
    { email: 'jeff@mastermind.com', name: 'Jeff', role: 'COACH' },
  ];
  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { email: u.email, name: u.name, role: u.role, passwordHash: hash },
    });
  }

  // Seed curriculum steps
  const steps = [
    'Welcome & Vision Setting', 'Wallet Security Fundamentals', 'Exchange Setup & KYC',
    'Liquidity Strategy 101', 'First Deployment', 'Advanced Yield Farming',
    'Risk Management', 'Tax & Compliance', 'Scaling Operations', 'Mastermind Graduation',
  ];
  for (let i = 0; i < steps.length; i++) {
    await prisma.curriculumStep.upsert({
      where: { id: `step-${i + 1}` },
      update: {},
      create: { id: `step-${i + 1}`, title: steps[i], order: i },
    });
  }
  console.log('Seed complete.');
}

async function main() {
  try {
    // Connect to database
    await prisma.$connect();
    console.log('Database connected');

    // Seed if fresh database
    await seedIfEmpty();

    // Schedule daily heartbeat
    scheduleHeartbeat();

    // Start server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});

main();

export default app;

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { errorHandler } from '@/middleware/error-handler';
import { notFoundHandler } from '@/middleware/not-found-handler';
import { logger } from '@/lib/logger';
import authRoutes from '@/routes/auth';
import uploadRoutes from '@/routes/upload.routes';
import stripeRoutes from '@/routes/stripe.routes';
import userRoutes from '@/routes/user.routes';
import { initializeWorkers, closeWorkers } from '@/workers';

// Load environment variables
dotenv.config();



const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
);

// Logging middleware
app.use(
  morgan('combined', {
    stream: {
      write: (message: string) => logger.info(message.trim()),
    },
  })
);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Authentication routes
app.use('/', authRoutes);

// API routes
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/stripe', stripeRoutes);
app.use('/api/v1/user', userRoutes);

app.use('/api/v1', (req, res) => {
  res.status(200).json({ message: 'API v1 is running' });
});

// Error handling middleware
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const server = app.listen(PORT, async () => {
  logger.info(`🚀 Stagingfy Backend Server running on port ${PORT}`);
  logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(
    `🌐 API URL: ${process.env.API_URL || `http://localhost:${PORT}`}`
  );

  // Initialize workers
  try {
    await initializeWorkers();
    logger.info('✅ All workers initialized successfully');
  } catch (error) {
    logger.error('❌ Failed to initialize workers:', error as Error);
    process.exit(1);
  }
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`📴 Received ${signal}. Starting graceful shutdown...`);

  try {
    // Close workers first
    await closeWorkers();
    logger.info('✅ Workers closed successfully');

    // Close server
    server.close(() => {
      logger.info('✅ Server closed successfully');
      process.exit(0);
    });
  } catch (error) {
    logger.error('❌ Error during graceful shutdown:', error as Error);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;

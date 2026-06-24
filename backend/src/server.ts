import app from './app.js';
import { initDb, pool } from './db/postgres.js';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // 1. Initialize and verify database tables and indexes on startup
    await initDb();

    // 2. Start listening
    const server = app.listen(PORT, () => {
      console.log(`===================================================`);
      console.log(`🚀 Pagination Backend running on port ${PORT}`);
      console.log(`📂 Health check: http://localhost:${PORT}/health`);
      console.log(`📂 Products API: http://localhost:${PORT}/api/products`);
      console.log(`===================================================`);
    });

    // 3. Graceful shutdown handler
    const shutdown = async () => {
      console.log('Shutting down server gracefully...');
      server.close(async () => {
        console.log('Express server closed.');
        try {
          await pool.end();
          console.log('Database connection pool ended.');
          process.exit(0);
        } catch (err) {
          console.error('Error closing database pool:', err);
          process.exit(1);
        }
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    console.error('CRITICAL: Failed to start the server:', error);
    process.exit(1);
  }
}

startServer();

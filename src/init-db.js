import pg from 'pg';
import config from './config/index.js';
import logger from './logger.js';

const { Client } = pg;

const initDb = async () => {
  // Use a direct client for initialization to avoid race conditions with the pool
  const client = new Client({
    host: config.database.host,
    port: config.database.port,
    user: config.database.user,
    password: config.database.password,
    database: config.database.database,
  });

  try {
    await client.connect();
    logger.info('Connected to the database for initialization.');

    await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
    logger.info('pgvector extension created or already exists.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT,
        embedding vector(1536),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        file_path VARCHAR(1024)
      );
    `);
    logger.info('Table "documents" created or already exists.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS urls (
        id SERIAL PRIMARY KEY,
        url TEXT NOT NULL,
        title VARCHAR(255),
        description TEXT,
        content TEXT,
embedding vector(1536),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    logger.info('Table "urls" created or already exists.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        provider VARCHAR(50) NOT NULL,
        provider_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    logger.info('Table "users" created or already exists.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS api_usage_logs (
        id SERIAL PRIMARY KEY,
        model VARCHAR(255) NOT NULL,
        prompt_tokens INTEGER,
        completion_tokens INTEGER,
        total_tokens INTEGER,
        cost NUMERIC(10, 6),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    logger.info('Table "api_usage_logs" created or already exists.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS notebooks (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    logger.info('Table "notebooks" created or already exists.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS notebook_documents (
        notebook_id INTEGER REFERENCES notebooks(id) ON DELETE CASCADE,
        document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
        PRIMARY KEY (notebook_id, document_id)
      );
    `);
    logger.info('Table "notebook_documents" created or already exists.');

  } catch (err) {
    logger.error('Error during database initialization:', err);
    // Exit with an error code to signal failure, which can be useful for docker-compose health checks
    process.exit(1);
  } finally {
    await client.end();
    logger.info('Database initialization client disconnected.');
  }
};

initDb();

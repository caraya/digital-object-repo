import pg from 'pg';
import config from '../config/index.js';
import { registerType } from 'pgvector/pg';

const { Pool } = pg;

const pool = new Pool(config.database);

pool.on('connect', async (client) => {
  try {
    await registerType(client);
    console.log('Connected to the database and registered vector type.');
  } catch (err) {
    console.error('Error registering pgvector type:', err);
  }
});

export default pool;

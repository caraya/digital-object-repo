import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import config from '../src/config/index.js';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXPORT_DIR = path.join(__dirname, '../exports');

// Ensure export directory exists
if (!fs.existsSync(EXPORT_DIR)) {
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

const exportJson = async () => {
  console.log('Starting JSON export...');
  const client = new Client(config.database);
  
  try {
    await client.connect();
    
    // Get all tables in public schema
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    const tables = res.rows.map(row => row.table_name);
    
    for (const table of tables) {
      console.log(`Exporting table: ${table}`);
      const tableRes = await client.query(`SELECT * FROM "${table}"`);
      const filePath = path.join(EXPORT_DIR, `${table}_${timestamp}.json`);
      fs.writeFileSync(filePath, JSON.stringify(tableRes.rows, null, 2));
      console.log(`Saved ${table} to ${filePath}`);
    }
    
    console.log('JSON export completed.');
  } catch (err) {
    console.error('Error during JSON export:', err);
  } finally {
    await client.end();
  }
};

const exportPgDump = () => {
  console.log('Starting Postgres dump...');
  const { host, port, user, password, database } = config.database;
  const dumpFile = path.join(EXPORT_DIR, `full_dump_${timestamp}.sql`);
  
  // Construct pg_dump command
  // Note: pg_dump must be available in the system path
  const cmd = `pg_dump -h ${host} -p ${port} -U ${user} -d ${database} -f "${dumpFile}"`;
  
  const env = { ...process.env, PGPASSWORD: password };
  
  exec(cmd, { env }, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing pg_dump: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`pg_dump stderr: ${stderr}`);
    }
    console.log(`Postgres dump saved to ${dumpFile}`);
  });
};

const run = async () => {
  await exportJson();
  exportPgDump();
};

run();

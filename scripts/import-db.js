import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pgvector from 'pgvector/pg';
import config from '../src/config/index.js';

const { Client } = pg;

const importJson = async () => {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: node scripts/import-db.js <path-to-json-file> [table-name]');
    process.exit(1);
  }

  const filePath = args[0];
  // Try to guess table name from filename if not provided
  // Assumes format "tablename_timestamp.json" or just "tablename.json"
  let tableName = args[1];
  if (!tableName) {
    const basename = path.basename(filePath, '.json');
    // Split by underscore and take the first part, or the whole thing if no underscore
    // This is a heuristic and might need adjustment based on your naming convention
    const parts = basename.split('_');
    // If the file is like "documents_2023-10-10.json", we want "documents"
    // If it's just "documents.json", we want "documents"
    // If it's "api_usage_logs_...", we want "api_usage_logs". 
    // Let's assume the timestamp starts with a number (year) if present.
    
    // Better approach: check if the table exists in the DB.
    tableName = basename; // Default to full name
  }

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  console.log(`Reading data from ${filePath}...`);
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  let data;
  try {
    data = JSON.parse(fileContent);
  } catch (e) {
    console.error('Invalid JSON file.');
    process.exit(1);
  }

  if (!Array.isArray(data)) {
    console.error('JSON root must be an array of objects.');
    process.exit(1);
  }

  if (data.length === 0) {
    console.log('No data to import.');
    return;
  }

  const client = new Client(config.database);

  try {
    await client.connect();
    
    // 1. Validate Table Name (and fix the heuristic if needed)
    // We'll check if the table exists. If not, we might try stripping the timestamp.
    let tableExists = await checkTableExists(client, tableName);
    if (!tableExists) {
        // Try stripping the last part if it looks like a timestamp (contains numbers/dashes)
        const potentialName = tableName.replace(/_\d{4}-\d{2}-\d{2}.*$/, '');
        if (potentialName !== tableName) {
            if (await checkTableExists(client, potentialName)) {
                tableName = potentialName;
                tableExists = true;
            }
        }
    }

    if (!tableExists) {
        console.error(`Table "${tableName}" does not exist in the database.`);
        process.exit(1);
    }

    console.log(`Importing into table: ${tableName}`);

    // 2. Get Column Definitions to handle special types (like vector)
    const columnTypes = await getColumnTypes(client, tableName);

    // 3. Insert Data
    let successCount = 0;
    let errorCount = 0;

    for (const row of data) {
      const keys = Object.keys(row);
      const values = [];
      const placeholders = [];

      keys.forEach((key, index) => {
        let value = row[key];
        
        // Handle Vector Type
        if (columnTypes[key] === 'USER-DEFINED' && Array.isArray(value)) {
             // Assuming it's a vector if it's USER-DEFINED and an array
             // We can be more specific if we query the type name, but this is usually safe for pgvector
             value = pgvector.toSql(value);
        }

        values.push(value);
        placeholders.push(`$${index + 1}`);
      });

      const query = `
        INSERT INTO "${tableName}" (${keys.map(k => `"${k}"`).join(', ')})
        VALUES (${placeholders.join(', ')})
        ON CONFLICT (id) DO NOTHING
      `;
      // Note: ON CONFLICT (id) assumes 'id' is the primary key and it exists in the data.
      // If your tables don't have 'id' or use a different PK, this might fail or duplicate data.

      try {
        await client.query(query, values);
        successCount++;
      } catch (err) {
        // If error is about missing column "id" for on conflict, try without on conflict
        if (err.message.includes('column "id" does not exist')) {
             try {
                const simpleQuery = `
                    INSERT INTO "${tableName}" (${keys.map(k => `"${k}"`).join(', ')})
                    VALUES (${placeholders.join(', ')})
                `;
                await client.query(simpleQuery, values);
                successCount++;
             } catch (retryErr) {
                 console.error(`Failed to insert row: ${retryErr.message}`);
                 errorCount++;
             }
        } else {
            console.error(`Failed to insert row: ${err.message}`);
            errorCount++;
        }
      }
    }

    console.log(`Import completed. Success: ${successCount}, Errors/Skipped: ${errorCount}`);
    
    // 4. Reset Sequences (Optional but recommended)
    // If we inserted explicit IDs, the auto-increment sequence might be out of sync.
    if (columnTypes['id']) {
        try {
            await client.query(`SELECT setval(pg_get_serial_sequence('${tableName}', 'id'), max(id)) FROM "${tableName}";`);
            console.log('Updated primary key sequence.');
        } catch (seqErr) {
            // Ignore, table might not have a sequence for id
        }
    }

  } catch (err) {
    console.error('Database error:', err);
  } finally {
    await client.end();
  }
};

async function checkTableExists(client, tableName) {
    const res = await client.query(`
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
        );
    `, [tableName]);
    return res.rows[0].exists;
}

async function getColumnTypes(client, tableName) {
    const res = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = $1
    `, [tableName]);
    
    const types = {};
    res.rows.forEach(row => {
        types[row.column_name] = row.data_type;
    });
    return types;
}

importJson();

import { getEmbedding, getSummary, getTableOfContents, getKeyInsights, getReflectionQuestions } from '../services/openai.js';
import pool from '../db/index.js';
import logger from '../logger.js';
import pgvector from 'pgvector/pg';
import * as pdfjs from 'pdfjs-dist';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream';
import { promisify } from 'util';
import crypto from 'crypto';

const pump = promisify(pipeline);

// This is required for pdfjs-dist to work in a Node.js environment
pdfjs.GlobalWorkerOptions.workerSrc = 'pdfjs-dist/build/pdf.worker.mjs';

const MAX_DB_STORAGE_LENGTH = 25000;  // Max characters to store in the database
const MAX_EMBEDDING_LENGTH = 15000;   // Max characters to use for the embedding
const UPLOADS_DIR = './uploads';

async function routes(fastify, options) {
  fastify.post('/documents', async (request, reply) => {
    const data = await request.file();

    if (!data) {
      return reply.status(400).send({ error: 'File is required' });
    }

    const { filename, mimetype, file } = data;
    const title = filename;
    
    // Create a unique filename to prevent overwrites
    const uniqueFilename = `${crypto.randomBytes(16).toString('hex')}${path.extname(filename)}`;
    const filePath = path.join(UPLOADS_DIR, uniqueFilename);

    try {
      // Ensure the uploads directory exists
      await fs.promises.mkdir(UPLOADS_DIR, { recursive: true });

      // Save the file to the filesystem using streams for efficiency
      await pump(file, fs.createWriteStream(filePath));
      
      let fullContent = '';

      // Now that the file is saved, read it for content extraction
      if (mimetype === 'application/pdf') {
        const buffer = await fs.promises.readFile(filePath);
        const uint8array = new Uint8Array(buffer);
        const doc = await pdfjs.getDocument(uint8array).promise;
        let text = '';
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const content = await page.getTextContent();
          const strings = content.items.map(item => item.str);
          text += strings.join(' ') + '\n';
          if (text.length > MAX_DB_STORAGE_LENGTH) {
            break; 
          }
        }
        fullContent = text.substring(0, MAX_DB_STORAGE_LENGTH);
      
      } else {
        // For other file types, read the saved file
        const fileContent = await fs.promises.readFile(filePath, 'utf-8');
        fullContent = fileContent.substring(0, MAX_DB_STORAGE_LENGTH);
      }

      if (!fullContent) {
        logger.error('File processing resulted in empty content.');
        return reply.status(400).send({ error: 'Could not extract text from the document.' });
      }

      const truncatedForEmbedding = fullContent.substring(0, MAX_EMBEDDING_LENGTH);
      const embedding = await getEmbedding(truncatedForEmbedding);
      if (!embedding) {
        return reply.status(500).send({ error: 'Failed to generate embedding' });
      }

      const { rows } = await pool.query(
        'INSERT INTO documents (title, content, embedding, file_path) VALUES ($1, $2, $3, $4) RETURNING id, title, created_at',
        [title, fullContent, pgvector.toSql(embedding), filePath]
      );

      return reply.status(201).send(rows[0]);

    } catch (error) {
      if (error.code === 'FST_PARTS_LIMIT') {
         return reply.status(413).send({ error: 'File size exceeds the limit.' });
      }
      logger.error('Error processing document:', error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  fastify.post('/documents/search', async (request, reply) => {
    const { query } = request.body;

    if (!query) {
      return reply.status(400).send({ error: 'Query is required' });
    }

    try {
      const embedding = await getEmbedding(query);
      if (!embedding) {
        return reply.status(500).send({ error: 'Failed to generate embedding for query' });
      }

      const vector = pgvector.toSql(embedding);
      const { rows } = await pool.query(
        `SELECT id, title, created_at, (embedding <=> $1) AS distance 
         FROM documents 
         ORDER BY distance ASC 
         LIMIT 5`,
        [vector]
      );

      return reply.send(rows);

    } catch (error) {
      logger.error('Error searching documents:', error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  fastify.get('/documents', async (request, reply) => {
    try {
      const { rows } = await pool.query(
        `SELECT 
          id, 
          title, 
          created_at, 
          file_path
         FROM documents
         ORDER BY created_at DESC`
      );
      return reply.send(rows);
    } catch (error) {
      logger.error('Error fetching documents:', error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  fastify.get('/documents/:id/summary', async (request, reply) => {
    const { id } = request.params;

    try {
      const { rows } = await pool.query(
        'SELECT content FROM documents WHERE id = $1',
        [id]
      );

      if (rows.length === 0) {
        return reply.status(404).send({ error: 'Document not found' });
      }

      const content = rows[0].content;
      if (!content) {
        return reply.status(400).send({ error: 'Document has no content to summarize' });
      }

      const summary = await getSummary(content);
      if (!summary) {
        return reply.status(500).send({ error: 'Failed to generate summary' });
      }

      return reply.send({ id, summary });

    } catch (error) {
      logger.error('Error searching documents:', error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  fastify.post('/documents/:id/analyze', async (request, reply) => {
    const { id } = request.params;
    const { type } = request.body;

    if (!type) {
      return reply.status(400).send({ error: 'Analysis type is required' });
    }

    try {
      const { rows } = await pool.query(
        'SELECT content FROM documents WHERE id = $1',
        [id]
      );

      if (rows.length === 0) {
        return reply.status(404).send({ error: 'Document not found' });
      }

      const content = rows[0].content;
      if (!content) {
        return reply.status(400).send({ error: 'Document has no content to analyze' });
      }

      let result;
      switch (type) {
        case 'table_of_contents':
          result = await getTableOfContents(content);
          break;
        case 'key_insights':
          result = await getKeyInsights(content);
          break;
        case 'reflection_questions':
          result = await getReflectionQuestions(content);
          break;
        default:
          return reply.status(400).send({ error: 'Invalid analysis type' });
      }

      if (!result) {
        return reply.status(500).send({ error: `Failed to generate ${type}` });
      }

      return reply.send({ id, type, result });

    } catch (error) {
      logger.error(`Error analyzing document ${id} for ${type}:`, error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  fastify.get('/documents/:id/download', async (request, reply) => {
    const { id } = request.params;
    try {
      const { rows } = await pool.query(
        'SELECT file_path, title FROM documents WHERE id = $1',
        [id]
      );

      if (rows.length === 0 || !rows[0].file_path) {
        return reply.status(404).send({ error: 'File not found or no file path recorded.' });
      }

      const { file_path, title } = rows[0];
      const stream = fs.createReadStream(file_path);
      
      // Use the original filename for the download
      const originalFilename = path.basename(title); 

      return reply.header('Content-Disposition', `attachment; filename="${originalFilename}"`).send(stream);
    } catch (error) {
      logger.error(`Error downloading document ${id}:`, error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  fastify.get('/documents/:id', async (request, reply) => {
    const { id } = request.params;

    try {
      const { rows } = await pool.query(
        'SELECT id, title, content, created_at, file_path FROM documents WHERE id = $1',
        [id]
      );

      if (rows.length === 0) {
        return reply.status(404).send({ error: 'Document not found' });
      }

      return reply.send(rows[0]);

    } catch (error) {
      logger.error(`Error fetching document ${id}:`, error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  fastify.delete('/documents/:id', async (request, reply) => {
    const { id } = request.params;
    try {
      // First, get the file path to delete the associated file
      const { rows } = await pool.query(
        'SELECT file_path FROM documents WHERE id = $1',
        [id]
      );

      if (rows.length > 0 && rows[0].file_path) {
        const filePath = rows[0].file_path;
        // Check if it's a file path and not a URL before trying to delete
        if (!filePath.startsWith('http')) {
          try {
            await fs.promises.unlink(filePath);
            logger.info(`Deleted file: ${filePath}`);
          } catch (fileError) {
            // Log the error but proceed to delete the DB record
            logger.error(`Error deleting file ${filePath}, but proceeding with DB record deletion:`, fileError);
          }
        }
      }

      // Delete the document record from the database
      const deleteResult = await pool.query(
        'DELETE FROM documents WHERE id = $1',
        [id]
      );

      if (deleteResult.rowCount === 0) {
        return reply.status(404).send({ error: 'Document not found' });
      }

      return reply.status(204).send(); // No content
    } catch (error) {
      logger.error(`Error deleting document ${id}:`, error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });
}

export default routes;

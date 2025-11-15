import { getEmbedding } from '../services/openai.js';
import pool from '../db/index.js';
import logger from '../logger.js';
import pgvector from 'pgvector/pg';

const MAX_EMBEDDING_LENGTH = 15000; // Max characters to use for the embedding

async function routes(fastify, options) {
  fastify.post('/texts', async (request, reply) => {
    const { title, content } = request.body;

    if (!title || !content) {
      return reply.status(400).send({ error: 'Title and content are required' });
    }

    try {
      // Truncate content for embedding if necessary
      const truncatedForEmbedding = content.substring(0, MAX_EMBEDDING_LENGTH);
      const embedding = await getEmbedding(truncatedForEmbedding);

      if (!embedding) {
        return reply.status(500).send({ error: 'Failed to generate embedding' });
      }

      const { rows } = await pool.query(
        'INSERT INTO documents (title, content, embedding, mime_type) VALUES ($1, $2, $3, $4) RETURNING *',
        [title, content, pgvector.toSql(embedding), 'text/plain']
      );

      return reply.status(201).send(rows[0]);
    } catch (error) {
      logger.error('Error processing text block:', error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });
}

export default routes;

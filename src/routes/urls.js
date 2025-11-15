import { scrapeUrl } from '../services/scraper.js';
import { getEmbedding } from '../services/openai.js';
import pool from '../db/index.js';
import logger from '../logger.js';
import pgvector from 'pgvector/pg';

async function routes(fastify, options) {
  fastify.post('/urls', async (request, reply) => {
    const { url } = request.body;

    if (!url) {
      return reply.status(400).send({ error: 'URL is required' });
    }

    try {
      const scrapedData = await scrapeUrl(url);
      if (!scrapedData) {
        return reply.status(500).send({ error: 'Failed to scrape URL' });
      }

      const { title, content } = scrapedData;

      // Truncate content to avoid exceeding OpenAI's token limit
      const truncatedContent = content.substring(0, 15000);

      const embedding = await getEmbedding(truncatedContent);
      if (!embedding) {
        return reply.status(500).send({ error: 'Failed to generate embedding' });
      }

      const { rows } = await pool.query(
        'INSERT INTO documents (title, content, embedding, source_url, mime_type) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [title || url, truncatedContent, pgvector.toSql(embedding), url, 'text/html']
      );

      return reply.status(201).send(rows[0]);
    } catch (error) {
      logger.error('Error processing URL:', error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  fastify.post('/urls/search', async (request, reply) => {
    const { query, limit = 5 } = request.body;

    if (!query) {
      return reply.status(400).send({ error: 'Query is required' });
    }

    try {
      const queryEmbedding = await getEmbedding(query);
      if (!queryEmbedding) {
        return reply.status(500).send({ error: 'Failed to generate query embedding' });
      }

      const { rows } = await pool.query(
        'SELECT id, title, file_path as url, l2_distance(embedding, $1) as similarity FROM documents ORDER BY embedding <=> $1 LIMIT $2',
        [pgvector.toSql(queryEmbedding), limit]
      );

      return reply.send(rows);
    } catch (error) {
      logger.error('Error during vector search:', error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  fastify.get('/urls', async (request, reply) => {
    try {
      const { rows } = await pool.query(
        "SELECT id, file_path as url, title, created_at FROM documents WHERE file_path LIKE 'http%' ORDER BY created_at DESC"
      );
      return reply.send(rows);
    } catch (error) {
      logger.error('Error fetching urls:', error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });
}

export default routes;

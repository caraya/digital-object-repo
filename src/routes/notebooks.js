import pool from '../db/index.js';
import logger from '../logger.js';
import { getEmbedding, getAnswerFromContext } from '../services/openai.js';
import pgvector from 'pgvector/pg';

async function routes(fastify, options) {
  // --- Notebook CRUD ---

  // Create a new notebook
  fastify.post('/notebooks', async (request, reply) => {
    const { title, content = '' } = request.body;
    if (!title) {
      return reply.status(400).send({ error: 'Title is required' });
    }
    try {
      const { rows } = await pool.query(
        'INSERT INTO notebooks (title, content) VALUES ($1, $2) RETURNING *',
        [title, content]
      );
      return reply.status(201).send(rows[0]);
    } catch (error) {
      logger.error('Error creating notebook:', error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  // Get all notebooks
  fastify.get('/notebooks', async (request, reply) => {
    try {
      const { rows } = await pool.query('SELECT * FROM notebooks ORDER BY updated_at DESC');
      return reply.send(rows);
    } catch (error) {
      logger.error('Error fetching notebooks:', error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  // Get a single notebook with its documents
  fastify.get('/notebooks/:id', async (request, reply) => {
    const { id } = request.params;
    try {
      const notebookRes = await pool.query('SELECT * FROM notebooks WHERE id = $1', [id]);
      if (notebookRes.rows.length === 0) {
        return reply.status(404).send({ error: 'Notebook not found' });
      }
      const notebook = notebookRes.rows[0];

      const documentsRes = await pool.query(
        `SELECT d.* FROM documents d
         JOIN notebook_documents nd ON d.id = nd.document_id
         WHERE nd.notebook_id = $1
         ORDER BY d.created_at DESC`,
        [id]
      );
      notebook.documents = documentsRes.rows;

      return reply.send(notebook);
    } catch (error) {
      logger.error(`Error fetching notebook ${id}:`, error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  // Update a notebook's title or content
  fastify.put('/notebooks/:id', async (request, reply) => {
    const { id } = request.params;
    const { title, content } = request.body;

    if (!title && !content) {
      return reply.status(400).send({ error: 'Title or content is required for update' });
    }

    try {
      const { rows } = await pool.query(
        `UPDATE notebooks SET 
         title = COALESCE($1, title), 
         content = COALESCE($2, content),
         updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 RETURNING *`,
        [title, content, id]
      );
      if (rows.length === 0) {
        return reply.status(404).send({ error: 'Notebook not found' });
      }
      return reply.send(rows[0]);
    } catch (error) {
      logger.error(`Error updating notebook ${id}:`, error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  // Delete a notebook
  fastify.delete('/notebooks/:id', async (request, reply) => {
    const { id } = request.params;
    try {
      const { rowCount } = await pool.query('DELETE FROM notebooks WHERE id = $1', [id]);
      if (rowCount === 0) {
        return reply.status(404).send({ error: 'Notebook not found' });
      }
      return reply.status(204).send();
    } catch (error) {
      logger.error(`Error deleting notebook ${id}:`, error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  // --- Document Management in Notebooks ---

  // Add a document to a notebook
  fastify.post('/notebooks/:notebookId/documents', async (request, reply) => {
    const { notebookId } = request.params;
    const { documentId } = request.body;

    if (!documentId) {
      return reply.status(400).send({ error: 'Document ID is required' });
    }

    try {
      await pool.query(
        'INSERT INTO notebook_documents (notebook_id, document_id) VALUES ($1, $2)',
        [notebookId, documentId]
      );
      // Also touch the notebook to update its `updated_at` timestamp
      await pool.query('UPDATE notebooks SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [notebookId]);
      return reply.status(201).send({ message: 'Document added to notebook successfully' });
    } catch (error) {
      if (error.code === '23505') { // unique_violation
        return reply.status(409).send({ error: 'Document is already in this notebook' });
      }
      logger.error(`Error adding document ${documentId} to notebook ${notebookId}:`, error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  // Remove a document from a notebook
  fastify.delete('/notebooks/:notebookId/documents/:documentId', async (request, reply) => {
    const { notebookId, documentId } = request.params;
    try {
      const { rowCount } = await pool.query(
        'DELETE FROM notebook_documents WHERE notebook_id = $1 AND document_id = $2',
        [notebookId, documentId]
      );

      if (rowCount === 0) {
        return reply.status(404).send({ error: 'Document not found in this notebook' });
      }
      
      await pool.query('UPDATE notebooks SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [notebookId]);
      return reply.status(204).send();
    } catch (error) {
      logger.error(`Error removing document ${documentId} from notebook ${notebookId}:`, error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  // --- AI Q&A for Notebooks ---

  // Ask a question about the content of a notebook
  fastify.post('/notebooks/:id/query', async (request, reply) => {
    const { id } = request.params;
    const { question } = request.body;

    if (!question) {
      return reply.status(400).send({ error: 'Question is required' });
    }

    try {
      // 1. Generate embedding for the question
      const questionEmbedding = await getEmbedding(question);
      if (!questionEmbedding) {
        return reply.status(500).send({ error: 'Failed to generate embedding for the question.' });
      }

      // 2. Fetch the notebook's own notes
      const notebookRes = await pool.query('SELECT content FROM notebooks WHERE id = $1', [id]);
      if (notebookRes.rows.length === 0) {
        return reply.status(404).send({ error: 'Notebook not found' });
      }
      const notebookNotes = notebookRes.rows[0].content || '';

      // 3. Perform vector similarity search to find the most relevant documents
      // Use pgvector's cosine similarity operator <=> and get top 5 most similar documents
      const vectorQuery = pgvector.toSql(questionEmbedding);
      const documentsRes = await pool.query(
        `SELECT d.title, d.content, 1 - (d.embedding <=> $1) as similarity
         FROM documents d
         JOIN notebook_documents nd ON d.id = nd.document_id
         WHERE nd.notebook_id = $2 AND d.embedding IS NOT NULL
         ORDER BY d.embedding <=> $1
         LIMIT 5`,
        [vectorQuery, id]
      );

      // 4. Compile the context from notebook notes and relevant documents
      let context = `Notebook Notes:\n${notebookNotes}\n\n---\n\n`;
      documentsRes.rows.forEach(doc => {
        context += `Document: ${doc.title} (Similarity: ${(doc.similarity * 100).toFixed(1)}%)\nContent:\n${doc.content}\n\n---\n\n`;
      });

      // 5. Get the answer from the AI service using the filtered context
      const answer = await getAnswerFromContext(question, context);

      if (!answer) {
        return reply.status(500).send({ error: 'Failed to get an answer from the AI service.' });
      }

      return reply.send({ answer });
    } catch (error) {
      logger.error(`Error querying notebook ${id}:`, error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });
}

export default routes;

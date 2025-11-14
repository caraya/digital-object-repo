import pool from '../db/index.js';
import logger from '../logger.js';

async function routes(fastify, options) {
  fastify.get('/usage', async (request, reply) => {
    try {
      const { rows } = await pool.query(
        `SELECT 
          id, 
          model, 
          prompt_tokens, 
          completion_tokens, 
          total_tokens, 
          cost, 
          created_at 
        FROM api_usage_logs 
        ORDER BY created_at DESC`
      );

      const totals = await pool.query(
        `SELECT
          CAST(SUM(cost) AS FLOAT) as total_cost,
          SUM(total_tokens) as total_tokens
        FROM api_usage_logs`
      );

      return reply.send({
        logs: rows,
        totals: totals.rows[0]
      });
    } catch (error) {
      logger.error('Error fetching API usage logs:', error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });
}

export default routes;

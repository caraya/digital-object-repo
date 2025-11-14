import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import config from './config/index.js';
import logger from './logger.js';
import urlRoutes from './routes/urls.js';
import documentRoutes from './routes/documents.js';
import usageRoutes from './routes/usage.js';
import notebookRoutes from './routes/notebooks.js';

const fastify = Fastify({
  logger: true,
});

fastify.register(multipart, {
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
});
fastify.register(urlRoutes, { prefix: '/api' });
fastify.register(documentRoutes, { prefix: '/api' });
fastify.register(usageRoutes, { prefix: '/api' });
fastify.register(notebookRoutes, { prefix: '/api' });

fastify.get('/', async (request, reply) => {
  return { hello: 'world' };
});

const start = async () => {
  try {
    await fastify.listen({ port: config.server.port, host: config.server.host });
    logger.info(`Server listening on ${fastify.server.address().port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

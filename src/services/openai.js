import OpenAI from 'openai';
import config from '../config/index.js';
import logger from '../logger.js';
import pool from '../db/index.js';

const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

const EMBEDDING_MODEL = 'text-embedding-ada-002';
const COMPLETION_MODEL = 'gpt-4o-mini';

// Pricing per 1,000 tokens in USD
const PRICING = {
  [EMBEDDING_MODEL]: {
    input: 0.0001,
  },
  [COMPLETION_MODEL]: {
    input: 0.00015,
    output: 0.0006,
  },
};

/**
 * Logs API usage to the database.
 * @param {string} model The model used.
 * @param {object} usage The usage data from the OpenAI API response.
 */
const logApiUsage = async (model, usage) => {
  const { prompt_tokens = 0, completion_tokens = 0, total_tokens = 0 } = usage || {};
  
  let cost = 0;
  if (PRICING[model]) {
    const modelPricing = PRICING[model];
    const inputCost = (prompt_tokens / 1000) * (modelPricing.input || 0);
    const outputCost = (completion_tokens / 1000) * (modelPricing.output || 0);
    cost = inputCost + outputCost;
  }

  try {
    await pool.query(
      `INSERT INTO api_usage_logs (model, prompt_tokens, completion_tokens, total_tokens, cost)
       VALUES ($1, $2, $3, $4, $5)`,
      [model, prompt_tokens, completion_tokens, total_tokens, cost]
    );
  } catch (error) {
    logger.error('Error logging API usage:', error);
  }
};

/**
 * Generates an embedding for the given text using OpenAI's embedding model.
 * @param {string} text The text to generate an embedding for.
 * @returns {Promise<number[]|null>} The embedding vector, or null if an error occurs.
 */
export const getEmbedding = async (text) => {
  if (!text) {
    logger.warn('getEmbedding called with no text.');
    return null;
  }
  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text.replace(/\n/g, ' '),
    });

    if (response.usage) {
      await logApiUsage(EMBEDDING_MODEL, response.usage);
    }

    return response.data[0].embedding;
  } catch (error) {
    logger.error('Error getting embedding from OpenAI:', error);
    return null;
  }
};

/**
 * Generates a summary for the given text using OpenAI's chat model.
 * @param {string} text The text to summarize.
 * @returns {Promise<string|null>} The summary text, or null if an error occurs.
 */
export const getSummary = async (text) => {
  if (!text) {
    logger.warn('getSummary called with no text.');
    return null;
  }
  try {
    const response = await openai.chat.completions.create({
      model: COMPLETION_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that summarizes documents concisely.'
        },
        {
          role: 'user',
          content: `Please provide a concise summary of the following text:\n\n${text}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 250,
    });

    if (response.usage) {
      await logApiUsage(COMPLETION_MODEL, response.usage);
    }

    return response.choices[0]?.message?.content?.trim() || null;
  } catch (error) {
    logger.error('Error getting summary from OpenAI:', error);
    return null;
  }
};

/**
 * A generic function to generate insights from text using a specified prompt.
 * @param {string} text The text to analyze.
 * @param {string} systemPrompt The system prompt to guide the model's behavior.
 * @returns {Promise<string|null>} The generated insight, or null if an error occurs.
 */
const generateInsight = async (text, systemPrompt) => {
  if (!text) {
    logger.warn('generateInsight called with no text.');
    return null;
  }
  try {
    const response = await openai.chat.completions.create({
      model: COMPLETION_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      temperature: 0.5,
      max_tokens: 500,
    });

    if (response.usage) {
      await logApiUsage(COMPLETION_MODEL, response.usage);
    }

    return response.choices[0]?.message?.content?.trim() || null;
  } catch (error) {
    logger.error(`Error generating insight with prompt "${systemPrompt}":`, error);
    return null;
  }
};

export const getTableOfContents = (text) => generateInsight(
  text,
  'Generate a table of contents for the following document. List the main sections and subsections. If the document is short, create a brief outline.'
);

export const getKeyInsights = (text) => generateInsight(
  text,
  'Extract the key insights and main takeaways from the following text. Present them as a bulleted list.'
);

export const getReflectionQuestions = (text) => generateInsight(
  text,
  'Based on the following text, generate a list of 3-5 thought-provoking reflection questions that challenge the reader to think more deeply about the content.'
);

/**
 * Analyzes the given text and provides an analysis report.
 * @param {string} text The text to analyze.
 * @returns {Promise<string|null>} The analysis report, or null if an error occurs.
 */
export const getAnalysis = async (text) => {
  if (!text) {
    logger.warn('getAnalysis called with no text.');
    return null;
  }
  try {
    const response = await openai.chat.completions.create({
      model: COMPLETION_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that analyzes text and provides detailed reports on various aspects such as tone, sentiment, and key themes.'
        },
        {
          role: 'user',
          content: `Please analyze the following text and provide a detailed report:\n\n${text}`,
        },
      ],
      temperature: 0.4,
      max_tokens: 600,
    });

    if (response.usage) {
      await logApiUsage(COMPLETION_MODEL, response.usage);
    }

    return response.choices[0]?.message?.content?.trim() || null;
  } catch (error) {
    logger.error('Error getting analysis from OpenAI:', error);
    return null;
  }
};

/**
 * Answers a question based on a given context using OpenAI's chat model.
 * @param {string} question The user's question.
 * @param {string} context The context compiled from notebook notes and document contents.
 * @returns {Promise<string|null>} The answer text, or null if an error occurs.
 */
export const getAnswerFromContext = async (question, context) => {
  if (!question || !context) {
    logger.warn('getAnswerFromContext called with no question or context.');
    return null;
  }
  try {
    const response = await openai.chat.completions.create({
      model: COMPLETION_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that answers questions based on the provided context. Synthesize information from all parts of the context to provide a comprehensive answer. If the answer is not found in the context, say so.'
        },
        {
          role: 'user',
          content: `Based on the following context, please answer the question.\n\n---\n\nCONTEXT:\n${context}\n\n---\n\nQUESTION: ${question}`,
        },
      ],
      temperature: 0.2,
    });

    if (response.usage) {
      await logApiUsage(COMPLETION_MODEL, response.usage);
    }

    return response.choices[0].message.content;
  } catch (error) {
    logger.error('Error getting answer from OpenAI:', error);
    return null;
  }
};

export default openai;

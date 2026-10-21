import OpenAI from 'openai';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

let openaiClient = null;

export function getOpenAIClient() {
  if (openaiClient) return openaiClient;

  if (!env.OPENAI_API_KEY) {
    logger.warn('OPENAI_API_KEY is not set. Real AI requests will require an API key.');
    return null;
  }

  openaiClient = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    timeout: 30000, // 30 second timeout
    maxRetries: 2
  });

  return openaiClient;
}

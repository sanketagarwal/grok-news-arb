/**
 * Vercel AI Gateway Configuration
 * 
 * Provides unified access to multiple AI models through Vercel AI Gateway:
 * - xai/grok-3 (or grok-2) - For live search and news analysis
 * - openai/gpt-4o - For general reasoning and fair value estimation
 * - anthropic/claude-sonnet-4 - Alternative for complex reasoning
 * - google/gemini-2.5-flash - Fast inference for quick tasks
 */

import { createGateway } from '@ai-sdk/gateway';

// Create gateway instance with API key
export const gateway = createGateway({
  apiKey: process.env.AI_GATEWAY_API_KEY,
  baseURL: 'https://ai-gateway.vercel.sh/v1/ai',
});

// Model configurations for different tasks
export const MODELS = {
  // Primary model for agent reasoning
  primary: 'openai/gpt-4o',
  
  // Grok for live X/Twitter search (has enableSearch capability)
  grok: 'xai/grok-2',
  
  // Fast model for quick tasks
  fast: 'google/gemini-2.0-flash',
  
  // Alternative for complex reasoning
  reasoning: 'anthropic/claude-sonnet-4',
  
  // Embeddings
  embedding: 'openai/text-embedding-3-small',
} as const;

// Get model through gateway
export function getModel(modelId: keyof typeof MODELS | string) {
  const id = MODELS[modelId as keyof typeof MODELS] || modelId;
  return gateway(id);
}

// Export for direct use
export { gateway as aiGateway };

/**
 * Grok Live Search Tool
 * Uses Grok API with search_parameters.mode = "on" for real-time X/Twitter data
 */

import { tool } from 'ai';
import { z } from 'zod';

const GROK_API_KEY = process.env.GROK_API_KEY;
const GROK_BASE_URL = 'https://api.x.ai/v1';

export interface NewsItem {
  content: string;
  source: string;
  timestamp: string;
  url?: string;
  engagement: 'low' | 'medium' | 'high';
  magnitude: number; // 0-1 importance score
}

export interface HeadlineAnalysis {
  category: string;
  magnitude: number;
  direction: 'positive' | 'negative' | 'neutral';
  affectedAssets: string[];
  confidence: number;
  isBreaking: boolean;
  summary: string;
}

/**
 * Search for breaking news on X/Twitter via Grok Live Search
 */
export const searchBreakingNews = tool({
  description: `Search X/Twitter for breaking news about a topic using Grok's Live Search. 
    Returns recent posts with engagement levels and importance scores. 
    Use this to find real-time news about markets, economics, politics, crypto, etc.`,
  parameters: z.object({
    query: z.string().describe('Search query (e.g., "Fed interest rates", "Bitcoin ETF approval")'),
    category: z.enum(['federal_reserve', 'inflation', 'elections', 'crypto', 'geopolitics', 'earnings', 'general'])
      .optional()
      .describe('Category filter for the news'),
    maxResults: z.number().min(1).max(20).default(10).describe('Maximum number of results'),
    recencyHours: z.number().min(1).max(24).default(2).describe('How recent the news should be (hours)'),
  }),
  execute: async ({ query, category, maxResults, recencyHours }) => {
    if (!GROK_API_KEY) {
      throw new Error('GROK_API_KEY not configured');
    }

    const systemPrompt = `You are a news extraction agent with access to real-time X/Twitter data.
Find breaking news about the given topic. Focus on:
- Official announcements from verified accounts
- High-engagement posts (many likes/retweets)
- Posts from credible financial/news sources
- Breaking news from the last ${recencyHours} hours

For each item, extract: content, source, timestamp, url (if available), engagement level.
Return as JSON array.`;

    const response = await fetch(`${GROK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'grok-2-latest',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Find recent news about: ${query}${category ? ` (category: ${category})` : ''}. Return up to ${maxResults} items as JSON.` }
        ],
        search_parameters: {
          mode: 'on', // Enable Live Search
          return_citations: true,
          from_date: new Date(Date.now() - recencyHours * 60 * 60 * 1000).toISOString().split('T')[0],
        },
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Grok API error: ${error}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '[]';

    // Parse JSON from response
    try {
      const start = content.indexOf('[');
      const end = content.lastIndexOf(']') + 1;
      if (start !== -1 && end > start) {
        const items = JSON.parse(content.slice(start, end)) as NewsItem[];
        return {
          success: true,
          newsItems: items.map((item: any) => ({
            ...item,
            magnitude: calculateMagnitude(item),
          })),
          query,
          timestamp: new Date().toISOString(),
        };
      }
    } catch (e) {
      // If parsing fails, return the raw content
    }

    return {
      success: true,
      newsItems: [],
      rawContent: content,
      query,
      timestamp: new Date().toISOString(),
    };
  },
});

/**
 * Analyze a headline to understand its market impact
 */
export const analyzeHeadline = tool({
  description: `Analyze a news headline to understand its potential market impact.
    Returns category, magnitude (0-1), direction (positive/negative/neutral), 
    affected assets, and confidence level.`,
  parameters: z.object({
    headline: z.string().describe('The news headline to analyze'),
  }),
  execute: async ({ headline }) => {
    if (!GROK_API_KEY) {
      throw new Error('GROK_API_KEY not configured');
    }

    const systemPrompt = `You are a financial news analyst. Analyze the headline and return JSON with:
- category: federal_reserve | inflation | elections | crypto | geopolitics | earnings | other
- magnitude: 0.0-1.0 (how impactful is this news)
- direction: positive | negative | neutral (for markets)
- affectedAssets: array of affected markets/assets (e.g., ["S&P 500", "Treasury yields", "USD"])
- confidence: 0.0-1.0 (confidence in analysis)
- isBreaking: boolean (is this breaking news)
- summary: one-sentence summary
- predictionMarkets: array of prediction market topics this could affect (e.g., ["Fed rate decision", "Inflation above 3%"])

Return ONLY valid JSON.`;

    const response = await fetch(`${GROK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'grok-2-latest',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analyze: "${headline}"` }
        ],
        search_parameters: { mode: 'on' },
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      throw new Error(`Grok API error: ${await response.text()}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '{}';

    try {
      const start = content.indexOf('{');
      const end = content.lastIndexOf('}') + 1;
      if (start !== -1 && end > start) {
        const analysis = JSON.parse(content.slice(start, end)) as HeadlineAnalysis;
        return {
          success: true,
          analysis,
          headline,
        };
      }
    } catch (e) {
      // Return default if parsing fails
    }

    return {
      success: true,
      analysis: {
        category: 'other',
        magnitude: 0.5,
        direction: 'neutral' as const,
        affectedAssets: [],
        confidence: 0.3,
        isBreaking: false,
        summary: headline,
        predictionMarkets: [],
      },
      headline,
    };
  },
});

/**
 * Verify news authenticity against current X/Twitter posts
 */
export const verifyNews = tool({
  description: 'Verify a news headline against real-time X/Twitter posts to check accuracy and find updates.',
  parameters: z.object({
    headline: z.string().describe('The headline to verify'),
  }),
  execute: async ({ headline }) => {
    if (!GROK_API_KEY) {
      throw new Error('GROK_API_KEY not configured');
    }

    const response = await fetch(`${GROK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'grok-2-latest',
        messages: [
          { 
            role: 'system', 
            content: `Search X/Twitter to verify the headline. Return JSON with:
- verified: boolean
- confidence: 0-1
- sourcesFound: number of credible sources
- latestUpdate: any newer information
- contradictions: any contradicting info found` 
          },
          { role: 'user', content: `Verify: "${headline}"` }
        ],
        search_parameters: { mode: 'on', return_citations: true },
        temperature: 0.1,
      }),
    });

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '{}';

    try {
      const start = content.indexOf('{');
      const end = content.lastIndexOf('}') + 1;
      if (start !== -1 && end > start) {
        return { success: true, ...JSON.parse(content.slice(start, end)) };
      }
    } catch (e) {}

    return {
      success: false,
      verified: false,
      confidence: 0,
      sourcesFound: 0,
    };
  },
});

function calculateMagnitude(item: any): number {
  let score = 0.5;
  
  // Boost for engagement
  if (item.engagement === 'high') score += 0.2;
  else if (item.engagement === 'medium') score += 0.1;
  
  // Boost for official sources
  const source = (item.source || '').toLowerCase();
  if (['fed', 'sec', 'whitehouse', 'treasury', 'official'].some(s => source.includes(s))) {
    score += 0.2;
  }
  
  // Boost for breaking keywords
  const content = (item.content || '').toLowerCase();
  if (['breaking', 'just in', 'urgent', 'confirmed'].some(k => content.includes(k))) {
    score += 0.1;
  }
  
  return Math.min(score, 1.0);
}

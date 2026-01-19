/**
 * Replay Labs API Tool
 * Unified API for Polymarket + Kalshi with semantic search
 * 
 * Key endpoints:
 * - /api/markets/semantic-search - Vector similarity search across prediction markets
 * - /api/markets/search - Text search across all venues
 * - /api/markets/overlap - Find cross-venue market overlaps
 * - /api/markets/{venue}/{identifier} - Get market details with fresh prices
 */

import { tool } from 'ai';
import { z } from 'zod';

const REPLAY_LABS_API_KEY = process.env.REPLAY_LABS_API_KEY;
const REPLAY_LABS_BASE_URL = 'https://api.replaylab.io'; // Update with actual base URL

export interface ReplayLabsMarket {
  venue: 'POLYMARKET' | 'KALSHI';
  id: string;
  canonicalId: string;
  marketType: string;
  question?: string;
  outcomes?: string[];
  isOpen: boolean;
  isBinary?: boolean;
  metadata: Record<string, any>;
}

export interface SemanticSearchResult {
  market: ReplayLabsMarket;
  score: number;
}

export interface MarketPrice {
  venue: string;
  id: string;
  price?: number;
  bestBid?: number;
  bestAsk?: number;
  volume24h?: number;
  liquidity?: number;
}

/**
 * Semantic search for prediction markets using vector similarity
 * This is the KEY tool for matching news headlines to affected markets
 */
export const semanticSearchMarkets = tool({
  description: `Semantic search across Polymarket and Kalshi prediction markets using vector similarity.
    This is the primary tool for finding markets related to a news headline.
    Returns markets ranked by semantic relevance score (0-1).
    
    Example: "Fed cuts rates 25bps" → finds Fed rate decision markets, inflation markets, etc.`,
  parameters: z.object({
    query: z.string().describe('The news headline or search query to find related markets'),
    venue: z.enum(['POLYMARKET', 'KALSHI']).array().optional()
      .describe('Filter by venue(s). Leave empty to search both.'),
    limit: z.number().min(1).max(20).default(10).describe('Maximum results to return'),
    minScore: z.number().min(0).max(1).optional().describe('Minimum similarity score cutoff'),
    activeOnly: z.boolean().default(true).describe('Only return active/open markets'),
  }),
  execute: async ({ query, venue, limit, minScore, activeOnly }) => {
    if (!REPLAY_LABS_API_KEY) {
      console.warn('REPLAY_LABS_API_KEY not set, using mock data');
      return getMockSemanticResults(query, limit);
    }

    try {
      const params = new URLSearchParams({
        q: query,
        limit: limit.toString(),
        active: activeOnly.toString(),
      });
      
      if (venue && venue.length > 0) {
        venue.forEach(v => params.append('venue', v));
      }
      if (minScore !== undefined) {
        params.append('minScore', minScore.toString());
      }

      const response = await fetch(`${REPLAY_LABS_BASE_URL}/api/markets/semantic-search?${params}`, {
        headers: {
          'x-api-key': REPLAY_LABS_API_KEY,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Replay Labs API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        markets: data.markets as SemanticSearchResult[],
        total: data.total,
        hasMore: data.hasMore,
        query,
        source: 'replay-labs',
      };
    } catch (error) {
      console.error('Replay Labs semantic search error:', error);
      return getMockSemanticResults(query, limit);
    }
  },
});

/**
 * Get fresh prices for a specific market
 */
export const getMarketPrice = tool({
  description: 'Get real-time price data for a specific prediction market.',
  parameters: z.object({
    venue: z.enum(['POLYMARKET', 'KALSHI']).describe('Market venue'),
    identifier: z.string().describe('Venue-specific market ID'),
    freshnessMs: z.number().default(5000).describe('Max age of price data in ms'),
  }),
  execute: async ({ venue, identifier, freshnessMs }) => {
    if (!REPLAY_LABS_API_KEY) {
      return getMockPrice(venue, identifier);
    }

    try {
      const response = await fetch(
        `${REPLAY_LABS_BASE_URL}/api/markets/${venue}/${identifier}?freshness_ms=${freshnessMs}`,
        {
          headers: {
            'x-api-key': REPLAY_LABS_API_KEY,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Replay Labs API error: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        price: data,
        venue,
        identifier,
      };
    } catch (error) {
      console.error('Replay Labs price fetch error:', error);
      return getMockPrice(venue, identifier);
    }
  },
});

/**
 * Find overlapping markets across Polymarket and Kalshi
 * Useful for cross-venue arbitrage opportunities
 */
export const findMarketOverlaps = tool({
  description: `Find cross-venue overlap candidates between Polymarket and Kalshi.
    Given a market on one venue, find equivalent markets on the other venue.
    Useful for identifying arbitrage opportunities across platforms.`,
  parameters: z.object({
    venue: z.enum(['POLYMARKET', 'KALSHI']).describe('Source market venue'),
    venuePk: z.string().describe('Venue-specific market ID'),
    limit: z.number().min(1).max(20).default(5).describe('Maximum overlaps to return'),
  }),
  execute: async ({ venue, venuePk, limit }) => {
    if (!REPLAY_LABS_API_KEY) {
      return {
        success: true,
        overlaps: [],
        message: 'API key not configured',
      };
    }

    try {
      const params = new URLSearchParams({
        venue,
        venuePk,
        limit: limit.toString(),
      });

      const response = await fetch(
        `${REPLAY_LABS_BASE_URL}/api/markets/overlap?${params}`,
        {
          headers: {
            'x-api-key': REPLAY_LABS_API_KEY,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Replay Labs API error: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        overlaps: data.markets,
        sourceVenue: venue,
        sourceId: venuePk,
      };
    } catch (error) {
      console.error('Replay Labs overlap search error:', error);
      return {
        success: false,
        error: String(error),
        overlaps: [],
      };
    }
  },
});

/**
 * Search markets with text query (non-semantic)
 */
export const searchMarkets = tool({
  description: 'Text search for markets across all supported venues.',
  parameters: z.object({
    query: z.string().describe('Search query'),
    venue: z.enum(['POLYMARKET', 'KALSHI', 'HYPERLIQUID_PERP', 'COINBASE']).array().optional(),
    limit: z.number().min(1).max(50).default(10),
  }),
  execute: async ({ query, venue, limit }) => {
    if (!REPLAY_LABS_API_KEY) {
      return getMockSearchResults(query, limit);
    }

    try {
      const params = new URLSearchParams({
        q: query,
        limit: limit.toString(),
      });
      
      if (venue && venue.length > 0) {
        venue.forEach(v => params.append('venue', v));
      }

      const response = await fetch(
        `${REPLAY_LABS_BASE_URL}/api/markets/search?${params}`,
        {
          headers: {
            'x-api-key': REPLAY_LABS_API_KEY,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Replay Labs API error: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        markets: data.markets,
        total: data.total,
        query,
      };
    } catch (error) {
      console.error('Replay Labs search error:', error);
      return getMockSearchResults(query, limit);
    }
  },
});

/**
 * Get Polymarket price history
 */
export const getPolymarketHistory = tool({
  description: 'Get price history for a Polymarket prediction market.',
  parameters: z.object({
    identifier: z.string().describe('Polymarket condition ID'),
    interval: z.enum(['1m', '5m', '15m', '1h', '4h', '1d']).default('1h'),
    limit: z.number().min(1).max(1000).default(100),
  }),
  execute: async ({ identifier, interval, limit }) => {
    if (!REPLAY_LABS_API_KEY) {
      return { success: true, history: [], message: 'API key not configured' };
    }

    try {
      const params = new URLSearchParams({
        interval,
        limit: limit.toString(),
      });

      const response = await fetch(
        `${REPLAY_LABS_BASE_URL}/api/polymarket/${identifier}/history?${params}`,
        {
          headers: {
            'x-api-key': REPLAY_LABS_API_KEY,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Replay Labs API error: ${response.status}`);
      }

      const data = await response.json();
      return {
        success: true,
        history: data.candles || data.prices,
        identifier,
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
        history: [],
      };
    }
  },
});

// Mock data functions for development/fallback
function getMockSemanticResults(query: string, limit: number) {
  const queryLower = query.toLowerCase();
  
  const mockMarkets: SemanticSearchResult[] = [
    {
      market: {
        venue: 'KALSHI',
        id: 'FED-26JAN-T4.50',
        canonicalId: 'fed-rate-jan-2026',
        marketType: 'prediction_binary',
        question: 'Will the Fed cut rates in January 2026?',
        outcomes: ['Yes', 'No'],
        isOpen: true,
        isBinary: true,
        metadata: { category: 'Economics', volume: 450000, liquidity: 125000 },
      },
      score: 0.92,
    },
    {
      market: {
        venue: 'POLYMARKET',
        id: '0xfed-rate-decision-jan-2026',
        canonicalId: 'fed-rate-jan-2026',
        marketType: 'prediction_binary',
        question: 'Will Federal Reserve cut interest rates at January 2026 FOMC?',
        outcomes: ['Yes', 'No'],
        isOpen: true,
        isBinary: true,
        metadata: { category: 'Economics', volume: 1250000, liquidity: 340000 },
      },
      score: 0.91,
    },
    {
      market: {
        venue: 'KALSHI',
        id: 'INFLATION-26Q1-A3',
        canonicalId: 'cpi-inflation-q1-2026',
        marketType: 'prediction_binary',
        question: 'Will CPI inflation be above 3% in Q1 2026?',
        outcomes: ['Yes', 'No'],
        isOpen: true,
        isBinary: true,
        metadata: { category: 'Economics', volume: 280000, liquidity: 85000 },
      },
      score: 0.78,
    },
    {
      market: {
        venue: 'POLYMARKET',
        id: '0xrecession-2026-us',
        canonicalId: 'recession-2026',
        marketType: 'prediction_binary',
        question: 'Will the US enter a recession in 2026?',
        outcomes: ['Yes', 'No'],
        isOpen: true,
        isBinary: true,
        metadata: { category: 'Economics', volume: 1890000, liquidity: 450000 },
      },
      score: 0.72,
    },
    {
      market: {
        venue: 'KALSHI',
        id: 'FED-26MAR-T4.25',
        canonicalId: 'fed-rate-mar-2026',
        marketType: 'prediction_binary',
        question: 'Will Fed funds rate be at or below 4.25% by March 2026?',
        outcomes: ['Yes', 'No'],
        isOpen: true,
        isBinary: true,
        metadata: { category: 'Economics', volume: 320000, liquidity: 95000 },
      },
      score: 0.85,
    },
  ];

  // Filter by relevance to query
  const filtered = mockMarkets.filter(m => {
    const q = m.market.question?.toLowerCase() || '';
    return queryLower.split(' ').some(word => 
      word.length > 2 && q.includes(word)
    );
  });

  // If no matches, return top results
  const results = filtered.length > 0 ? filtered : mockMarkets;

  return {
    success: true,
    markets: results.slice(0, limit),
    total: results.length,
    hasMore: results.length > limit,
    query,
    source: 'mock-data',
  };
}

function getMockPrice(venue: string, identifier: string) {
  return {
    success: true,
    price: {
      venue,
      id: identifier,
      yesPrice: 0.68 + Math.random() * 0.1,
      noPrice: 0.32 - Math.random() * 0.1,
      bestBid: 0.67,
      bestAsk: 0.69,
      volume24h: 125000 + Math.random() * 50000,
      liquidity: 45000 + Math.random() * 20000,
      lastUpdate: new Date().toISOString(),
    },
    source: 'mock-data',
  };
}

function getMockSearchResults(query: string, limit: number) {
  return getMockSemanticResults(query, limit);
}

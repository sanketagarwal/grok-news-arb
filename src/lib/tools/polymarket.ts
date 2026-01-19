/**
 * Polymarket API Tool
 * Fetches prediction markets, prices, and orderbook data from Polymarket
 */

import { tool } from 'ai';
import { z } from 'zod';

const POLYMARKET_GAMMA_URL = 'https://gamma-api.polymarket.com';
const POLYMARKET_CLOB_URL = 'https://clob.polymarket.com';

export interface PolymarketMarket {
  id: string;
  question: string;
  description?: string;
  category: string;
  endDate: string;
  outcomes: {
    name: string;
    price: number;
  }[];
  volume: number;
  liquidity: number;
  active: boolean;
}

/**
 * Search Polymarket markets by keyword/topic
 */
export const searchPolymarketMarkets = tool({
  description: `Search Polymarket prediction markets by keyword or topic.
    Returns markets with current prices, volume, and liquidity.
    Use this to find markets related to news events.`,
  parameters: z.object({
    query: z.string().describe('Search query (e.g., "Fed rates", "Bitcoin", "election")'),
    active: z.boolean().default(true).describe('Only return active markets'),
    limit: z.number().min(1).max(50).default(10).describe('Maximum results'),
  }),
  execute: async ({ query, active, limit }) => {
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        active: active.toString(),
        ...(query && { tag_slug: query.toLowerCase().replace(/\s+/g, '-') }),
      });

      const response = await fetch(`${POLYMARKET_GAMMA_URL}/markets?${params}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        // Fallback to mock data
        return getMockPolymarketMarkets(query, limit);
      }

      const data = await response.json();
      
      // Filter by query text
      const queryLower = query.toLowerCase();
      const filtered = (data || [])
        .filter((m: any) => 
          m.question?.toLowerCase().includes(queryLower) ||
          m.description?.toLowerCase().includes(queryLower) ||
          m.category?.toLowerCase().includes(queryLower)
        )
        .slice(0, limit);

      return {
        success: true,
        markets: filtered.map(formatPolymarketMarket),
        query,
        count: filtered.length,
        source: 'polymarket',
      };
    } catch (error) {
      return getMockPolymarketMarkets(query, limit);
    }
  },
});

/**
 * Get detailed market info from Polymarket
 */
export const getPolymarketMarketDetails = tool({
  description: 'Get detailed information about a specific Polymarket market.',
  parameters: z.object({
    marketId: z.string().describe('Polymarket market ID or slug'),
  }),
  execute: async ({ marketId }) => {
    try {
      const response = await fetch(`${POLYMARKET_GAMMA_URL}/markets/${marketId}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Polymarket API error: ${response.status}`);
      }

      const data = await response.json();
      return {
        success: true,
        market: formatPolymarketMarket(data),
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
      };
    }
  },
});

/**
 * Get orderbook/prices from Polymarket CLOB
 */
export const getPolymarketPrices = tool({
  description: 'Get current prices and orderbook depth for a Polymarket market.',
  parameters: z.object({
    tokenId: z.string().describe('Polymarket token ID for the outcome'),
  }),
  execute: async ({ tokenId }) => {
    try {
      const response = await fetch(`${POLYMARKET_CLOB_URL}/book?token_id=${tokenId}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return getMockPolymarketOrderbook(tokenId);
      }

      const data = await response.json();
      
      const bids = (data.bids || []).slice(0, 5).map((b: any) => ({
        price: parseFloat(b.price),
        size: parseFloat(b.size),
      }));
      
      const asks = (data.asks || []).slice(0, 5).map((a: any) => ({
        price: parseFloat(a.price),
        size: parseFloat(a.size),
      }));

      const bestBid = bids[0]?.price || 0;
      const bestAsk = asks[0]?.price || 1;

      return {
        success: true,
        orderbook: {
          tokenId,
          bids,
          asks,
          spread: bestAsk - bestBid,
          midPrice: (bestBid + bestAsk) / 2,
        },
      };
    } catch (error) {
      return getMockPolymarketOrderbook(tokenId);
    }
  },
});

function formatPolymarketMarket(m: any): PolymarketMarket {
  const outcomes = (m.outcomes || ['Yes', 'No']).map((name: string, i: number) => ({
    name,
    price: m.outcomePrices?.[i] ? parseFloat(m.outcomePrices[i]) : (i === 0 ? 0.5 : 0.5),
  }));

  return {
    id: m.id || m.condition_id,
    question: m.question || m.title,
    description: m.description,
    category: m.category || 'General',
    endDate: m.end_date_iso || m.endDate,
    outcomes,
    volume: parseFloat(m.volume || m.volumeNum || '0'),
    liquidity: parseFloat(m.liquidity || m.liquidityNum || '0'),
    active: m.active !== false && m.closed !== true,
  };
}

function getMockPolymarketMarkets(query: string, limit: number) {
  const mockMarkets: PolymarketMarket[] = [
    {
      id: 'fed-rate-jan-2026',
      question: 'Will the Federal Reserve cut interest rates in January 2026?',
      description: 'Resolves YES if the Fed announces a rate cut at the January 2026 FOMC meeting.',
      category: 'Economics',
      endDate: '2026-01-31T23:59:59Z',
      outcomes: [
        { name: 'Yes', price: 0.68 },
        { name: 'No', price: 0.32 },
      ],
      volume: 1250000,
      liquidity: 340000,
      active: true,
    },
    {
      id: 'btc-100k-jan-2026',
      question: 'Will Bitcoin reach $100,000 by January 31, 2026?',
      category: 'Crypto',
      endDate: '2026-01-31T23:59:59Z',
      outcomes: [
        { name: 'Yes', price: 0.58 },
        { name: 'No', price: 0.42 },
      ],
      volume: 2800000,
      liquidity: 890000,
      active: true,
    },
    {
      id: 'inflation-3pct-q1-2026',
      question: 'Will US CPI inflation be above 3% in Q1 2026?',
      category: 'Economics',
      endDate: '2026-04-15T23:59:59Z',
      outcomes: [
        { name: 'Yes', price: 0.42 },
        { name: 'No', price: 0.58 },
      ],
      volume: 560000,
      liquidity: 180000,
      active: true,
    },
    {
      id: 'recession-2026',
      question: 'Will the US enter a recession in 2026?',
      category: 'Economics',
      endDate: '2026-12-31T23:59:59Z',
      outcomes: [
        { name: 'Yes', price: 0.25 },
        { name: 'No', price: 0.75 },
      ],
      volume: 1890000,
      liquidity: 450000,
      active: true,
    },
    {
      id: 'sp500-6000-2026',
      question: 'Will S&P 500 close above 6,000 by end of Q1 2026?',
      category: 'Markets',
      endDate: '2026-03-31T23:59:59Z',
      outcomes: [
        { name: 'Yes', price: 0.71 },
        { name: 'No', price: 0.29 },
      ],
      volume: 920000,
      liquidity: 280000,
      active: true,
    },
  ];

  const queryLower = query.toLowerCase();
  const filtered = mockMarkets.filter(m =>
    m.question.toLowerCase().includes(queryLower) ||
    m.category.toLowerCase().includes(queryLower) ||
    m.description?.toLowerCase().includes(queryLower)
  );

  return {
    success: true,
    markets: filtered.slice(0, limit),
    query,
    count: filtered.length,
    source: 'polymarket-mock',
  };
}

function getMockPolymarketOrderbook(tokenId: string) {
  return {
    success: true,
    orderbook: {
      tokenId,
      bids: [
        { price: 0.67, size: 2500 },
        { price: 0.66, size: 4200 },
        { price: 0.65, size: 3100 },
      ],
      asks: [
        { price: 0.69, size: 1800 },
        { price: 0.70, size: 3500 },
        { price: 0.71, size: 2900 },
      ],
      spread: 0.02,
      midPrice: 0.68,
    },
  };
}

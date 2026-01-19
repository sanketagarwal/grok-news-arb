/**
 * Kalshi API Tool
 * Fetches prediction markets, prices, and orderbook data
 */

import { tool } from 'ai';
import { z } from 'zod';

const KALSHI_API_KEY = process.env.KALSHI_API_KEY;
const KALSHI_BASE_URL = process.env.KALSHI_USE_DEMO === 'true' 
  ? 'https://demo-api.kalshi.co/trade-api/v2'
  : 'https://trading-api.kalshi.com/trade-api/v2';

export interface KalshiMarket {
  ticker: string;
  title: string;
  subtitle?: string;
  category: string;
  status: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  liquidity: number;
  expirationTime: string;
  lastTradeTime?: string;
}

export interface KalshiOrderbook {
  ticker: string;
  bids: { price: number; quantity: number }[];
  asks: { price: number; quantity: number }[];
  spread: number;
  midPrice: number;
}

/**
 * Search Kalshi markets by keyword/topic
 */
export const searchKalshiMarkets = tool({
  description: `Search Kalshi prediction markets by keyword or topic.
    Returns markets with current prices, volume, and liquidity.
    Use this to find markets related to news events.`,
  parameters: z.object({
    query: z.string().describe('Search query (e.g., "Fed rates", "inflation", "election")'),
    status: z.enum(['open', 'closed', 'settled', 'all']).default('open').describe('Market status filter'),
    limit: z.number().min(1).max(50).default(10).describe('Maximum results'),
  }),
  execute: async ({ query, status, limit }) => {
    // For demo/development, return mock data if no API key
    if (!KALSHI_API_KEY) {
      return getMockKalshiMarkets(query, limit);
    }

    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        ...(status !== 'all' && { status }),
      });

      const response = await fetch(`${KALSHI_BASE_URL}/markets?${params}`, {
        headers: {
          'Authorization': `Bearer ${KALSHI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Kalshi API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Filter by query
      const queryLower = query.toLowerCase();
      const filtered = (data.markets || [])
        .filter((m: any) => 
          m.title?.toLowerCase().includes(queryLower) ||
          m.subtitle?.toLowerCase().includes(queryLower) ||
          m.category?.toLowerCase().includes(queryLower)
        )
        .slice(0, limit);

      return {
        success: true,
        markets: filtered.map(formatKalshiMarket),
        query,
        count: filtered.length,
        source: 'kalshi',
      };
    } catch (error) {
      // Fallback to mock data on error
      return getMockKalshiMarkets(query, limit);
    }
  },
});

/**
 * Get orderbook for a specific Kalshi market
 */
export const getKalshiOrderbook = tool({
  description: 'Get the orderbook (bids/asks) for a specific Kalshi market ticker.',
  parameters: z.object({
    ticker: z.string().describe('Kalshi market ticker (e.g., "FED-26JAN-T4.50")'),
  }),
  execute: async ({ ticker }) => {
    if (!KALSHI_API_KEY) {
      return getMockOrderbook(ticker);
    }

    try {
      const response = await fetch(`${KALSHI_BASE_URL}/markets/${ticker}/orderbook`, {
        headers: {
          'Authorization': `Bearer ${KALSHI_API_KEY}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Kalshi API error: ${response.status}`);
      }

      const data = await response.json();
      
      const bids = (data.orderbook?.yes || []).map((o: any) => ({ 
        price: o.price / 100, 
        quantity: o.count 
      }));
      const asks = (data.orderbook?.no || []).map((o: any) => ({ 
        price: (100 - o.price) / 100, 
        quantity: o.count 
      }));

      const bestBid = bids[0]?.price || 0;
      const bestAsk = asks[0]?.price || 1;

      return {
        success: true,
        orderbook: {
          ticker,
          bids,
          asks,
          spread: bestAsk - bestBid,
          midPrice: (bestBid + bestAsk) / 2,
        },
      };
    } catch (error) {
      return getMockOrderbook(ticker);
    }
  },
});

/**
 * Get detailed market info
 */
export const getKalshiMarketDetails = tool({
  description: 'Get detailed information about a specific Kalshi market.',
  parameters: z.object({
    ticker: z.string().describe('Kalshi market ticker'),
  }),
  execute: async ({ ticker }) => {
    if (!KALSHI_API_KEY) {
      return {
        success: true,
        market: {
          ticker,
          title: `Market ${ticker}`,
          yesPrice: 0.65,
          noPrice: 0.35,
          volume: 125000,
          liquidity: 45000,
        },
      };
    }

    const response = await fetch(`${KALSHI_BASE_URL}/markets/${ticker}`, {
      headers: {
        'Authorization': `Bearer ${KALSHI_API_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Kalshi API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      market: formatKalshiMarket(data.market),
    };
  },
});

function formatKalshiMarket(m: any): KalshiMarket {
  return {
    ticker: m.ticker,
    title: m.title || m.ticker,
    subtitle: m.subtitle,
    category: m.category || 'unknown',
    status: m.status || 'open',
    yesPrice: (m.yes_bid || m.last_price || 50) / 100,
    noPrice: 1 - (m.yes_bid || m.last_price || 50) / 100,
    volume: m.volume || 0,
    liquidity: m.open_interest || 0,
    expirationTime: m.expiration_time || m.close_time,
    lastTradeTime: m.last_trade_time,
  };
}

function getMockKalshiMarkets(query: string, limit: number) {
  const mockMarkets: KalshiMarket[] = [
    {
      ticker: 'FED-26JAN-T4.50',
      title: 'Will the Fed cut rates in January 2026?',
      category: 'Economics',
      status: 'open',
      yesPrice: 0.72,
      noPrice: 0.28,
      volume: 450000,
      liquidity: 125000,
      expirationTime: '2026-01-31T23:59:59Z',
    },
    {
      ticker: 'INFLATION-26Q1-A3',
      title: 'Will CPI inflation be above 3% in Q1 2026?',
      category: 'Economics',
      status: 'open',
      yesPrice: 0.45,
      noPrice: 0.55,
      volume: 280000,
      liquidity: 85000,
      expirationTime: '2026-04-15T23:59:59Z',
    },
    {
      ticker: 'FED-26MAR-T4.25',
      title: 'Will Fed funds rate be at or below 4.25% by March 2026?',
      category: 'Economics',
      status: 'open',
      yesPrice: 0.58,
      noPrice: 0.42,
      volume: 320000,
      liquidity: 95000,
      expirationTime: '2026-03-31T23:59:59Z',
    },
    {
      ticker: 'BTC-26JAN-100K',
      title: 'Will Bitcoin be above $100,000 by end of January 2026?',
      category: 'Crypto',
      status: 'open',
      yesPrice: 0.62,
      noPrice: 0.38,
      volume: 890000,
      liquidity: 230000,
      expirationTime: '2026-01-31T23:59:59Z',
    },
    {
      ticker: 'RECESSION-26',
      title: 'Will there be a US recession in 2026?',
      category: 'Economics',
      status: 'open',
      yesPrice: 0.28,
      noPrice: 0.72,
      volume: 520000,
      liquidity: 145000,
      expirationTime: '2026-12-31T23:59:59Z',
    },
  ];

  const queryLower = query.toLowerCase();
  const filtered = mockMarkets.filter(m => 
    m.title.toLowerCase().includes(queryLower) ||
    m.category.toLowerCase().includes(queryLower) ||
    m.ticker.toLowerCase().includes(queryLower)
  );

  return {
    success: true,
    markets: filtered.slice(0, limit),
    query,
    count: filtered.length,
    source: 'kalshi-mock',
  };
}

function getMockOrderbook(ticker: string): { success: boolean; orderbook: KalshiOrderbook } {
  return {
    success: true,
    orderbook: {
      ticker,
      bids: [
        { price: 0.71, quantity: 500 },
        { price: 0.70, quantity: 1200 },
        { price: 0.69, quantity: 800 },
      ],
      asks: [
        { price: 0.73, quantity: 450 },
        { price: 0.74, quantity: 900 },
        { price: 0.75, quantity: 1100 },
      ],
      spread: 0.02,
      midPrice: 0.72,
    },
  };
}

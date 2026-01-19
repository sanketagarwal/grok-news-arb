/**
 * Live News Monitoring Service
 * 
 * Continuously polls for breaking news and finds affected prediction markets.
 * 
 * Flow:
 * 1. Poll Grok/AI for breaking news every N seconds
 * 2. Filter for high-impact news (breaking, official, etc.)
 * 3. Deduplicate (don't process same news twice)
 * 4. For each new headline → semantic search for affected markets
 * 5. Output results
 */

import { generateText } from 'ai';
import { gateway, MODELS } from '../ai-gateway';

// Configuration
const POLL_INTERVAL_MS = 30000; // 30 seconds
const NEWS_CATEGORIES = [
  'federal reserve',
  'interest rates',
  'inflation',
  'CPI',
  'Fed',
  'FOMC',
  'Bitcoin',
  'crypto',
  'ETF',
  'SEC',
  'election',
  'Trump',
  'tariffs',
  'recession',
  'GDP',
  'jobs report',
  'unemployment',
];

const HIGH_IMPACT_KEYWORDS = [
  'breaking',
  'just in',
  'urgent',
  'official',
  'confirms',
  'announces',
  'approved',
  'rejected',
  'passes',
  'fails',
  'wins',
  'loses',
  'crashes',
  'surges',
  'plunges',
  'record',
  'emergency',
  'shock',
];

// Store seen headlines to avoid duplicates
const seenHeadlines = new Set<string>();

export interface NewsItem {
  headline: string;
  source: string;
  timestamp: Date;
  category: string;
  magnitude: 'HIGH' | 'MEDIUM' | 'LOW';
  url?: string;
}

export interface AffectedMarket {
  venue: 'KALSHI' | 'POLYMARKET';
  id: string;
  question: string;
  similarityScore: number;
  currentPrice?: number;
  // Fair value fields (calculated when available)
  fairValue?: number;
  edge?: number;
  edgePercent?: number;
  signal?: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  side?: 'YES' | 'NO';
  entryPrice?: number;
  targetPrice?: number;
  stopLoss?: number;
  suggestedSize?: number;
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface NewsWithMarkets {
  news: NewsItem;
  affectedMarkets: AffectedMarket[];
  analysisTime: number;
}

export type NewsCallback = (result: NewsWithMarkets) => void;
export type StatusCallback = (status: string) => void;

/**
 * Fetch breaking news from Grok/AI Gateway
 */
async function fetchBreakingNews(categories: string[]): Promise<NewsItem[]> {
  const categoryList = categories.slice(0, 5).join(', ');
  
  const prompt = `You are monitoring X/Twitter for BREAKING financial news in the last 5 minutes.

Categories to watch: ${categoryList}

Search for posts that are:
- Breaking news (contains "breaking", "just in", "urgent", etc.)
- From official/verified sources
- High engagement (many likes/retweets)
- About major market-moving events

Return a JSON array of news items found. Each item should have:
- headline: the main news content (1-2 sentences)
- source: the account/source name
- category: which category it falls under
- magnitude: "HIGH", "MEDIUM", or "LOW" based on market impact

If no breaking news found, return an empty array: []

Return ONLY valid JSON array, no other text.`;

  try {
    const result = await generateText({
      model: gateway(MODELS.grok), // Use Grok for live search capability
      prompt,
      temperature: 0.1,
    });

    const content = result.text || '[]';
    
    // Parse JSON from response
    const start = content.indexOf('[');
    const end = content.lastIndexOf(']') + 1;
    
    if (start !== -1 && end > start) {
      const items = JSON.parse(content.slice(start, end));
      return items.map((item: any) => ({
        headline: item.headline || '',
        source: item.source || 'unknown',
        timestamp: new Date(),
        category: item.category || 'general',
        magnitude: item.magnitude || 'MEDIUM',
        url: item.url,
      }));
    }
  } catch (error) {
    console.error('Error fetching news:', error);
  }
  
  return [];
}

/**
 * Semantic search for affected markets using Replay Labs
 */
async function findAffectedMarkets(headline: string): Promise<AffectedMarket[]> {
  const REPLAY_LABS_API_KEY = process.env.REPLAY_LABS_API_KEY;
  const REPLAY_LABS_BASE_URL = process.env.REPLAY_LABS_BASE_URL || 'https://api.replaylab.io';
  
  if (!REPLAY_LABS_API_KEY) {
    console.warn('REPLAY_LABS_API_KEY not set, using mock data');
    return getMockAffectedMarkets(headline);
  }

  try {
    const params = new URLSearchParams({
      q: headline,
      limit: '10',
      active: 'true',
    });

    const response = await fetch(`${REPLAY_LABS_BASE_URL}/api/markets/semantic-search?${params}`, {
      headers: {
        'x-api-key': REPLAY_LABS_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`Replay Labs API error: ${response.status}, using mock data`);
      return getMockAffectedMarkets(headline);
    }

    const data = await response.json();
    
    return (data.markets || []).map((item: any) => ({
      venue: item.market?.venue || 'UNKNOWN',
      id: item.market?.id || '',
      question: item.market?.question || item.market?.symbol || '',
      similarityScore: item.score || 0,
      currentPrice: item.market?.metadata?.yesPrice,
    }));
  } catch (error) {
    console.error('Error searching markets:', error);
    return getMockAffectedMarkets(headline);
  }
}

/**
 * Mock data for testing without API
 */
function getMockAffectedMarkets(headline: string): AffectedMarket[] {
  const headlineLower = headline.toLowerCase();
  
  const allMarkets: AffectedMarket[] = [
    // Fed-related (with mock current prices)
    { venue: 'KALSHI', id: 'FED-26JAN-T4.50', question: 'Will the Fed cut rates in January 2026?', similarityScore: 0.92, currentPrice: 0.65 },
    { venue: 'POLYMARKET', id: 'fed-rate-jan-2026', question: 'Will Federal Reserve cut interest rates at January 2026 FOMC?', similarityScore: 0.91, currentPrice: 0.62 },
    { venue: 'KALSHI', id: 'FED-26MAR-T4.25', question: 'Will Fed funds rate be at or below 4.25% by March 2026?', similarityScore: 0.85, currentPrice: 0.71 },
    { venue: 'POLYMARKET', id: 'recession-2026', question: 'Will the US enter a recession in 2026?', similarityScore: 0.72, currentPrice: 0.28 },
    { venue: 'KALSHI', id: 'INFLATION-26Q1-A3', question: 'Will CPI inflation be above 3% in Q1 2026?', similarityScore: 0.78, currentPrice: 0.45 },
    
    // Crypto-related (with mock current prices)
    { venue: 'POLYMARKET', id: 'btc-100k-jan-2026', question: 'Will Bitcoin reach $100,000 by January 31, 2026?', similarityScore: 0.94, currentPrice: 0.72 },
    { venue: 'KALSHI', id: 'BTC-26JAN-100K', question: 'Will Bitcoin be above $100,000 by end of January 2026?', similarityScore: 0.93, currentPrice: 0.70 },
    { venue: 'POLYMARKET', id: 'eth-5000-2026', question: 'Will Ethereum reach $5,000 in 2026?', similarityScore: 0.75, currentPrice: 0.35 },
    
    // Politics (with mock current prices)
    { venue: 'POLYMARKET', id: 'trump-2024', question: 'Will Trump win the 2024 presidential election?', similarityScore: 0.88, currentPrice: 0.52 },
    { venue: 'KALSHI', id: 'PRES-2024-REP', question: 'Will a Republican win the 2024 presidential election?', similarityScore: 0.85, currentPrice: 0.54 },
  ];
  
  // Filter based on headline content
  let filtered: AffectedMarket[] = [];
  
  if (headlineLower.includes('fed') || headlineLower.includes('rate') || headlineLower.includes('fomc') || headlineLower.includes('interest')) {
    filtered = allMarkets.filter(m => 
      m.question.toLowerCase().includes('fed') || 
      m.question.toLowerCase().includes('rate') ||
      m.question.toLowerCase().includes('recession') ||
      m.question.toLowerCase().includes('inflation')
    );
  } else if (headlineLower.includes('bitcoin') || headlineLower.includes('btc') || headlineLower.includes('crypto') || headlineLower.includes('etf')) {
    filtered = allMarkets.filter(m => 
      m.question.toLowerCase().includes('bitcoin') || 
      m.question.toLowerCase().includes('crypto') ||
      m.question.toLowerCase().includes('ethereum') ||
      m.question.toLowerCase().includes('btc')
    );
  } else if (headlineLower.includes('trump') || headlineLower.includes('election') || headlineLower.includes('president')) {
    filtered = allMarkets.filter(m => 
      m.question.toLowerCase().includes('trump') || 
      m.question.toLowerCase().includes('election') ||
      m.question.toLowerCase().includes('republican')
    );
  } else if (headlineLower.includes('inflation') || headlineLower.includes('cpi')) {
    filtered = allMarkets.filter(m => 
      m.question.toLowerCase().includes('inflation') || 
      m.question.toLowerCase().includes('cpi') ||
      m.question.toLowerCase().includes('fed')
    );
  }
  
  // If no specific matches, return top general markets
  if (filtered.length === 0) {
    filtered = allMarkets.slice(0, 5);
  }
  
  // Add some randomness to scores for realism
  return filtered.slice(0, 5).map(m => ({
    ...m,
    similarityScore: Math.round((m.similarityScore + (Math.random() * 0.1 - 0.05)) * 100) / 100,
  })).sort((a, b) => b.similarityScore - a.similarityScore);
}

/**
 * Check if headline is new (not seen before)
 */
function isNewHeadline(headline: string): boolean {
  // Normalize headline for comparison
  const normalized = headline.toLowerCase().trim().replace(/[^\w\s]/g, '');
  
  if (seenHeadlines.has(normalized)) {
    return false;
  }
  
  // Also check for similar headlines (fuzzy match)
  for (const seen of seenHeadlines) {
    if (similarity(normalized, seen) > 0.8) {
      return false;
    }
  }
  
  seenHeadlines.add(normalized);
  
  // Keep set size manageable (last 1000 headlines)
  if (seenHeadlines.size > 1000) {
    const first = seenHeadlines.values().next().value;
    seenHeadlines.delete(first);
  }
  
  return true;
}

/**
 * Simple string similarity (Jaccard)
 */
function similarity(a: string, b: string): number {
  const setA = new Set(a.split(' '));
  const setB = new Set(b.split(' '));
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

/**
 * Analyze headline for category and magnitude
 */
async function analyzeHeadline(headline: string): Promise<{ category: string; magnitude: 'HIGH' | 'MEDIUM' | 'LOW'; direction: string; confidence: number }> {
  // Quick heuristic-based analysis (faster than LLM call)
  const headlineLower = headline.toLowerCase();
  
  let category = 'general';
  let magnitude: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
  let direction = 'neutral';
  let confidence = 0.6; // Base confidence
  
  // Detect category
  if (headlineLower.match(/fed|fomc|rate|interest|powell/)) {
    category = 'federal_reserve';
    confidence += 0.1;
  } else if (headlineLower.match(/bitcoin|btc|crypto|ethereum|eth|etf/)) {
    category = 'crypto';
    confidence += 0.1;
  } else if (headlineLower.match(/trump|biden|election|president|congress/)) {
    category = 'politics';
    confidence += 0.1;
  } else if (headlineLower.match(/inflation|cpi|pce|prices/)) {
    category = 'inflation';
    confidence += 0.1;
  } else if (headlineLower.match(/recession|gdp|economy|jobs|unemployment/)) {
    category = 'economy';
    confidence += 0.1;
  }
  
  // Detect magnitude
  if (headlineLower.match(/breaking|urgent|shock|crash|surge|plunge|record|emergency/)) {
    magnitude = 'HIGH';
    confidence += 0.15;
  } else if (headlineLower.match(/announces|confirms|official|approved|passes/)) {
    magnitude = 'HIGH';
    confidence += 0.15;
  } else if (headlineLower.match(/reports|expects|likely|may|could/)) {
    magnitude = 'LOW';
    confidence -= 0.1;
  }
  
  // Detect direction
  if (headlineLower.match(/cut|lower|drop|fall|crash|plunge|down|bear|sell/)) {
    direction = 'negative';
    confidence += 0.05;
  } else if (headlineLower.match(/raise|hike|surge|jump|up|bull|buy|approve|pass/)) {
    direction = 'positive';
    confidence += 0.05;
  }
  
  // Clamp confidence to valid range
  confidence = Math.max(0.3, Math.min(0.95, confidence));
  
  return { category, magnitude, direction, confidence };
}

/**
 * Main monitoring loop
 */
export async function startMonitoring(
  onNews: NewsCallback,
  onStatus: StatusCallback,
  options: {
    pollIntervalMs?: number;
    categories?: string[];
    maxMarketsPerNews?: number;
  } = {}
): Promise<() => void> {
  const {
    pollIntervalMs = POLL_INTERVAL_MS,
    categories = NEWS_CATEGORIES,
    maxMarketsPerNews = 5,
  } = options;
  
  let running = true;
  let pollCount = 0;
  
  onStatus('🔴 LIVE MONITORING STARTED');
  onStatus(`   Polling every ${pollIntervalMs / 1000}s for: ${categories.slice(0, 5).join(', ')}...`);
  
  const poll = async () => {
    if (!running) return;
    
    pollCount++;
    const startTime = Date.now();
    
    try {
      // Fetch breaking news
      const newsItems = await fetchBreakingNews(categories);
      
      // Filter for new headlines only
      const newItems = newsItems.filter(item => isNewHeadline(item.headline));
      
      if (newItems.length === 0) {
        onStatus(`[${new Date().toLocaleTimeString()}] ⏳ Poll #${pollCount} - No new breaking news`);
      } else {
        for (const news of newItems) {
          // Analyze the headline
          const analysis = await analyzeHeadline(news.headline);
          news.category = analysis.category;
          news.magnitude = analysis.magnitude as 'HIGH' | 'MEDIUM' | 'LOW';
          
          // Find affected markets
          const markets = await findAffectedMarkets(news.headline);
          const analysisTime = Date.now() - startTime;
          
          // Callback with results
          onNews({
            news,
            affectedMarkets: markets.slice(0, maxMarketsPerNews),
            analysisTime,
          });
        }
      }
    } catch (error) {
      onStatus(`[${new Date().toLocaleTimeString()}] ❌ Error: ${error}`);
    }
    
    // Schedule next poll
    if (running) {
      setTimeout(poll, pollIntervalMs);
    }
  };
  
  // Start polling
  poll();
  
  // Return stop function
  return () => {
    running = false;
    onStatus('⏹️ MONITORING STOPPED');
  };
}

/**
 * Calculate fair value for a market given news analysis
 */
function calculateFairValue(
  market: AffectedMarket,
  newsAnalysis: { magnitude: string; direction: string; confidence: number }
): AffectedMarket {
  // Default current price if not available
  const currentPrice = market.currentPrice ?? 0.5;
  
  // Calculate price shift based on news magnitude and direction
  const magnitude = newsAnalysis.magnitude === 'HIGH' ? 0.85 : 
                    newsAnalysis.magnitude === 'MEDIUM' ? 0.5 : 0.25;
  
  let baseShift: number;
  if (magnitude > 0.8) {
    baseShift = 0.15 + (magnitude - 0.8) * 0.5; // 15-25%
  } else if (magnitude > 0.5) {
    baseShift = 0.05 + (magnitude - 0.5) * 0.33; // 5-15%
  } else {
    baseShift = magnitude * 0.1; // 0-5%
  }
  
  // Apply direction
  if (newsAnalysis.direction === 'negative') {
    baseShift = -baseShift;
  } else if (newsAnalysis.direction === 'neutral') {
    baseShift = baseShift * 0.2;
  }
  
  // Adjust for confidence and similarity
  const adjustedShift = baseShift * newsAnalysis.confidence * market.similarityScore;
  
  // Calculate fair value
  let fairValue = currentPrice + adjustedShift;
  fairValue = Math.max(0.01, Math.min(0.99, fairValue));
  
  // Calculate edge
  const edge = fairValue - currentPrice;
  const edgePercent = currentPrice > 0 ? (edge / currentPrice) * 100 : 0;
  
  // Determine signal
  const edgeAbs = Math.abs(edge);
  let signal: AffectedMarket['signal'] = 'HOLD';
  if (edgeAbs > 0.15 && newsAnalysis.confidence > 0.7) {
    signal = edge > 0 ? 'STRONG_BUY' : 'STRONG_SELL';
  } else if (edgeAbs > 0.08) {
    signal = edge > 0 ? 'BUY' : 'SELL';
  } else if (edgeAbs > 0.05) {
    signal = edge > 0 ? 'BUY' : 'SELL';
  }
  
  // Calculate trade parameters
  const side: 'YES' | 'NO' = edge > 0 ? 'YES' : 'NO';
  const entryPrice = edge > 0 
    ? Math.min(currentPrice + 0.02, fairValue - 0.03)
    : Math.max(currentPrice - 0.02, fairValue + 0.03);
  const targetPrice = fairValue;
  const stopLoss = edge > 0 ? currentPrice - 0.12 : currentPrice + 0.12;
  
  // Position sizing based on edge and confidence
  let suggestedSize = 250; // Max $250
  if (edgeAbs < 0.05) suggestedSize *= 0.5;
  else if (edgeAbs < 0.10) suggestedSize *= 0.75;
  suggestedSize = Math.round(suggestedSize / 25) * 25;
  
  const confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 
    edgeAbs > 0.15 ? 'HIGH' : edgeAbs > 0.08 ? 'MEDIUM' : 'LOW';
  
  return {
    ...market,
    currentPrice: Math.round(currentPrice * 100) / 100,
    fairValue: Math.round(fairValue * 100) / 100,
    edge: Math.round(edge * 100) / 100,
    edgePercent: Math.round(edgePercent * 10) / 10,
    signal: signal === 'HOLD' ? undefined : signal,
    side: signal === 'HOLD' ? undefined : side,
    entryPrice: signal === 'HOLD' ? undefined : Math.round(entryPrice * 100) / 100,
    targetPrice: signal === 'HOLD' ? undefined : Math.round(targetPrice * 100) / 100,
    stopLoss: signal === 'HOLD' ? undefined : Math.round(stopLoss * 100) / 100,
    suggestedSize: signal === 'HOLD' ? undefined : suggestedSize,
    confidence: signal === 'HOLD' ? undefined : confidence,
  };
}

/**
 * One-time analysis (for testing)
 */
export async function analyzeOnce(headline: string, includeFairValue: boolean = true): Promise<NewsWithMarkets> {
  const startTime = Date.now();
  
  const analysis = await analyzeHeadline(headline);
  let markets = await findAffectedMarkets(headline);
  
  // Calculate fair values if requested
  if (includeFairValue) {
    const newsAnalysis = {
      magnitude: analysis.magnitude,
      direction: analysis.direction || 'neutral',
      confidence: analysis.confidence || 0.7,
    };
    
    markets = markets.map(market => calculateFairValue(market, newsAnalysis));
  }
  
  return {
    news: {
      headline,
      source: 'manual',
      timestamp: new Date(),
      category: analysis.category,
      magnitude: analysis.magnitude as 'HIGH' | 'MEDIUM' | 'LOW',
    },
    affectedMarkets: markets,
    analysisTime: Date.now() - startTime,
  };
}

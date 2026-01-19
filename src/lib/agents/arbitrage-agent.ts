/**
 * News-Lag Arbitrage Agent
 * Uses Vercel AI SDK with tools to find arbitrage opportunities
 */

import { generateText, tool, stepCountIs } from 'ai';
import { z } from 'zod';
import {
  searchBreakingNews,
  analyzeHeadline,
  verifyNews,
  searchKalshiMarkets,
  getKalshiOrderbook,
  searchPolymarketMarkets,
  estimateFairValue,
  generateTradeRecommendation,
  // Replay Labs - Primary market discovery
  semanticSearchMarkets,
  getMarketPrice,
  findMarketOverlaps,
} from '../tools';

// Use Vercel AI Gateway - supports multiple providers
const MODEL = process.env.AI_MODEL || 'openai/gpt-4o';

export interface ArbitrageSignal {
  headline: string;
  timestamp: string;
  markets: MarketSignal[];
  summary: string;
}

export interface MarketSignal {
  platform: 'kalshi' | 'polymarket';
  ticker: string;
  question: string;
  currentPrice: number;
  fairValue: number;
  edge: number;
  edgePercent: number;
  signal: string;
  confidence: string;
  action: string;
  suggestedSize: number;
  entryPrice: number;
  stopLoss: number;
  targetPrice: number;
  reasoning: string;
}

const SYSTEM_PROMPT = `You are an expert prediction markets arbitrage agent. Your job is to:

1. Analyze breaking news headlines for market impact
2. Find related prediction markets on Kalshi and Polymarket
3. Estimate fair value shifts based on the news
4. Generate trade signals with entry/exit recommendations

WORKFLOW:
1. First, analyze the headline to understand its impact (category, magnitude, direction)
2. Search for related markets on BOTH Kalshi and Polymarket
3. For each relevant market found, estimate fair value given the news
4. Generate trade recommendations for markets with significant edge (>5%)

IMPORTANT:
- Only recommend trades with edge > 5% and confidence > 0.6
- Consider liquidity - avoid markets with < $10,000 liquidity
- Factor in slippage for position sizing
- Be conservative with magnitude estimates
- Verify news if possible before generating signals

OUTPUT: Provide a structured summary of all trade opportunities found.`;

/**
 * Run the arbitrage agent on a news headline
 */
export async function runArbitrageAgent(headline: string): Promise<ArbitrageSignal> {
  const startTime = Date.now();
  
  const result = await generateText({
    model: MODEL as any, // Vercel AI Gateway model string
    system: SYSTEM_PROMPT,
    prompt: `Analyze this breaking news and find arbitrage opportunities:

"${headline}"

Steps:
1. Analyze the headline for market impact (category, magnitude, direction)
2. Use semanticSearchMarkets to find related prediction markets on both Polymarket and Kalshi
3. For the top 5 most relevant markets (highest similarity scores), get fresh prices with getMarketPrice
4. Estimate fair value for each market given the news
5. Generate trade recommendations for markets with >5% edge
6. Optionally check for cross-venue overlaps with findMarketOverlaps for arbitrage

Provide a complete analysis with specific trade recommendations.`,
    tools: {
      analyzeHeadline,
      // Replay Labs semantic search (primary - searches both Polymarket + Kalshi)
      semanticSearchMarkets,
      getMarketPrice,
      findMarketOverlaps,
      // Fallback individual venue searches
      searchKalshiMarkets,
      searchPolymarketMarkets,
      getKalshiOrderbook,
      // Fair value & signals
      estimateFairValue,
      generateTradeRecommendation,
    },
    stopWhen: stepCountIs(10), // Allow up to 10 steps for complete analysis
    maxTokens: 4096,
  });

  // Parse the results from tool calls
  const markets: MarketSignal[] = [];
  
  for (const step of result.steps) {
    for (const toolResult of step.toolResults || []) {
      if (toolResult.toolName === 'generateTradeRecommendation' && toolResult.result?.recommendation) {
        const rec = toolResult.result.recommendation;
        markets.push({
          platform: rec.platform,
          ticker: rec.marketTicker,
          question: rec.marketQuestion,
          currentPrice: rec.currentPrice,
          fairValue: rec.fairValue,
          edge: rec.edge,
          edgePercent: rec.edgePercent,
          signal: rec.action,
          confidence: rec.confidence,
          action: `${rec.action} ${rec.side}`,
          suggestedSize: rec.suggestedSize,
          entryPrice: rec.entryLimit,
          stopLoss: rec.stopLoss,
          targetPrice: rec.takeProfit,
          reasoning: rec.reasoning,
        });
      }
    }
  }

  // Sort by edge
  markets.sort((a, b) => Math.abs(b.edge) - Math.abs(a.edge));

  return {
    headline,
    timestamp: new Date().toISOString(),
    markets: markets.slice(0, 5), // Top 5 opportunities
    summary: result.text || generateSummary(headline, markets),
  };
}

/**
 * Quick analysis without full agent workflow
 * Uses Replay Labs semantic search for better market matching
 */
export async function quickAnalyze(headline: string) {
  // 1. Analyze headline
  const analysis = await analyzeHeadline.execute({ headline }, {} as any);
  
  // 2. Use Replay Labs semantic search (searches BOTH Polymarket + Kalshi)
  const semanticResult = await semanticSearchMarkets.execute({
    query: headline,
    limit: 10,
    activeOnly: true,
  }, {} as any);

  // 3. Transform results to common format
  const allMarkets = (semanticResult.markets || []).map((result: any) => {
    const m = result.market || result;
    return {
      ...m,
      platform: (m.venue || 'unknown').toLowerCase(),
      ticker: m.id,
      title: m.question,
      question: m.question,
      yesPrice: m.metadata?.yesPrice || 0.5,
      liquidity: m.metadata?.liquidity || m.metadata?.volume || 50000,
      similarityScore: result.score || 0.5,
    };
  });

  const signals: MarketSignal[] = [];
  
  for (const market of allMarkets.slice(0, 5)) {
    const currentPrice = market.yesPrice || market.outcomes?.[0]?.price || 0.5;
    
    const fairValueResult = await estimateFairValue.execute({
      marketQuestion: market.title || market.question,
      currentYesPrice: currentPrice,
      newsHeadline: headline,
      newsMagnitude: analysis.analysis?.magnitude || 0.5,
      newsDirection: analysis.analysis?.direction || 'neutral',
      newsConfidence: analysis.analysis?.confidence || 0.5,
      liquidity: market.liquidity || 50000,
    }, {} as any);

    if (fairValueResult.estimate && Math.abs(fairValueResult.estimate.edge) > 0.03) {
      const rec = await generateTradeRecommendation.execute({
        marketTicker: market.ticker || market.id,
        marketQuestion: market.title || market.question,
        platform: market.platform,
        currentPrice,
        fairValue: fairValueResult.estimate.fairValue,
        edge: fairValueResult.estimate.edge,
        liquidity: market.liquidity || 50000,
        maxPositionSize: 250,
      }, {} as any);

      if (rec.recommendation) {
        signals.push({
          platform: market.platform,
          ticker: market.ticker || market.id,
          question: market.title || market.question,
          currentPrice,
          fairValue: fairValueResult.estimate.fairValue,
          edge: fairValueResult.estimate.edge,
          edgePercent: fairValueResult.estimate.edgePercent,
          signal: rec.recommendation.action,
          confidence: rec.recommendation.confidence,
          action: `${rec.recommendation.action} ${rec.recommendation.side}`,
          suggestedSize: rec.recommendation.suggestedSize,
          entryPrice: rec.recommendation.entryLimit,
          stopLoss: rec.recommendation.stopLoss,
          targetPrice: rec.recommendation.takeProfit,
          reasoning: rec.recommendation.reasoning,
        });
      }
    }
  }

  // Sort by absolute edge
  signals.sort((a, b) => Math.abs(b.edge) - Math.abs(a.edge));

  return {
    headline,
    analysis: analysis.analysis,
    timestamp: new Date().toISOString(),
    markets: signals,
    summary: generateSummary(headline, signals),
  };
}

function extractKeywords(headline: string): string {
  // Extract main keywords for market search
  const stopWords = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'will', 'be', 'to', 'of', 'in', 'for', 'on', 'by'];
  const words = headline.toLowerCase().split(/\s+/);
  const keywords = words.filter(w => !stopWords.includes(w) && w.length > 2);
  return keywords.slice(0, 5).join(' ');
}

function generateSummary(headline: string, markets: MarketSignal[]): string {
  if (markets.length === 0) {
    return `No significant arbitrage opportunities found for: "${headline}"`;
  }
  
  const topSignals = markets.filter(m => Math.abs(m.edge) > 0.05);
  if (topSignals.length === 0) {
    return `Found ${markets.length} related markets but no significant edge (>5%) detected.`;
  }
  
  const buySignals = topSignals.filter(m => m.edge > 0);
  const sellSignals = topSignals.filter(m => m.edge < 0);
  
  return `Found ${topSignals.length} arbitrage opportunities: ${buySignals.length} BUY signals, ${sellSignals.length} SELL signals. ` +
    `Best opportunity: ${topSignals[0].question} with ${Math.round(topSignals[0].edgePercent)}% edge.`;
}

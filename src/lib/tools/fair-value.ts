/**
 * Fair Value Estimation Tool
 * Estimates what the market price SHOULD be given news, vs current price
 */

import { tool } from 'ai';
import { z } from 'zod';

export interface FairValueEstimate {
  currentPrice: number;
  fairValue: number;
  edge: number; // fairValue - currentPrice
  edgePercent: number;
  confidence: number;
  direction: 'long' | 'short' | 'hold';
  signal: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
  reasoning: string;
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  riskReward: number;
}

/**
 * Estimate fair value given news and current market price
 */
export const estimateFairValue = tool({
  description: `Estimate the fair value of a prediction market given breaking news.
    Compares current price to what it SHOULD be, generating trade signals.
    Returns edge (difference), confidence, and entry recommendations.`,
  parameters: z.object({
    marketQuestion: z.string().describe('The prediction market question'),
    currentYesPrice: z.number().min(0).max(1).describe('Current YES price (0-1)'),
    newsHeadline: z.string().describe('The breaking news headline'),
    newsMagnitude: z.number().min(0).max(1).describe('News importance score (0-1)'),
    newsDirection: z.enum(['positive', 'negative', 'neutral']).describe('News direction for the market'),
    newsConfidence: z.number().min(0).max(1).describe('Confidence in news analysis'),
    liquidity: z.number().optional().describe('Market liquidity in USD'),
  }),
  execute: async ({ 
    marketQuestion, 
    currentYesPrice, 
    newsHeadline, 
    newsMagnitude, 
    newsDirection, 
    newsConfidence,
    liquidity = 50000,
  }) => {
    // Calculate expected price shift based on news
    const baseShift = calculateBaseShift(newsMagnitude, newsDirection);
    
    // Adjust for confidence
    const adjustedShift = baseShift * newsConfidence;
    
    // Calculate fair value
    let fairValue = currentYesPrice + adjustedShift;
    fairValue = Math.max(0.01, Math.min(0.99, fairValue)); // Clamp to valid range
    
    // Calculate edge
    const edge = fairValue - currentYesPrice;
    const edgePercent = (edge / currentYesPrice) * 100;
    
    // Determine signal strength
    const { signal, direction } = getSignal(edge, newsConfidence, liquidity);
    
    // Calculate entry/exit levels
    const entryPrice = direction === 'long' 
      ? Math.min(currentYesPrice + 0.02, fairValue - 0.03)
      : Math.max(currentYesPrice - 0.02, fairValue + 0.03);
    
    const targetPrice = fairValue;
    const stopLoss = direction === 'long'
      ? currentYesPrice - 0.10
      : currentYesPrice + 0.10;
    
    const riskReward = Math.abs(targetPrice - entryPrice) / Math.abs(entryPrice - stopLoss);
    
    // Generate reasoning
    const reasoning = generateReasoning(
      marketQuestion,
      newsHeadline,
      currentYesPrice,
      fairValue,
      edge,
      signal
    );

    return {
      success: true,
      estimate: {
        currentPrice: currentYesPrice,
        fairValue: Math.round(fairValue * 100) / 100,
        edge: Math.round(edge * 100) / 100,
        edgePercent: Math.round(edgePercent * 10) / 10,
        confidence: newsConfidence,
        direction,
        signal,
        reasoning,
        entryPrice: Math.round(entryPrice * 100) / 100,
        targetPrice: Math.round(targetPrice * 100) / 100,
        stopLoss: Math.round(stopLoss * 100) / 100,
        riskReward: Math.round(riskReward * 10) / 10,
      } as FairValueEstimate,
    };
  },
});

/**
 * Generate trade recommendation
 */
export const generateTradeRecommendation = tool({
  description: 'Generate a complete trade recommendation based on fair value analysis.',
  parameters: z.object({
    marketTicker: z.string().describe('Market ticker/ID'),
    marketQuestion: z.string().describe('Market question'),
    platform: z.enum(['kalshi', 'polymarket']).describe('Trading platform'),
    currentPrice: z.number().describe('Current YES price'),
    fairValue: z.number().describe('Estimated fair value'),
    edge: z.number().describe('Price edge'),
    liquidity: z.number().describe('Market liquidity'),
    maxPositionSize: z.number().default(250).describe('Maximum position size in USD'),
  }),
  execute: async ({
    marketTicker,
    marketQuestion,
    platform,
    currentPrice,
    fairValue,
    edge,
    liquidity,
    maxPositionSize,
  }) => {
    const direction = edge > 0 ? 'long' : 'short';
    const side = direction === 'long' ? 'YES' : 'NO';
    
    // Calculate position size based on edge and liquidity
    const edgeAbs = Math.abs(edge);
    let suggestedSize = maxPositionSize;
    
    // Reduce size for lower edge
    if (edgeAbs < 0.05) suggestedSize *= 0.5;
    else if (edgeAbs < 0.10) suggestedSize *= 0.75;
    
    // Reduce size for low liquidity
    if (liquidity < 20000) suggestedSize *= 0.5;
    else if (liquidity < 50000) suggestedSize *= 0.75;
    
    // Round to nearest $25
    suggestedSize = Math.round(suggestedSize / 25) * 25;
    suggestedSize = Math.max(25, Math.min(maxPositionSize, suggestedSize));
    
    // Calculate expected profit
    const entryPrice = direction === 'long' ? currentPrice : (1 - currentPrice);
    const exitPrice = direction === 'long' ? fairValue : (1 - fairValue);
    const contracts = Math.floor(suggestedSize / entryPrice);
    const expectedProfit = contracts * (exitPrice - entryPrice);
    
    const confidence = edgeAbs > 0.15 ? 'HIGH' : edgeAbs > 0.08 ? 'MEDIUM' : 'LOW';

    return {
      success: true,
      recommendation: {
        action: edge > 0.03 ? 'BUY' : edge < -0.03 ? 'SELL' : 'HOLD',
        side,
        platform,
        marketTicker,
        marketQuestion,
        currentPrice,
        fairValue,
        edge: Math.round(edge * 100) / 100,
        edgePercent: Math.round((edge / currentPrice) * 100 * 10) / 10,
        suggestedSize,
        contracts,
        expectedProfit: Math.round(expectedProfit * 100) / 100,
        confidence,
        entryLimit: Math.round((direction === 'long' ? currentPrice + 0.02 : currentPrice - 0.02) * 100) / 100,
        stopLoss: Math.round((direction === 'long' ? currentPrice - 0.12 : currentPrice + 0.12) * 100) / 100,
        takeProfit: Math.round(fairValue * 100) / 100,
        reasoning: `${confidence} confidence ${side} signal. Edge of ${Math.round(edge * 100)}% detected. Fair value estimated at ${Math.round(fairValue * 100)}¢ vs current ${Math.round(currentPrice * 100)}¢.`,
      },
    };
  },
});

function calculateBaseShift(magnitude: number, direction: string): number {
  // Base shift depends on magnitude (0-1)
  // High magnitude news can shift prices 15-25%
  // Medium magnitude: 5-15%
  // Low magnitude: 1-5%
  
  let shift: number;
  if (magnitude > 0.8) {
    shift = 0.15 + (magnitude - 0.8) * 0.5; // 15-25%
  } else if (magnitude > 0.5) {
    shift = 0.05 + (magnitude - 0.5) * 0.33; // 5-15%
  } else {
    shift = magnitude * 0.1; // 0-5%
  }
  
  // Apply direction
  if (direction === 'negative') {
    shift = -shift;
  } else if (direction === 'neutral') {
    shift = shift * 0.2; // Neutral news has smaller effect
  }
  
  return shift;
}

function getSignal(edge: number, confidence: number, liquidity: number): {
  signal: FairValueEstimate['signal'];
  direction: 'long' | 'short' | 'hold';
} {
  const edgeAbs = Math.abs(edge);
  
  // Require minimum liquidity
  if (liquidity < 10000) {
    return { signal: 'hold', direction: 'hold' };
  }
  
  // Require minimum confidence
  if (confidence < 0.5) {
    return { signal: 'hold', direction: 'hold' };
  }
  
  const direction = edge > 0 ? 'long' : edge < 0 ? 'short' : 'hold';
  
  if (edgeAbs > 0.15 && confidence > 0.7) {
    return { signal: edge > 0 ? 'strong_buy' : 'strong_sell', direction };
  } else if (edgeAbs > 0.08 && confidence > 0.6) {
    return { signal: edge > 0 ? 'buy' : 'sell', direction };
  } else if (edgeAbs > 0.05) {
    return { signal: edge > 0 ? 'buy' : 'sell', direction };
  }
  
  return { signal: 'hold', direction: 'hold' };
}

function generateReasoning(
  question: string,
  headline: string,
  currentPrice: number,
  fairValue: number,
  edge: number,
  signal: string
): string {
  const direction = edge > 0 ? 'undervalued' : 'overvalued';
  const action = edge > 0 ? 'BUY YES' : 'SELL YES / BUY NO';
  
  return `Market "${question}" appears ${direction} given news: "${headline}". ` +
    `Current price ${Math.round(currentPrice * 100)}¢ vs fair value ${Math.round(fairValue * 100)}¢ ` +
    `(${Math.round(edge * 100)}% edge). Signal: ${signal.toUpperCase()}. Recommended action: ${action}.`;
}

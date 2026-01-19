/**
 * Export all tools for the arbitrage agent
 */

export { searchBreakingNews, analyzeHeadline, verifyNews } from './grok-search';
export { searchKalshiMarkets, getKalshiOrderbook, getKalshiMarketDetails } from './kalshi';
export { searchPolymarketMarkets, getPolymarketMarketDetails, getPolymarketPrices } from './polymarket';
export { estimateFairValue, generateTradeRecommendation } from './fair-value';

// Semantic Verification Engine
export {
  verifyMarketPair,
  findMatchingMarkets,
  generateVerificationReport,
  batchVerifyMarkets,
  getVerifiedPairs,
  VERIFIED_PAIRS,
  type MarketResolutionCriteria,
  type VerificationResult,
  type Misalignment,
  type MarketPairMatch,
  type VerifiedMarketPair,
} from './semantic-verification';

// Replay Labs - Unified API for Polymarket + Kalshi with semantic search
export { 
  semanticSearchMarkets, 
  getMarketPrice, 
  findMarketOverlaps,
  searchMarkets,
  getPolymarketHistory,
} from './replay-labs';

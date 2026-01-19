/**
 * LLM Semantic Verification Engine
 * 
 * Compares resolution criteria between Polymarket and Kalshi markets
 * to detect technical misalignments and prevent bad trades due to rule ambiguity.
 * 
 * Key features:
 * - Semantic market matching across platforms
 * - Resolution criteria comparison using LLM
 * - Technical misalignment detection
 * - Confidence scoring for market equivalence
 */

import { tool, generateText } from 'ai';
import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface MarketResolutionCriteria {
  platform: 'kalshi' | 'polymarket';
  marketId: string;
  question: string;
  description?: string;
  resolutionSource?: string;
  resolutionDate?: string;
  rules?: string[];
  category?: string;
}

export interface VerificationResult {
  isMatch: boolean;
  matchConfidence: number; // 0-1
  semanticSimilarity: number; // 0-1
  misalignments: Misalignment[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  recommendation: 'SAFE_TO_TRADE' | 'PROCEED_WITH_CAUTION' | 'AVOID' | 'MANUAL_REVIEW';
  reasoning: string;
  detailedAnalysis: {
    questionMatch: boolean;
    dateMatch: boolean;
    sourceMatch: boolean;
    rulesMatch: boolean;
    scopeMatch: boolean;
  };
}

export interface Misalignment {
  type: 'RESOLUTION_DATE' | 'RESOLUTION_SOURCE' | 'SCOPE' | 'THRESHOLD' | 'DEFINITION' | 'EDGE_CASE';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  kalshiValue?: string;
  polymarketValue?: string;
  potentialImpact: string;
}

export interface MarketPairMatch {
  kalshiMarket: MarketResolutionCriteria;
  polymarketMarket: MarketResolutionCriteria;
  verification: VerificationResult;
  timestamp: string;
}

// ═══════════════════════════════════════════════════════════════
// LLM VERIFICATION PROMPTS
// ═══════════════════════════════════════════════════════════════

const VERIFICATION_SYSTEM_PROMPT = `You are an expert prediction market analyst specializing in resolution criteria analysis.
Your job is to compare two prediction markets from different platforms (Kalshi and Polymarket) and determine:

1. Whether they are semantically equivalent (asking the same fundamental question)
2. Identify any technical misalignments in their resolution criteria
3. Assess risk of arbitrage trades between these markets

CRITICAL ASPECTS TO ANALYZE:

📅 TEMPORAL ALIGNMENT
- Resolution dates must match exactly or have clear equivalence
- Time zones matter (EST vs UTC)
- "By end of" vs "On" date differences

📰 RESOLUTION SOURCE
- Primary source must be the same or highly correlated
- Official sources (BLS, Fed) vs news reports
- Specific vs general sourcing

📏 THRESHOLD DEFINITIONS  
- Numeric thresholds (>3% vs ≥3%)
- Rounding conventions
- Edge cases at exact thresholds

🎯 SCOPE ALIGNMENT
- Geographic scope (US vs global)
- Time period covered
- What specifically resolves YES vs NO

⚠️ EDGE CASES
- Ties, cancellations, delays
- Market closure scenarios
- Ambiguous outcomes

OUTPUT MUST BE VALID JSON following the exact schema provided.`;

const MARKET_COMPARISON_PROMPT = (market1: MarketResolutionCriteria, market2: MarketResolutionCriteria) => `
Compare these two prediction markets and provide detailed analysis:

═══════════════════════════════════════════════════════════
KALSHI MARKET
═══════════════════════════════════════════════════════════
Ticker: ${market1.marketId}
Question: ${market1.question}
Description: ${market1.description || 'Not provided'}
Resolution Source: ${market1.resolutionSource || 'Not specified'}
Resolution Date: ${market1.resolutionDate || 'Not specified'}
Rules: ${market1.rules?.join(' | ') || 'Not specified'}
Category: ${market1.category || 'Unknown'}

═══════════════════════════════════════════════════════════
POLYMARKET MARKET
═══════════════════════════════════════════════════════════
ID: ${market2.marketId}
Question: ${market2.question}
Description: ${market2.description || 'Not provided'}
Resolution Source: ${market2.resolutionSource || 'Not specified'}
Resolution Date: ${market2.resolutionDate || 'Not specified'}
Rules: ${market2.rules?.join(' | ') || 'Not specified'}
Category: ${market2.category || 'Unknown'}

═══════════════════════════════════════════════════════════

Analyze and return JSON:
{
  "isMatch": boolean,
  "matchConfidence": number (0-1),
  "semanticSimilarity": number (0-1),
  "misalignments": [
    {
      "type": "RESOLUTION_DATE" | "RESOLUTION_SOURCE" | "SCOPE" | "THRESHOLD" | "DEFINITION" | "EDGE_CASE",
      "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
      "description": "string",
      "kalshiValue": "string or null",
      "polymarketValue": "string or null",
      "potentialImpact": "string"
    }
  ],
  "riskLevel": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "recommendation": "SAFE_TO_TRADE" | "PROCEED_WITH_CAUTION" | "AVOID" | "MANUAL_REVIEW",
  "reasoning": "string",
  "detailedAnalysis": {
    "questionMatch": boolean,
    "dateMatch": boolean,
    "sourceMatch": boolean,
    "rulesMatch": boolean,
    "scopeMatch": boolean
  }
}`;

// ═══════════════════════════════════════════════════════════════
// TOOLS
// ═══════════════════════════════════════════════════════════════

/**
 * Verify semantic equivalence between two markets
 */
export const verifyMarketPair = tool({
  description: `Verify if a Kalshi market and Polymarket market are semantically equivalent.
    Compares resolution criteria to detect technical misalignments that could cause arbitrage losses.
    Returns risk assessment and recommendation for trading.`,
  parameters: z.object({
    kalshiMarket: z.object({
      marketId: z.string().describe('Kalshi market ticker'),
      question: z.string().describe('Market question/title'),
      description: z.string().optional().describe('Full market description'),
      resolutionSource: z.string().optional().describe('Data source for resolution'),
      resolutionDate: z.string().optional().describe('When market resolves'),
      rules: z.array(z.string()).optional().describe('Specific resolution rules'),
      category: z.string().optional().describe('Market category'),
    }),
    polymarketMarket: z.object({
      marketId: z.string().describe('Polymarket condition ID'),
      question: z.string().describe('Market question/title'),
      description: z.string().optional().describe('Full market description'),
      resolutionSource: z.string().optional().describe('Data source for resolution'),
      resolutionDate: z.string().optional().describe('When market resolves'),
      rules: z.array(z.string()).optional().describe('Specific resolution rules'),
      category: z.string().optional().describe('Market category'),
    }),
  }),
  execute: async ({ kalshiMarket, polymarketMarket }) => {
    try {
      const market1: MarketResolutionCriteria = { 
        platform: 'kalshi', 
        ...kalshiMarket 
      };
      const market2: MarketResolutionCriteria = { 
        platform: 'polymarket', 
        ...polymarketMarket 
      };
      
      // Use LLM for semantic comparison
      const result = await generateText({
        model: (process.env.AI_MODEL || 'openai/gpt-4o') as any,
        system: VERIFICATION_SYSTEM_PROMPT,
        prompt: MARKET_COMPARISON_PROMPT(market1, market2),
        maxTokens: 2000,
      });
      
      // Parse LLM response
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          success: false,
          error: 'Failed to parse LLM response',
          rawResponse: result.text,
        };
      }
      
      const verification: VerificationResult = JSON.parse(jsonMatch[0]);
      
      return {
        success: true,
        verification,
        kalshiMarket: market1,
        polymarketMarket: market2,
        timestamp: new Date().toISOString(),
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
 * Find potential market matches across platforms
 */
export const findMatchingMarkets = tool({
  description: `Find potentially matching markets between Kalshi and Polymarket for a given topic.
    Uses semantic search to identify candidate pairs for verification.`,
  parameters: z.object({
    topic: z.string().describe('Topic to search for (e.g., "Fed rates", "Bitcoin price")'),
    kalshiMarkets: z.array(z.object({
      ticker: z.string(),
      title: z.string(),
      category: z.string().optional(),
      expirationTime: z.string().optional(),
    })).describe('List of Kalshi markets to match against'),
    polymarketMarkets: z.array(z.object({
      id: z.string(),
      question: z.string(),
      category: z.string().optional(),
      endDate: z.string().optional(),
    })).describe('List of Polymarket markets to match against'),
    minSimilarity: z.number().min(0).max(1).default(0.7).describe('Minimum similarity threshold'),
  }),
  execute: async ({ topic, kalshiMarkets, polymarketMarkets, minSimilarity }) => {
    try {
      // Build comparison prompt
      const matchPrompt = `
You are matching prediction markets across platforms.

TOPIC: ${topic}

KALSHI MARKETS:
${kalshiMarkets.map((m, i) => `${i + 1}. [${m.ticker}] ${m.title} (expires: ${m.expirationTime || 'unknown'})`).join('\n')}

POLYMARKET MARKETS:
${polymarketMarkets.map((m, i) => `${i + 1}. [${m.id}] ${m.question} (ends: ${m.endDate || 'unknown'})`).join('\n')}

Find all potential matching pairs. For each pair, provide:
- kalshiIndex (1-based)
- polymarketIndex (1-based)
- similarity (0-1)
- reason

Return JSON array:
[
  {
    "kalshiIndex": number,
    "polymarketIndex": number,
    "similarity": number,
    "reason": "string"
  }
]

Only include pairs with similarity >= ${minSimilarity}.`;

      const result = await generateText({
        model: (process.env.AI_MODEL || 'openai/gpt-4o') as any,
        system: 'You are an expert at matching equivalent prediction markets across different platforms.',
        prompt: matchPrompt,
        maxTokens: 2000,
      });
      
      const jsonMatch = result.text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return {
          success: true,
          matches: [],
          message: 'No matches found',
        };
      }
      
      const rawMatches = JSON.parse(jsonMatch[0]);
      
      // Enrich with actual market data
      const matches = rawMatches
        .filter((m: any) => m.similarity >= minSimilarity)
        .map((m: any) => ({
          kalshiMarket: kalshiMarkets[m.kalshiIndex - 1],
          polymarketMarket: polymarketMarkets[m.polymarketIndex - 1],
          similarity: m.similarity,
          reason: m.reason,
          needsVerification: true,
        }));
      
      return {
        success: true,
        topic,
        matches,
        totalKalshiMarkets: kalshiMarkets.length,
        totalPolymarketMarkets: polymarketMarkets.length,
        matchCount: matches.length,
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
 * Generate a detailed verification report for a market pair
 */
export const generateVerificationReport = tool({
  description: `Generate a comprehensive verification report for a matched market pair.
    Includes detailed misalignment analysis and trading recommendations.`,
  parameters: z.object({
    verification: z.object({
      isMatch: z.boolean(),
      matchConfidence: z.number(),
      semanticSimilarity: z.number(),
      misalignments: z.array(z.object({
        type: z.string(),
        severity: z.string(),
        description: z.string(),
        kalshiValue: z.string().optional(),
        polymarketValue: z.string().optional(),
        potentialImpact: z.string(),
      })),
      riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
      recommendation: z.enum(['SAFE_TO_TRADE', 'PROCEED_WITH_CAUTION', 'AVOID', 'MANUAL_REVIEW']),
      reasoning: z.string(),
    }),
    kalshiTicker: z.string(),
    polymarketId: z.string(),
    priceSpread: z.number().optional().describe('Current price spread in cents'),
  }),
  execute: async ({ verification, kalshiTicker, polymarketId, priceSpread }) => {
    const criticalMisalignments = verification.misalignments.filter(m => m.severity === 'CRITICAL');
    const highMisalignments = verification.misalignments.filter(m => m.severity === 'HIGH');
    
    // Calculate adjusted recommendation based on spread
    let adjustedRecommendation = verification.recommendation;
    if (priceSpread && priceSpread < 3 && verification.misalignments.length > 0) {
      // Small spread + any misalignment = not worth the risk
      adjustedRecommendation = 'AVOID';
    }
    
    const report = {
      // Header
      reportId: `VR-${Date.now()}`,
      generatedAt: new Date().toISOString(),
      
      // Market Pair
      markets: {
        kalshi: kalshiTicker,
        polymarket: polymarketId,
        priceSpread: priceSpread ? `${priceSpread}¢` : 'Unknown',
      },
      
      // Overall Assessment
      assessment: {
        isEquivalent: verification.isMatch,
        confidence: `${Math.round(verification.matchConfidence * 100)}%`,
        semanticSimilarity: `${Math.round(verification.semanticSimilarity * 100)}%`,
        riskLevel: verification.riskLevel,
        recommendation: adjustedRecommendation,
      },
      
      // Misalignment Summary
      misalignmentSummary: {
        total: verification.misalignments.length,
        critical: criticalMisalignments.length,
        high: highMisalignments.length,
        medium: verification.misalignments.filter(m => m.severity === 'MEDIUM').length,
        low: verification.misalignments.filter(m => m.severity === 'LOW').length,
      },
      
      // Detailed Misalignments
      misalignments: verification.misalignments.map(m => ({
        ...m,
        emoji: getMisalignmentEmoji(m.type),
      })),
      
      // Trading Guidance
      tradingGuidance: getTradingGuidance(verification, priceSpread),
      
      // LLM Reasoning
      aiReasoning: verification.reasoning,
    };
    
    return {
      success: true,
      report,
    };
  },
});

/**
 * Batch verify multiple market pairs
 */
export const batchVerifyMarkets = tool({
  description: `Verify multiple market pairs in batch. Returns verification status for each pair.`,
  parameters: z.object({
    pairs: z.array(z.object({
      kalshi: z.object({
        marketId: z.string(),
        question: z.string(),
        description: z.string().optional(),
      }),
      polymarket: z.object({
        marketId: z.string(),
        question: z.string(),
        description: z.string().optional(),
      }),
    })).max(10).describe('Market pairs to verify (max 10)'),
  }),
  execute: async ({ pairs }) => {
    const results: Array<{
      kalshi: string;
      polymarket: string;
      quickVerification: 'LIKELY_MATCH' | 'POSSIBLE_MATCH' | 'UNLIKELY_MATCH';
      needsDetailedVerification: boolean;
    }> = [];
    
    // Quick semantic comparison using simpler heuristics + LLM
    for (const pair of pairs) {
      const similarity = quickSimilarityScore(pair.kalshi.question, pair.polymarket.question);
      
      let quickVerification: 'LIKELY_MATCH' | 'POSSIBLE_MATCH' | 'UNLIKELY_MATCH';
      if (similarity > 0.8) {
        quickVerification = 'LIKELY_MATCH';
      } else if (similarity > 0.5) {
        quickVerification = 'POSSIBLE_MATCH';
      } else {
        quickVerification = 'UNLIKELY_MATCH';
      }
      
      results.push({
        kalshi: pair.kalshi.marketId,
        polymarket: pair.polymarket.marketId,
        quickVerification,
        needsDetailedVerification: quickVerification !== 'UNLIKELY_MATCH',
      });
    }
    
    return {
      success: true,
      results,
      summary: {
        total: pairs.length,
        likelyMatches: results.filter(r => r.quickVerification === 'LIKELY_MATCH').length,
        possibleMatches: results.filter(r => r.quickVerification === 'POSSIBLE_MATCH').length,
        needingDetailedVerification: results.filter(r => r.needsDetailedVerification).length,
      },
    };
  },
});

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function getMisalignmentEmoji(type: string): string {
  const emojis: Record<string, string> = {
    'RESOLUTION_DATE': '📅',
    'RESOLUTION_SOURCE': '📰',
    'SCOPE': '🌍',
    'THRESHOLD': '📏',
    'DEFINITION': '📖',
    'EDGE_CASE': '⚠️',
  };
  return emojis[type] || '❓';
}

function getTradingGuidance(verification: VerificationResult, priceSpread?: number): string[] {
  const guidance: string[] = [];
  
  if (verification.recommendation === 'SAFE_TO_TRADE') {
    guidance.push('✅ Markets are semantically equivalent and safe for arbitrage');
    if (priceSpread && priceSpread > 5) {
      guidance.push(`💰 Spread of ${priceSpread}¢ presents good opportunity`);
    }
  } else if (verification.recommendation === 'PROCEED_WITH_CAUTION') {
    guidance.push('⚠️ Minor differences detected - verify resolution criteria manually');
    guidance.push('📊 Consider smaller position sizes to limit exposure');
    verification.misalignments.forEach(m => {
      if (m.severity === 'MEDIUM') {
        guidance.push(`  → ${getMisalignmentEmoji(m.type)} ${m.description}`);
      }
    });
  } else if (verification.recommendation === 'AVOID') {
    guidance.push('🚫 Significant misalignments detected - avoid arbitrage');
    guidance.push('💡 These markets may resolve differently despite similar wording');
    verification.misalignments.filter(m => m.severity === 'HIGH' || m.severity === 'CRITICAL').forEach(m => {
      guidance.push(`  → ${getMisalignmentEmoji(m.type)} ${m.description}`);
    });
  } else {
    guidance.push('🔍 Manual review required before trading');
    guidance.push('📋 Resolution criteria ambiguity needs human judgment');
  }
  
  return guidance;
}

function quickSimilarityScore(question1: string, question2: string): number {
  // Simple heuristic similarity (Jaccard-like)
  const normalize = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, '');
  const words1 = new Set(normalize(question1).split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(normalize(question2).split(/\s+/).filter(w => w.length > 2));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
}

// ═══════════════════════════════════════════════════════════════
// MARKET REGISTRY (known cross-platform pairs)
// ═══════════════════════════════════════════════════════════════

export interface VerifiedMarketPair {
  id: string;
  name: string;
  kalshi: {
    ticker: string;
    question: string;
  };
  polymarket: {
    conditionId: string;
    question: string;
  };
  lastVerified: string;
  verificationStatus: 'VERIFIED_MATCH' | 'NEEDS_REVIEW' | 'KNOWN_MISMATCH';
  notes?: string;
}

// Pre-verified market pairs (would be populated from analysis)
export const VERIFIED_PAIRS: VerifiedMarketPair[] = [
  {
    id: 'fed-rate-jan-2026',
    name: 'Fed Rate Cut January 2026',
    kalshi: {
      ticker: 'FED-26JAN-T4.50',
      question: 'Will the Fed cut rates in January 2026?',
    },
    polymarket: {
      conditionId: 'fed-rate-jan-2026',
      question: 'Will the Federal Reserve cut interest rates in January 2026?',
    },
    lastVerified: '2026-01-15T00:00:00Z',
    verificationStatus: 'VERIFIED_MATCH',
    notes: 'Both resolve based on FOMC announcement',
  },
  {
    id: 'btc-100k-jan-2026',
    name: 'Bitcoin $100K January 2026',
    kalshi: {
      ticker: 'BTC-26JAN-100K',
      question: 'Will Bitcoin be above $100,000 by end of January 2026?',
    },
    polymarket: {
      conditionId: 'btc-100k-jan-2026',
      question: 'Will Bitcoin reach $100,000 by January 31, 2026?',
    },
    lastVerified: '2026-01-15T00:00:00Z',
    verificationStatus: 'NEEDS_REVIEW',
    notes: 'Verify: "above" vs "reach" - may have different threshold interpretation',
  },
];

/**
 * Get pre-verified market pairs
 */
export const getVerifiedPairs = tool({
  description: 'Get list of pre-verified market pairs between Kalshi and Polymarket',
  parameters: z.object({
    status: z.enum(['all', 'verified', 'needs_review', 'mismatch']).default('all'),
    category: z.string().optional().describe('Filter by category'),
  }),
  execute: async ({ status, category }) => {
    let pairs = [...VERIFIED_PAIRS];
    
    if (status !== 'all') {
      const statusMap = {
        verified: 'VERIFIED_MATCH',
        needs_review: 'NEEDS_REVIEW',
        mismatch: 'KNOWN_MISMATCH',
      };
      pairs = pairs.filter(p => p.verificationStatus === statusMap[status]);
    }
    
    return {
      success: true,
      pairs,
      count: pairs.length,
    };
  },
});

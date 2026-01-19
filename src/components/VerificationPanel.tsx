'use client';

import { useState } from 'react';

interface Misalignment {
  type: string;
  severity: string;
  description: string;
}

interface MatchedPair {
  kalshi: {
    ticker: string;
    question: string;
    price?: number;
  };
  polymarket: {
    id: string;
    question: string;
    price?: number;
  };
  verification: {
    isMatch: boolean;
    matchConfidence: number;
    riskLevel: string;
    recommendation: string;
    misalignments: Misalignment[];
  };
  priceSpread?: number;
  arbitrageOpportunity: boolean;
}

interface VerificationResult {
  topic: string;
  timestamp: string;
  matchedPairs: MatchedPair[];
  summary: string;
  statistics: {
    marketsScanned: { kalshi: number; polymarket: number };
    matchesFound: number;
    safeToTrade: number;
    proceedWithCaution: number;
    avoid: number;
    needsReview: number;
  };
  meta?: { durationMs: number };
}

export default function VerificationPanel() {
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedPair, setExpandedPair] = useState<number | null>(null);

  const verify = async () => {
    if (!topic.trim()) return;
    
    setLoading(true);
    setError(null);
    setExpandedPair(null);
    
    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'topic', topic }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Verification failed');
      }
      
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'LOW': return 'text-emerald-400 bg-emerald-500/20';
      case 'MEDIUM': return 'text-yellow-400 bg-yellow-500/20';
      case 'HIGH': return 'text-orange-400 bg-orange-500/20';
      case 'CRITICAL': return 'text-red-400 bg-red-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  const getRecommendationStyle = (rec: string) => {
    switch (rec) {
      case 'SAFE_TO_TRADE': return { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', icon: '✅' };
      case 'PROCEED_WITH_CAUTION': return { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', icon: '⚠️' };
      case 'AVOID': return { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', icon: '🚫' };
      case 'MANUAL_REVIEW': return { color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30', icon: '🔍' };
      default: return { color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/30', icon: '❓' };
    }
  };

  const getMisalignmentIcon = (type: string) => {
    switch (type) {
      case 'RESOLUTION_DATE': return '📅';
      case 'RESOLUTION_SOURCE': return '📰';
      case 'SCOPE': return '🌍';
      case 'THRESHOLD': return '📏';
      case 'DEFINITION': return '📖';
      case 'EDGE_CASE': return '⚠️';
      default: return '❓';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="market-card p-6">
        <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
          <span className="text-2xl">🔬</span>
          <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
            Semantic Verification Engine
          </span>
        </h2>
        <p className="text-gray-400 text-sm mb-4">
          Compare resolution criteria between Kalshi and Polymarket markets to detect technical misalignments
        </p>
        
        {/* Input */}
        <div className="flex gap-4">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && verify()}
            placeholder="e.g., Fed rates, Bitcoin, inflation"
            className="flex-1 bg-black/50 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-colors"
          />
          <button
            onClick={verify}
            disabled={loading || !topic.trim()}
            className="px-8 py-3 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-lg font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '🔄 Verifying...' : '🔬 Verify'}
          </button>
        </div>
        
        {/* Quick topics */}
        <div className="mt-4 flex gap-2 flex-wrap">
          <span className="text-xs text-gray-500">Quick search:</span>
          {['Fed rates', 'Bitcoin', 'inflation', 'recession', 'election'].map((t) => (
            <button
              key={t}
              onClick={() => setTopic(t)}
              className="text-xs px-2 py-1 bg-gray-800 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="market-card p-4 border-red-500/50 bg-red-900/20">
          <p className="text-red-400">❌ {error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Statistics */}
          <div className="market-card p-6">
            <h3 className="text-lg font-semibold mb-4 text-violet-400">📊 Verification Statistics</h3>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-white">{result.statistics.marketsScanned.kalshi}</div>
                <div className="text-xs text-gray-400">Kalshi Scanned</div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-white">{result.statistics.marketsScanned.polymarket}</div>
                <div className="text-xs text-gray-400">Polymarket Scanned</div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-emerald-400">{result.statistics.safeToTrade}</div>
                <div className="text-xs text-gray-400">Safe to Trade</div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-yellow-400">{result.statistics.proceedWithCaution}</div>
                <div className="text-xs text-gray-400">Caution</div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-red-400">{result.statistics.avoid}</div>
                <div className="text-xs text-gray-400">Avoid</div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-purple-400">{result.statistics.needsReview}</div>
                <div className="text-xs text-gray-400">Review Needed</div>
              </div>
            </div>
          </div>

          {/* Matched Pairs */}
          <div className="market-card p-6">
            <h3 className="text-lg font-semibold mb-4 text-fuchsia-400">
              🎯 Matched Market Pairs ({result.matchedPairs.length})
            </h3>
            
            {result.matchedPairs.length === 0 ? (
              <p className="text-gray-500">No matching market pairs found for this topic.</p>
            ) : (
              <div className="space-y-4">
                {result.matchedPairs.map((pair, i) => {
                  const recStyle = getRecommendationStyle(pair.verification.recommendation);
                  const isExpanded = expandedPair === i;
                  
                  return (
                    <div
                      key={i}
                      className={`rounded-lg border transition-all cursor-pointer ${recStyle.border} ${recStyle.bg}`}
                      onClick={() => setExpandedPair(isExpanded ? null : i)}
                    >
                      {/* Header */}
                      <div className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg">{recStyle.icon}</span>
                              <span className={`font-medium ${recStyle.color}`}>
                                {pair.verification.recommendation.replace(/_/g, ' ')}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-xs ${getRiskColor(pair.verification.riskLevel)}`}>
                                {pair.verification.riskLevel} RISK
                              </span>
                              {pair.arbitrageOpportunity && (
                                <span className="px-2 py-0.5 rounded text-xs bg-emerald-500/20 text-emerald-400">
                                  💰 ARB OPPORTUNITY
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-400">
                              Confidence: {Math.round(pair.verification.matchConfidence * 100)}%
                              {pair.priceSpread !== undefined && (
                                <span className="ml-4">
                                  Spread: <span className="text-white font-mono">{Math.round(pair.priceSpread)}¢</span>
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-gray-400 text-xl">{isExpanded ? '▼' : '▶'}</span>
                        </div>
                        
                        {/* Markets Overview */}
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="bg-black/30 rounded p-3">
                            <div className="text-xs text-blue-400 mb-1">KALSHI</div>
                            <div className="font-mono text-xs text-gray-500">{pair.kalshi.ticker}</div>
                            <div className="text-sm text-white mt-1">{pair.kalshi.question}</div>
                            {pair.kalshi.price !== undefined && (
                              <div className="text-emerald-400 font-mono mt-1">
                                {Math.round(pair.kalshi.price * 100)}¢
                              </div>
                            )}
                          </div>
                          <div className="bg-black/30 rounded p-3">
                            <div className="text-xs text-purple-400 mb-1">POLYMARKET</div>
                            <div className="font-mono text-xs text-gray-500 truncate">{pair.polymarket.id}</div>
                            <div className="text-sm text-white mt-1">{pair.polymarket.question}</div>
                            {pair.polymarket.price !== undefined && (
                              <div className="text-emerald-400 font-mono mt-1">
                                {Math.round(pair.polymarket.price * 100)}¢
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="border-t border-gray-700/50 p-4">
                          <h4 className="text-sm font-semibold text-gray-400 mb-3">
                            ⚠️ Detected Misalignments ({pair.verification.misalignments.length})
                          </h4>
                          
                          {pair.verification.misalignments.length === 0 ? (
                            <p className="text-emerald-400 text-sm">
                              ✅ No misalignments detected - markets appear equivalent
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {pair.verification.misalignments.map((m, j) => (
                                <div
                                  key={j}
                                  className={`p-3 rounded bg-black/30 border ${
                                    m.severity === 'CRITICAL' ? 'border-red-500/50' :
                                    m.severity === 'HIGH' ? 'border-orange-500/50' :
                                    m.severity === 'MEDIUM' ? 'border-yellow-500/50' :
                                    'border-gray-600/50'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 mb-1">
                                    <span>{getMisalignmentIcon(m.type)}</span>
                                    <span className="font-medium text-white">{m.type.replace(/_/g, ' ')}</span>
                                    <span className={`text-xs px-2 py-0.5 rounded ${
                                      m.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-400' :
                                      m.severity === 'HIGH' ? 'bg-orange-500/20 text-orange-400' :
                                      m.severity === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400' :
                                      'bg-gray-500/20 text-gray-400'
                                    }`}>
                                      {m.severity}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-300">{m.description}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="market-card p-6">
            <h3 className="text-lg font-semibold mb-2 text-pink-400">📝 Summary</h3>
            <p className="text-gray-300">{result.summary}</p>
            {result.meta && (
              <p className="text-xs text-gray-500 mt-2">
                Verification completed in {result.meta.durationMs}ms
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

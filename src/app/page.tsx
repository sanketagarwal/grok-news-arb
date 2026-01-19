'use client';

import { useState } from 'react';

interface MarketSignal {
  platform: string;
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

interface AnalysisResult {
  headline: string;
  analysis?: {
    category: string;
    magnitude: number;
    direction: string;
    confidence: number;
    summary: string;
  };
  markets: MarketSignal[];
  summary: string;
  meta?: {
    durationMs: number;
  };
}

export default function Home() {
  const [headline, setHeadline] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyze = async () => {
    if (!headline.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headline, mode: 'quick' }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Analysis failed');
      }
      
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-8">
      {/* Header */}
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-emerald-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent">
            🚀 Grok News Arbitrage
          </h1>
          <p className="text-gray-400">
            Real-time news → Prediction market signals via Grok Live Search
          </p>
        </div>

        {/* Input */}
        <div className="market-card p-6 mb-8">
          <label className="block text-sm text-gray-400 mb-2">
            📰 Enter Breaking News Headline
          </label>
          <div className="flex gap-4">
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && analyze()}
              placeholder="e.g., Fed cuts rates 25bps"
              className="flex-1 bg-black/50 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            <button
              onClick={analyze}
              disabled={loading || !headline.trim()}
              className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-lg font-semibold text-black hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '⏳ Analyzing...' : '🔍 Analyze'}
            </button>
          </div>
          
          {/* Quick examples */}
          <div className="mt-4 flex gap-2 flex-wrap">
            <span className="text-xs text-gray-500">Try:</span>
            {[
              'Fed cuts rates 25bps',
              'Bitcoin ETF approved',
              'CPI comes in hot at 4%',
              'Russia-Ukraine ceasefire announced',
            ].map((example) => (
              <button
                key={example}
                onClick={() => setHeadline(example)}
                className="text-xs px-2 py-1 bg-gray-800 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="market-card p-4 mb-8 border-red-500/50 bg-red-900/20">
            <p className="text-red-400">❌ {error}</p>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-6">
            {/* Analysis */}
            {result.analysis && (
              <div className="market-card p-6">
                <h2 className="text-lg font-semibold mb-4 text-cyan-400">📊 News Analysis</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <span className="text-xs text-gray-500 block">Category</span>
                    <span className="text-yellow-400 font-medium">{result.analysis.category}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block">Magnitude</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500"
                          style={{ width: `${result.analysis.magnitude * 100}%` }}
                        />
                      </div>
                      <span className="text-sm">{Math.round(result.analysis.magnitude * 100)}%</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block">Direction</span>
                    <span className={`font-medium ${
                      result.analysis.direction === 'positive' ? 'text-green-400' :
                      result.analysis.direction === 'negative' ? 'text-red-400' : 'text-gray-400'
                    }`}>
                      {result.analysis.direction === 'positive' ? '📈' : 
                       result.analysis.direction === 'negative' ? '📉' : '➡️'} {result.analysis.direction}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block">Confidence</span>
                    <span className={`font-medium ${
                      result.analysis.confidence > 0.7 ? 'text-green-400' :
                      result.analysis.confidence > 0.4 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {Math.round(result.analysis.confidence * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Markets */}
            <div className="market-card p-6">
              <h2 className="text-lg font-semibold mb-4 text-emerald-400">
                🎯 Affected Markets ({result.markets.length})
              </h2>
              
              {result.markets.length === 0 ? (
                <p className="text-gray-500">No significant arbitrage opportunities found.</p>
              ) : (
                <div className="space-y-4">
                  {result.markets.map((market, i) => (
                    <div 
                      key={i} 
                      className={`p-4 rounded-lg border ${
                        market.edge > 0 ? 'border-emerald-500/30 bg-emerald-900/10' : 'border-red-500/30 bg-red-900/10'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-medium text-white">{market.question}</h3>
                          <span className="text-xs text-gray-500">
                            {market.platform.toUpperCase()} • {market.ticker}
                          </span>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                          market.signal === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' :
                          market.signal === 'SELL' ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {market.action}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500 block">Current</span>
                          <span className="font-mono">{Math.round(market.currentPrice * 100)}¢</span>
                        </div>
                        <div>
                          <span className="text-gray-500 block">Fair Value</span>
                          <span className="font-mono">{Math.round(market.fairValue * 100)}¢</span>
                        </div>
                        <div>
                          <span className="text-gray-500 block">Edge</span>
                          <span className={`font-mono font-bold ${market.edge > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {market.edge > 0 ? '+' : ''}{Math.round(market.edgePercent)}%
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 block">Size</span>
                          <span className="font-mono">${market.suggestedSize}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 block">Confidence</span>
                          <span className={`font-mono ${
                            market.confidence === 'HIGH' ? 'text-emerald-400' :
                            market.confidence === 'MEDIUM' ? 'text-yellow-400' : 'text-gray-400'
                          }`}>{market.confidence}</span>
                        </div>
                      </div>
                      
                      <div className="mt-3 pt-3 border-t border-gray-700/50 text-xs text-gray-500">
                        Entry: {Math.round(market.entryPrice * 100)}¢ • 
                        Target: {Math.round(market.targetPrice * 100)}¢ • 
                        Stop: {Math.round(market.stopLoss * 100)}¢
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Summary */}
            <div className="market-card p-6">
              <h2 className="text-lg font-semibold mb-2 text-purple-400">📝 Summary</h2>
              <p className="text-gray-300">{result.summary}</p>
              {result.meta && (
                <p className="text-xs text-gray-500 mt-2">
                  Analysis completed in {result.meta.durationMs}ms
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

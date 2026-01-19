/**
 * API Route: News Arbitrage Agent
 * POST /api/agent
 */

import { NextRequest, NextResponse } from 'next/server';
import { quickAnalyze, runArbitrageAgent } from '@/lib/agents/arbitrage-agent';

export const maxDuration = 60; // 60 seconds max

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { headline, mode = 'quick' } = body;

    if (!headline || typeof headline !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid headline' },
        { status: 400 }
      );
    }

    console.log(`[Agent] Analyzing: "${headline}" (mode: ${mode})`);
    const startTime = Date.now();

    let result;
    if (mode === 'full') {
      // Full agent with multi-step reasoning
      result = await runArbitrageAgent(headline);
    } else {
      // Quick analysis with direct tool calls
      result = await quickAnalyze(headline);
    }

    const duration = Date.now() - startTime;
    console.log(`[Agent] Completed in ${duration}ms, found ${result.markets.length} opportunities`);

    return NextResponse.json({
      success: true,
      ...result,
      meta: {
        mode,
        durationMs: duration,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Agent] Error:', error);
    return NextResponse.json(
      { 
        error: 'Agent execution failed', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    name: 'News-Lag Arbitrage Agent',
    version: '1.0.0',
    endpoints: {
      analyze: {
        method: 'POST',
        body: {
          headline: 'string (required)',
          mode: "'quick' | 'full' (default: 'quick')",
        },
      },
    },
    example: {
      curl: `curl -X POST http://localhost:3000/api/agent -H "Content-Type: application/json" -d '{"headline": "Fed cuts rates 25bps"}'`,
    },
  });
}

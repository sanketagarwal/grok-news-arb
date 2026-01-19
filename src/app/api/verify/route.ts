/**
 * API Route: Market Verification
 * 
 * POST /api/verify
 * - topic: Search for matching markets and verify
 * - pair: Verify specific market pair
 */

import { NextRequest, NextResponse } from 'next/server';
import { runVerificationAgent, quickVerify } from '@/lib/agents/verification-agent';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const { mode, topic, kalshiTicker, polymarketId } = body;
    
    if (mode === 'pair' && kalshiTicker && polymarketId) {
      // Quick verify specific pair
      const result = await quickVerify(kalshiTicker, polymarketId);
      
      return NextResponse.json({
        success: true,
        mode: 'pair',
        result,
        meta: {
          durationMs: Date.now() - startTime,
        },
      });
    } else if (topic) {
      // Full topic search and verification
      const result = await runVerificationAgent(topic);
      
      return NextResponse.json({
        success: true,
        mode: 'topic',
        ...result,
        meta: {
          durationMs: Date.now() - startTime,
        },
      });
    } else {
      return NextResponse.json(
        { error: 'Missing required parameters: topic or (kalshiTicker, polymarketId)' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Verification error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Verification failed' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    service: 'Market Verification API',
    endpoints: {
      'POST /api/verify': {
        description: 'Verify market pairs across Kalshi and Polymarket',
        params: {
          'mode': 'topic | pair',
          'topic': 'Search topic (for mode=topic)',
          'kalshiTicker': 'Kalshi market ticker (for mode=pair)',
          'polymarketId': 'Polymarket condition ID (for mode=pair)',
        },
      },
    },
  });
}

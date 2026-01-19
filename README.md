# 🚀 Grok News-Lag Arbitrage Engine

**Real-time breaking news → prediction market arbitrage signals**

An AI agent built with **Vercel AI SDK** that monitors X/Twitter via **Grok API Live Search**, maps news events to Kalshi/Polymarket markets using semantic search, and generates trade signals before prices fully adjust.

![Demo](https://img.shields.io/badge/Status-Night%201%20Demo-green)
![Framework](https://img.shields.io/badge/Framework-Vercel%20AI%20SDK-black)
![License](https://img.shields.io/badge/License-MIT-blue)

## 🎯 What It Does

```
Breaking News → Grok Live Search → Semantic Match → Find Markets → Fair Value → Trade Signals
      ↓              ↓                  ↓              ↓            ↓            ↓
"Fed cuts     Search X/Twitter    Match to         Kalshi &    Estimate    "BUY YES
 rates"       for confirmation    market topics    Polymarket  new price    @ 72¢"
```

### Night-1 Demo

A CLI that:
1. Takes a news headline ("Fed cuts rates 25bps")
2. Uses Grok Live Search to analyze/verify the news
3. Finds 5 affected markets across Kalshi + Polymarket
4. Fetches current prices
5. Outputs **fair value shift estimate** vs current price with entry recommendations

## 💰 Expected Value

| Scenario | Daily EV |
|----------|----------|
| Best days (multiple news events) | $200-500 |
| Typical days | $20-100 |
| Quiet days | $0 |

**Constraints:** $100-250 max position before slippage, edge depends on speed

---

## ⚡ Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/grok-news-arb.git
cd grok-news-arb
npm install
```

### 2. Configure API Keys

```bash
cp env.example .env
```

Edit `.env` with your API keys (see [Required API Keys](#-required-api-keys) below).

### 3. Run CLI Demo

```bash
# Analyze a headline
npm run cli -- --headline "Fed cuts rates 25bps"

# Interactive mode
npm run cli -- --interactive
```

### 4. Run Web UI

```bash
npm run dev
# Open http://localhost:3000
```

---

## 🔑 Required API Keys

| Key | Purpose | Get It |
|-----|---------|--------|
| `GROK_API_KEY` | Grok Live Search (X/Twitter data) | [console.x.ai](https://console.x.ai/) |
| `OPENAI_API_KEY` | Embeddings & AI Gateway | [platform.openai.com](https://platform.openai.com/) |
| `REPLAY_LABS_API_KEY` | **Unified Polymarket + Kalshi API with semantic search** | Provided |
| `KALSHI_API_KEY` | Kalshi market data (fallback) | [kalshi.com](https://kalshi.com/) → Settings → API |
| `POLYMARKET_API_KEY` | Polymarket data (fallback) | [polymarket.com](https://polymarket.com/) |

### ⭐ Replay Labs (Primary Market Discovery)

Replay Labs provides a **unified API** with:
- **Semantic search** across Polymarket + Kalshi using vector similarity
- **Market overlap detection** for cross-venue arbitrage
- **Real-time prices** with JIIT caching
- **Price history** for backtesting

### env.example

```env
# Grok / xAI (REQUIRED)
GROK_API_KEY=xai-xxxxxxxxxxxxxxxx

# OpenAI for embeddings (REQUIRED)
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxx

# AI Model (uses Vercel AI Gateway format)
AI_MODEL=openai/gpt-4o

# Replay Labs - Unified Polymarket + Kalshi API (RECOMMENDED)
REPLAY_LABS_API_KEY=rn_xxxxxxxxxxxxx
REPLAY_LABS_BASE_URL=https://api.replaylab.io

# Kalshi (fallback if not using Replay Labs)
KALSHI_API_KEY=your_kalshi_key

# Polymarket (fallback if not using Replay Labs)
POLYMARKET_API_KEY=your_polymarket_key
```

---

## 📁 Project Structure

```
grok-news-arb/
├── src/
│   ├── app/                    # Next.js app
│   │   ├── api/agent/route.ts  # API endpoint
│   │   └── page.tsx            # Web UI
│   ├── lib/
│   │   ├── tools/              # Vercel AI SDK tools
│   │   │   ├── grok-search.ts  # Grok Live Search
│   │   │   ├── kalshi.ts       # Kalshi markets
│   │   │   ├── polymarket.ts   # Polymarket
│   │   │   └── fair-value.ts   # Fair value estimation
│   │   └── agents/
│   │       └── arbitrage-agent.ts  # Main agent
│   └── cli.ts                  # CLI interface
├── package.json
├── env.example
└── README.md
```

---

## 🛠️ Architecture

Built with **Vercel AI SDK** using the `tool()` function pattern:

```typescript
import { generateText, tool, stepCountIs } from 'ai';
import { z } from 'zod';

// Define tools
const searchKalshiMarkets = tool({
  description: 'Search Kalshi prediction markets by keyword',
  parameters: z.object({
    query: z.string(),
    limit: z.number().default(10),
  }),
  execute: async ({ query, limit }) => {
    // Fetch from Kalshi API
  },
});

// Run agent with multi-step reasoning
const result = await generateText({
  model: 'openai/gpt-4o',
  prompt: 'Find arbitrage opportunities for: "Fed cuts rates 25bps"',
  tools: {
    searchKalshiMarkets,
    searchPolymarketMarkets,
    estimateFairValue,
    generateTradeRecommendation,
  },
  stopWhen: stepCountIs(10),
});
```

### Tools Available

| Tool | Description |
|------|-------------|
| `searchBreakingNews` | Search X/Twitter via Grok Live Search |
| `analyzeHeadline` | Analyze news for market impact |
| `verifyNews` | Verify headline against X posts |
| **`semanticSearchMarkets`** | **Semantic search across Polymarket + Kalshi (Replay Labs)** |
| **`getMarketPrice`** | **Get real-time prices (Replay Labs)** |
| **`findMarketOverlaps`** | **Find cross-venue arbitrage opportunities (Replay Labs)** |
| `searchKalshiMarkets` | Search Kalshi markets (fallback) |
| `searchPolymarketMarkets` | Search Polymarket markets (fallback) |
| `estimateFairValue` | Estimate fair value given news |
| `generateTradeRecommendation` | Generate trade signal |

---

## 📊 Sample Output

```
╔═══════════════════════════════════════════════════════════════════════╗
║  🚀 GROK NEWS-LAG ARBITRAGE ENGINE                                    ║
╚═══════════════════════════════════════════════════════════════════════╝

📰 HEADLINE: "Fed cuts interest rates by 25 basis points"

📊 NEWS ANALYSIS:
   Category:   federal_reserve
   Magnitude:  ████████░░ 80%
   Direction:  📈 POSITIVE
   Confidence: HIGH (85%)

🎯 TOP AFFECTED MARKETS:

┌────────────────────────────────────────────────────────────────────┐
│ 1. Will Fed cut rates in January 2026? (Kalshi)                    │
│    Platform: KALSHI | Ticker: FED-26JAN-T4.50                      │
├────────────────────────────────────────────────────────────────────┤
│ Current: 72¢  │  Fair Value: 89¢  │  Edge: +17%                    │
│ 💹 SIGNAL: BUY YES                                                  │
│ Entry: 74¢  │  Target: 89¢  │  Stop: 60¢                           │
│ Size: $250  │  Confidence: HIGH                                    │
└────────────────────────────────────────────────────────────────────┘

📝 SUMMARY:
Found 3 arbitrage opportunities: 2 BUY signals, 1 SELL signal.
Best opportunity: Fed rate cut market with 17% edge.
```

---

## 🚀 API Usage

```bash
# Analyze a headline
curl -X POST http://localhost:3000/api/agent \
  -H "Content-Type: application/json" \
  -d '{"headline": "Fed cuts rates 25bps", "mode": "quick"}'
```

Response:
```json
{
  "success": true,
  "headline": "Fed cuts rates 25bps",
  "analysis": {
    "category": "federal_reserve",
    "magnitude": 0.8,
    "direction": "positive",
    "confidence": 0.85
  },
  "markets": [
    {
      "platform": "kalshi",
      "ticker": "FED-26JAN-T4.50",
      "question": "Will Fed cut rates in January 2026?",
      "currentPrice": 0.72,
      "fairValue": 0.89,
      "edge": 0.17,
      "signal": "BUY",
      "action": "BUY YES",
      "suggestedSize": 250,
      "confidence": "HIGH"
    }
  ],
  "summary": "Found 3 arbitrage opportunities with 17% best edge."
}
```

---

## 📈 Roadmap

- [x] **Night 1:** CLI demo with manual headline input
- [ ] **Week 1:** Live Grok monitoring + auto-detection
- [ ] **Week 2:** Backtesting framework
- [ ] **Week 3:** Auto-execution + risk management
- [ ] **Week 4:** Dashboard + Telegram/Discord alerts

---

## ⚠️ Disclaimers

- This is experimental trading software. Use at your own risk.
- Prediction markets have regulatory restrictions in some jurisdictions.
- Past performance does not guarantee future results.
- The edge depends on execution speed and market conditions.

---

## 📜 License

MIT License

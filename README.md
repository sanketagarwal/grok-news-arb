# 🚀 Grok News-Lag Arbitrage Engine

**When news breaks, find which prediction markets are affected before prices move.**

---

## What This Does (Simple Version)

> "When news breaks, this bot instantly finds which betting markets are affected and tells you what to buy before the price moves."

---

## How It Works (Step by Step)

```
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 1: NEWS HAPPENS                                               │
│                                                                      │
│  📰 "Fed cuts interest rates by 25 basis points"                    │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 2: FIND AFFECTED MARKETS                                      │
│                                                                      │
│  🔍 Semantic search across Polymarket + Kalshi                      │
│                                                                      │
│  Found:                                                              │
│  • "Will Fed cut rates in January?" (Polymarket) - 64% match        │
│  • "Will Fed cut rates by 25bps at September meeting?" (Kalshi)     │
│  • "Will inflation be above 3%?" (Kalshi)                           │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 3: CHECK CURRENT PRICES                                       │
│                                                                      │
│  💰 "Will Fed cut rates in January?"                                │
│     Current price: 65¢ (market thinks 65% chance)                   │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 4: CALCULATE FAIR VALUE                                       │
│                                                                      │
│  🧮 News says it HAPPENED → probability is ~99%                     │
│     Fair value: 99¢                                                  │
│     Current price: 65¢                                               │
│     Edge: +34¢ (52% profit opportunity!)                            │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 5: GENERATE TRADE SIGNAL                                      │
│                                                                      │
│  💹 STRONG BUY YES                                                   │
│     Entry: ≤67¢                                                      │
│     Target: 99¢                                                      │
│     Stop Loss: 53¢                                                   │
│     Size: $250                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Why This Makes Money

```
Timeline:

T+0 seconds:    📰 News breaks: "Fed cuts rates"
                Market price: 65¢
                
T+5 seconds:    🤖 YOUR BOT sees news, finds market, calculates edge
                YOU BUY at 65¢
                
T+30 seconds:   📱 Traders start reading news
                Price rises to 75¢
                
T+2 minutes:    📈 Everyone knows now
                Price rises to 90¢
                
T+10 minutes:   ✅ Market fully adjusts
                Price settles at 99¢
                
                💰 YOU PROFIT: 34¢ per contract (52% return)
```

**You're faster than humans** who need to see news → think → search → decide.

---

## Quick Start

### 1. Install

```bash
git clone https://github.com/sanketagarwal/grok-news-arb.git
cd grok-news-arb
npm install
```

### 2. Configure

```bash
cp env.example .env
# Edit .env with your API keys
```

### 3. Run

```bash
# Test with sample headlines (see real Polymarket + Kalshi markets!)
npm run test-monitor

# Analyze a specific headline
npm run cli -- --headline "Fed cuts rates 25bps"

# Start live monitoring
npm run monitor
```

---

## Sample Output

```
╔═══════════════════════════════════════════════════════════════════════╗
║  📡 GROK NEWS-LAG ARBITRAGE - LIVE MONITOR                            ║
╚═══════════════════════════════════════════════════════════════════════╝

📰 "Fed cuts interest rates by 25 basis points at FOMC meeting"
   Category: federal_reserve | 🟡 MEDIUM

🎯 AFFECTED MARKETS:

┌────────────────────────────────────────────────────────────────────────┐
│ [POLYMARKET] Fed decreases interest rates by 25 bps after January 20  │
│ Match: 64%                                                             │
├────────────────────────────────────────────────────────────────────────┤
│ Current: 50¢    │ Fair Value: 48¢    │ Edge: -2¢ (-4.8%)              │
│ ⏸️  HOLD - Edge too small for confident trade                          │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│ [KALSHI] Will the Fed cut rates 1 times at emergency meetings?        │
│ Match: 60%                                                             │
├────────────────────────────────────────────────────────────────────────┤
│ Current: 70¢    │ Fair Value: 85¢    │ Edge: +15¢ (+21.8%)            │
│ 💹 STRONG_BUY YES    Confidence: HIGH    Size: $250                   │
│ Entry: ≤72¢    Target: 85¢     Stop: 58¢                              │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Required API Keys

| Key | What It Does | 
|-----|--------------|
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway - access to GPT-4, Grok, Claude |
| `REPLAY_LABS_API_KEY` | Semantic search across Polymarket + Kalshi |

```env
# .env file
AI_GATEWAY_API_KEY=vck_xxxxxxxxxxxxx
REPLAY_LABS_API_KEY=rn_xxxxxxxxxxxxx
REPLAY_LABS_BASE_URL=https://replay-lab-delta.preview.recall.network
```

---

## What's Built vs What's Not

| ✅ Built | ❌ Not Built (Future) |
|----------|----------------------|
| News → Market matching | Auto-trading |
| Semantic search (real Polymarket + Kalshi) | Live news feed from Grok |
| Fair value calculation | Position tracking |
| Trade signals with entry/stop/target | Risk management |
| CLI + Web UI | P&L dashboard |

---

## Commands

| Command | What It Does |
|---------|--------------|
| `npm run test-monitor` | Test with 5 sample headlines |
| `npm run monitor` | Start live news monitoring |
| `npm run cli -- --headline "..."` | Analyze specific headline |
| `npm run dev` | Start web UI at localhost:3000 |

---

## Tech Stack

- **Vercel AI SDK** - AI agent framework with tool calling
- **Replay Labs API** - Semantic search across prediction markets
- **Vercel AI Gateway** - Unified access to GPT-4, Grok, Claude
- **Next.js** - Web UI
- **TypeScript** - Type safety

---

## Project Structure

```
grok-news-arb/
├── src/
│   ├── monitor.ts              # Live monitoring CLI
│   ├── cli.ts                  # One-time analysis CLI
│   ├── lib/
│   │   ├── services/
│   │   │   └── news-monitor.ts # Core monitoring logic
│   │   ├── tools/              # AI tools (search, fair value, etc.)
│   │   └── agents/             # AI agents
│   └── app/                    # Next.js web UI
├── .env                        # Your API keys (not committed)
├── env.example                 # Example env file
└── package.json
```

---

## License

MIT

---

## Disclaimer

This is experimental software. Prediction markets have regulatory restrictions in some jurisdictions. Use at your own risk.

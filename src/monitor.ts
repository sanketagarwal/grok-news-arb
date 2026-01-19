#!/usr/bin/env npx tsx
/**
 * Live News Monitor CLI
 * 
 * Continuously monitors for breaking news and finds affected prediction markets.
 * 
 * Usage:
 *   npm run monitor                    # Start live monitoring
 *   npm run monitor -- --test          # Test with a sample headline
 *   npm run monitor -- --headline "Fed cuts rates"  # Analyze specific headline
 */

import 'dotenv/config';
import { Command } from 'commander';
import chalk from 'chalk';
import { startMonitoring, analyzeOnce, NewsWithMarkets } from './lib/services/news-monitor';

const program = new Command();

program
  .name('news-monitor')
  .description('Live news monitoring → prediction market matching')
  .version('1.0.0');

program
  .option('-t, --test', 'Test with sample headlines')
  .option('-h, --headline <text>', 'Analyze a specific headline')
  .option('-i, --interval <seconds>', 'Poll interval in seconds', '30')
  .option('--max-markets <n>', 'Max markets per news item', '5')
  .action(async (options) => {
    printHeader();
    
    // Check API keys
    const missingKeys = checkApiKeys();
    if (missingKeys.length > 0) {
      console.log(chalk.yellow('\n⚠️  Missing API keys (will use mock data):'));
      missingKeys.forEach(key => console.log(chalk.yellow(`   - ${key}`)));
      console.log('');
    }
    
    if (options.test) {
      await runTests();
    } else if (options.headline) {
      await analyzeHeadline(options.headline);
    } else {
      await runLiveMonitor({
        pollIntervalMs: parseInt(options.interval) * 1000,
        maxMarketsPerNews: parseInt(options.maxMarkets),
      });
    }
  });

function printHeader() {
  console.log(chalk.cyan.bold(`
╔═══════════════════════════════════════════════════════════════════════╗
║  📡 GROK NEWS-LAG ARBITRAGE - LIVE MONITOR                            ║
║  Continuous news → prediction market matching                         ║
╚═══════════════════════════════════════════════════════════════════════╝
`));
}

function checkApiKeys(): string[] {
  const missing: string[] = [];
  
  if (!process.env.AI_GATEWAY_API_KEY) {
    missing.push('AI_GATEWAY_API_KEY (Vercel AI Gateway)');
  }
  if (!process.env.REPLAY_LABS_API_KEY) {
    missing.push('REPLAY_LABS_API_KEY (Semantic search)');
  }
  
  return missing;
}

async function runTests() {
  console.log(chalk.green.bold('🧪 RUNNING TEST MODE\n'));
  
  const testHeadlines = [
    'Fed cuts interest rates by 25 basis points at FOMC meeting',
    'Bitcoin surges past $100,000 for the first time in history',
    'SEC approves spot Ethereum ETF applications',
    'CPI inflation comes in hot at 4.2%, above expectations',
    'Trump announces tariffs on Chinese imports',
  ];
  
  for (const headline of testHeadlines) {
    console.log(chalk.gray('─'.repeat(70)));
    await analyzeHeadline(headline);
    console.log('');
  }
  
  console.log(chalk.green.bold('\n✅ Tests complete!'));
}

async function analyzeHeadline(headline: string) {
  console.log(chalk.white.bold('📰 HEADLINE:'));
  console.log(chalk.white(`   "${headline}"\n`));
  
  const startTime = Date.now();
  
  try {
    const result = await analyzeOnce(headline);
    printNewsResult(result);
  } catch (error) {
    console.log(chalk.red(`   ❌ Error: ${error}`));
  }
}

async function runLiveMonitor(options: { pollIntervalMs: number; maxMarketsPerNews: number }) {
  console.log(chalk.green.bold('🔴 STARTING LIVE MONITOR\n'));
  console.log(chalk.gray(`   Poll interval: ${options.pollIntervalMs / 1000}s`));
  console.log(chalk.gray(`   Max markets: ${options.maxMarketsPerNews}`));
  console.log(chalk.gray('   Press Ctrl+C to stop\n'));
  console.log(chalk.gray('─'.repeat(70)));
  
  const stop = await startMonitoring(
    // On news detected
    (result: NewsWithMarkets) => {
      console.log('');
      printNewsResult(result);
      console.log(chalk.gray('─'.repeat(70)));
    },
    // On status update
    (status: string) => {
      console.log(chalk.gray(status));
    },
    options
  );
  
  // Handle Ctrl+C
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n\n⏹️  Stopping monitor...'));
    stop();
    process.exit(0);
  });
}

function printNewsResult(result: NewsWithMarkets) {
  const { news, affectedMarkets, analysisTime } = result;
  
  // News header
  const magnitudeColor = news.magnitude === 'HIGH' ? chalk.red : 
                         news.magnitude === 'MEDIUM' ? chalk.yellow : chalk.gray;
  const magnitudeIcon = news.magnitude === 'HIGH' ? '🔴' : 
                        news.magnitude === 'MEDIUM' ? '🟡' : '⚪';
  
  console.log(chalk.cyan(`[${new Date().toLocaleTimeString()}] `) + 
              chalk.white.bold(`📰 ${news.headline}`));
  console.log(chalk.gray(`   Source: ${news.source} | `) +
              chalk.blue(`Category: ${news.category} | `) +
              magnitudeColor(`${magnitudeIcon} ${news.magnitude}`));
  
  // Affected markets
  if (affectedMarkets.length === 0) {
    console.log(chalk.yellow('\n   ⚠️  No matching prediction markets found'));
  } else {
    console.log(chalk.green.bold('\n   🎯 AFFECTED MARKETS:'));
    
    affectedMarkets.forEach((market, i) => {
      const venueColor = market.venue === 'KALSHI' ? chalk.blue : chalk.magenta;
      const scoreColor = market.similarityScore > 0.85 ? chalk.green : 
                         market.similarityScore > 0.7 ? chalk.yellow : chalk.gray;
      
      const prefix = i === affectedMarkets.length - 1 ? '└─' : '├─';
      
      console.log(
        chalk.gray(`   ${prefix} `) +
        venueColor(`[${market.venue.padEnd(10)}] `) +
        chalk.white(`"${market.question}"`) +
        scoreColor(` ${Math.round(market.similarityScore * 100)}% match`)
      );
    });
  }
  
  console.log(chalk.gray(`\n   ⏱️  Analysis time: ${analysisTime}ms`));
}

// Run
program.parse();

#!/usr/bin/env npx tsx
/**
 * CLI for News-Lag Arbitrage Agent
 * Usage: npx tsx src/cli.ts --headline "Fed cuts rates 25bps"
 */

import 'dotenv/config';
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { quickAnalyze } from './lib/agents/arbitrage-agent';

const program = new Command();

program
  .name('grok-arb')
  .description('News-Lag Arbitrage Engine - Find prediction market opportunities from breaking news')
  .version('1.0.0');

program
  .option('-h, --headline <text>', 'News headline to analyze')
  .option('-i, --interactive', 'Interactive mode')
  .option('-m, --mode <mode>', 'Analysis mode: quick or full', 'quick')
  .action(async (options) => {
    console.log(chalk.cyan.bold(`
╔═══════════════════════════════════════════════════════════════════════╗
║  🚀 GROK NEWS-LAG ARBITRAGE ENGINE                                    ║
║  Real-time news → Prediction market signals                           ║
╚═══════════════════════════════════════════════════════════════════════╝
`));

    if (options.interactive) {
      await interactiveMode();
    } else if (options.headline) {
      await analyzeHeadline(options.headline);
    } else {
      // Demo with sample headline
      console.log(chalk.yellow('No headline provided. Running demo...\n'));
      await analyzeHeadline('Fed cuts interest rates by 25 basis points');
    }
  });

async function analyzeHeadline(headline: string) {
  console.log(chalk.white.bold('📰 HEADLINE:'));
  console.log(chalk.white(`   "${headline}"\n`));

  const spinner = ora('Analyzing news and searching markets...').start();

  try {
    const startTime = Date.now();
    const result = await quickAnalyze(headline);
    const duration = Date.now() - startTime;

    spinner.succeed(`Analysis complete in ${duration}ms`);

    // Display analysis
    if (result.analysis) {
      console.log(chalk.cyan.bold('\n📊 NEWS ANALYSIS:'));
      console.log(chalk.gray('─'.repeat(60)));
      console.log(`   Category:   ${chalk.yellow(result.analysis.category || 'unknown')}`);
      console.log(`   Magnitude:  ${formatMagnitude(result.analysis.magnitude || 0)}`);
      console.log(`   Direction:  ${formatDirection(result.analysis.direction || 'neutral')}`);
      console.log(`   Confidence: ${formatConfidence(result.analysis.confidence || 0)}`);
      if (result.analysis.summary) {
        console.log(`   Summary:    ${chalk.white(result.analysis.summary)}`);
      }
    }

    // Display market signals
    console.log(chalk.green.bold('\n🎯 TOP AFFECTED MARKETS:\n'));

    if (result.markets.length === 0) {
      console.log(chalk.yellow('   No significant arbitrage opportunities found.\n'));
    } else {
      result.markets.forEach((market, index) => {
        console.log(chalk.cyan(`┌${'─'.repeat(68)}┐`));
        console.log(chalk.cyan(`│ ${chalk.bold(`${index + 1}. ${market.question.slice(0, 58).padEnd(58)}`)} │`));
        console.log(chalk.cyan(`│ ${chalk.gray(`Platform: ${market.platform.toUpperCase()} | Ticker: ${market.ticker}`.padEnd(66))} │`));
        console.log(chalk.cyan(`├${'─'.repeat(68)}┤`));
        
        const priceStr = `Current: ${formatPrice(market.currentPrice)}  │  Fair Value: ${formatPrice(market.fairValue)}  │  Edge: ${formatEdge(market.edge, market.edgePercent)}`;
        console.log(chalk.cyan(`│ ${priceStr.padEnd(66)} │`));
        
        const signalStr = `${formatSignal(market.signal, market.action)}`;
        console.log(chalk.cyan(`│ ${signalStr.padEnd(76)} │`));
        
        const detailsStr = `Entry: ${formatPrice(market.entryPrice)}  │  Target: ${formatPrice(market.targetPrice)}  │  Stop: ${formatPrice(market.stopLoss)}`;
        console.log(chalk.cyan(`│ ${detailsStr.padEnd(66)} │`));
        
        const sizeStr = `Size: $${market.suggestedSize}  │  Confidence: ${market.confidence}`;
        console.log(chalk.cyan(`│ ${sizeStr.padEnd(66)} │`));
        
        console.log(chalk.cyan(`└${'─'.repeat(68)}┘\n`));
      });
    }

    // Summary
    console.log(chalk.white.bold('📝 SUMMARY:'));
    console.log(chalk.gray('─'.repeat(60)));
    console.log(`   ${result.summary}\n`);

  } catch (error) {
    spinner.fail('Analysis failed');
    console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : 'Unknown error'}`));
    console.log(chalk.yellow('\nMake sure your API keys are configured in .env'));
  }
}

async function interactiveMode() {
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(chalk.green('Interactive mode. Enter headlines to analyze (type "exit" to quit)\n'));

  const prompt = () => {
    rl.question(chalk.cyan('📰 Enter headline: '), async (input) => {
      const headline = input.trim();
      
      if (headline.toLowerCase() === 'exit') {
        console.log(chalk.yellow('\nGoodbye! 👋\n'));
        rl.close();
        return;
      }

      if (headline) {
        await analyzeHeadline(headline);
      }
      
      prompt();
    });
  };

  prompt();
}

// Formatting helpers
function formatPrice(price: number): string {
  const cents = Math.round(price * 100);
  return chalk.white(`${cents}¢`);
}

function formatEdge(edge: number, percent: number): string {
  const sign = edge > 0 ? '+' : '';
  const color = edge > 0.1 ? chalk.green.bold : edge > 0.05 ? chalk.green : edge > 0 ? chalk.yellow : chalk.red;
  return color(`${sign}${Math.round(percent)}%`);
}

function formatSignal(signal: string, action: string): string {
  const icon = signal === 'BUY' ? '💹' : signal === 'SELL' ? '📉' : '⏸️';
  const color = signal === 'BUY' ? chalk.green.bold : signal === 'SELL' ? chalk.red.bold : chalk.gray;
  return `${icon} SIGNAL: ${color(action)}`;
}

function formatMagnitude(mag: number): string {
  const bars = '█'.repeat(Math.round(mag * 10)) + '░'.repeat(10 - Math.round(mag * 10));
  const color = mag > 0.7 ? chalk.red : mag > 0.4 ? chalk.yellow : chalk.green;
  return color(`${bars} ${Math.round(mag * 100)}%`);
}

function formatDirection(dir: string): string {
  const colors: Record<string, typeof chalk.green> = {
    positive: chalk.green,
    negative: chalk.red,
    neutral: chalk.gray,
  };
  const icons: Record<string, string> = {
    positive: '📈',
    negative: '📉',
    neutral: '➡️',
  };
  return `${icons[dir] || '❓'} ${(colors[dir] || chalk.white)(dir.toUpperCase())}`;
}

function formatConfidence(conf: number): string {
  const label = conf > 0.8 ? 'HIGH' : conf > 0.5 ? 'MEDIUM' : 'LOW';
  const color = conf > 0.8 ? chalk.green : conf > 0.5 ? chalk.yellow : chalk.red;
  return color(`${label} (${Math.round(conf * 100)}%)`);
}

program.parse();

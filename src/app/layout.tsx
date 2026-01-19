import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Grok News Arbitrage',
  description: 'Real-time news → prediction market arbitrage signals',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-arb-dark min-h-screen">{children}</body>
    </html>
  );
}

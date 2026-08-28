import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Vegam | Universal Event & Telemetry Simulation Platform',
  description: 'Production-grade stateless event simulation, surprisal I(x) anomaly scoring, Markov DAG choreography, and BYOB multi-protocol telemetry generator.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen bg-background font-['Outfit',sans-serif] selection:bg-primary/30">
        {children}
      </body>
    </html>
  );
}

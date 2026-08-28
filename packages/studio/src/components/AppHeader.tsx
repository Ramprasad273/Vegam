'use client';

import React from 'react';
import Link from 'next/link';
import { Layers, Grid2X2, Activity, ShieldCheck, Settings, Zap } from 'lucide-react';

interface AppHeaderProps {
  view: 'hub' | 'workbench';
  onViewChange: (view: 'hub' | 'workbench') => void;
}

export function AppHeader({ view, onViewChange }: AppHeaderProps) {
  return (
    <header className="h-[48px] border-b border-[var(--border-subtle)] flex items-center justify-between px-4 bg-[var(--bg-panel)] shrink-0">
      <div className="flex items-center">
        <Link href="/" className="flex items-center gap-2.5 font-semibold text-sm text-[var(--text-primary)] no-underline">
          <div className="bg-white rounded-[4px] p-[2px]">
            <Zap className="text-black w-3.5 h-3.5 block" />
          </div>
          Vegam
        </Link>
        
        <div className="flex gap-4 ml-8 h-full">
          <button
            onClick={() => onViewChange('hub')}
            className={`flex items-center gap-1.5 text-[13px] font-medium px-1 border-b-2 cursor-pointer transition-colors duration-150 h-full ${
              view === 'hub'
                ? 'text-[var(--text-primary)] border-[var(--text-primary)]'
                : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]'
            }`}
          >
            <Grid2X2 className="w-3.5 h-3.5" /> Hub
          </button>
          <button
            onClick={() => onViewChange('workbench')}
            className={`flex items-center gap-1.5 text-[13px] font-medium px-1 border-b-2 cursor-pointer transition-colors duration-150 h-full ${
              view === 'workbench'
                ? 'text-[var(--text-primary)] border-[var(--text-primary)]'
                : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]'
            }`}
          >
            <Activity className="w-3.5 h-3.5" /> Workbench
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span 
          className="badge border border-[var(--border-strong)] text-[var(--text-secondary)] bg-[var(--bg-base)]" 
          title="Generate high-surprisal anomaly streams for AI agent evaluation and SARIF v2.1.0 audit export."
        >
          AI Agent Surprisal & SARIF v2.1.0 Ready
        </span>
        <span 
          className="badge badge-green" 
          title="Local secure execution. Zero data egress."
        >
          <ShieldCheck className="w-3 h-3" /> Local Engine Secure
        </span>

        <button className="btn btn-ghost !p-1.5">
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}

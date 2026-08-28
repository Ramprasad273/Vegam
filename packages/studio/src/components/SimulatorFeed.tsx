'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, Terminal, RotateCcw, Link as LinkIcon, Activity, ArrowRight } from 'lucide-react';
import type { SimulationNodeConfig } from './Workbench';

interface SimulatorFeedProps {
  isRunning: boolean;
  onToggleRun: () => void;
  nodes: SimulationNodeConfig[];
  activeConnection?: any;
}

interface LogEvent {
  id: string;
  stage: number;
  timestamp: string;
  topic: string;
  payload: any;
  isAnomaly?: boolean;
}

export function SimulatorFeed({ isRunning, onToggleRun, nodes, activeConnection }: SimulatorFeedProps) {
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [metrics, setMetrics] = useState({ total: 0, tps: 0, bw: 0 });
  const [nodeCounts, setNodeCounts] = useState<Record<string, number>>({});
  const abortRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isRunning || nodes.length === 0) {
      abortRef.current = true;
      setMetrics(m => ({ ...m, tps: 0, bw: 0 }));
      return;
    }

    abortRef.current = false;

    const executeBatch = async () => {
      if (abortRef.current) return;
      try {
        const response = await fetch('/api/simulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scenarioConfig: {
              scenarioId: 'live-studio',
              scenarioName: 'Live Studio',
              nodes: nodes,
              concurrency: 1,
              anomalyThresholdBits: 6.0
            },
            rateHz: nodes[0]?.emissionRateHz ?? 10,
            durationSec: 1,
            activeConnection: activeConnection ? {
              bootstrapServers: activeConnection.url,
              protocol: activeConnection.type,
              username: activeConnection.username,
              password: activeConnection.password,
              apiKey: activeConnection.apiKey,
              ssl: activeConnection.ssl
            } : undefined
          })
        });

        if (!response.ok) throw new Error('Simulation failed');
        const data = await response.json();

        if (data && data.success && Array.isArray(data.recentPackets)) {
          const newCounts: Record<string, number> = {};
          
          const newLogs: LogEvent[] = data.recentPackets.map((pkt: any) => {
            const nodeIndex = nodes.findIndex(n => n.nodeId === pkt.nodeId);
            
            // Increment local batch count
            newCounts[pkt.nodeId] = (newCounts[pkt.nodeId] || 0) + 1;

            return {
              id: pkt.packetId || `pkt_${Math.random()}`,
              stage: nodeIndex >= 0 ? nodeIndex + 1 : 1,
              timestamp: new Date().toISOString().split('T')[1].slice(0, -1),
              topic: pkt.targetTopicOrUri || 'events.raw',
              payload: pkt.payload || {},
              isAnomaly: pkt.isAnomaly
            };
          });

          setLogs(prev => [...newLogs, ...prev].slice(0, 100));
          
          setMetrics(prev => ({
            total: prev.total + data.recentPackets.length,
            tps: data.actualThroughputHz || 0,
            bw: Number(((data.actualThroughputHz || 0) * 0.4).toFixed(1))
          }));

          setNodeCounts(prev => {
            const next = { ...prev };
            for (const [nId, count] of Object.entries(newCounts)) {
              next[nId] = (next[nId] || 0) + count;
            }
            return next;
          });
        }
      } catch (err) {
        console.error('Simulation poll error:', err);
      }
    };

    executeBatch();
    const interval = setInterval(executeBatch, 1000);
    return () => {
      abortRef.current = true;
      clearInterval(interval);
    };
  }, [isRunning, nodes]);

  const handleClear = () => {
    setLogs([]);
    setMetrics({ total: 0, tps: 0, bw: 0 });
    setNodeCounts({});
  };

  // JSON syntax highlighting using safe React nodes
  const renderHighlightedJson = (obj: any) => {
    const jsonStr = JSON.stringify(obj, null, 2);
    return jsonStr.split('\n').map((line, idx) => {
      // Basic match for "key": "value" or "key": number
      const match = line.match(/^(\s*)(".*?")(: )?(".*?"|[-0-9.]+)?(,)?$/);
      if (match) {
        return (
          <div key={idx}>
            {match[1]}
            <span className="text-[var(--accent-purple)]">{match[2]}</span>
            {match[3]}
            {match[4] && (
              <span className={match[4].startsWith('"') ? "text-[var(--accent-green)]" : "text-[var(--accent-amber)]"}>
                {match[4]}
              </span>
            )}
            {match[5]}
          </div>
        );
      }
      return <div key={idx}>{line}</div>;
    });
  };

  return (
    <div className="flex flex-col h-full w-full">
      <div className="p-4 border-b border-[var(--border-subtle)] flex flex-col gap-4 shrink-0 bg-[var(--bg-panel)]">
        <div className="flex justify-between items-center">
          <h2 className="m-0 text-base font-semibold text-[var(--text-primary)]">Live Telemetry</h2>
          <button 
            className={`btn rounded-full px-4 py-1.5 font-semibold transition-all duration-300 ${isRunning ? 'bg-[var(--border-strong)] text-[var(--text-primary)] hover:border-[var(--border-focus)] animate-pulse' : 'btn-primary'}`}
            onClick={onToggleRun}
          >
            {isRunning ? <><Square className="w-3.5 h-3.5" /> Stop Simulation</> : <><Play className="w-3.5 h-3.5" /> Start Simulation</>}
          </button>
        </div>
        
        {/* Visual Pipeline Graph */}
        <div className="flex items-center gap-2 overflow-x-auto py-2">
          {nodes.length === 0 ? (
            <div className="text-xs text-[var(--text-tertiary)] italic">Add stages to visualize workflow...</div>
          ) : (
            nodes.map((node, idx) => (
              <React.Fragment key={node.nodeId}>
                <div className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border min-w-[120px] transition-colors ${isRunning ? 'border-[var(--accent-blue)] bg-[rgba(59,130,246,0.05)]' : 'border-[var(--border-strong)] bg-[var(--bg-surface)]'}`}>
                  <span className="text-[10px] uppercase font-bold text-[var(--text-secondary)]">Stage {idx + 1}</span>
                  <span className="text-xs font-semibold text-center truncate w-full max-w-[140px]" title={node.nodeName}>{node.nodeName}</span>
                  <div className="text-[10px] font-mono bg-[var(--bg-base)] px-2 py-0.5 rounded border border-[var(--border-subtle)] mt-1 text-[var(--text-primary)]">
                    {nodeCounts[node.nodeId] || 0} evts
                  </div>
                </div>
                {idx < nodes.length - 1 && (
                  <ArrowRight className={`w-4 h-4 shrink-0 ${isRunning ? 'text-[var(--accent-blue)] animate-pulse' : 'text-[var(--border-strong)]'}`} />
                )}
              </React.Fragment>
            ))
          )}
        </div>

        <div className="flex gap-4 mt-2">
          <div className="flex-1 flex justify-between items-center text-xs">
            <span className="text-[var(--text-secondary)]">Throughput: <strong className="text-[var(--text-primary)] font-mono">{metrics.tps} msg/s</strong></span>
            <span className="text-[var(--text-secondary)]">Total Events: <strong className="text-[var(--text-primary)] font-mono">{metrics.total.toLocaleString()}</strong></span>
            <span className="text-[var(--text-secondary)]">Bandwidth: <strong className="text-[var(--text-primary)] font-mono">{metrics.bw} KB/s</strong></span>
          </div>
        </div>
      </div>
      
      <div className="px-5 py-2.5 border-b border-[var(--border-subtle)] flex justify-between items-center bg-[var(--bg-base)] shrink-0">
        <div className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5" /> Event Stream Payload
        </div>
        <button className="btn btn-ghost !py-0.5 !px-1.5 !text-[11px]" onClick={handleClear}>
          <RotateCcw className="w-3 h-3" /> Clear Logs
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-[var(--bg-base)]">
        {logs.length === 0 ? (
          <div className="flex flex-col h-full items-center justify-center text-[var(--text-tertiary)] text-center text-xs gap-2">
            <Activity className="w-8 h-8 opacity-20" />
            <span>Hit Start Simulation to inject events<br/>into the local engine pipeline.</span>
          </div>
        ) : (
          logs.map((log, idx) => (
            <div key={`${log.id}-${idx}`} className="bg-[var(--bg-surface)] p-3.5 rounded-[var(--radius-lg)] border border-[var(--border-strong)] hover:border-[#444] transition-colors font-mono text-[11px] shadow-sm">
              <div className="flex justify-between items-center mb-2.5 pb-2.5 border-b border-[var(--border-subtle)]">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${log.stage > 1 ? 'bg-[rgba(139,92,246,0.1)] text-[var(--accent-purple)] border border-[rgba(139,92,246,0.2)]' : 'bg-[var(--bg-base)] text-[var(--text-secondary)] border border-[var(--border-strong)]'}`}>
                    S{log.stage}
                  </span>
                  <span className="text-[var(--text-primary)] font-semibold">{log.topic}</span>
                </div>
                <div className="flex items-center gap-2">
                  {log.isAnomaly && <span className="bg-red-500/10 border border-red-500/20 text-red-500 px-1.5 py-0.5 rounded text-[10px] font-bold">ANOMALY</span>}
                  <span className="text-[var(--text-tertiary)]">{log.timestamp}</span>
                </div>
              </div>
              <div className="text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed px-1">
                {renderHighlightedJson(log.payload)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { Plus, MoreHorizontal, GitMerge, Activity, Server, Cloud, Info, X, Trash2, ShieldCheck } from 'lucide-react';
import { VegamScenarioConfig } from '@vegam/engine';

interface HubProps {
  onOpenWorkflow: (id: string) => void;
}

interface BrokerConnection {
  id: string;
  name: string;
  type: 'KAFKA' | 'RABBITMQ' | 'HTTP' | 'NATS';
  url: string;
  username?: string;
  password?: string;
  apiKey?: string;
  ssl?: boolean;
}

export function Hub({ onOpenWorkflow }: HubProps) {
  const [savedFlows, setSavedFlows] = useState<Record<string, VegamScenarioConfig | Record<string, unknown>>>({});
  const [connections, setConnections] = useState<BrokerConnection[]>([
    { id: 'default-1', name: 'Local Redpanda / Kafka', type: 'KAFKA', url: 'localhost:19092' },
    { id: 'default-2', name: 'Staging RabbitMQ', type: 'RABBITMQ', url: 'amqp://staging.internal:5672' }
  ]);
  
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConnId, setEditingConnId] = useState<string | null>(null);
  const [newConnName, setNewConnName] = useState('');
  const [newConnType, setNewConnType] = useState<'KAFKA' | 'RABBITMQ' | 'HTTP' | 'NATS'>('KAFKA');
  const [newConnUrl, setNewConnUrl] = useState('');
  
  // Auth state
  const [newConnUsername, setNewConnUsername] = useState('');
  const [newConnPassword, setNewConnPassword] = useState('');
  const [newConnApiKey, setNewConnApiKey] = useState('');
  const [newConnSsl, setNewConnSsl] = useState(false);
  
  // Hydration state
  const [isMounted, setIsMounted] = useState(false);
  
  // Connection Menu state
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [abuseConfirmed, setAbuseConfirmed] = useState<Record<string, boolean>>({});

  // Health Test state
  const [healthStatus, setHealthStatus] = useState<Record<string, { status: 'testing' | 'connected' | 'error', latency?: number, msg?: string }>>({});

  const handleTestConnection = async (conn: BrokerConnection) => {
    setHealthStatus(prev => ({ ...prev, [conn.id]: { status: 'testing' } }));
    try {
      const res = await fetch('/api/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocol: conn.type, uri: conn.url })
      });
      const data = await res.json();
      if (data.success) {
        setHealthStatus(prev => ({ ...prev, [conn.id]: { status: 'connected', latency: data.latencyMs } }));
        handleMockClick(`Connected to ${conn.name} (${data.latencyMs}ms)`);
      } else {
        setHealthStatus(prev => ({ ...prev, [conn.id]: { status: 'error', msg: data.error } }));
        handleMockClick(`Connection failed: ${data.error}`);
      }
    } catch (err: unknown) {
      setHealthStatus(prev => ({ ...prev, [conn.id]: { status: 'error', msg: err instanceof Error ? err.message : String(err) } }));
      handleMockClick('Network error testing connection');
    }
    setOpenMenuId(null);
  };

  useEffect(() => {
    setIsMounted(true);
    try {
      // Load Workflows
      const storedFlows = localStorage.getItem('vegam_custom_scenarios_v1');
      if (storedFlows) {
        const parsed = JSON.parse(storedFlows);
        if (typeof parsed === 'object' && !Array.isArray(parsed) && parsed !== null) {
          setSavedFlows(parsed);
        }
      }
      
      // Load Connections (never restore plaintext passwords/apiKeys from storage)
      const storedConns = localStorage.getItem('vegam_connections_v1');
      if (storedConns) {
        const parsedConns = JSON.parse(storedConns);
        if (Array.isArray(parsedConns) && parsedConns.length > 0) {
          setConnections(parsedConns.map((c: BrokerConnection) => ({
            ...c,
            password: c.password === '***' ? undefined : c.password,
            apiKey: c.apiKey === '***' ? undefined : c.apiKey
          })));
        }
      }
    } catch (e) {
      console.warn('Failed to parse local storage', e);
    }
  }, []);

  const handleMockClick = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleDeleteConnection = (id: string) => {
    const updatedConns = connections.filter(c => c.id !== id);
    setConnections(updatedConns);
    localStorage.setItem('vegam_connections_v1', JSON.stringify(updatedConns));
    setOpenMenuId(null);
    handleMockClick('Connection deleted');
  };

  const handleSaveConnection = () => {
    if (!newConnName || !newConnUrl) return;
    
    const newConn: BrokerConnection = {
      id: editingConnId || `conn-${Date.now()}`,
      name: newConnName,
      type: newConnType,
      url: newConnUrl,
      username: newConnUsername || undefined,
      password: newConnPassword || undefined,
      apiKey: newConnApiKey || undefined,
      ssl: newConnSsl
    };
    
    const updatedConns = editingConnId 
      ? connections.map(c => c.id === editingConnId ? newConn : c)
      : [...connections, newConn];
      
    setConnections(updatedConns);
    
    // Privacy Policy requirement: never persist credentials to localStorage
    const safeConnsToStore = updatedConns.map(c => ({
      ...c,
      password: c.password ? '***' : undefined,
      apiKey: c.apiKey ? '***' : undefined
    }));
    localStorage.setItem('vegam_connections_v1', JSON.stringify(safeConnsToStore));
    
    setIsModalOpen(false);
    setEditingConnId(null);
    setNewConnName('');
    setNewConnUrl('');
    setNewConnUsername('');
    setNewConnPassword('');
    setNewConnApiKey('');
    setNewConnSsl(false);
    handleMockClick(editingConnId ? 'Connection updated successfully' : 'Connection added successfully');
  };

  const maskUrl = (url: string) => {
    try {
      if (url.includes('@')) {
        return url.replace(/:([^:]+)@/, ':***@');
      }
      return url;
    } catch {
      return url;
    }
  };

  if (!isMounted) {
    return <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)] animate-pulse">Loading Hub...</div>;
  }

  return (
    <div className="w-full p-4 md:p-10 overflow-y-auto relative h-full">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 bg-[var(--bg-panel)] border border-[var(--border-focus)] text-[var(--text-primary)] px-4 py-2 rounded-[var(--radius-lg)] shadow-lg flex items-center gap-2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <Info className="w-4 h-4 text-[var(--accent-blue)]" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Add Connection Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--bg-panel)] border border-[var(--border-strong)] rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-4 border-b border-[var(--border-strong)]">
              <h2 className="font-semibold text-base m-0 text-[var(--text-primary)]">
                {editingConnId ? 'Edit Broker Connection' : 'Add Broker Connection'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-[var(--text-muted)] hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-5 flex flex-col gap-4">
              <div>
                <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">Connection Name</label>
                <input 
                  type="text" 
                  value={newConnName}
                  onChange={(e) => setNewConnName(e.target.value)}
                  placeholder="e.g. Prod Kafka Cluster"
                  className="input-base w-full"
                />
              </div>
              
              <div>
                <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">Protocol</label>
                <select 
                  value={newConnType}
                  onChange={(e) => setNewConnType(e.target.value as 'KAFKA' | 'RABBITMQ' | 'NATS' | 'HTTP')}
                  className="input-base w-full bg-[var(--bg-base)]"
                >
                  <option value="KAFKA">Kafka / Redpanda</option>
                  <option value="RABBITMQ">RabbitMQ (AMQP)</option>
                  <option value="NATS">NATS</option>
                  <option value="HTTP">HTTP Webhook</option>
                </select>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">Broker URL / Connection String</label>
                <input 
                  type="text" 
                  value={newConnUrl}
                  onChange={(e) => setNewConnUrl(e.target.value)}
                  placeholder={newConnType === 'HTTP' ? "https://api.example.com/webhook" : "e.g. pkc-12345.us-east-1.aws.confluent.cloud:9092"}
                  className="input-base w-full"
                />
              </div>

              {/* Authentication Fields based on Protocol */}
              <div className="pt-2 border-t border-[var(--border-subtle)] mt-2">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-3">Authentication (Optional)</span>
                
                {newConnType === 'HTTP' ? (
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">HMAC Secret / API Key</label>
                    <input 
                      type="password" 
                      value={newConnApiKey}
                      onChange={(e) => setNewConnApiKey(e.target.value)}
                      placeholder="Signs webhook payloads with x-vegam-signature"
                      className="input-base w-full"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">Username / Key</label>
                        <input 
                          type="text" 
                          value={newConnUsername}
                          onChange={(e) => setNewConnUsername(e.target.value)}
                          placeholder="Username"
                          className="input-base w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">Password / Secret</label>
                        <input 
                          type="password" 
                          value={newConnPassword}
                          onChange={(e) => setNewConnPassword(e.target.value)}
                          placeholder="Password"
                          className="input-base w-full"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <input 
                        type="checkbox" 
                        id="conn-ssl"
                        checked={newConnSsl}
                        onChange={(e) => setNewConnSsl(e.target.checked)}
                        className="rounded border-[var(--border-strong)] bg-[var(--bg-base)] text-[var(--accent-blue)] focus:ring-[var(--accent-blue)]"
                      />
                      <label htmlFor="conn-ssl" className="text-[12px] font-medium text-[var(--text-secondary)] cursor-pointer">
                        Enable SSL / TLS Encryption
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-4 border-t border-[var(--border-strong)] bg-[var(--bg-base)] flex justify-end gap-3">
              <button className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>Cancel</button>
              <button 
                className="btn btn-primary" 
                onClick={handleSaveConnection}
                disabled={!newConnName || !newConnUrl}
              >
                Save Connection
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-[1000px] mx-auto">
        
        {/* Broker Connections */}
        <div className="flex justify-between items-center mb-5">
          <span className="text-base font-semibold">Broker Connections (Destinations)</span>
          <button 
            className="btn"
            onClick={() => {
              setEditingConnId(null);
              setNewConnName('');
              setNewConnType('KAFKA');
              setNewConnUrl('');
              setNewConnUsername('');
              setNewConnPassword('');
              setNewConnApiKey('');
              setNewConnSsl(false);
              setIsModalOpen(true);
            }}
          >
            <Plus className="w-3.5 h-3.5" /> Add Connection
          </button>
        </div>
        <div className="flex items-center gap-2 -mt-3 mb-4 text-[12px] text-[var(--text-subtle)]">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>Security Notice: Passwords and API keys are session-only and never stored in plain text or sent to external servers.</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
          {connections.map((conn, idx) => (
            <div key={conn.id} className="bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-[var(--radius-lg)] p-5 hover:border-[#333] transition-colors relative">
              <div className="flex justify-between mb-3">
                {healthStatus[conn.id]?.status === 'testing' ? (
                  <span className="badge border border-[var(--border-strong)] text-[var(--text-muted)]">Testing...</span>
                ) : healthStatus[conn.id]?.status === 'connected' ? (
                  <span className="badge badge-green">Connected ({healthStatus[conn.id]?.latency}ms)</span>
                ) : healthStatus[conn.id]?.status === 'error' ? (
                  <span className="badge border border-red-500/50 text-red-500 bg-red-500/10">Error</span>
                ) : (
                  <span className="badge border border-[var(--border-strong)] text-[var(--text-muted)]">Offline</span>
                )}
                <button 
                  className="hover:text-[var(--text-primary)] transition-colors p-1"
                  onClick={() => setOpenMenuId(openMenuId === conn.id ? null : conn.id)}
                  title="Connection Settings"
                >
                  <MoreHorizontal className="w-4 h-4 text-[var(--text-muted)] cursor-pointer" />
                </button>
                {openMenuId === conn.id && (
                  <div className="absolute right-4 top-10 bg-[var(--bg-panel)] border border-[var(--border-strong)] rounded-md shadow-xl py-1 z-10 w-56 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-3 py-2 border-b border-[var(--border-strong)] mb-1">
                      <label className="flex items-start gap-2 text-[10px] text-[var(--text-secondary)] leading-tight cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="mt-0.5 rounded border-[var(--border-strong)] bg-[var(--bg-base)] text-[var(--accent-blue)] focus:ring-[var(--accent-blue)]"
                          checked={abuseConfirmed[conn.id] || false}
                          onChange={(e) => setAbuseConfirmed(prev => ({ ...prev, [conn.id]: e.target.checked }))}
                        />
                        <span>I confirm I own or have authorization to test this target broker.</span>
                      </label>
                    </div>
                    <button 
                      className="w-full text-left px-3 py-1.5 text-[12px] text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => handleTestConnection(conn)}
                      disabled={!abuseConfirmed[conn.id]}
                    >
                      <Activity className="w-3.5 h-3.5" /> Test Connection
                    </button>
                    <button 
                      className="w-full text-left px-3 py-1.5 text-[12px] text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors flex items-center gap-2"
                      onClick={() => {
                        setEditingConnId(conn.id);
                        setNewConnName(conn.name);
                        setNewConnType(conn.type);
                        setNewConnUrl(conn.url);
                        setNewConnUsername(conn.username || '');
                        setNewConnPassword(''); // Never pre-fill credentials on edit
                        setNewConnApiKey('');   // Never pre-fill credentials on edit
                        setNewConnSsl(conn.ssl || false);
                        setIsModalOpen(true);
                        setOpenMenuId(null);
                      }}
                    >
                      <MoreHorizontal className="w-3.5 h-3.5" /> Edit Connection
                    </button>
                    <button 
                      className="w-full text-left px-3 py-1.5 text-[12px] text-red-500 hover:bg-red-500/10 transition-colors flex items-center gap-2"
                      onClick={() => handleDeleteConnection(conn.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                )}
              </div>
              <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
                {conn.type === 'KAFKA' ? <Server className="w-4 h-4" /> : <Cloud className="w-4 h-4" />} 
                {conn.name}
              </h3>
              <p className="text-[12px] text-[var(--text-muted)] font-mono truncate" title={maskUrl(conn.url)}>{maskUrl(conn.url)}</p>
            </div>
          ))}
        </div>

        {/* Workflows */}
        <div className="flex justify-between items-center mb-5 mt-12">
          <span className="text-base font-semibold">Event Workflows</span>
          <button className="btn btn-primary" onClick={() => onOpenWorkflow(`custom-flow-${Date.now()}`)}>
            <Plus className="w-3.5 h-3.5" /> Create Workflow
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div 
            className="bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-[var(--radius-lg)] p-5 cursor-pointer hover:border-[#333] transition-colors"
            onClick={() => onOpenWorkflow('flow-checkout')}
          >
            <div className="flex justify-between mb-3">
              <span className="badge border border-[var(--border-strong)] text-[var(--text-muted)]">
                <GitMerge className="w-2.5 h-2.5" /> 2 Stages
              </span>
              <span className="text-[11px] text-[var(--text-subtle)]">Template</span>
            </div>
            <h3 className="text-sm font-semibold mb-2">Checkout & Payment Pipeline</h3>
            <p className="text-[12px] text-[var(--text-muted)] leading-relaxed">
              Simulates correlated `orders.checkout` and downstream `orders.payment` flows.
            </p>
          </div>

          <div 
            className="bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-[var(--radius-lg)] p-5 cursor-pointer hover:border-[#333] transition-colors"
            onClick={() => onOpenWorkflow('flow-fintech-ai')}
          >
            <div className="flex justify-between mb-3">
              <span className="badge border border-[var(--border-strong)] text-[var(--accent-purple)] bg-[rgba(139,92,246,0.1)]">
                <Activity className="w-2.5 h-2.5" /> AI Agent Bench
              </span>
              <span className="text-[11px] text-[var(--text-subtle)]">SARIF v2.1.0</span>
            </div>
            <h3 className="text-sm font-semibold mb-2">Fintech Fraud Surprisal Stream</h3>
            <p className="text-[12px] text-[var(--text-muted)] leading-relaxed">
              Simulates anomalous financial transactions for fraud detection evaluation.
            </p>
          </div>

          {Object.keys(savedFlows).map(flowId => {
            const flowData = savedFlows[flowId] as any;
            const flowNodes = Array.isArray(flowData?.nodes) ? flowData.nodes : Array.isArray(flowData) ? flowData : [];
            const stageCount = flowNodes.length;
            const flowName = flowData?.name || flowNodes[0]?.nodeName || 'Custom Workflow';

            return (
              <div 
                key={flowId}
                className="bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-[var(--radius-lg)] p-5 cursor-pointer hover:border-[#333] transition-colors"
                onClick={() => onOpenWorkflow(flowId)}
              >
                <div className="flex justify-between mb-3">
                  <span className="badge border border-[var(--border-strong)] text-[var(--text-muted)]">
                    <Activity className="w-2.5 h-2.5" /> {stageCount} Stages
                  </span>
                  <span className="text-[11px] text-[var(--text-subtle)]">Custom</span>
                </div>
                <h3 className="text-sm font-semibold mb-2 truncate">{flowName}</h3>
                <p className="text-[12px] text-[var(--text-muted)] leading-relaxed font-mono truncate">
                  ID: {flowId}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

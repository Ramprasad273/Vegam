'use client';

import React, { useState, useEffect } from 'react';
import { Check, Save, Network } from 'lucide-react';
import { SchemaTreeBuilder } from './SchemaTreeBuilder';
import { SimulatorFeed } from './SimulatorFeed';

export interface SimulationNodeConfig {
  nodeId: string;
  nodeName: string;
  nodeType: 'producer' | 'markov_fork' | 'aggregator' | 'dlq_route' | 'timer';
  protocol: 'KAFKA' | 'AMQP' | 'NATS' | 'MQTT' | 'HTTP';
  targetTopicOrUri: string;
  emissionRateHz?: number;
  synthesisRules?: Array<{ fieldName: string; ruleExpression: string }>;
  templateMode?: 'visual' | 'raw';
  rawJsonTemplate?: string;
}

const FINTECH_AI_NODES: SimulationNodeConfig[] = [
  {
    nodeId: 'node-ai-1',
    nodeName: 'Transaction Authorization Stream',
    nodeType: 'producer',
    protocol: 'KAFKA',
    targetTopicOrUri: 'fintech.auth.raw',
    emissionRateHz: 150,
    synthesisRules: [
      { fieldName: 'txId', ruleExpression: 'uuid()' },
      { fieldName: 'timestamp', ruleExpression: '$NOW_MS' },
      { fieldName: 'amountUsd', ruleExpression: 'gaussian(45, 12)' },
      { fieldName: 'merchantId', ruleExpression: 'weighted(["MERCH-1", "MERCH-2", "MERCH-ANOMALY"])' },
      { fieldName: 'riskScore', ruleExpression: 'gaussian(0.1, 0.05)' }
    ]
  },
  {
    nodeId: 'node-ai-2',
    nodeName: 'AI Agent Surprisal Evaluation Node',
    nodeType: 'producer',
    protocol: 'KAFKA',
    targetTopicOrUri: 'fintech.fraud.surprisal',
    emissionRateHz: 150,
    synthesisRules: [
      { fieldName: 'txId', ruleExpression: '$PREV.txId' },
      { fieldName: 'surprisalScoreI', ruleExpression: 'gaussian(7.2, 1.1)' },
      { fieldName: 'sarifRuleId', ruleExpression: '"VEGAM-SEC-001"' },
      { fieldName: 'actionTaken', ruleExpression: '"QUARANTINE_AGENT_REVIEW"' }
    ]
  }
];

const DEFAULT_NODES: SimulationNodeConfig[] = [
  {
    nodeId: 'node-1',
    nodeName: 'Order Checkout Gateway',
    nodeType: 'producer',
    protocol: 'KAFKA',
    targetTopicOrUri: 'orders.checkout',
    emissionRateHz: 120,
    synthesisRules: [
      { fieldName: 'eventId', ruleExpression: 'uuid()' },
      { fieldName: 'timestamp', ruleExpression: '$NOW_MS' },
      { fieldName: 'customer.id', ruleExpression: 'weighted([1001, 1002, 1003])' },
      { fieldName: 'customer.name', ruleExpression: '"Jane Doe"' },
      { fieldName: 'cartTotal', ruleExpression: 'gaussian(200, 50)' }
    ]
  }
];

interface WorkbenchProps {
  initialWorkflowId?: string | null;
}

export function Workbench({ initialWorkflowId }: WorkbenchProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [nodes, setNodes] = useState<SimulationNodeConfig[]>([]);
  const [workflowName, setWorkflowName] = useState('Custom Workflow');
  const [workflowDesc, setWorkflowDesc] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
  const [isMounted, setIsMounted] = useState(false);
  
  // Connection states
  const [availableConnections, setAvailableConnections] = useState<any[]>([]);
  const [activeConnectionId, setActiveConnectionId] = useState<string>('local-memory');

  // Load logic
  useEffect(() => {
    setIsMounted(true);
    
    try {
      const storedConns = localStorage.getItem('vegam_connections_v1');
      if (storedConns) {
        setAvailableConnections(JSON.parse(storedConns));
      }
    } catch (e) {}

    if (initialWorkflowId === 'flow-fintech-ai') {
      setNodes(FINTECH_AI_NODES);
      setWorkflowName('Fintech Fraud Surprisal Stream');
      setWorkflowDesc('Simulates anomalous financial transactions for fraud detection evaluation.');
      return;
    }
    if (initialWorkflowId === 'flow-checkout') {
      setNodes(DEFAULT_NODES);
      setWorkflowName('Checkout & Payment Pipeline');
      setWorkflowDesc('Simulates correlated orders.checkout and downstream orders.payment flows.');
      return;
    }

    try {
      const stored = localStorage.getItem('vegam_custom_scenarios_v1');
      if (stored) {
        const parsedMap = JSON.parse(stored);
        if (initialWorkflowId && parsedMap[initialWorkflowId]) {
          const flowData = parsedMap[initialWorkflowId];
          if (Array.isArray(flowData)) {
            setNodes(flowData);
            setWorkflowName(flowData[0]?.nodeName || 'Custom Workflow');
          } else {
            setNodes(flowData.nodes || []);
            setWorkflowName(flowData.name || 'Custom Workflow');
            setWorkflowDesc(flowData.description || '');
          }
          return;
        }
      }
    } catch (e) {
      console.warn('Failed to load from local storage:', e);
    }
    
    // Fallback to default
    setNodes(DEFAULT_NODES);
  }, [initialWorkflowId]);


  const handleUpdateNode = (nodeId: string, updatedNode: SimulationNodeConfig) => {
    setNodes(prev => prev.map(n => n.nodeId === nodeId ? updatedNode : n));
  };

  const handleAddNode = () => {
    const newNode: SimulationNodeConfig = {
      nodeId: `node-${Date.now()}`,
      nodeName: 'New Downstream Stage',
      nodeType: 'producer',
      protocol: 'KAFKA',
      targetTopicOrUri: 'new.topic',
      emissionRateHz: 100,
      synthesisRules: [
        { fieldName: 'newField', ruleExpression: '"value"' }
      ]
    };
    setNodes(prev => [...prev, newNode]);
  };

  const handleDeleteNode = (nodeId: string) => {
    setNodes(prev => prev.filter(n => n.nodeId !== nodeId));
  };

  const handleSave = () => {
    try {
      const stored = localStorage.getItem('vegam_custom_scenarios_v1');
      const parsedMap = stored ? JSON.parse(stored) : {};
      
      const saveId = (initialWorkflowId && initialWorkflowId.startsWith('custom-flow')) ? initialWorkflowId : `custom-flow-${Date.now()}`;
      parsedMap[saveId] = {
        name: workflowName,
        description: workflowDesc,
        nodes: nodes
      };
      
      localStorage.setItem('vegam_custom_scenarios_v1', JSON.stringify(parsedMap));
      
      // Visual feedback instead of blocking alert
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
      
    } catch (e) {
      console.error('Save failed', e);
    }
  };

  if (!isMounted) {
    return <div className="w-full h-full flex items-center justify-center bg-[var(--bg-panel)] text-[var(--text-muted)] animate-pulse">Loading Workbench...</div>;
  }

  return (
    <div className="flex flex-col md:flex-row w-full h-full text-[13px] overflow-hidden">
      {/* Left Pane: Builder */}
      <div className="w-full md:w-1/2 md:max-w-3xl border-b md:border-b-0 md:border-r border-[var(--border-subtle)] flex flex-col bg-[var(--bg-base)] h-1/2 md:h-full">
        <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex justify-between items-center bg-[var(--bg-panel)] shrink-0">
          <div className="flex-1 mr-6">
            <input 
              type="text" 
              value={workflowName} 
              onChange={(e) => setWorkflowName(e.target.value)} 
              className="bg-transparent border-none outline-none font-semibold text-base m-0 p-0 text-[var(--text-primary)] w-full placeholder:text-[var(--text-muted)] focus:ring-0"
              placeholder="Workflow Name"
            />
            <input 
              type="text" 
              value={workflowDesc} 
              onChange={(e) => setWorkflowDesc(e.target.value)} 
              className="bg-transparent border-none outline-none text-[12px] m-0 mt-1 p-0 text-[var(--text-muted)] w-full placeholder:text-[var(--border-strong)] focus:ring-0"
              placeholder="Add a description for this workflow..."
            />
          </div>
          
          <div className="flex items-center gap-3">
            <select 
              value={activeConnectionId}
              onChange={(e) => setActiveConnectionId(e.target.value)}
              className="bg-[var(--bg-surface)] border border-[var(--border-strong)] text-[12px] px-2 py-1.5 rounded outline-none focus:border-[var(--accent-blue)] text-[var(--text-primary)]"
            >
              <optgroup label="Testing & Local Loop">
                <option value="local-memory">Local Memory (No Outbound)</option>
              </optgroup>
              {availableConnections.length > 0 && (
                <optgroup label="Outbound Brokers">
                  {availableConnections.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
                  ))}
                </optgroup>
              )}
            </select>

            <button 
              className="btn bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] transition-colors text-[var(--text-primary)] font-semibold border-[var(--border-strong)]"
              onClick={handleSave}
            >
              {saveStatus === 'saved' ? <><Save className="w-4 h-4 text-[var(--accent-green)]" /> Saved</> : <><Save className="w-4 h-4" /> Save Workflow</>}
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          <SchemaTreeBuilder 
            nodes={nodes} 
            onUpdateNode={handleUpdateNode} 
            onAddNode={handleAddNode} 
            onDeleteNode={handleDeleteNode}
          />
        </div>
      </div>

      {/* Right Pane: Simulator */}
      <div className="w-full md:w-1/2 flex-1 flex flex-col bg-[var(--bg-panel)] h-1/2 md:h-full">
        <SimulatorFeed 
          isRunning={isRunning} 
          onToggleRun={() => setIsRunning(!isRunning)} 
          nodes={nodes} 
          activeConnection={availableConnections.find(c => c.id === activeConnectionId)}
        />
      </div>
    </div>
  );
}

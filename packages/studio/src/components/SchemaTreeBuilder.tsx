'use client';

import React from 'react';
import { Fingerprint, Clock, Plus, Hash, User, Coins, Code, Link as LinkIcon, Trash2, Code2, ListTree, Info, Activity, GitMerge } from 'lucide-react';
import type { SimulationNodeConfig } from './Workbench';

interface SchemaTreeBuilderProps {
  nodes: SimulationNodeConfig[];
  onUpdateNode: (nodeId: string, updatedNode: SimulationNodeConfig) => void;
  onAddNode: () => void;
  onDeleteNode: (nodeId: string) => void;
}

const COMMON_RULES = [
  { label: 'Custom String', value: '"value"' },
  { label: 'UUID v4', value: 'uuid()' },
  { label: 'Current Timestamp', value: '$NOW_MS' },
  { label: 'Gaussian (Mean, StdDev)', value: 'gaussian(200, 50)' },
  { label: 'Weighted Selection', value: 'weighted([1, 2, 3])' },
  { label: 'Inherit Upstream ($PREV)', value: '$PREV.eventId' }
];

export function SchemaTreeBuilder({ nodes, onUpdateNode, onAddNode, onDeleteNode }: SchemaTreeBuilderProps) {
  
  const handleUpdateField = (nodeId: string, fieldIndex: number, newFieldName: string, newRule: string) => {
    const node = nodes.find(n => n.nodeId === nodeId);
    if (!node) return;
    const rules = [...(node.synthesisRules || [])];
    rules[fieldIndex] = { fieldName: newFieldName, ruleExpression: newRule };
    onUpdateNode(nodeId, { ...node, synthesisRules: rules });
  };

  const handleAddField = (nodeId: string) => {
    const node = nodes.find(n => n.nodeId === nodeId);
    if (!node) return;
    const rules = [...(node.synthesisRules || []), { fieldName: 'newField', ruleExpression: '"value"' }];
    onUpdateNode(nodeId, { ...node, synthesisRules: rules, templateMode: 'visual' });
  };

  const handleDeleteField = (nodeId: string, fieldIndex: number) => {
    const node = nodes.find(n => n.nodeId === nodeId);
    if (!node) return;
    const rules = (node.synthesisRules || []).filter((_, i) => i !== fieldIndex);
    onUpdateNode(nodeId, { ...node, synthesisRules: rules });
  };

  const getRuleIcon = (expr: string) => {
    if (expr.includes('uuid')) return <Fingerprint className="w-3.5 h-3.5" />;
    if (expr.includes('NOW')) return <Clock className="w-3.5 h-3.5" />;
    if (expr.includes('PREV')) return <LinkIcon className="w-3.5 h-3.5" />;
    if (expr.includes('gaussian') || expr.includes('weighted')) return <Hash className="w-3.5 h-3.5" />;
    return <Code className="w-3.5 h-3.5" />;
  };

  return (
    <div>
      {nodes.map((node, idx) => {
        const mode = node.templateMode || 'visual';
        const rawJson = node.rawJsonTemplate || '{\n  "id": "uuid()",\n  "timestamp": "$NOW_MS"\n}';
        
        let jsonError: string | null = null;
        if (mode === 'raw') {
          try {
            JSON.parse(rawJson);
          } catch (e: unknown) {
            jsonError = e instanceof Error ? e.message : String(e);
          }
        }

        return (
          <React.Fragment key={node.nodeId}>
            <div className="bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-[var(--radius-lg)] p-5 mb-6 relative hover:border-[#333] transition-colors">
              
              {/* Stage Deletion Button */}
              {idx > 0 && (
                <button 
                  onClick={() => onDeleteNode(node.nodeId)}
                  className="absolute top-4 right-4 text-[var(--text-tertiary)] hover:text-red-500 transition-colors p-1"
                  title="Delete Stage"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent-purple)] bg-[var(--accent-purple-light)] px-2 py-0.5 rounded border border-[rgba(139,92,246,0.2)] shadow-sm">
                    Stage {idx + 1}
                  </span>
                  <input
                    className="input-base font-semibold !w-48"
                    style={{ height: '34px', padding: '0 10px', boxSizing: 'border-box', lineHeight: 'normal' }}
                    value={node.nodeName}
                    onChange={(e) => onUpdateNode(node.nodeId, { ...node, nodeName: e.target.value })}
                    placeholder="Event Stage Name"
                  />
                  <select
                    className="input-base font-semibold !w-36 ml-2"
                    style={{ height: '34px', padding: '0 10px', boxSizing: 'border-box', lineHeight: 'normal' }}
                    value={node.nodeType}
                    onChange={(e) => onUpdateNode(node.nodeId, { ...node, nodeType: e.target.value as 'producer' | 'markov_fork' })}
                  >
                    <option value="producer">Producer</option>
                    <option value="markov_fork">Markov Fork</option>
                    <option value="aggregator">Aggregator</option>
                    <option value="dlq_route">DLQ Route</option>
                  </select>
                </div>
                <div className="flex gap-3 items-center text-xs">
                  <span className="text-[var(--text-secondary)] whitespace-nowrap">Dest:</span>
                  <input 
                    type="text" 
                    value={node.targetTopicOrUri}
                    onChange={(e) => onUpdateNode(node.nodeId, { ...node, targetTopicOrUri: e.target.value })}
                    className="input-base !w-32" 
                    style={{ height: '34px', padding: '0 10px', boxSizing: 'border-box', lineHeight: 'normal' }}
                  />
                  <span className="text-[var(--text-secondary)] whitespace-nowrap">Rate (Hz):</span>
                  <input 
                    type="number" 
                    value={node.emissionRateHz} 
                    onChange={(e) => onUpdateNode(node.nodeId, { ...node, emissionRateHz: Number(e.target.value) })}
                    className="input-base !w-20" 
                    style={{ height: '34px', padding: '0 10px', boxSizing: 'border-box', lineHeight: 'normal' }}
                  />
                </div>
              </div>

              <div className="bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] p-3">
                <div className="flex justify-between items-center mb-3">
                  <div className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Payload Template</div>
                  
                  {/* Mode Toggle */}
                  <div className="flex bg-[var(--bg-panel)] rounded-md border border-[var(--border-strong)] p-0.5">
                    <button 
                      onClick={() => onUpdateNode(node.nodeId, { ...node, templateMode: 'visual' })}
                      className={`flex items-center gap-1 px-2 py-1 rounded-sm text-[11px] transition-colors ${mode === 'visual' ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm border border-[var(--border-subtle)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
                    >
                      <ListTree className="w-3 h-3" /> Visual
                    </button>
                    <button 
                      onClick={() => onUpdateNode(node.nodeId, { ...node, templateMode: 'raw' })}
                      className={`flex items-center gap-1 px-2 py-1 rounded-sm text-[11px] transition-colors ${mode === 'raw' ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm border border-[var(--border-subtle)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
                    >
                      <Code2 className="w-3 h-3" /> Raw JSON
                    </button>
                  </div>
                </div>
                
                {mode === 'visual' ? (
                  <>
                    {(node.synthesisRules || []).map((rule, ruleIdx) => {
                      const isCorrelated = rule.ruleExpression.includes('PREV');
                      const isPredefined = COMMON_RULES.some(r => rule.ruleExpression.startsWith(r.value.split('(')[0]));
                      
                      return (
                        <div key={ruleIdx} className={`flex items-center gap-3 py-1.5 border-b border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] group ${isCorrelated ? 'bg-[rgba(139,92,246,0.03)]' : ''}`}>
                          <input 
                            type="text" 
                            value={rule.fieldName}
                            onChange={(e) => handleUpdateField(node.nodeId, ruleIdx, e.target.value, rule.ruleExpression)}
                            className="flex items-center gap-1.5 w-[150px] font-mono text-[var(--text-primary)] bg-transparent border-none outline-none focus:border-b focus:border-[var(--accent-blue)]"
                          />
                          
                          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-[var(--radius-sm)] text-[11px] ${isCorrelated ? 'bg-[rgba(139,92,246,0.1)] border border-[rgba(139,92,246,0.3)] text-[var(--accent-purple)]' : 'bg-[var(--bg-surface)] border border-[var(--border-strong)] text-[var(--text-secondary)]'}`}>
                            {getRuleIcon(rule.ruleExpression)}
                            
                            <select 
                              value={isPredefined ? COMMON_RULES.find(r => rule.ruleExpression.startsWith(r.value.split('(')[0]))?.value : '"value"'}
                              onChange={(e) => handleUpdateField(node.nodeId, ruleIdx, rule.fieldName, e.target.value)}
                              className="bg-transparent border-none outline-none text-[11px] cursor-pointer text-inherit max-w-[120px] truncate"
                            >
                              {COMMON_RULES.map(cr => (
                                <option key={cr.value} value={cr.value}>{cr.label}</option>
                              ))}
                            </select>
                          </div>

                          <input 
                            type="text" 
                            value={rule.ruleExpression}
                            onChange={(e) => handleUpdateField(node.nodeId, ruleIdx, rule.fieldName, e.target.value)}
                            className="bg-transparent border-b border-transparent focus:border-[var(--accent-blue)] outline-none font-mono text-[11px] flex-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                          />
                          
                          <button 
                            onClick={() => handleDeleteField(node.nodeId, ruleIdx)}
                            className="opacity-0 group-hover:opacity-100 text-[var(--text-tertiary)] hover:text-red-500 transition-opacity p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                    
                    <div className="mt-3">
                      <button 
                        className="btn btn-ghost !py-1 !px-2 !text-[11px]"
                        onClick={() => handleAddField(node.nodeId)}
                      >
                        <Plus className="w-3 h-3" /> Add Property
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="w-full">
                    <textarea 
                      value={rawJson}
                      onChange={(e) => onUpdateNode(node.nodeId, { ...node, rawJsonTemplate: e.target.value })}
                      className={`w-full h-[150px] bg-[#111111] border rounded-md p-3 font-mono text-[12px] text-[var(--text-primary)] focus:outline-none resize-y ${jsonError ? 'border-red-900 focus:border-red-500' : 'border-[var(--border-strong)] focus:border-[var(--accent-blue)]'}`}
                      placeholder={'{\n  "id": "{{uuid()}}"\n}'}
                      spellCheck="false"
                    />
                    <div className="flex justify-between items-start mt-2">
                      <div className="text-[11px] text-[var(--text-muted)] flex items-center gap-1.5">
                        <Info className="w-3 h-3" /> Map string values directly to expressions, e.g. <code className="bg-[#222] px-1 rounded text-white">"uuid()"</code>
                      </div>
                      {jsonError && (
                        <div className="text-[11px] text-red-500 max-w-[200px] text-right truncate" title={jsonError}>
                          Invalid JSON: {jsonError}
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>

              {/* Advanced Config (Surprisal & Markov) */}
              <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
                 <details className="text-[12px]">
                   <summary className="font-semibold text-[var(--text-secondary)] cursor-pointer hover:text-[var(--text-primary)] flex items-center gap-2">
                     <Activity className="w-3.5 h-3.5" /> Surprisal & Anomaly Rules
                   </summary>
                   <div className="p-3 bg-[var(--bg-base)] border border-[var(--border-strong)] rounded mt-2 text-[var(--text-muted)]">
                     <p className="mb-2">{"Define threshold bits $\\mathcal{I}(x)$ and routing logic when anomalies occur."}</p>
                     <div className="flex gap-4">
                       <label className="flex flex-col gap-1 w-1/3">
                         <span className="text-[11px]">Anomaly Threshold (Bits)</span>
                         <input type="number" defaultValue="6.0" className="input-base !py-1" />
                       </label>
                       <label className="flex flex-col gap-1 w-2/3">
                         <span className="text-[11px]">Chaos Action</span>
                         <select className="input-base !py-1">
                           <option>Route to DLQ</option>
                           <option>Inject Latency Jitter</option>
                         </select>
                       </label>
                     </div>
                   </div>
                 </details>

                 {node.nodeType === 'markov_fork' && (
                   <details className="text-[12px] mt-2" open>
                     <summary className="font-semibold text-[var(--accent-purple)] cursor-pointer hover:text-[var(--text-primary)] flex items-center gap-2">
                       <GitMerge className="w-3.5 h-3.5" /> Markov Branching Routes
                     </summary>
                     <div className="p-3 bg-[var(--bg-base)] border border-[rgba(139,92,246,0.2)] rounded mt-2">
                       <div className="flex justify-between text-[11px] mb-2 text-[var(--text-secondary)]">
                         <span>Probability</span>
                         <span>Target Topic / Node</span>
                       </div>
                       <div className="flex gap-2 mb-2">
                         <input type="text" defaultValue="88%" className="input-base !py-1 w-20 text-center" />
                         <input type="text" defaultValue="orders.confirmed" className="input-base !py-1 flex-1" />
                       </div>
                       <div className="flex gap-2">
                         <input type="text" defaultValue="12%" className="input-base !py-1 w-20 text-center" />
                         <input type="text" defaultValue="orders.dlq" className="input-base !py-1 flex-1" />
                       </div>
                     </div>
                   </details>
                 )}
              </div>
            </div>
            
            {idx < nodes.length - 1 && (
              <div className="w-0.5 h-8 bg-[var(--border-strong)] -mt-6 mb-2 ml-8"></div>
            )}
          </React.Fragment>
        );
      })}

      <button 
        className="btn btn-ghost w-full justify-center border-dashed border-[var(--border-strong)] py-3 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] mt-2"
        onClick={onAddNode}
      >
        <Plus className="w-4 h-4" /> Add Downstream Stage
      </button>
    </div>
  );
}

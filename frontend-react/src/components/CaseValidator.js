import React, { useState } from 'react';
import { agentAction } from '../services/api';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export default function CaseValidator() {
  const [caseNumber, setCaseNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [caseData, setCaseData] = useState(null);
  const [resolving, setResolving] = useState(false);
  const [resolution, setResolution] = useState(null);
  const [agentComments, setAgentComments] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [executionResult, setExecutionResult] = useState(null);

  const handleFetch = async () => {
    if (!caseNumber.trim()) { alert('Please enter a Case Number'); return; }
    setLoading(true);
    setCaseData(null);
    setResolution(null);
    setExecutionResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/case-by-number/${caseNumber.trim()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || 'Case not found');
      }
      setCaseData(await res.json());
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!caseData) return;
    setResolving(true);
    setResolution(null);
    setExecutionResult(null);
    try {
      const res = await fetch(`${API_BASE}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: caseData.Id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || 'Resolution failed');
      }
      setResolution(await res.json());
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setResolving(false);
    }
  };

  const handleAgentAction = async (action) => {
    if (action !== 'execute' && !agentComments.trim()) {
      alert('Please provide comments explaining what needs to change.');
      return;
    }
    setActionLoading(action);
    setExecutionResult(null);
    try {
      const res = await agentAction(caseData.Id, action, agentComments, resolution);
      if (action === 'execute') {
        setExecutionResult(res);
      } else {
        setResolution({ ...res.resolution, case_id: caseData.Id });
        setAgentComments('');
        alert('Resolution revised. Please review again.');
      }
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setActionLoading('');
    }
  };

  const handleRefresh = async () => {
    if (!caseNumber.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/case-by-number/${caseNumber.trim()}`);
      if (res.ok) setCaseData(await res.json());
    } catch (e) { /* ignore */ }
    setLoading(false);
  };

  return (
    <div className="panel">
      {/* Case Number Input */}
      <div className="card">
        <h2>Validate Case Resolution</h2>
        <p style={{ color: '#666', fontSize: '13px', marginBottom: '16px' }}>
          Enter a Salesforce Case Number to fetch case details, run AI resolution, and validate the outcome.
        </p>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label>Case Number</label>
            <input
              type="text"
              value={caseNumber}
              onChange={(e) => setCaseNumber(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleFetch()}
              placeholder="e.g., 00001234"
            />
          </div>
          <button className="btn btn-primary" onClick={handleFetch} disabled={loading} style={{ height: '42px' }}>
            {loading ? 'Fetching...' : 'Fetch Case'}
          </button>
        </div>
        {loading && (
          <div className="loading show">
            <div className="spinner" />
            <span>Fetching case from Salesforce...</span>
          </div>
        )}
      </div>

      {/* Case Details */}
      {caseData && (
        <div className="card">
          <h2>
            Case #{caseData.CaseNumber}
            <button className="btn btn-outline btn-sm" onClick={handleRefresh} style={{ float: 'right' }}>
              Refresh from Salesforce
            </button>
          </h2>
          <div className="resolution-result">
            <div className="field">
              <span className="field-label">Case ID</span>
              <span className="field-value" style={{ fontFamily: 'monospace', fontSize: '12px' }}>{caseData.Id}</span>
            </div>
            <div className="field">
              <span className="field-label">Subject</span>
              <span className="field-value">{caseData.Subject}</span>
            </div>
            <div className="field">
              <span className="field-label">Status</span>
              <span className="field-value">
                <span className={`action-badge ${caseData.Status === 'Closed' ? 'auto_resolve' : caseData.Status === 'Escalated' ? 'escalate' : 'route'}`}>
                  {caseData.Status}
                </span>
              </span>
            </div>
            <div className="field">
              <span className="field-label">Type</span>
              <span className="field-value">{caseData.Type || 'N/A'}</span>
            </div>
            <div className="field">
              <span className="field-label">Priority</span>
              <span className="field-value">{caseData.Priority || 'N/A'}</span>
            </div>
            <div className="field">
              <span className="field-label">Origin</span>
              <span className="field-value">{caseData.Origin || 'N/A'}</span>
            </div>
            <div className="field">
              <span className="field-label">Owner</span>
              <span className="field-value">{caseData.OwnerName || 'N/A'}</span>
            </div>
            <div className="field">
              <span className="field-label">Contact</span>
              <span className="field-value">{caseData.ContactName || 'N/A'} ({caseData.ContactEmail || 'N/A'})</span>
            </div>
            <div className="field">
              <span className="field-label">Created</span>
              <span className="field-value">{caseData.CreatedDate || 'N/A'}</span>
            </div>
            {caseData.Description && (
              <div className="field" style={{ gridTemplateColumns: '1fr' }}>
                <span className="field-label">Description</span>
                <div className="notes-box" style={{ marginTop: '6px' }}>{caseData.Description}</div>
              </div>
            )}
            {caseData.AI_Resolution_Status && (
              <div className="field">
                <span className="field-label">AI Resolution Status</span>
                <span className="field-value">
                  <span className="type-badge">{caseData.AI_Resolution_Status}</span>
                </span>
              </div>
            )}
            {caseData.AI_Resolution_Notes && (
              <div className="field" style={{ gridTemplateColumns: '1fr' }}>
                <span className="field-label">AI Resolution Notes (from Salesforce)</span>
                <div className="notes-box" style={{ marginTop: '6px' }}>{caseData.AI_Resolution_Notes}</div>
              </div>
            )}
          </div>

          {/* Comments */}
          {caseData.Comments && caseData.Comments.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <h3 style={{ fontSize: '14px', color: '#1B4F72', marginBottom: '8px' }}>Case Comments</h3>
              <div style={{ background: '#f8f9fa', borderRadius: '8px', padding: '12px', maxHeight: '200px', overflowY: 'auto' }}>
                {caseData.Comments.map((c, i) => (
                  <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid #eee', fontSize: '13px' }}>
                    <span style={{ color: '#888', fontSize: '11px' }}>{c.CreatedDate}</span>
                    <div style={{ marginTop: '4px' }}>{c.CommentBody}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!resolution && (
            <div style={{ marginTop: '20px' }}>
              <button className="btn btn-success" onClick={handleResolve} disabled={resolving}
                style={{ padding: '12px 24px', fontSize: '15px' }}>
                {resolving ? 'Analyzing...' : 'Run AI Resolution'}
              </button>
              {resolving && (
                <div className="loading show" style={{ marginTop: '8px' }}>
                  <div className="spinner" />
                  <span>AI is analyzing the case and generating resolution... (15-30 seconds)</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* AI Resolution */}
      {resolution && (
        <div className="card">
          <h2>AI Resolution Recommendation</h2>
          <div className="resolution-result">
            <div className="field">
              <span className="field-label">Recommended Action</span>
              <span className="field-value">
                <span className={`action-badge ${resolution.recommended_action}`}>
                  {resolution.recommended_action.replace('_', ' ')}
                </span>
              </span>
            </div>
            <div className="field">
              <span className="field-label">Confidence</span>
              <span className="field-value">
                <span className="confidence-bar">
                  <span className="confidence-fill" style={{
                    width: `${resolution.confidence_score * 100}%`,
                    background: resolution.confidence_score >= 0.75 ? '#27ae60' : resolution.confidence_score >= 0.5 ? '#f39c12' : '#e74c3c',
                  }} />
                </span>
                {' '}{(resolution.confidence_score * 100).toFixed(0)}%
              </span>
            </div>
            <div className="field">
              <span className="field-label">Issue Summary</span>
              <span className="field-value">{resolution.issue_summary}</span>
            </div>
            <div className="field">
              <span className="field-label">Root Cause</span>
              <span className="field-value">{resolution.root_cause}</span>
            </div>
            <div className="field">
              <span className="field-label">Requires Human</span>
              <span className="field-value">{resolution.requires_human ? 'Yes' : 'No'}</span>
            </div>
            <div className="field">
              <span className="field-label">Route to Team</span>
              <span className="field-value">{resolution.route_to_team || 'N/A'}</span>
            </div>
            <div className="field">
              <span className="field-label">Can Auto-Close</span>
              <span className="field-value">{resolution.can_auto_close ? 'Yes' : 'No'}</span>
            </div>
            <div className="field">
              <span className="field-label">Reasoning</span>
              <span className="field-value">{resolution.reasoning}</span>
            </div>

            <div className="section">
              <h3>Resolution Steps</h3>
              <ol className="steps-list">
                {resolution.resolution_steps.map((step, i) => <li key={i}>{step}</li>)}
              </ol>
            </div>

            <div className="section">
              <h3>Resolution Notes</h3>
              <div className="notes-box">{resolution.resolution_notes}</div>
            </div>

            <div className="section">
              <h3>Customer Email</h3>
              <div className="email-preview">
                <div className="email-subject">Subject: {resolution.customer_email_subject}</div>
                <div className="email-body">{resolution.customer_email_body}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Agent Decision */}
      {resolution && !executionResult && (
        <div className="card">
          <h2>Agent Decision</h2>
          <div className="form-group">
            <label>Agent Comments (required for "Partially Correct" or "Not Right")</label>
            <textarea
              value={agentComments}
              onChange={(e) => setAgentComments(e.target.value)}
              placeholder="Explain what needs to change..."
              rows={4}
              style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontFamily: 'inherit', fontSize: '14px' }}
            />
          </div>
          <div className="btn-group" style={{ marginTop: '16px' }}>
            <button className="btn btn-success" onClick={() => handleAgentAction('execute')}
              disabled={!!actionLoading} style={{ padding: '12px 24px', fontSize: '15px' }}>
              {actionLoading === 'execute' ? 'Executing...' : 'Execute AI Steps'}
            </button>
            <button className="btn btn-outline" onClick={() => handleAgentAction('partially_correct')}
              disabled={!!actionLoading} style={{ padding: '12px 24px', fontSize: '15px', borderColor: '#f39c12', color: '#f39c12' }}>
              {actionLoading === 'partially_correct' ? 'Revising...' : 'Partially Correct'}
            </button>
            <button className="btn btn-outline" onClick={() => handleAgentAction('not_right')}
              disabled={!!actionLoading} style={{ padding: '12px 24px', fontSize: '15px', borderColor: '#e74c3c', color: '#e74c3c' }}>
              {actionLoading === 'not_right' ? 'Revising...' : 'Not Right'}
            </button>
          </div>
          {actionLoading && (
            <div className="loading show" style={{ marginTop: '12px' }}>
              <div className="spinner" />
              <span>{actionLoading === 'execute' ? 'AI Agent executing steps on Salesforce...' : 'AI revising resolution...'}</span>
            </div>
          )}
        </div>
      )}

      {/* Execution Result */}
      {executionResult && (
        <div className="card">
          <h2 style={{ color: '#27ae60' }}>Resolution Executed</h2>
          <div className="resolution-result">
            <div className="field">
              <span className="field-label">Actions Taken</span>
              <span className="field-value">{executionResult.actions_taken}</span>
            </div>
            <div className="section">
              <h3>Execution Log</h3>
              <div style={{ background: '#f8f9fa', borderRadius: '8px', padding: '16px', maxHeight: '400px', overflowY: 'auto' }}>
                {executionResult.execution_log.map((entry, i) => (
                  <div key={i} style={{ padding: '8px 12px', borderBottom: '1px solid #eee', fontSize: '13px' }}>
                    {entry.type === 'tool_call' ? (
                      <>
                        <span style={{ display: 'inline-block', background: '#2E86C1', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, marginRight: '8px' }}>
                          {entry.tool}
                        </span>
                        <span style={{ color: '#27ae60' }}>{entry.result}</span>
                      </>
                    ) : (
                      <span style={{ color: '#666', fontStyle: 'italic' }}>{entry.message}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <button className="btn btn-outline" onClick={handleRefresh} style={{ marginTop: '16px' }}>
            Refresh Case from Salesforce to Validate
          </button>
        </div>
      )}
    </div>
  );
}

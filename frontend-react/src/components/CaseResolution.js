import React, { useState } from 'react';
import { resolveCase, agentAction } from '../services/api';

function ConfidenceBar({ score }) {
  const color = score >= 0.75 ? '#27ae60' : score >= 0.5 ? '#f39c12' : '#e74c3c';
  return (
    <span>
      <span className="confidence-bar">
        <span className="confidence-fill" style={{ width: `${score * 100}%`, background: color }} />
      </span>
      {' '}{(score * 100).toFixed(0)}%
    </span>
  );
}

function ActionBadge({ action }) {
  return <span className={`action-badge ${action}`}>{action.replace('_', ' ')}</span>;
}

export default function CaseResolution() {
  const [caseId, setCaseId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [agentComments, setAgentComments] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [executionResult, setExecutionResult] = useState(null);

  const handleResolve = async () => {
    if (!caseId.trim()) { alert('Please enter a Case ID'); return; }
    setLoading(true);
    setResult(null);
    setExecutionResult(null);
    try {
      const data = await resolveCase(caseId.trim());
      setResult(data);
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setLoading(false);
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
      const res = await agentAction(caseId, action, agentComments, result);

      if (action === 'execute') {
        setExecutionResult(res);
      } else {
        // Revised resolution — update the displayed result
        const revised = res.resolution;
        setResult({ ...revised, case_id: caseId });
        setAgentComments('');
        alert('Resolution has been revised based on your feedback. Please review again.');
      }
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setActionLoading('');
    }
  };

  return (
    <div className="panel">
      {/* Case ID Input */}
      <div className="card">
        <h2>Resolve a Salesforce Case</h2>
        <div className="form-group">
          <label>Case ID (Salesforce 18-character ID)</label>
          <input
            type="text"
            value={caseId}
            onChange={(e) => setCaseId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleResolve()}
            placeholder="e.g., 500XXXXXXXXXXXX"
          />
        </div>
        <button className="btn btn-primary" onClick={handleResolve} disabled={loading}>
          {loading ? 'Analyzing...' : 'Analyze & Resolve Case'}
        </button>
        {loading && (
          <div className="loading show">
            <div className="spinner" />
            <span>Analyzing case with AI... This may take 15-30 seconds.</span>
          </div>
        )}
      </div>

      {/* AI Resolution Result */}
      {result && (
        <div className="card">
          <h2>AI Resolution Recommendation</h2>
          <div className="resolution-result">
            <div className="field">
              <span className="field-label">Recommended Action</span>
              <span className="field-value"><ActionBadge action={result.recommended_action} /></span>
            </div>
            <div className="field">
              <span className="field-label">Confidence Score</span>
              <span className="field-value"><ConfidenceBar score={result.confidence_score} /></span>
            </div>
            <div className="field">
              <span className="field-label">Issue Summary</span>
              <span className="field-value">{result.issue_summary}</span>
            </div>
            <div className="field">
              <span className="field-label">Root Cause</span>
              <span className="field-value">{result.root_cause}</span>
            </div>
            <div className="field">
              <span className="field-label">Requires Human</span>
              <span className="field-value">{result.requires_human ? 'Yes' : 'No'}</span>
            </div>
            <div className="field">
              <span className="field-label">Route to Team</span>
              <span className="field-value">{result.route_to_team || 'N/A'}</span>
            </div>
            <div className="field">
              <span className="field-label">Can Auto-Close</span>
              <span className="field-value">{result.can_auto_close ? 'Yes' : 'No'}</span>
            </div>
            <div className="field">
              <span className="field-label">Reasoning</span>
              <span className="field-value">{result.reasoning}</span>
            </div>

            <div className="section">
              <h3>Resolution Steps</h3>
              <ol className="steps-list">
                {result.resolution_steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>

            <div className="section">
              <h3>Resolution Notes</h3>
              <div className="notes-box">{result.resolution_notes}</div>
            </div>

            <div className="section">
              <h3>Suggested Customer Email</h3>
              <div className="email-preview">
                <div className="email-subject">Subject: {result.customer_email_subject}</div>
                <div className="email-body">{result.customer_email_body}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Agent Decision Panel */}
      {result && !executionResult && (
        <div className="card">
          <h2>Agent Decision</h2>
          <p style={{ color: '#666', fontSize: '14px', marginBottom: '16px' }}>
            Review the AI-generated resolution above and choose an action:
          </p>

          <div className="form-group">
            <label>Agent Comments (required for "Partially Correct" or "Not Right")</label>
            <textarea
              value={agentComments}
              onChange={(e) => setAgentComments(e.target.value)}
              placeholder="Explain what needs to change, what's wrong, or additional context..."
              rows={4}
              style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontFamily: 'inherit', fontSize: '14px' }}
            />
          </div>

          <div className="btn-group" style={{ marginTop: '16px' }}>
            <button
              className="btn btn-success"
              onClick={() => handleAgentAction('execute')}
              disabled={!!actionLoading}
              style={{ padding: '12px 24px', fontSize: '15px' }}
            >
              {actionLoading === 'execute' ? (
                <><span className="spinner" style={{ width: 16, height: 16 }} /> Executing...</>
              ) : (
                'Execute AI Steps'
              )}
            </button>

            <button
              className="btn btn-outline"
              onClick={() => handleAgentAction('partially_correct')}
              disabled={!!actionLoading}
              style={{ padding: '12px 24px', fontSize: '15px', borderColor: '#f39c12', color: '#f39c12' }}
            >
              {actionLoading === 'partially_correct' ? (
                <><span className="spinner" style={{ width: 16, height: 16 }} /> Revising...</>
              ) : (
                'Steps Partially Correct'
              )}
            </button>

            <button
              className="btn btn-outline"
              onClick={() => handleAgentAction('not_right')}
              disabled={!!actionLoading}
              style={{ padding: '12px 24px', fontSize: '15px', borderColor: '#e74c3c', color: '#e74c3c' }}
            >
              {actionLoading === 'not_right' ? (
                <><span className="spinner" style={{ width: 16, height: 16 }} /> Revising...</>
              ) : (
                'Steps Not Right'
              )}
            </button>
          </div>

          {actionLoading && (
            <div className="loading show" style={{ marginTop: '12px' }}>
              <div className="spinner" />
              <span>
                {actionLoading === 'execute'
                  ? 'AI Agent is executing resolution steps on Salesforce...'
                  : 'AI is revising resolution based on your feedback...'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Execution Result */}
      {executionResult && (
        <div className="card">
          <h2 style={{ color: '#27ae60' }}>Resolution Executed Successfully</h2>
          <div className="resolution-result">
            <div className="field">
              <span className="field-label">Status</span>
              <span className="field-value">
                <span className="action-badge auto_resolve">{executionResult.status}</span>
              </span>
            </div>
            <div className="field">
              <span className="field-label">Actions Taken</span>
              <span className="field-value">{executionResult.actions_taken}</span>
            </div>

            <div className="section">
              <h3>Execution Log</h3>
              <div style={{ background: '#f8f9fa', borderRadius: '8px', padding: '16px', maxHeight: '400px', overflowY: 'auto' }}>
                {executionResult.execution_log.map((entry, i) => (
                  <div key={i} style={{
                    padding: '10px 12px',
                    borderBottom: '1px solid #eee',
                    fontSize: '13px',
                  }}>
                    {entry.type === 'tool_call' ? (
                      <>
                        <span style={{
                          display: 'inline-block',
                          background: '#2E86C1',
                          color: 'white',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          marginRight: '8px',
                        }}>
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
        </div>
      )}
    </div>
  );
}

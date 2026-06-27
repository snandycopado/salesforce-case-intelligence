import React, { useState } from 'react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export default function CreateCase() {
  const [form, setForm] = useState({
    subject: '',
    description: '',
    type: '',
    priority: 'Medium',
    origin: 'Web',
    contactEmail: '',
    contactName: '',
  });
  const [loading, setLoading] = useState(false);
  const [createdCase, setCreatedCase] = useState(null);
  const [resolving, setResolving] = useState(false);
  const [resolution, setResolution] = useState(null);

  const caseTypes = [
    '', 'Billing', 'Technical Support', 'Account Management',
    'Subscription Management', 'General Inquiry', 'Feature Request',
    'Bug Report', 'Onboarding', 'Password Reset',
  ];

  const priorities = ['Low', 'Medium', 'High', 'Critical'];
  const origins = ['Web', 'Phone', 'Email', 'Chat'];

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleCreate = async () => {
    if (!form.subject.trim()) { alert('Subject is required'); return; }
    setLoading(true);
    setCreatedCase(null);
    setResolution(null);

    try {
      const res = await fetch(`${API_BASE}/api/create-case`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || 'Failed to create case');
      }
      const data = await res.json();
      setCreatedCase(data);
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!createdCase) return;
    setResolving(true);
    try {
      const res = await fetch(`${API_BASE}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: createdCase.case_id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || 'Resolution failed');
      }
      const data = await res.json();
      setResolution(data);
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setResolving(false);
    }
  };

  const handleReset = () => {
    setForm({ subject: '', description: '', type: '', priority: 'Medium', origin: 'Web', contactEmail: '', contactName: '' });
    setCreatedCase(null);
    setResolution(null);
  };

  return (
    <div className="panel">
      {/* Create Case Form */}
      <div className="card">
        <h2>Create Test Case in Salesforce</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>Subject *</label>
            <input name="subject" value={form.subject} onChange={handleChange}
              placeholder="e.g., Unable to login to my account" />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>Description</label>
            <textarea name="description" value={form.description} onChange={handleChange}
              placeholder="Detailed description of the issue..."
              rows={4} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontFamily: 'inherit', fontSize: '14px' }} />
          </div>
          <div className="form-group">
            <label>Case Type</label>
            <select name="type" value={form.type} onChange={handleChange}
              style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}>
              {caseTypes.map(t => <option key={t} value={t}>{t || '-- Select --'}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Priority</label>
            <select name="priority" value={form.priority} onChange={handleChange}
              style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}>
              {priorities.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Origin</label>
            <select name="origin" value={form.origin} onChange={handleChange}
              style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}>
              {origins.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Contact Name</label>
            <input name="contactName" value={form.contactName} onChange={handleChange}
              placeholder="Customer name" />
          </div>
          <div className="form-group">
            <label>Contact Email</label>
            <input name="contactEmail" value={form.contactEmail} onChange={handleChange}
              placeholder="customer@example.com" />
          </div>
        </div>

        <div className="btn-group" style={{ marginTop: '16px' }}>
          <button className="btn btn-primary" onClick={handleCreate} disabled={loading}>
            {loading ? 'Creating...' : 'Create Case in Salesforce'}
          </button>
          <button className="btn btn-outline" onClick={handleReset}>Reset</button>
        </div>

        {loading && (
          <div className="loading show">
            <div className="spinner" />
            <span>Creating case in Salesforce...</span>
          </div>
        )}
      </div>

      {/* Created Case Result */}
      {createdCase && (
        <div className="card">
          <h2 style={{ color: '#27ae60' }}>Case Created Successfully</h2>
          <div className="resolution-result">
            <div className="field">
              <span className="field-label">Case ID</span>
              <span className="field-value" style={{ fontFamily: 'monospace' }}>{createdCase.case_id}</span>
            </div>
            <div className="field">
              <span className="field-label">Case Number</span>
              <span className="field-value"><strong>{createdCase.case_number}</strong></span>
            </div>
            <div className="field">
              <span className="field-label">Subject</span>
              <span className="field-value">{createdCase.subject}</span>
            </div>
            <div className="field">
              <span className="field-label">Status</span>
              <span className="field-value">
                <span className="action-badge auto_resolve">{createdCase.status}</span>
              </span>
            </div>
          </div>

          {!resolution && (
            <div style={{ marginTop: '20px' }}>
              <button className="btn btn-success" onClick={handleResolve} disabled={resolving}
                style={{ padding: '12px 24px', fontSize: '15px' }}>
                {resolving ? 'Analyzing...' : 'Run AI Resolution on This Case'}
              </button>
              {resolving && (
                <div className="loading show" style={{ marginTop: '8px' }}>
                  <div className="spinner" />
                  <span>AI is analyzing the case and generating resolution...</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Resolution Result */}
      {resolution && (
        <div className="card">
          <h2>AI Resolution for Case {createdCase?.case_number}</h2>
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

            <div className="section">
              <h3>Resolution Steps</h3>
              <ol className="steps-list">
                {resolution.resolution_steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
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

          <p style={{ marginTop: '16px', color: '#666', fontSize: '13px' }}>
            Resolution has been stored on the case. Go to the <strong>Case Resolution</strong> tab
            and enter Case ID <code style={{ background: '#f0f0f0', padding: '2px 6px', borderRadius: '3px' }}>{createdCase?.case_id}</code> to
            approve/reject and execute the steps.
          </p>
        </div>
      )}
    </div>
  );
}

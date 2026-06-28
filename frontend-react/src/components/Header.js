import React from 'react';

export default function Header({ health }) {
  const isOnline = health?.status === 'healthy';

  return (
    <header className="header">
      <div>
        <h1>Salesforce Case Intelligence Platform</h1>
        <p className="subtitle">AI-Powered Case Resolution with RAG</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {isOnline && health?.org_name && (
          <div style={{
            background: 'rgba(255,255,255,0.12)',
            padding: '8px 14px',
            borderRadius: '8px',
            fontSize: '12px',
            lineHeight: '1.5',
            textAlign: 'right',
          }}>
            <div style={{ fontWeight: 600 }}>{health.org_name}</div>
            <div style={{ opacity: 0.8 }}>
              {health.username}
              {health.org_type && <span> | {health.org_type}</span>}
              {health.is_sandbox && <span style={{ marginLeft: 6, background: '#f39c12', color: '#000', padding: '1px 6px', borderRadius: '3px', fontSize: '10px', fontWeight: 600 }}>SANDBOX</span>}
            </div>
          </div>
        )}
        <div className="status-badge">
          <span className={`status-dot ${isOnline ? '' : 'error'}`} />
          <span>{isOnline ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>
    </header>
  );
}

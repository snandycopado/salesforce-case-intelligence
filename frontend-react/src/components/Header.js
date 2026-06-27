import React from 'react';

export default function Header({ status }) {
  const isOnline = status === 'healthy';

  return (
    <header className="header">
      <div>
        <h1>Salesforce Case Intelligence Platform</h1>
        <p className="subtitle">AI-Powered Case Resolution with RAG</p>
      </div>
      <div className="status-badge">
        <span className={`status-dot ${isOnline ? '' : 'error'}`} />
        <span>{isOnline ? 'Connected' : 'Disconnected'}</span>
      </div>
    </header>
  );
}

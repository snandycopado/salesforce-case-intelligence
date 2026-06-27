import React, { useState } from 'react';
import { generateKnowledge } from '../services/api';

export default function Dashboard({ health, articleCount, companyKbCount, onRefresh }) {
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');

  const handleGenerate = async (sync) => {
    setLoading(true);
    setLoadingText(sync ? 'Generating knowledge articles... This may take several minutes.' : 'Starting background generation...');
    try {
      const data = await generateKnowledge(sync);
      if (data.status === 'completed') {
        alert(`Generated ${data.articles_generated} knowledge articles!`);
      } else {
        alert('Knowledge generation started in background. Check logs for progress.');
      }
      onRefresh();
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel">
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{articleCount}</div>
          <div className="stat-label">Knowledge Articles</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{health?.articles_in_store ?? '-'}</div>
          <div className="stat-label">Vector Embeddings</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{companyKbCount}</div>
          <div className="stat-label">Company Guidelines</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{health ? 'Online' : 'Offline'}</div>
          <div className="stat-label">Server Status</div>
        </div>
      </div>

      <div className="card">
        <h2>Quick Actions</h2>
        <div className="btn-group">
          <button className="btn btn-primary" onClick={() => handleGenerate(false)} disabled={loading}>
            Generate Knowledge (Background)
          </button>
          <button className="btn btn-success" onClick={() => handleGenerate(true)} disabled={loading}>
            Generate Knowledge (Wait)
          </button>
          <button className="btn btn-outline" onClick={onRefresh} disabled={loading}>
            Refresh Dashboard
          </button>
        </div>
        {loading && (
          <div className="loading show">
            <div className="spinner" />
            <span>{loadingText}</span>
          </div>
        )}
      </div>
    </div>
  );
}

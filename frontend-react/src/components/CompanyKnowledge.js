import React, { useState, useEffect } from 'react';
import { getCompanyKnowledge } from '../services/api';

export default function CompanyKnowledge() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    try {
      const data = await getCompanyKnowledge();
      setFiles(data.files);
    } catch (e) {
      console.error('Failed to load company knowledge:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="panel">
        <div className="loading show">
          <div className="spinner" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="card">
        <h2>Company Standard Knowledge Guidelines</h2>
        <p className="help-text">
          Place your company's standard knowledge files in the <code>company_knowledge/</code> folder.
          Name them by Case Type (e.g., <code>Billing.md</code>, <code>Technical_Support.md</code>).
        </p>
        {files.length === 0 ? (
          <div className="empty-state">
            <div className="icon">&#128196;</div>
            <p>No company knowledge files found. Add .md, .txt, or .docx files to the company_knowledge/ folder.</p>
          </div>
        ) : (
          <table className="articles-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Filename</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.filename}>
                  <td className="article-name">{f.name}</td>
                  <td>{f.filename}</td>
                  <td><span className="type-badge">{f.type}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

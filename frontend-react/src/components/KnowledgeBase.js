import React, { useState, useEffect } from 'react';
import { getArticles, getArticle, getDownloadUrl } from '../services/api';

function markdownToHtml(md) {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^\* (.+)$/gm, '<li>$1</li>')
    .replace(/^\d+\.\s(.+)$/gm, '<li>$1</li>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
}

export default function KnowledgeBase() {
  const [articles, setArticles] = useState([]);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [articleContent, setArticleContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadArticles();
  }, []);

  const loadArticles = async () => {
    setLoading(true);
    try {
      const data = await getArticles();
      setArticles(data.articles);
    } catch (e) {
      console.error('Failed to load articles:', e);
    } finally {
      setLoading(false);
    }
  };

  const viewArticle = async (id) => {
    try {
      const data = await getArticle(id);
      setSelectedArticle(id);
      setArticleContent(data.content);
    } catch (e) {
      alert('Failed to load article: ' + e.message);
    }
  };

  if (loading) {
    return (
      <div className="panel">
        <div className="loading show">
          <div className="spinner" />
          <span>Loading articles...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="card">
        <h2>Generated Knowledge Articles</h2>
        {articles.length === 0 ? (
          <div className="empty-state">
            <div className="icon">&#128218;</div>
            <p>No articles yet. Generate the knowledge base first.</p>
          </div>
        ) : (
          <table className="articles-table">
            <thead>
              <tr>
                <th>Article</th>
                <th>Case Type</th>
                <th>Sub Type</th>
                <th>Cases</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {articles.map((a) => (
                <tr key={a.id} className={selectedArticle === a.id ? 'selected' : ''}>
                  <td className="article-name">{a.id}</td>
                  <td><span className="type-badge">{a.case_type}</span></td>
                  <td>{a.sub_type}</td>
                  <td><span className="count-badge">{a.case_count} cases</span></td>
                  <td>
                    <button className="btn btn-outline btn-sm" onClick={() => viewArticle(a.id)}>
                      View
                    </button>{' '}
                    {a.has_docx && (
                      <a href={getDownloadUrl(a.id)} className="btn btn-primary btn-sm" target="_blank" rel="noreferrer">
                        Download
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedArticle && (
        <div className="card">
          <h2>
            {selectedArticle}
            <a href={getDownloadUrl(selectedArticle)} className="btn btn-outline btn-sm" style={{ float: 'right' }} target="_blank" rel="noreferrer">
              Download .docx
            </a>
          </h2>
          <div className="article-viewer" dangerouslySetInnerHTML={{ __html: markdownToHtml(articleContent) }} />
        </div>
      )}
    </div>
  );
}

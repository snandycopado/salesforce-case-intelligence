import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import KnowledgeBase from './components/KnowledgeBase';
import CaseResolution from './components/CaseResolution';
import CompanyKnowledge from './components/CompanyKnowledge';
import CaseValidator from './components/CaseValidator';
import { getHealth, getArticles, getCompanyKnowledge } from './services/api';
import './App.css';

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'validate', label: 'Validate Case' },
  { id: 'resolve', label: 'Case Resolution' },
  { id: 'knowledge', label: 'Knowledge Base' },
  { id: 'company', label: 'Company Knowledge' },
];

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [health, setHealth] = useState(null);
  const [articleCount, setArticleCount] = useState(0);
  const [companyKbCount, setCompanyKbCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const h = await getHealth();
      setHealth(h);
    } catch {
      setHealth(null);
    }
    try {
      const a = await getArticles();
      setArticleCount(a.articles.length);
    } catch {
      setArticleCount(0);
    }
    try {
      const c = await getCompanyKnowledge();
      setCompanyKbCount(c.files.length);
    } catch {
      setCompanyKbCount(0);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <div className="app">
      <Header health={health} />

      <nav className="nav">
        {TABS.map((tab) => (
          <div
            key={tab.id}
            className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </div>
        ))}
      </nav>

      <main className="main">
        {activeTab === 'dashboard' && (
          <Dashboard
            health={health}
            articleCount={articleCount}
            companyKbCount={companyKbCount}
            onRefresh={refresh}
          />
        )}
        {activeTab === 'validate' && <CaseValidator />}
        {activeTab === 'resolve' && <CaseResolution />}
        {activeTab === 'knowledge' && <KnowledgeBase />}
        {activeTab === 'company' && <CompanyKnowledge />}
      </main>
    </div>
  );
}

export default App;

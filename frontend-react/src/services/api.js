const API_BASE = process.env.REACT_APP_API_URL || 'https://salesforce-case-intelligence.onrender.com';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Request failed');
  }
  return res.json();
}

export async function getHealth() {
  return request('/health');
}

export async function getArticles() {
  return request('/api/articles');
}

export async function getArticle(id) {
  return request(`/api/articles/${id}`);
}

export function getDownloadUrl(id) {
  return `${API_BASE}/api/articles/${id}/download`;
}

export async function getCompanyKnowledge() {
  return request('/api/company-knowledge');
}

export async function generateKnowledge(sync = false) {
  const endpoint = sync ? '/generate-knowledge-sync' : '/generate-knowledge';
  return request(endpoint);
}

export async function resolveCase(caseId) {
  return request('/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ case_id: caseId }),
  });
}

export async function agentAction(caseId, action, comments, previousResolution) {
  return request('/agent-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      case_id: caseId,
      action,
      comments,
      previous_resolution: previousResolution,
    }),
  });
}

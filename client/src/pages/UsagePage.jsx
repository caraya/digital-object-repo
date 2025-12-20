import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './UsagePage.css';

function UsagePage() {
  const [usageData, setUsageData] = useState({ logs: [], totals: {} });
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUsage = async () => {
      setStatus('loading');
      try {
        const response = await fetch('/api/usage');
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Failed to fetch usage data');
        }
        const data = await response.json();
        setUsageData(data);
        setStatus('success');
      } catch (err) {
        setStatus('error');
        setError(err.message);
        console.error('Fetch usage error:', err);
      }
    };

    fetchUsage();
  }, []);

  if (status === 'loading') {
    return <div>Loading usage data...</div>;
  }

  if (status === 'error') {
    return <div className="error-message">Error: {error}</div>;
  }

  const { logs, totals } = usageData;

  return (
    <div className="usage-container">
      <Link to="/">&larr; Back to Home</Link>
      <h1>API Usage & Costs</h1>

      <div className="totals-summary">
        <div className="summary-card">
          <h2>Total Estimated Cost</h2>
          <p>${parseFloat(totals.total_cost || 0).toFixed(6)}</p>
        </div>
        <div className="summary-card">
          <h2>Total Tokens Used</h2>
          <p>{parseInt(totals.total_tokens || 0).toLocaleString()}</p>
        </div>
      </div>

      <h2>Usage Log</h2>
      <div className="usage-table-container">
        <table className="usage-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Model</th>
              <th>Prompt Tokens</th>
              <th>Completion Tokens</th>
              <th>Total Tokens</th>
              <th>Estimated Cost</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>{new Date(log.created_at).toLocaleString()}</td>
                <td>{log.model}</td>
                <td>{(log.prompt_tokens || 0).toLocaleString()}</td>
                <td>{(log.completion_tokens || 0).toLocaleString()}</td>
                <td>{(log.total_tokens || 0).toLocaleString()}</td>
                <td>${(parseFloat(log.cost) || 0).toFixed(6)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default UsagePage;

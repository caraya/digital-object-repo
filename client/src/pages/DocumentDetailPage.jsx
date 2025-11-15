import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import AddToNotebook from '../components/AddToNotebook';
import './DocumentDetailPage.css';

function DocumentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [document, setDocument] = useState(null);
  const [status, setStatus] = useState('loading'); // loading, success, error
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [summaryStatus, setSummaryStatus] = useState('idle'); // idle, loading, success, error
  const [summaryError, setSummaryError] = useState(null);
  const [analysis, setAnalysis] = useState({});
  const [analysisStatus, setAnalysisStatus] = useState({});
  const [analysisError, setAnalysisError] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const fetchDocument = async () => {
      setStatus('loading');
      try {
        const response = await fetch(`/api/documents/${id}`);
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Failed to fetch document');
        }
        const data = await response.json();
        setDocument(data);
        setStatus('success');
      } catch (err) {
        setStatus('error');
        setError(err.message);
        console.error('Fetch document error:', err);
      }
    };

    fetchDocument();
  }, [id]);

  const handleGetSummary = async () => {
    setSummaryStatus('loading');
    setSummary(null);
    setSummaryError(null);
    try {
      const response = await fetch(`/api/documents/${id}/summary`);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to fetch summary');
      }
      const data = await response.json();
      setSummary(data.summary);
      setSummaryStatus('success');
    } catch (err) {
      setSummaryStatus('error');
      setSummaryError(err.message);
      console.error('Fetch summary error:', err);
    }
  };

  const handleGetAnalysis = async (type) => {
    setAnalysisStatus(prev => ({ ...prev, [type]: 'loading' }));
    setAnalysis(prev => ({ ...prev, [type]: null }));
    setAnalysisError(prev => ({ ...prev, [type]: null }));

    try {
      const response = await fetch(`/api/documents/${id}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `Failed to fetch ${type}`);
      }

      const data = await response.json();
      setAnalysis(prev => ({ ...prev, [type]: data.result }));
      setAnalysisStatus(prev => ({ ...prev, [type]: 'success' }));
    } catch (err) {
      setAnalysisStatus(prev => ({ ...prev, [type]: 'error' }));
      setAnalysisError(prev => ({ ...prev, [type]: err.message }));
      console.error(`Fetch ${type} error:`, err);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
      try {
        const response = await fetch(`/api/documents/${id}`, {
          method: 'DELETE',
        });
        if (!response.ok) {
          const errData = await response.json().catch(() => ({ error: 'Failed to delete item' }));
          throw new Error(errData.error);
        }
        navigate('/');
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const getYouTubeId = (url) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  if (status === 'loading') {
    return <div>Loading document...</div>;
  }

  if (status === 'error') {
    return <div className="error-message">Error: {error}</div>;
  }

  if (!document) {
    return <div>Loading...</div>;
  }

  const youTubeId = getYouTubeId(document.source_url);
  const isVideo = document.mime_type && document.mime_type.startsWith('video/');

  return (
    <div className="document-detail-container">
      <Link to="/" className="back-link">&larr; Back to All Items</Link>

      <div className="document-meta">
        <p>Document ID: {document.id}</p>
        <p>Created at: {new Date(document.created_at).toLocaleString()}</p>
        <p>Updated at: {new Date(document.updated_at).toLocaleString()}</p>
        {document.source_url && <p>Source: <a href={document.source_url} target="_blank" rel="noopener noreferrer">{document.source_url}</a></p>}
      </div>

      <div className="document-actions">
        {document.source_url && (
            <a href={document.source_url} className="action-button" target="_blank" rel="noopener noreferrer">
                View Original
            </a>
        )}
        <button onClick={() => setIsModalOpen(true)} className="action-button">
          Add to Notebook
        </button>
        <button onClick={handleDelete} className="delete-button">Delete Item</button>
      </div>

      {youTubeId && (
        <div className="video-container">
          <iframe
            width="560"
            height="315"
            src={`https://www.youtube.com/embed/${youTubeId}`}
            frameBorder="0"
            allowFullScreen
            title="Embedded YouTube Video"
          ></iframe>
        </div>
      )}

      {isVideo && (
        <div className="video-container">
          <video controls src={`/api/documents/${document.id}/download`} type={document.mime_type} key={document.id}>
            Your browser does not support the video tag.
          </video>
        </div>
      )}

      {document.content && (
        <div className="content-section">
          <h2>Extracted Content</h2>
          <div className="extracted-content-markdown">
            <ReactMarkdown>{document.content}</ReactMarkdown>
          </div>
        </div>
      )}

      <div className="analysis-section">
        <h2>AI Analysis</h2>
        <div className="analysis-buttons">
          <button onClick={handleGetSummary} disabled={summaryStatus === 'loading'}>
            {summaryStatus === 'loading' ? 'Generating Summary...' : 'Generate Summary'}
          </button>
          <button onClick={() => handleGetAnalysis('toc')} disabled={analysisStatus.toc === 'loading'}>
            {analysisStatus.toc === 'loading' ? 'Generating ToC...' : 'Generate Table of Contents'}
          </button>
          <button onClick={() => handleGetAnalysis('insights')} disabled={analysisStatus.insights === 'loading'}>
            {analysisStatus.insights === 'loading' ? 'Generating Insights...' : 'Generate Key Insights'}
          </button>
        </div>

        {summaryStatus === 'error' && <div className="error-message">Summary Error: {summaryError}</div>}
        {summaryStatus === 'success' && summary && (
          <div className="summary-content">
            <h3>Summary</h3>
            <ReactMarkdown>{summary}</ReactMarkdown>
          </div>
        )}

        {Object.keys(analysisStatus).map(type => (
          <div key={type}>
            {analysisStatus[type] === 'error' && <div className="error-message">{type} Error: {analysisError[type]}</div>}
            {analysisStatus[type] === 'success' && analysis[type] && (
              <div className="analysis-result-content">
                <h3>{type === 'toc' ? 'Table of Contents' : 'Key Insights'}</h3>
                <div className="markdown-content">
                  <ReactMarkdown>{analysis[type]}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="delete-section">
        <button onClick={handleDelete} className="delete-button">Delete Item</button>
      </div>

      <AddToNotebook
        documentId={document.id}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}

export default DocumentDetailPage;

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import './NotebookDetailPage.css';

function NotebookDetailPage() {
  const { id } = useParams();
  const [notebook, setNotebook] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const textareaRef = useRef(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [queryStatus, setQueryStatus] = useState('idle'); // idle, loading, success, error
  const [queryError, setQueryError] = useState('');

  const fetchNotebook = useCallback(async () => {
    setStatus('loading');
    try {
      const response = await fetch(`/api/notebooks/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch notebook');
      }
      const data = await response.json();
      setNotebook(data);
      setEditedContent(data.content || '');
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setError(err.message);
    }
  }, [id]);

  useEffect(() => {
    fetchNotebook();
  }, [fetchNotebook]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [isEditing, editedContent]);

  const handleSave = async () => {
    try {
      const response = await fetch(`/api/notebooks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editedContent }),
      });
      if (!response.ok) {
        throw new Error('Failed to save content');
      }
      const updatedNotebook = await response.json();
      setNotebook(prev => ({ ...prev, content: updatedNotebook.content, updated_at: updatedNotebook.updated_at }));
      setIsEditing(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRemoveDocument = async (documentId) => {
    if (window.confirm('Are you sure you want to remove this document from the notebook?')) {
      try {
        const response = await fetch(`/api/notebooks/${id}/documents/${documentId}`, {
          method: 'DELETE',
        });
        if (!response.ok) {
          throw new Error('Failed to remove document');
        }
        fetchNotebook(); // Refresh notebook data
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const handleAskQuestion = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;

    setQueryStatus('loading');
    setAnswer('');
    setQueryError('');

    try {
      const response = await fetch(`/api/notebooks/${id}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to get an answer');
      }

      const data = await response.json();
      setAnswer(data.answer);
      setQueryStatus('success');
    } catch (err) {
      setQueryError(err.message);
      setQueryStatus('error');
    }
  };

  if (status === 'loading') return <div>Loading notebook...</div>;
  if (status === 'error') return <div className="error-message">Error: {error}</div>;

  return (
    <div className="notebook-detail-container">
      <Link to="/notebooks">&larr; Back to Notebooks</Link>
      <h1>{notebook.title}</h1>
      <p className="notebook-meta">Last updated: {new Date(notebook.updated_at).toLocaleString()}</p>

      <div className="notebook-layout">
        {/* Left Column: Grouped Items */}
        <div className="grouped-documents-section layout-column">
          <h2>Grouped Items ({notebook.documents?.length || 0})</h2>
          <div className="grouped-items-list">
            {notebook.documents && notebook.documents.length > 0 ? (
              notebook.documents.map(doc => (
                <div key={doc.id} className="grouped-item-card">
                  <Link to={`/documents/${doc.id}`}>
                    <h4>{doc.title}</h4>
                    <p>Added: {new Date(doc.created_at).toLocaleDateString()}</p>
                  </Link>
                  <button onClick={() => handleRemoveDocument(doc.id)} className="remove-doc-button">
                    &times;
                  </button>
                </div>
              ))
            ) : (
              <p>No items have been added to this notebook yet.</p>
            )}
          </div>
        </div>

        {/* Center Column: Notes */}
        <div className="notebook-content-section layout-column">
          <h2>Notes</h2>
          {isEditing ? (
            <div className="editing-area">
              <textarea
                ref={textareaRef}
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="notes-textarea"
              />
              <div className="editing-controls">
                <button onClick={handleSave} className="save-button">Save</button>
                <button onClick={() => setIsEditing(false)} className="cancel-button">Cancel</button>
              </div>
            </div>
          ) : (
            <div>
              <button onClick={() => setIsEditing(true)} className="edit-button">Edit Notes</button>
              <div className="content-box">
                {notebook.content ? (
                  <ReactMarkdown>{notebook.content}</ReactMarkdown>
                ) : (
                  <p className="placeholder-text">No notes yet. Click 'Edit Notes' to add some.</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Q&A */}
        <div className="qna-section layout-column">
          <h2>Ask a Question</h2>
          <form onSubmit={handleAskQuestion} className="qna-form">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a question based on the content of your notes and grouped items..."
              className="notes-textarea"
              rows="3"
            />
            <button type="submit" disabled={queryStatus === 'loading'}>
              {queryStatus === 'loading' ? 'Thinking...' : 'Ask Question'}
            </button>
          </form>

          {queryStatus === 'loading' && <p>Getting your answer...</p>}
          {queryStatus === 'error' && <div className="error-message">{queryError}</div>}
          {queryStatus === 'success' && answer && (
            <div className="answer-section">
              <h3>Answer</h3>
              <div className="content-box">
                <ReactMarkdown>{answer}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default NotebookDetailPage;

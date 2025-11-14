import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './NotebooksPage.css';

function NotebooksPage() {
  const [notebooks, setNotebooks] = useState([]);
  const [newNotebookTitle, setNewNotebookTitle] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchNotebooks = async () => {
    try {
      setError('');
      setIsLoading(true);
      const response = await fetch('/api/notebooks');
      if (!response.ok) {
        throw new Error('Failed to fetch notebooks');
      }
      const data = await response.json();
      setNotebooks(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotebooks();
  }, []);

  const handleCreateNotebook = async (e) => {
    e.preventDefault();
    if (!newNotebookTitle.trim()) {
      setError('Title cannot be empty');
      return;
    }
    try {
      const response = await fetch('/api/notebooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newNotebookTitle }),
      });
      if (!response.ok) {
        throw new Error('Failed to create notebook');
      }
      setNewNotebookTitle('');
      fetchNotebooks(); // Refresh the list
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="notebooks-container">
      <h2>Notebooks</h2>
      {error && <p className="error-message">{error}</p>}

      <div className="create-notebook-form">
        <form onSubmit={handleCreateNotebook}>
          <input
            type="text"
            value={newNotebookTitle}
            onChange={(e) => setNewNotebookTitle(e.target.value)}
            placeholder="Enter new notebook title..."
          />
          <button type="submit">Create Notebook</button>
        </form>
      </div>

      {isLoading ? (
        <p>Loading notebooks...</p>
      ) : (
        <div className="notebooks-list">
          {notebooks.length > 0 ? (
            notebooks.map((notebook) => (
              <div key={notebook.id} className="notebook-card">
                <Link to={`/notebooks/${notebook.id}`}>
                  <h3>{notebook.title}</h3>
                  <p>Last updated: {new Date(notebook.updated_at).toLocaleString()}</p>
                </Link>
              </div>
            ))
          ) : (
            <p>No notebooks found. Create one to get started!</p>
          )}
        </div>
      )}
    </div>
  );
}

export default NotebooksPage;

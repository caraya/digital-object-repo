import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AddToNotebook from './AddToNotebook';
import './AllItemsList.css';
import './AddToNotebook.css';

function AllItemsList() {
  const [allItems, setAllItems] = useState([]);
  const [error, setError] = useState('');
  const [modalOpenFor, setModalOpenFor] = useState(null); // Tracks which item's modal is open

  const fetchAllItems = async () => {
    try {
      setError('');
      const response = await fetch('/api/documents');
      if (!response.ok) {
        throw new Error('Failed to fetch items');
      }
      const items = await response.json();
      // Sort all items by creation date, newest first
      items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setAllItems(items);

    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    fetchAllItems();
  }, []);

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      try {
        const response = await fetch(`/api/documents/${id}`, {
          method: 'DELETE',
        });
        if (!response.ok) {
          const errData = await response.json().catch(() => ({ error: 'Failed to delete item' }));
          throw new Error(errData.error);
        }
        // Refresh the list after deletion
        fetchAllItems();
      } catch (err) {
        setError(err.message);
      }
    }
  };

  return (
    <div className="search-container">
      <h2>All Items</h2>
      {error && <p className="error-message">{error}</p>}
      
      <div className="results-container">
        {allItems.length > 0 ? (
          <div className="items-grid" role="table">
            <div className="grid-header" role="row">
              <div role="columnheader">Type</div>
              <div role="columnheader">Title</div>
              <div role="columnheader">Created</div>
              <div role="columnheader">Actions</div>
            </div>
            {allItems.map((item) => {
              const isUrl = item.file_path && item.file_path.startsWith('http');
              return (
                <React.Fragment key={item.id}>
                  <div className="grid-cell" role="cell">{isUrl ? 'URL' : 'File'}</div>
                  <div className="grid-cell" role="cell">
                    <Link to={`/documents/${item.id}`}>{item.title || item.file_path}</Link>
                  </div>
                  <div className="grid-cell" role="cell">{new Date(item.created_at).toLocaleDateString()}</div>
                  <div className="grid-cell actions-cell" role="cell">
                    <Link to={`/documents/${item.id}`} className="action-button">View Details</Link>
                    {isUrl ? (
                      <a 
                        href={item.file_path}
                        className="action-button"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View Original
                      </a>
                    ) : (
                      <a 
                        href={`/api/documents/${item.id}/download`} 
                        className="action-button"
                        download
                        >
                          Download
                        </a>
                      )}
                    <button onClick={() => setModalOpenFor(item.id)} className="action-button">
                      Add to Notebook
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="delete-button">Delete</button>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        ) : (
          <p>No items found. Upload a file or add a URL to get started.</p>
        )}
      </div>

      {modalOpenFor && (
        <AddToNotebook
          documentId={modalOpenFor}
          isOpen={!!modalOpenFor}
          onClose={() => setModalOpenFor(null)}
        />
      )}
    </div>
  );
}

export default AllItemsList;

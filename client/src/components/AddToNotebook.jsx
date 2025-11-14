import React, { useState, useRef, useEffect } from 'react';
import './AddToNotebook.css';

function AddToNotebook({ documentId, isOpen, onClose }) {
  const dialogRef = useRef(null);
  const [notebooks, setNotebooks] = useState([]);
  const [selectedNotebook, setSelectedNotebook] = useState('');
  const [newNotebookTitle, setNewNotebookTitle] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      const fetchNotebooks = async () => {
        setSuccessMessage('');
        setError('');
        try {
          const response = await fetch('/api/notebooks');
          if (!response.ok) throw new Error('Failed to fetch notebooks');
          const data = await response.json();
          setNotebooks(data);
          if (data.length > 0) {
            setSelectedNotebook(data[0].id);
          }
        } catch (err) {
          setError(err.message);
        }
      };

      fetchNotebooks();
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [isOpen]);

  const handleClose = () => {
    setError('');
    setSuccessMessage('');
    onClose();
  };

  const handleAddToNotebook = async () => {
    try {
      const response = await fetch(`/api/notebooks/${selectedNotebook}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to add to notebook');
      }
      setSuccessMessage('Successfully added to notebook!');
      setTimeout(handleClose, 1500);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreateAndAddToNotebook = async () => {
    if (!newNotebookTitle.trim()) {
      setError('New notebook title is required');
      return;
    }
    try {
      const createResponse = await fetch('/api/notebooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newNotebookTitle }),
      });
      if (!createResponse.ok) throw new Error('Failed to create notebook');
      const newNotebook = await createResponse.json();

      const addResponse = await fetch(`/api/notebooks/${newNotebook.id}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId }),
      });
      if (!addResponse.ok) throw new Error('Failed to add to new notebook');
      
      setSuccessMessage(`Successfully created and added to "${newNotebook.title}"!`);
      setNewNotebookTitle('');
      setTimeout(handleClose, 1500);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
      <dialog ref={dialogRef} className="add-notebook-dialog" onClose={handleClose}>
        <div className="modal-content">
          <h3>Add to Notebook</h3>
          {error && <p className="error-message">{error}</p>}
          {successMessage && <p className="success-message">{successMessage}</p>}

          <div className="modal-section">
            <h4>Add to Existing Notebook</h4>
            <select 
              value={selectedNotebook} 
              onChange={(e) => setSelectedNotebook(e.target.value)}
              disabled={notebooks.length === 0}
            >
              {notebooks.length === 0 ? (
                <option>No notebooks found. Create one below.</option>
              ) : (
                notebooks.map(notebook => (
                  <option key={notebook.id} value={notebook.id}>{notebook.title}</option>
                ))
              )}
            </select>
            <button 
              onClick={handleAddToNotebook}
              disabled={notebooks.length === 0}
            >
              Add to Selected
            </button>
          </div>

          <div className="modal-section">
            <h4>Create & Add to New Notebook</h4>
            <input 
              type="text" 
              placeholder="New notebook title..."
              value={newNotebookTitle}
              onChange={(e) => setNewNotebookTitle(e.target.value)}
            />
            <button onClick={handleCreateAndAddToNotebook}>Create & Add</button>
          </div>

          <div className="modal-cancel-section">
            <button onClick={handleClose} className="modal-cancel-button">Cancel</button>
          </div>
        </div>
      </dialog>
  );
}

export default AddToNotebook;

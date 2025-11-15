import React, { useState } from 'react';

function TextForm() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState(''); // '', 'success', 'error'
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('loading');
    setMessage('');

    try {
      const response = await fetch('/api/texts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title, content }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to add text block');
      }

      setStatus('success');
      setMessage('Text block added successfully!');
      setTitle('');
      setContent('');
      // Optionally, trigger a refresh of the items list
      window.dispatchEvent(new Event('itemAdded'));
    } catch (err) {
      setStatus('error');
      setMessage(err.message);
    }
  };

  return (
    <div className="text-form">
      <h2>Add a Text Block</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="title">Title</label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="content">Content</label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            rows="10"
          ></textarea>
        </div>
        <button type="submit" disabled={status === 'loading'}>
          {status === 'loading' ? 'Adding...' : 'Add Text'}
        </button>
      </form>
      {message && (
        <p className={status === 'success' ? 'success-message' : 'error-message'}>
          {message}
        </p>
      )}
    </div>
  );
}

export default TextForm;

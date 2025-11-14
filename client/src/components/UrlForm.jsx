import React, { useState } from 'react';

function UrlForm() {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState('idle'); // idle, submitting, success, error
  const [error, setError] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!url) {
      setStatus('error');
      setError('Please enter a URL.');
      return;
    }

    setStatus('submitting');
    setError(null);

    try {
      const response = await fetch('/api/urls', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Submitting URL failed');
      }

      const result = await response.json();
      setStatus('success');
      setUrl(''); // Clear input on success
      console.log('URL submitted successfully:', result);
      // Reload the page to show the new item in the list
      window.location.reload();
    } catch (err) {
      setStatus('error');
      setError(err.message);
      console.error('URL submission error:', err);
    }
  };

  return (
    <div className="url-form">
      <h2>Add a URL</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
          required
        />
        <button type="submit" disabled={status === 'submitting'}>
          {status === 'submitting' ? 'Adding...' : 'Add URL'}
        </button>
      </form>
      
      {status === 'success' && <p className="success-message">URL added successfully!</p>}
      {status === 'error' && <p className="error-message">Error: {error}</p>}
    </div>
  );
}

export default UrlForm;

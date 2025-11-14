import React, { useState } from 'react';

function FileUpload() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle'); // idle, uploading, success, error
  const [error, setError] = useState(null);

  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) {
      setStatus('error');
      setError('Please select a file first.');
      return;
    }

    setStatus('uploading');
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/documents', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Upload failed');
      }

      const result = await response.json();
      setStatus('success');
      console.log('Upload successful:', result);
      // Reload the page to show the new item in the list
      window.location.reload();
    } catch (err) {
      setStatus('error');
      setError(err.message);
      console.error('Upload error:', err);
    }
  };

  return (
    <div className="file-upload">
      <h2>Upload a Document</h2>
      <input type="file" onChange={handleFileChange} />
      <button onClick={handleUpload} disabled={status === 'uploading'}>
        {status === 'uploading' ? 'Uploading...' : 'Upload'}
      </button>
      
      {status === 'success' && <p className="success-message">File uploaded successfully!</p>}
      {status === 'error' && <p className="error-message">Error: {error}</p>}
    </div>
  );
}

export default FileUpload;

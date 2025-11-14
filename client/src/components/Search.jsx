import React, { useState } from 'react';
import { Link } from 'react-router-dom';

function Search() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('idle'); // idle, searching, success, error
  const [error, setError] = useState(null);

  const handleSearch = async (event) => {
    event.preventDefault();
    if (!query) {
      setStatus('error');
      setError('Please enter a search query.');
      return;
    }

    setStatus('searching');
    setError(null);
    setResults([]);

    try {
      const response = await fetch('/api/documents/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Search failed');
      }

      const data = await response.json();
      setResults(data);
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setError(err.message);
      console.error('Search error:', err);
    }
  };

  return (
    <div className="search-container">
      <h2>Search Documents</h2>
      <form onSubmit={handleSearch}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter your search query..."
        />
        <button type="submit" disabled={status === 'searching'}>
          {status === 'searching' ? 'Searching...' : 'Search'}
        </button>
      </form>

      {status === 'error' && <p className="error-message">Error: {error}</p>}
      
      <div className="search-results">
        {status === 'success' && results.length === 0 && <p>No results found.</p>}
        {results.length > 0 && (
          <ul>
            {results.map((result) => (
              <Link to={`/documents/${result.id}`} key={result.id} className="search-result-link">
                <li className="search-result-item">
                  <h3>{result.title}</h3>
                  <p>Similarity Distance: {result.distance.toFixed(4)}</p>
                  <small>ID: {result.id} | Created: {new Date(result.created_at).toLocaleString()}</small>
                </li>
              </Link>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default Search;

import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import Search from '../components/Search';
import './SearchResultsPage.css';

function SearchResultsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/documents/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query, page, limit: 10 }),
        });

        if (!response.ok) {
          throw new Error('Search failed');
        }

        const data = await response.json();
        setResults(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (query) {
      fetchResults();
    } else {
      setResults([]);
    }
  }, [query, page]);

  const handlePageChange = (newPage) => {
    setSearchParams({ q: query, page: newPage });
  };

  return (
    <div className="search-results-page">
      <Search />
      {query && <h1>Search Results for "{query}"</h1>}
      
      {loading && <p>Loading...</p>}
      {error && <p className="error-message">Error: {error}</p>}
      
      {!loading && !error && query && results.length === 0 && (
        <p>No results found.</p>
      )}

      <ul className="search-results-list">
        {results.map((result) => (
          <li key={result.id} className="search-result-item">
            <Link to={`/documents/${result.id}`} className="search-result-link">
              <h3>{result.title}</h3>
              <div className="search-result-meta">
                <span>Score: {result.score ? Number(result.score).toFixed(4) : 'N/A'}</span>
                <span> | </span>
                <span>Created: {new Date(result.created_at).toLocaleDateString()}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <div className="pagination">
        <button 
          onClick={() => handlePageChange(page - 1)}
          disabled={page <= 1 || loading}
        >
          Previous
        </button>
        <span>Page {page}</span>
        <button 
          onClick={() => handlePageChange(page + 1)}
          disabled={results.length < 10 || loading}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default SearchResultsPage;

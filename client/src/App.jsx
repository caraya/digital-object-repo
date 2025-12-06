import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import FileUpload from './components/FileUpload';
import UrlForm from './components/UrlForm';
import TextForm from './components/TextForm';
import Search from './components/Search';
import AllItemsList from './components/AllItemsList';
import DocumentDetailPage from './pages/DocumentDetailPage';
import UsagePage from './pages/UsagePage';
import NotebooksPage from './pages/NotebooksPage';
import NotebookDetailPage from './pages/NotebookDetailPage';
import SearchResultsPage from './pages/SearchResultsPage';
import './App.css';
import './components/TextForm.css';

function HomePage() {
  return (
    <div className="home-grid">
      <div className="left-column">
        <div className="forms-container">
          <FileUpload />
          <UrlForm />
          <TextForm />
        </div>
        <hr className="divider" />
        <Search />
      </div>
      <div className="right-column">
        <AllItemsList />
      </div>
    </div>
  );
}

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Digital Object Repository</h1>
        <nav>
          <Link to="/">Home</Link>
          <Link to="/search">Search</Link>
          <Link to="/notebooks">Notebooks</Link>
          <Link to="/usage">Usage</Link>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchResultsPage />} />
          <Route path="/documents/:id" element={<DocumentDetailPage />} />
          <Route path="/usage" element={<UsagePage />} />
          <Route path="/notebooks" element={<NotebooksPage />} />
          <Route path="/notebooks/:id" element={<NotebookDetailPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;

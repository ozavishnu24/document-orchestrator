import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

// USE ENV VARIABLE FOR CLOUD DEPLOYMENT, FALLBACK TO LOCALHOST
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function App() {
  const [file, setFile] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch documents on load
  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/documents`);
      setDocuments(res.data);
    } catch (err) {
      console.error("Error fetching documents:", err);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return alert("Please select a file");
    
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      await axios.post(`${API_URL}/api/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      fetchDocuments(); // Refresh list
      setFile(null); // Reset file input
      e.target.reset(); // Clear form
    } catch (err) {
      console.error(err);
      alert("Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (id) => {
    try {
      await axios.post(`${API_URL}/api/send/${id}`);
      alert("Email workflow triggered!");
      fetchDocuments();
    } catch (err) {
      console.error(err);
      alert("Failed to send");
    }
  };

  return (
    <div className="app-container">
      <h1>📄 AI Document Orchestrator</h1>
      
      {/* Upload Section */}
      <div className="upload-section">
        <h3>Upload Document (PDF)</h3>
        <form onSubmit={handleUpload}>
          <input type="file" onChange={(e) => setFile(e.target.files[0])} />
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Processing...' : 'Upload & Extract'}
          </button>
        </form>
      </div>

      {/* List Section */}
      <h3>Processed Documents</h3>
      <div className="doc-list">
        {documents.map((doc) => (
          <div key={doc._id} className="doc-card">
            <div className="doc-header">
              <strong>{doc.filename}</strong>
              <span className={`status-badge ${doc.status === 'Sent' ? 'status-sent' : 'status-pending'}`}>
                {doc.status}
              </span>
            </div>
            
            <div className="doc-details">
              <p><b>Type:</b> {doc.extractedData?.documentType}</p>
              <p><b>Date:</b> {doc.extractedData?.date}</p>
              <p><b>Summary:</b> {doc.extractedData?.summary}</p>
              <p><b>Parties:</b> {doc.extractedData?.partiesInvolved?.join(', ')}</p>
            </div>

            {doc.status !== 'Sent' && (
              <button onClick={() => handleSend(doc._id)} className="btn-secondary">
                Approve & Send Email
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
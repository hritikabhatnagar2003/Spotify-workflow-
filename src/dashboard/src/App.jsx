import React, { useState, useEffect } from 'react';
import './index.css';
import StatsHeader from './components/StatsHeader';
import InsightCard from './components/InsightCard';

function App() {
  const [stats, setStats] = useState(null);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, insightsRes] = await Promise.all([
          fetch('http://localhost:3001/api/stats'),
          fetch('http://localhost:3001/api/insights')
        ]);

        if (!statsRes.ok || !insightsRes.ok) {
          throw new Error('Failed to fetch data from API');
        }

        const statsData = await statsRes.json();
        const insightsData = await insightsRes.json();

        setStats(statsData);
        setInsights(insightsData);
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="loader-container">
        <div className="loader"></div>
        <div>Loading Spotify Review Engine Data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="loader-container" style={{ color: '#ff6b6b' }}>
        <h2>Error Loading Data</h2>
        <p>{error}</p>
        <p style={{ marginTop: '1rem', color: 'var(--text-subdued)' }}>
          Make sure the backend API is running on port 3001 (<code>node src/api/server.js</code>).
        </p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header animate-fade-in">
        <h1 className="dashboard-title">Spotify Review Engine</h1>
        <p className="dashboard-subtitle">Active Discovery Pipeline & PM Dashboard</p>
      </header>

      <StatsHeader stats={stats} />

      <main>
        <h2 className="insights-header animate-fade-in">
          Weekly Insights Digest
          {insights?.generated_at && (
            <span style={{ fontSize: '0.9rem', color: 'var(--text-subdued)', marginLeft: '1rem', fontWeight: 'normal' }}>
              (Generated: {new Date(insights.generated_at).toLocaleDateString()})
            </span>
          )}
        </h2>

        {insights?.insights && insights.insights.length > 0 ? (
          <div className="insights-grid">
            {insights.insights.map((insight, index) => (
              <InsightCard key={index} insight={insight} index={index} />
            ))}
          </div>
        ) : (
          <div className="insight-card animate-fade-in" style={{ textAlign: 'center', padding: '3rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>No insights generated yet</h3>
            <p style={{ color: 'var(--text-subdued)' }}>Run the pipeline to generate your first Weekly Digest.</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;

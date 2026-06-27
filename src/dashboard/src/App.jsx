import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  MessageSquare, 
  TrendingUp, 
  Settings,
  Download
} from 'lucide-react';
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
        const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        
        const [statsRes, insightsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/stats`),
          fetch(`${API_BASE_URL}/api/insights`)
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
        <div style={{ color: 'var(--text-muted)' }}>Loading Workspace...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="loader-container">
        <h2 style={{ color: '#ef4444' }}>Connection Error</h2>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="var(--brand-green)">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.54.659.301 1.02zm1.44-3.3c-.301.42-.84.54-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.6.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
          </svg>
          <div className="sidebar-title">Spotify<br/>Review<br/>Discovery</div>
        </div>

        <nav className="nav-menu">
          <div className="nav-item active">
            <LayoutDashboard size={20} />
            Dashboard
          </div>
          <div className="nav-item">
            <MessageSquare size={20} />
            Feedback Analysis
          </div>
          <div className="nav-item">
            <TrendingUp size={20} />
            Market Trends
          </div>
          <div className="nav-item">
            <Settings size={20} />
            Settings
          </div>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="top-nav">
          <div className="top-nav-title">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="var(--brand-green)">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.54.659.301 1.02zm1.44-3.3c-.301.42-.84.54-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.6.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
            </svg>
            Spotify Review Discovery
          </div>
          <div className="avatar">
            <svg viewBox="0 0 36 36" width="36" height="36" fill="var(--brand-green)">
              <circle cx="18" cy="14" r="6" fill="#1db954" opacity="0.8"/>
              <path d="M18 22c-6 0-10 4-10 8v2h20v-2c0-4-4-8-10-8z" fill="#1db954" opacity="0.8"/>
            </svg>
          </div>
        </header>

        <div className="scroll-area">
          <StatsHeader stats={stats} />

          <div className="insights-header-row animate-fade-in">
            <h2 className="insights-title">Weekly RAG Digest</h2>
            <button className="btn-export">
              <Download size={16} /> Export Report
            </button>
          </div>

          {insights?.insights && insights.insights.length > 0 ? (
            <div className="insights-grid">
              {insights.insights.map((insight, index) => (
                <InsightCard key={index} insight={insight} index={index} />
              ))}
            </div>
          ) : (
            <div className="insight-card animate-fade-in" style={{ textAlign: 'center', padding: '3rem' }}>
              <h3 style={{ marginBottom: '1rem' }}>No insights generated yet</h3>
              <p style={{ color: 'var(--text-muted)' }}>Run the pipeline to generate your first Weekly Digest.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;

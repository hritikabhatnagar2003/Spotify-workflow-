import React from 'react';

const StatsHeader = ({ stats }) => {
  if (!stats) return null;

  return (
    <div className="stats-grid animate-fade-in">
      <div className="stat-card">
        <div className="stat-label">Total Reviews</div>
        <div className="stat-value">{stats.total?.toLocaleString() || 0}</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Vectorized Chunks</div>
        <div className="stat-value">{stats.vectorized?.toLocaleString() || 0}</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Play Store</div>
        <div className="stat-value">
          {stats.byPlatform?.find(p => p.platform.toLowerCase().includes('play'))?.count.toLocaleString() || 0}
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-label">App Store</div>
        <div className="stat-value">
          {stats.byPlatform?.find(p => p.platform.toLowerCase().includes('appstore'))?.count.toLocaleString() || 0}
        </div>
      </div>
    </div>
  );
};

export default StatsHeader;

import React from 'react';
import { MessageSquare, Database, PlaySquare, Smartphone } from 'lucide-react';

const StatsHeader = ({ stats }) => {
  if (!stats) return null;

  return (
    <div className="stats-grid animate-fade-in">
      <div className="stat-card">
        <div className="stat-header">
          <span className="stat-label">Total Reviews</span>
          <MessageSquare size={20} className="stat-icon" />
        </div>
        <div className="stat-value">{stats.total?.toLocaleString() || 0}</div>
      </div>
      
      <div className="stat-card">
        <div className="stat-header">
          <span className="stat-label">Vectorized</span>
          <Database size={20} className="stat-icon" />
        </div>
        <div className="stat-value">{stats.vectorized?.toLocaleString() || 0}</div>
      </div>
      
      <div className="stat-card">
        <div className="stat-header">
          <span className="stat-label">Play Store</span>
          <PlaySquare size={20} className="stat-icon" />
        </div>
        <div className="stat-value">
          {stats.byPlatform?.find(p => p.platform.toLowerCase().includes('play'))?.count.toLocaleString() || 0}
        </div>
      </div>
      
      <div className="stat-card">
        <div className="stat-header">
          <span className="stat-label">App Store</span>
          <Smartphone size={20} className="stat-icon" />
        </div>
        <div className="stat-value">
          {stats.byPlatform?.find(p => p.platform.toLowerCase().includes('appstore'))?.count.toLocaleString() || 0}
        </div>
      </div>
    </div>
  );
};

export default StatsHeader;

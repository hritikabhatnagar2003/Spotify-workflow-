import React from 'react';

const InsightCard = ({ insight, index }) => {
  const getImpactClass = (impact) => {
    switch(impact?.toLowerCase()) {
      case 'high': return 'impact-high';
      case 'medium': return 'impact-medium';
      case 'low': return 'impact-low';
      default: return 'impact-medium';
    }
  };

  return (
    <div 
      className="insight-card animate-fade-in" 
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      <div className="insight-theme">
        <span>{insight.theme}</span>
        <span className={`impact-badge ${getImpactClass(insight.user_impact)}`}>
          {insight.user_impact || 'Medium'} Impact
        </span>
      </div>
      
      <div className="insight-finding">
        {insight.key_finding}
      </div>

      {insight.evidence_quotes && insight.evidence_quotes.length > 0 && (
        <div className="insight-quotes">
          {insight.evidence_quotes.map((quote, i) => (
            <div key={i} className="quote">"{quote}"</div>
          ))}
        </div>
      )}

      <div className="insight-recommendation">
        <div className="rec-label">PM Recommendation</div>
        <div className="rec-text">{insight.pm_recommendation}</div>
      </div>
    </div>
  );
};

export default InsightCard;

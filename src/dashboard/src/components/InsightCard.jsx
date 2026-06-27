import React from 'react';
import { Lightbulb } from 'lucide-react';

const InsightCard = ({ insight, index }) => {
  return (
    <div 
      className="insight-card animate-fade-in" 
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      <div className="insight-header">
        <div className="insight-theme">{insight.theme}</div>
        <div className="impact-badge">
          {insight.user_impact || 'HIGH IMPACT'}
        </div>
      </div>
      
      <div className="section-label">Finding</div>
      <div className="insight-finding">
        {insight.key_finding}
      </div>

      {insight.evidence_quotes && insight.evidence_quotes.length > 0 && (
        <div className="quote-box">
          {insight.evidence_quotes.slice(0, 2).map((quote, i) => (
            <div key={i} className="quote-text">"{quote}"</div>
          ))}
          <div className="quote-source">- Reviewer</div>
        </div>
      )}

      <div className="insight-recommendation">
        <Lightbulb size={18} className="rec-icon" />
        <div>
          <strong>Recommendation: </strong>
          {insight.pm_recommendation}
        </div>
      </div>
    </div>
  );
};

export default InsightCard;

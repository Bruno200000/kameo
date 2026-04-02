import React from 'react';
import { ArrowUpRight } from 'lucide-react';

export const StatCard = ({ icon, title, value, color, valueColor, trend, trendUp }) => (
  <div className="stat-card">
    <div className={`stat-icon bg-${color}`}>{icon}</div>
    <div className="stat-details">
      <p className="stat-title">{title}</p>
      <h3 className={`stat-value ${valueColor === 'red' ? 'text-red' : ''}`}>{value}</h3>
      {trend && <p className={`stat-change ${trendUp ? 'positive' : 'negative'}`}>{trendUp && <ArrowUpRight size={14}/>} {trend}</p>}
    </div>
  </div>
);

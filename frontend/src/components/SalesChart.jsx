import React from 'react';

const SalesChart = ({ data = [] }) => {
  if (!data || data.length === 0) return <div style={{ height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>Pas de données de vente</div>;

  const maxAmount = Math.max(...data.map(d => d.amount), 1);
  const chartHeight = 150;
  const chartWidth = 400;
  const padding = 20;
  
  const points = data.map((d, i) => {
    const x = (i * (chartWidth / (data.length - 1)));
    const y = chartHeight - (d.amount / maxAmount * chartHeight);
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="chart-container" style={{ marginTop: '20px' }}>
      <h3 style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '15px' }}>Évolution des ventes (7 derniers jours)</h3>
      <svg width="100%" height={chartHeight + padding * 2} viewBox={`0 0 ${chartWidth} ${chartHeight + padding}`} preserveAspectRatio="none">
        {/* Background Grid */}
        {[0, 0.25, 0.5, 0.75, 1].map(v => (
          <line 
            key={v} 
            x1="0" y1={chartHeight * v} 
            x2={chartWidth} y2={chartHeight * v} 
            stroke="#f1f5f9" 
            strokeWidth="1" 
          />
        ))}
        
        {/* The Line */}
        <polyline
          fill="none"
          stroke="#3b82f6"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
        
        {/* Data Points */}
        {data.map((d, i) => {
          const x = (i * (chartWidth / (data.length - 1)));
          const y = chartHeight - (d.amount / maxAmount * chartHeight);
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="4" fill="#3b82f6" stroke="white" strokeWidth="2" />
              <text x={x} y={chartHeight + 20} textAnchor="middle" fontSize="10" fill="#94a3b8">{d.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default SalesChart;

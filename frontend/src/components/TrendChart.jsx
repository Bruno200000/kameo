import React from 'react';

const TrendChart = ({ data = [], dataKey = 'value', color = '#3b82f6', title = '' }) => {
  if (!data || data.length === 0) return <div style={{ height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>Données indisponibles</div>;

  const maxVal = Math.max(...data.map(d => d[dataKey]), 1);
  const chartHeight = 100;
  const chartWidth = 300;
  
  const points = data.map((d, i) => {
    const x = (i * (chartWidth / (data.length - 1)));
    const y = chartHeight - (d[dataKey] / maxVal * chartHeight);
    return `${x},${y}`;
  }).join(' ');

  return (
    <div style={{ padding: '15px', background: '#fff', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
      {title && <h4 style={{ margin: '0 0 15px 0', fontSize: '0.85rem', color: '#64748b' }}>{title}</h4>}
      <svg width="100%" height={chartHeight + 20} viewBox={`0 0 ${chartWidth} ${chartHeight + 20}`} preserveAspectRatio="none">
        <path
          d={`M 0,${chartHeight} L ${points} L ${chartWidth},${chartHeight} Z`}
          fill={`${color}20`}
        />
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
        {data.map((d, i) => {
          const x = (i * (chartWidth / (data.length - 1)));
          return <text key={i} x={x} y={chartHeight + 15} textAnchor="middle" fontSize="9" fill="#94a3b8">{d.label}</text>;
        })}
      </svg>
    </div>
  );
};

export default TrendChart;

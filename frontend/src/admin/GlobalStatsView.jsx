import React from 'react';
import { useFetch } from '../hooks/useFetch';
import { StatCard } from '../components/StatCard';
import TrendChart from '../components/TrendChart';
import { Users, Building, Package, CreditCard } from 'lucide-react';

const GlobalStatsView = () => {
  const [stats, loading] = useFetch('/dashboard/stats', {
    sales_today: 0,
    sales_change: "+0%",
    stock_value: 0,
    low_stock_items: 0,
    active_customers: 0,
    historical_sales: []
  });

  if (loading) return <div>Chargement des analyses globales...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      <div className="dashboard-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
        <StatCard icon={<CreditCard size={24} />} title="Ventes Aujourd'hui" value={`${stats.sales_today} F`} color="blue" trend={stats.sales_change} trendUp />
        <StatCard icon={<Package size={24} />} title="Valeur Stock" value={`${stats.stock_value} F`} color="green" />
        <StatCard icon={<Users size={24} />} title="Clients Actifs" value={stats.active_customers} color="purple" />
        <StatCard icon={<Building size={24} />} title="Articles Faible Stock" value={stats.low_stock_items} color="orange" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ marginBottom: '15px' }}>Ventes des 7 derniers jours</h3>
          <TrendChart
            data={stats.historical_sales}
            dataKey="amount"
            color="#3b82f6"
            title="Montant des ventes"
          />
        </div>
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ marginBottom: '15px' }}>Évolution des ventes</h3>
          <TrendChart
            data={stats.historical_sales}
            dataKey="amount"
            color="#f59e0b"
            title="Tendance des ventes"
          />
        </div>
      </div>
    </div>
  );
};

export default GlobalStatsView;

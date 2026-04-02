import React from 'react';
import { useFetch } from '../hooks/useFetch';
import { StatCard } from '../components/StatCard';
import TrendChart from '../components/TrendChart';
import { Users, Building, Package, CreditCard } from 'lucide-react';

const GlobalStatsView = () => {
  const { data: stats, loading } = useFetch('/admin/stats', {
    total_companies: 0,
    total_users: 0,
    total_products: 0,
    total_revenue: 0,
    growth_trend: [],
    plan_distribution: { trial: 0, pro: 0, enterprise: 0, free: 0 },
    subscription_status: { active: 0, pending: 0, rejected: 0 },
    recent_companies: []
  });

  if (loading) return <div>Chargement des analyses globales...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      <div className="dashboard-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
        <StatCard icon={<Building size={24} />} title="Entreprises" value={stats.total_companies} color="blue" />
        <StatCard icon={<Users size={24} />} title="Utilisateurs" value={stats.total_users} color="purple" />
        <StatCard icon={<Package size={24} />} title="Produits" value={stats.total_products} color="green" />
        <StatCard icon={<CreditCard size={24} />} title="MRR (Abonnements)" value={`${stats.total_revenue} F`} color="orange" trendUp trend="+15%" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ marginBottom: '15px' }}>Croissance de la Plateforme</h3>
          <TrendChart
            data={stats.growth_trend}
            dataKey="companies"
            color="#3b82f6"
            title="Nombre d'entreprises par mois"
          />
        </div>
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ marginBottom: '15px' }}>Chiffre d'Affaires Mensuel (Abonnements)</h3>
          <TrendChart
            data={stats.growth_trend}
            dataKey="mrr"
            color="#f59e0b"
            title="MRR en Euros"
          />
        </div>
      </div>

      <div className="card" style={{ padding: '20px' }}>
        <h3>Détails de Distribution des Plans</h3>
        <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
          <div style={{ flex: 1, padding: '15px', background: '#f8fafc', borderRadius: '8px', textAlign: 'center' }}>
            <strong style={{ fontSize: '1.2rem' }}>{stats.plan_distribution.free || 0}</strong>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Plan GRATUIT / ESSAI</p>
          </div>
          <div style={{ flex: 1, padding: '15px', background: '#f8fafc', borderRadius: '8px', textAlign: 'center' }}>
            <strong style={{ fontSize: '1.2rem', color: '#3b82f6' }}>{stats.plan_distribution.pro || 0}</strong>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Plan PRO</p>
          </div>
          <div style={{ flex: 1, padding: '15px', background: '#f8fafc', borderRadius: '8px', textAlign: 'center' }}>
            <strong style={{ fontSize: '1.2rem', color: '#8b5cf6' }}>{stats.plan_distribution.enterprise || 0}</strong>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Plan ENTREPRISE</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <div style={{ flex: 1, padding: '15px', background: '#f0fdf4', borderRadius: '8px', textAlign: 'center' }}>
            <strong style={{ fontSize: '1.2rem', color: '#15803d' }}>{stats.subscription_status.active || 0}</strong>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#166534' }}>Abonnements validés</p>
          </div>
          <div style={{ flex: 1, padding: '15px', background: '#fef3c7', borderRadius: '8px', textAlign: 'center' }}>
            <strong style={{ fontSize: '1.2rem', color: '#b45309' }}>{stats.subscription_status.pending || 0}</strong>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#92400e' }}>En attente de validation</p>
          </div>
          <div style={{ flex: 1, padding: '15px', background: '#fee2e2', borderRadius: '8px', textAlign: 'center' }}>
            <strong style={{ fontSize: '1.2rem', color: '#991b1b' }}>{stats.subscription_status.rejected || 0}</strong>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#7f1d1d' }}>Abonnements rejetés</p>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: '20px' }}>
        <h3>Dernières entreprises ajoutées</h3>
        {stats.recent_companies && stats.recent_companies.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Entreprise</th>
                <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Plan</th>
                <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Statut</th>
                <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Inscription</th>
              </tr>
            </thead>
            <tbody>
              {stats.recent_companies.map((company, index) => (
                <tr key={company.id || index}>
                  <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>{company.name}</td>
                  <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>{company.plan}</td>
                  <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>{company.status}</td>
                  <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>{new Date(company.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ marginTop: '10px', color: '#6b7280' }}>Aucune entreprise récente pour le moment.</p>
        )}
      </div>
    </div>
  );
};

export default GlobalStatsView;

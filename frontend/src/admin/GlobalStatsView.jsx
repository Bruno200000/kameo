import React from 'react';
import { useFetch } from '../hooks/useFetch';
import { StatCard } from '../components/StatCard';
import { Users, Building, AlertTriangle, CheckCircle } from 'lucide-react';

const GlobalStatsView = () => {
  const [stats, loading] = useFetch('/admin/stats', {
    totalCompanies: 0,
    activeSubscriptions: 0,
    unpaidCount: 0,
    totalUsers: 0,
    unpaidCompanies: []
  });

  const data = stats || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', padding: '10px 0' }}>
      {data.success === false && (
        <div style={{ padding: '15px', background: '#fee2e2', border: '1px solid #ef4444', borderRadius: '8px', color: '#b91c1c' }}>
          <strong>Attention :</strong> {data.error || "Impossible de charger toutes les données."}
          {data.debug && <pre style={{ fontSize: '11px', marginTop: '10px', overflow: 'auto' }}>{JSON.stringify(data.debug, null, 2)}</pre>}
        </div>
      )}

      {data.debug && data.success !== false && (
        <div style={{ padding: '10px', background: '#fff7ed', border: '1px solid #fb923c', borderRadius: '8px', color: '#9a3412', fontSize: '13px' }}>
          <strong>Note :</strong> Certaines statistiques pourraient être incomplètes.
          <details><summary style={{ cursor: 'pointer' }}>Voir détails techniques</summary>
            <pre style={{ fontSize: '11px', marginTop: '5px' }}>{JSON.stringify(data.debug, null, 2)}</pre>
          </details>
        </div>
      )}

      <div className="dashboard-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
        <StatCard icon={<Building size={24} />} title="Total Entreprises" value={data.totalCompanies || 0} color="blue" />
        <StatCard icon={<CheckCircle size={24} />} title="Abonnements Actifs" value={data.activeSubscriptions || 0} color="green" />
        <StatCard icon={<Users size={24} />} title="Total Utilisateurs" value={data.totalUsers || 0} color="purple" />
        <StatCard icon={<AlertTriangle size={24} />} title="Abonnements Suspendus" value={data.unpaidCount || 0} color="red" />
      </div>

      <div className="card">
        <div className="card-header">
          <h3 style={{ margin: 0, color: '#1e293b' }}>Entreprises nécessitantes une action (Impayés / En attente)</h3>
        </div>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Entreprise</th>
                <th>Contact</th>
                <th>Plan Cible</th>
                <th>Statut Actuel</th>
              </tr>
            </thead>
            <tbody>
              {(!Array.isArray(data.unpaidCompanies) || data.unpaidCompanies.length === 0) ? (
                <tr><td colSpan="4" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>Tous les abonnements sont à jour.</td></tr>
              ) : (
                data.unpaidCompanies.map(c => (
                  <tr key={c?.id || Math.random()}>
                    <td><strong>{c?.name || 'Inconnu'}</strong></td>
                    <td>{c?.email || 'N/A'}<br/><span style={{fontSize: '11px', color: '#94a3b8'}}>{c?.phone || ''}</span></td>
                    <td><span className="status-badge" style={{ backgroundColor: '#e2e8f0', color: '#475569' }}>{c?.plan_id || 'trial'}</span></td>
                    <td><span className="status-badge error">{c?.subscription_status || 'pending'}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default GlobalStatsView;

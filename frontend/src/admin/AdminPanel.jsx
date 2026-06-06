import React, { useState } from 'react';
import { Users, TrendingUp, Settings, Activity } from 'lucide-react';
import CompaniesManager from './CompaniesManager';
import GlobalStatsView from './GlobalStatsView';
import UsersManager from './UsersManager';
import { useFetch, API_URL } from '../hooks/useFetch';

const AdminPanel = () => {
  const [activeTab, setActiveTab] = useState('users');
  const currentUser = JSON.parse(localStorage.getItem('kameo_current_user') || '{}');
  const isSuperAdmin = currentUser.role === 'superadmin';

  return (
    <div style={{ padding: '0 0 40px 0' }}>
      <div style={{ display: 'flex', gap: '15px', marginBottom: '30px', borderBottom: '1px solid #e2e8f0', paddingBottom: '15px', flexWrap: 'wrap' }}>
        {isSuperAdmin && (
          <button
            onClick={() => setActiveTab('companies')}
            className={`nav-item ${activeTab === 'companies' ? 'active' : ''}`}
            style={{ width: 'auto', padding: '10px 20px' }}
          >
            <Users size={18} /> Gestion Entreprises
          </button>
        )}
        <button
          onClick={() => setActiveTab('users')}
          className={`nav-item ${activeTab === 'users' ? 'active' : ''}`}
          style={{ width: 'auto', padding: '10px 20px' }}
        >
          <Users size={18} /> Gestion Utilisateurs
        </button>
        {isSuperAdmin && (
          <>
            <button
              onClick={() => setActiveTab('stats')}
              className={`nav-item ${activeTab === 'stats' ? 'active' : ''}`}
              style={{ width: 'auto', padding: '10px 20px' }}
            >
              <TrendingUp size={18} /> Donnees Structurees
            </button>
            <button
              onClick={() => setActiveTab('monitoring')}
              className={`nav-item ${activeTab === 'monitoring' ? 'active' : ''}`}
              style={{ width: 'auto', padding: '10px 20px' }}
            >
              <Activity size={18} /> Monitoring
            </button>
            <button
              onClick={() => setActiveTab('config')}
              className={`nav-item ${activeTab === 'config' ? 'active' : ''}`}
              style={{ width: 'auto', padding: '10px 20px' }}
            >
              <Settings size={18} /> Configuration SaaS
            </button>
          </>
        )}
      </div>

      {activeTab === 'companies' && isSuperAdmin ? <CompaniesManager /> :
       activeTab === 'users' ? <UsersManager /> :
       activeTab === 'stats' && isSuperAdmin ? <GlobalStatsView /> :
       activeTab === 'monitoring' && isSuperAdmin ? <SessionsMonitor /> :
       activeTab === 'config' && isSuperAdmin ? <SaaSConfig /> :
       <UsersManager />}
    </div>
  );
};

const SaaSConfig = () => {
  const [settings, settingsLoading, setSettings] = useFetch('/admin/config', {});
  const [companies, companiesLoading, setCompanies] = useFetch('/admin/companies', []);
  const [isSaving, setIsSaving] = useState(false);
  const [isCompanySaving, setIsCompanySaving] = useState(false);
  const [maintenanceDraft, setMaintenanceDraft] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');

  React.useEffect(() => {
    setMaintenanceDraft(settings.maintenance_message || '');
  }, [settings.maintenance_message]);

  React.useEffect(() => {
    if (!selectedCompanyId && companies.length > 0) {
      setSelectedCompanyId(companies[0].id);
    }
  }, [companies, selectedCompanyId]);

  const handleUpdate = async (key, value) => {
    setIsSaving(true);
    try {
      const res = await fetch(`${API_URL}/admin/config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success !== false) {
        setSettings({ ...settings, [key]: String(value) });
      } else {
        alert("Erreur de sauvegarde: " + (data.error || 'configuration non enregistree'));
      }
    } catch (e) {
      alert("Erreur de sauvegarde");
    }
    setIsSaving(false);
  };

  const selectedCompany = companies.find(company => company.id === selectedCompanyId);

  const updateSelectedCompanyStatus = async (status) => {
    if (!selectedCompany) {
      alert('Selectionnez une compagnie.');
      return;
    }

    const actionLabel = status === 'suspended' ? 'bloquer' : 'activer';
    if (status === 'suspended' && !window.confirm(`Voulez-vous vraiment bloquer ${selectedCompany.name} ?`)) return;

    setIsCompanySaving(true);
    try {
      const res = await fetch(`${API_URL}/admin/companies/${selectedCompany.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription_status: status,
          plan_id: selectedCompany.plan_id || 'trial'
        })
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success !== false) {
        setCompanies(companies.map(company => (
          company.id === selectedCompany.id
            ? { ...company, subscription_status: status }
            : company
        )));
      } else {
        alert(`Impossible de ${actionLabel} la compagnie: ` + (data.error || 'erreur serveur'));
      }
    } catch (e) {
      alert(`Impossible de ${actionLabel} la compagnie.`);
    }
    setIsCompanySaving(false);
  };

  if (settingsLoading || companiesLoading) return <div>Chargement des parametres...</div>;

  return (
    <div className="card" style={{ padding: '30px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
        <h3 style={{ margin: 0 }}>Parametres de la Plateforme</h3>
        {(isSaving || isCompanySaving) && <span style={{ fontSize: '12px', color: '#3b82f6' }}>Enregistrement...</span>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <ConfigToggle
            title="Mode Maintenance"
            desc="Desactiver l'acces public a la plateforme"
            checked={settings.maintenance_mode === 'true'}
            onChange={(val) => handleUpdate('maintenance_mode', val)}
          />
          <ConfigToggle
            title="Inscriptions Libres"
            desc="Permettre aux nouvelles entreprises de s'inscrire"
            checked={settings.allow_new_signups === 'true'}
            onChange={(val) => handleUpdate('allow_new_signups', val)}
          />
          <ConfigToggle
            title="Notifications d'impayes"
            desc="Alerter l'admin en temps reel des impayes"
            checked={settings.notify_unpaid === 'true'}
            onChange={(val) => handleUpdate('notify_unpaid', val)}
          />
          <ConfigToggle
            title="Suspension Automatique"
            desc="Bloquer les comptes a la fin de leur abonnement"
            checked={settings.auto_suspend === 'true'}
            onChange={(val) => handleUpdate('auto_suspend', val)}
          />
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9' }} />

        <div style={{ padding: '18px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '8px' }}>Message de maintenance</label>
          <textarea
            rows={4}
            className="large-input"
            style={{ width: '100%', resize: 'vertical', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px' }}
            value={maintenanceDraft}
            onChange={(e) => setMaintenanceDraft(e.target.value)}
            placeholder="Ex: L'application est en maintenance. Nous revenons dans quelques minutes."
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button className="primary-btn" onClick={() => handleUpdate('maintenance_message', maintenanceDraft)} disabled={isSaving}>
              Enregistrer le message
            </button>
          </div>
        </div>

        <div style={{ padding: '18px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '14px' }}>
            <div>
              <h4 style={{ margin: '0 0 4px', color: '#0f172a' }}>Controle d'acces compagnie</h4>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Selectionnez une compagnie pour la rendre non fonctionnelle ou la reactiver.</p>
            </div>
            {selectedCompany && (
              <span className={`status-badge ${selectedCompany.subscription_status === 'active' ? 'success' : 'error'}`}>
                {selectedCompany.subscription_status || 'pending'}
              </span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1fr) auto auto', gap: '10px', alignItems: 'center' }}>
            <select
              className="filter-select"
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              disabled={isCompanySaving || companies.length === 0}
              style={{ width: '100%', minHeight: '38px' }}
            >
              {companies.length === 0 ? (
                <option value="">Aucune compagnie disponible</option>
              ) : companies.map(company => (
                <option key={company.id} value={company.id}>
                  {company.name} - {company.subscription_status || 'pending'}
                </option>
              ))}
            </select>
            <button
              className="secondary-btn"
              onClick={() => updateSelectedCompanyStatus('suspended')}
              disabled={!selectedCompany || selectedCompany.subscription_status === 'suspended' || isCompanySaving}
              style={{ backgroundColor: '#fee2e2', borderColor: '#f87171', color: '#991b1b' }}
            >
              Bloquer
            </button>
            <button
              className="primary-btn"
              onClick={() => updateSelectedCompanyStatus('active')}
              disabled={!selectedCompany || selectedCompany.subscription_status === 'active' || isCompanySaving}
              style={{ backgroundColor: '#10b981', borderColor: '#10b981', color: 'white' }}
            >
              Activer
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <ConfigInput
            label="Nom de la Plateforme"
            value={settings.platform_name || ''}
            onBlur={(val) => handleUpdate('platform_name', val)}
          />
          <ConfigInput
            label="Email de Support"
            value={settings.support_email || ''}
            onBlur={(val) => handleUpdate('support_email', val)}
          />
          <ConfigInput
            label="Version du Logiciel"
            value={settings.version || ''}
            onBlur={(val) => handleUpdate('version', val)}
          />
          <ConfigInput
            label="Devise par defaut (ex: FCFA)"
            value={settings.default_currency || 'FCFA'}
            onBlur={(val) => handleUpdate('default_currency', val)}
          />
          <ConfigInput
            label="Duree periode d'essai (Jours)"
            value={settings.trial_days || '14'}
            type="number"
            onBlur={(val) => handleUpdate('trial_days', val)}
          />
          <div style={{ padding: '15px', background: '#f8fafc', borderRadius: '8px' }}>
             <label style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '8px' }}>Derniere mise a jour</label>
             <div style={{ fontSize: '14px' }}>{new Date().toLocaleDateString('fr-FR', { dateStyle: 'long' })}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ConfigToggle = ({ title, desc, checked, onChange }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', background: '#f8fafc', borderRadius: '8px' }}>
    <div>
      <strong style={{ fontSize: '14px' }}>{title}</strong>
      <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>{desc}</p>
    </div>
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      style={{ width: '20px', height: '20px', cursor: 'pointer' }}
    />
  </div>
);

const ConfigInput = ({ label, value, type = "text", onBlur }) => {
  const [val, setVal] = useState(value);
  React.useEffect(() => setVal(value), [value]);

  return (
    <div style={{ padding: '15px', background: '#f8fafc', borderRadius: '8px' }}>
      <label style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '8px' }}>{label}</label>
      <input
        type={type}
        className="large-input"
        style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '4px' }}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => onBlur(val)}
      />
    </div>
  );
};

const SessionsMonitor = () => {
  const [users, usersLoading] = useFetch('/admin/users', []);
  const [filterActive, setFilterActive] = useState(false);

  const isOnline = (lastLogin) => {
    if (!lastLogin) return false;
    const date = new Date(lastLogin);
    const now = new Date();
    return (now - date) < (30 * 60 * 1000);
  };

  const filteredUsers = filterActive
    ? users.filter(u => isOnline(u.last_login_at))
    : users;

  const onlineCount = users.filter(u => isOnline(u.last_login_at)).length;

  if (usersLoading) return <div>Analyse des sessions en cours...</div>;

  return (
    <div>
      <style>{`
        @keyframes monitor-pulse {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h3 style={{ margin: 0 }}>Surveillance des sessions</h3>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>{onlineCount} utilisateur(s) actuellement en ligne</p>
        </div>
        <button
          className="secondary-btn"
          onClick={() => setFilterActive(!filterActive)}
          style={{ borderColor: filterActive ? '#10b981' : '#e2e8f0', color: filterActive ? '#10b981' : '#64748b' }}
        >
          {filterActive ? 'Voir tout le monde' : 'Voir uniquement les actifs'}
        </button>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Utilisateur</th>
                <th>Entreprise</th>
                <th>Role</th>
                <th>Statut</th>
                <th>Derniere connexion</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>Aucune session trouvee</td></tr>
              ) : filteredUsers.map(u => {
                const active = isOnline(u.last_login_at);
                return (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="user-avatar" style={{
                          width: '32px', height: '32px', fontSize: '12px',
                          backgroundColor: active ? '#ecfdf5' : '#f8fafc',
                          color: active ? '#10b981' : '#64748b',
                          border: active ? '1px solid #10b981' : '1px solid #e2e8f0'
                        }}>
                          {u.first_name?.[0]}{u.last_name?.[0]}
                        </div>
                        <strong>{u.first_name} {u.last_name}</strong>
                      </div>
                    </td>
                    <td>{u.companies ? u.companies.name : <em style={{ color: '#94a3b8' }}>Plateforme</em>}</td>
                    <td><span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b' }}>{u.role}</span></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '10px', height: '10px', borderRadius: '50%',
                          backgroundColor: active ? '#10b981' : '#cbd5e1',
                          animation: active ? 'monitor-pulse 2s infinite' : 'none'
                        }} />
                        <span style={{ fontSize: '12px', color: active ? '#10b981' : '#64748b', fontWeight: active ? 600 : 400 }}>
                          {active ? 'En ligne' : 'Inactif'}
                        </span>
                      </div>
                    </td>
                    <td style={{ fontSize: '12px', color: '#64748b' }}>
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleString('fr-FR', {
                        dateStyle: 'short',
                        timeStyle: 'short'
                      }) : 'Jamais'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;

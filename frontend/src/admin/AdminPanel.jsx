import React, { useState } from 'react';
import { Users, TrendingUp, Settings } from 'lucide-react';
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
              <TrendingUp size={18} /> Données Structurées
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
       activeTab === 'config' && isSuperAdmin ? <SaaSConfig /> :
       <UsersManager />}
    </div>
  );
};

const SaaSConfig = () => {
  const [settings, settingsLoading, setSettings] = useFetch('/admin/config', {});
  const [isSaving, setIsSaving] = useState(false);

  const handleUpdate = async (key, value) => {
    setIsSaving(true);
    try {
      const res = await fetch(`${API_URL}/admin/config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value })
      });
      if (res.ok) setSettings({ ...settings, [key]: value });
    } catch (e) { alert("Erreur de sauvegarde"); }
    setIsSaving(false);
  };

  if (settingsLoading) return <div>Chargement des paramètres...</div>;

  return (
    <div className="card" style={{ padding: '30px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
        <h3 style={{ margin: 0 }}>Paramètres de la Plateforme</h3>
        {isSaving && <span style={{ fontSize: '12px', color: '#3b82f6' }}>Enregistrement...</span>}
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Toggle Switches */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <ConfigToggle 
            title="Mode Maintenance" 
            desc="Désactiver l'accès publique à la plateforme" 
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
            title="Notifications d'impayés" 
            desc="Alerter l'admin en temps réel des impayés" 
            checked={settings.notify_unpaid === 'true'} 
            onChange={(val) => handleUpdate('notify_unpaid', val)}
          />
          <ConfigToggle 
            title="Suspension Automatique" 
            desc="Bloquer les comptes à la fin de leur abonnement" 
            checked={settings.auto_suspend === 'true'} 
            onChange={(val) => handleUpdate('auto_suspend', val)}
          />
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9' }} />

        {/* Text Fields */}
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
            label="Devise par défaut (ex: FCFA)" 
            value={settings.default_currency || 'FCFA'} 
            onBlur={(val) => handleUpdate('default_currency', val)}
          />
          <ConfigInput 
            label="Durée période d'essai (Jours)" 
            value={settings.trial_days || '14'} 
            type="number"
            onBlur={(val) => handleUpdate('trial_days', val)}
          />
          <div style={{ padding: '15px', background: '#f8fafc', borderRadius: '8px' }}>
             <label style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '8px' }}>Dernière mise à jour</label>
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

export default AdminPanel;

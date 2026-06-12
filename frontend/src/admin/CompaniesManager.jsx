import React, { useState } from 'react';
import { Plus, Trash2, Edit2, Lock, Unlock, Clock } from 'lucide-react';
import { useFetch, API_URL } from '../hooks/useFetch';

const emptyForm = { name: '', email: '', phone: '', address: '', plan_id: 'trial', trial_ends_at: '', password: '' };

const toDateTimeLocalValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (isNaN(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

const getTrialCountdownLabel = (company) => {
  if ((company.plan_id || 'trial') !== 'trial') return '-';
  if (company.trial_countdown_enabled === false) return 'Desactive';
  if (!company.trial_ends_at) return 'Non defini';

  const diffMs = new Date(company.trial_ends_at).getTime() - Date.now();
  if (!Number.isFinite(diffMs)) return 'Non defini';
  if (diffMs <= 0 || company.trial_expired) return 'Expire';

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
  return `${days}j ${hours}h`;
};

const CompaniesManager = () => {
  const [companies, companiesLoading, setCompanies] = useFetch('/admin/companies', []);
  const [showAdd, setShowAdd] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState(emptyForm);

  const closeForm = () => {
    setShowAdd(false);
    setEditingCompany(null);
    setFormData(emptyForm);
  };

  const handleSave = async () => {
    const isEditing = !!editingCompany;
    if (!formData.name || !formData.email || (!isEditing && !formData.password)) {
      return alert("Le nom, l'email et le mot de passe (pour les nouveaux) sont requis.");
    }

    setIsSaving(true);
    try {
      const url = isEditing ? `${API_URL}/admin/companies/${editingCompany.id}` : `${API_URL}/admin/companies`;
      const method = isEditing ? 'PATCH' : 'POST';
      const payload = { ...formData };
      if (isEditing && !payload.password) delete payload.password;
      if (payload.trial_ends_at) {
        payload.trial_ends_at = new Date(payload.trial_ends_at).toISOString();
      } else {
        delete payload.trial_ends_at;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const resData = await res.json();

      if (resData.success) {
        if (isEditing) {
          setCompanies(companies.map(c => c.id === editingCompany.id ? { ...c, ...(resData.company || payload) } : c));
        } else {
          setCompanies([resData.company, ...companies]);
        }
        closeForm();
      } else {
        alert('Erreur: ' + (resData.error || 'operation impossible'));
      }
    } catch(err) {
      alert('Erreur serveur');
    }
    setIsSaving(false);
  };

  const startEdit = (company) => {
    setEditingCompany(company);
    setFormData({
      name: company.name || '',
      email: company.email || '',
      phone: company.phone || '',
      address: company.address || '',
      plan_id: company.plan_id || 'trial',
      trial_ends_at: toDateTimeLocalValue(company.trial_ends_at),
      password: ''
    });
    setShowAdd(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer cette entreprise ? Toutes ses donnees seront effacees.")) return;
    try {
      const res = await fetch(`${API_URL}/admin/companies/${id}`, { method: 'DELETE' });
      const d = await res.json();
      if (d.success) setCompanies(companies.filter(c => c.id !== id));
    } catch (e) {
      alert("Erreur suppression");
    }
  };

  const updateCompanyStatus = async (company, status, planId = company.plan_id || 'pro') => {
    try {
      const res = await fetch(`${API_URL}/admin/companies/${company.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription_status: status, plan_id: planId })
      });
      const d = await res.json();
      if (d.success) {
        setCompanies(companies.map(c => c.id === company.id ? { ...c, ...(d.company || {}), subscription_status: status, plan_id: planId } : c));
      } else {
        alert('Erreur mise a jour: ' + (d.error || ''));
      }
    } catch(e) {
      alert('Erreur mise a jour');
    }
  };

  const handleApproveSubscription = async (company) => {
    await updateCompanyStatus(company, 'active', company.plan_id || 'pro');
  };

  const handleRejectSubscription = async (company) => {
    await updateCompanyStatus(company, 'rejected', company.plan_id || 'trial');
  };

  const handleSuspendCompany = async (company) => {
    if (!window.confirm(`Bloquer ${company.name} ? Ses utilisateurs ne pourront plus utiliser l'application.`)) return;
    await updateCompanyStatus(company, 'suspended', company.plan_id || 'trial');
  };

  const handleActivateCompany = async (company) => {
    await updateCompanyStatus(company, 'active', company.plan_id || 'pro');
  };

  if (companiesLoading) return <div>Chargement...</div>;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
        <button className="primary-btn" onClick={() => { setEditingCompany(null); setFormData(emptyForm); setShowAdd(true); }}>
          <Plus size={16} /> Nouvelle Entreprise
        </button>
      </div>

      {showAdd && (
        <div className="card" style={{ marginBottom: '30px', padding: '25px', borderLeft: '4px solid #3b82f6' }}>
          <h3>{editingCompany ? 'Modifier une entreprise' : 'Creer une nouvelle entreprise (Tenant)'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(220px, 1fr))', gap: '20px', marginTop: '20px' }}>
            <input type="text" placeholder="Nom de l'entreprise" className="large-input" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            <input type="email" placeholder="Email contact" className="large-input" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            <input type="text" placeholder="Telephone" className="large-input" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
            <input type="password" placeholder={editingCompany ? 'Nouveau mot de passe admin (optionnel)' : 'Mot de passe (Compte Admin)'} className="large-input" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
            <select className="filter-select" value={formData.plan_id} onChange={e => setFormData({...formData, plan_id: e.target.value})}>
              <option value="trial">Essai (14 jrs)</option>
              <option value="pro">Professionnel</option>
              <option value="enterprise">Entreprise</option>
            </select>
            <input
              type="datetime-local"
              className="large-input"
              value={formData.trial_ends_at}
              onChange={e => setFormData({ ...formData, trial_ends_at: e.target.value })}
              disabled={formData.plan_id !== 'trial'}
              title="Date de fin de l'offre gratuite"
            />
          </div>
          <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
            <button className="primary-btn" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Enregistrement...' : (editingCompany ? 'Enregistrer' : 'Creer')}
            </button>
            <button className="secondary-btn" onClick={closeForm}>Annuler</button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Email</th>
                <th>Plan</th>
                <th>Essai gratuit</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {companies.map(c => (
                <tr key={c.id}>
                  <td><strong>{c.name}</strong></td>
                  <td>{c.email}</td>
                  <td><span className="status-badge" style={{ backgroundColor: '#e2e8f0' }}>{c.plan_id || 'trial'}</span></td>
                  <td>
                    <span className={`status-badge ${getTrialCountdownLabel(c) === 'Expire' ? 'error' : 'warning'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <Clock size={12} /> {getTrialCountdownLabel(c)}
                    </span>
                  </td>
                  <td><span className={`status-badge ${c.subscription_status === 'active' ? 'success' : 'error'}`}>{c.subscription_status || 'pending'}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                      <button className="icon-btn" onClick={() => startEdit(c)}><Edit2 size={16} /></button>
                      <button className="icon-btn" style={{ color: '#ef4444' }} onClick={() => handleDelete(c.id)}><Trash2 size={16} /></button>
                      {c.subscription_status === 'active' ? (
                        <button className="secondary-btn" style={{ padding: '4px 8px', fontSize: '0.75rem', backgroundColor: '#fef2f2', borderColor: '#fca5a5', color: '#991b1b' }} onClick={() => handleSuspendCompany(c)}>
                          <Lock size={13} /> Bloquer
                        </button>
                      ) : (
                        <button className="secondary-btn" style={{ padding: '4px 8px', fontSize: '0.75rem', backgroundColor: '#d1fae5', borderColor: '#34d399', color: '#065f46' }} onClick={() => handleActivateCompany(c)}>
                          <Unlock size={13} /> Activer
                        </button>
                      )}
                      {c.subscription_status === 'pending' && (
                        <>
                          <button className="secondary-btn" style={{ padding: '4px 8px', fontSize: '0.75rem', backgroundColor: '#d1fae5', borderColor: '#34d399', color: '#065f46' }} onClick={() => handleApproveSubscription(c)}>Valider</button>
                          <button className="secondary-btn" style={{ padding: '4px 8px', fontSize: '0.75rem', backgroundColor: '#fee2e2', borderColor: '#f87171', color: '#991b1b' }} onClick={() => handleRejectSubscription(c)}>Rejeter</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default CompaniesManager;

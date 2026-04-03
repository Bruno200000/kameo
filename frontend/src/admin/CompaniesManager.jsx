import React, { useState } from 'react';
import { Users, Plus, Trash2, Edit2 } from 'lucide-react';
import { useFetch, API_URL } from '../hooks/useFetch';

const CompaniesManager = () => {
  const [companies, setCompanies] = useFetch('/admin/companies', []);
  const [showAdd, setShowAdd] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', address: '', plan_id: 'trial', password: '' });

  const handleSave = async () => {
    const isEditing = !!editingCompany;
    if (!formData.name || !formData.email || (!isEditing && !formData.password)) {
      return alert("Le nom, l'email et le mot de passe (pour les nouveaux) sont requis.");
    }
    
    setIsSaving(true);
    try {
      const url = isEditing ? `${API_URL}/admin/companies/${editingCompany.id}` : `${API_URL}/admin/companies`;
      const method = isEditing ? 'PATCH' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const resData = await res.json();
      
      if (resData.success) {
        if (isEditing) {
          setCompanies(companies.map(c => c.id === editingCompany.id ? { ...c, ...formData } : c));
        } else {
          setCompanies([resData.company, ...companies]);
        }
        setShowAdd(false);
        setEditingCompany(null);
        setFormData({ name: '', email: '', phone: '', address: '', plan_id: 'trial', password: '' });
      } else {
        alert('Erreur: ' + resData.error);
      }
    } catch(err) { alert('Erreur serveur'); }
    setIsSaving(false);
  };

  const startEdit = (company) => {
    setEditingCompany(company);
    setFormData({ 
      name: company.name, 
      email: company.email, 
      phone: company.phone || '', 
      address: company.address || '', 
      plan_id: company.plan_id || 'trial',
      password: '' // Don't pre-fill password
    });
    setShowAdd(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer cette entreprise ? Toutes ses données seront effacées.")) return;
    try {
      const res = await fetch(`${API_URL}/admin/companies/${id}`, { method: 'DELETE' });
      const d = await res.json();
      if (d.success) setCompanies(companies.filter(c => c.id !== id));
    } catch (e) { alert("Erreur suppression"); }
  };

  const handleApproveSubscription = async (company) => {
    try {
      const res = await fetch(`${API_URL}/admin/companies/${company.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription_status: 'active', plan_id: company.plan_id || 'pro' })
      });
      const d = await res.json();
      if (d.success) {
        setCompanies(companies.map(c => c.id === company.id ? { ...c, subscription_status: 'active' } : c));
      } else {
        alert('Erreur approbation: ' + (d.error || '')); 
      }
    } catch(e) { alert('Erreur approbation'); }
  };

  const handleRejectSubscription = async (company) => {
    try {
      const res = await fetch(`${API_URL}/admin/companies/${company.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription_status: 'rejected' })
      });
      const d = await res.json();
      if (d.success) {
        setCompanies(companies.map(c => c.id === company.id ? { ...c, subscription_status: 'rejected' } : c));
      } else {
        alert('Erreur rejet: ' + (d.error || '')); 
      }
    } catch(e) { alert('Erreur rejet'); }
  };

  if (loading) return <div>Chargement...</div>;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
        <button className="primary-btn" onClick={() => setShowAdd(true)}><Plus size={16} /> Nouvelle Entreprise</button>
      </div>

      {showAdd && (
        <div className="card" style={{ marginBottom: '30px', padding: '25px', borderLeft: '4px solid #3b82f6' }}>
          <h3>Créer une nouvelle entreprise (Tenant)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px', marginTop: '20px' }}>
            <input type="text" placeholder="Nom de l'entreprise" className="large-input" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            <input type="email" placeholder="Email contact" className="large-input" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            <input type="text" placeholder="Téléphone" className="large-input" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
            <input type="password" placeholder="Mot de passe (Compte Admin)" className="large-input" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
            <select className="filter-select" value={formData.plan_id} onChange={e => setFormData({...formData, plan_id: e.target.value})}>
              <option value="trial">Essai (14 jrs)</option>
              <option value="pro">Professionnel</option>
              <option value="enterprise">Entreprise</option>
            </select>
          </div>
          <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
            <button className="primary-btn" onClick={handleSave} disabled={isSaving}>{isSaving ? 'Enregistrement...' : 'Créer'}</button>
            <button className="secondary-btn" onClick={() => setShowAdd(false)}>Annuler</button>
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
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {companies.map(c => (
                <tr key={c.id}>
                  <td><strong>{c.name}</strong></td>
                  <td>{c.email}</td>
                  <td><span className="status-badge" style={{ backgroundColor: '#e2e8f0' }}>{c.plan_id}</span></td>
                  <td><span className={`status-badge ${c.subscription_status === 'active' ? 'success' : 'error'}`}>{c.subscription_status}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                      <button className="icon-btn" onClick={() => startEdit(c)}><Edit2 size={16} /></button>
                      <button className="icon-btn" style={{ color: '#ef4444' }} onClick={() => handleDelete(c.id)}><Trash2 size={16} /></button>
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

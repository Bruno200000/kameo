import React, { useState } from 'react';
import { Trash2, Edit2, UserPlus, X } from 'lucide-react';
import { useFetch, API_URL } from '../hooks/useFetch';

const UsersManager = () => {
  const [companies, companiesLoading] = useFetch('/admin/companies', []);
  const [users, usersLoading, setUsers] = useFetch('/admin/users', []);
  const [editingUser, setEditingUser] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({ first_name: '', last_name: '', email: '', role: 'admin' });
  const [createData, setCreateData] = useState({ first_name: '', last_name: '', email: '', password: '', role: 'admin', company_id: '' });

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer cet utilisateur ?")) return;
    try {
      const res = await fetch(`${API_URL}/admin/users/${id}`, { method: 'DELETE' });
      if (res.ok) setUsers(users.filter(u => u.id !== id));
    } catch (e) { alert("Erreur suppression"); }
  };

  const handleUpdate = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`${API_URL}/admin/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setUsers(users.map(u => u.id === editingUser.id ? { ...u, ...formData } : u));
        setEditingUser(null);
      }
    } catch (e) { alert("Erreur modification"); }
    setIsSaving(false);
  };

  const handleCreate = async () => {
    if (!createData.first_name || !createData.email || !createData.password) {
      return alert("Prénom, email et mot de passe sont requis.");
    }
    setIsSaving(true);
    try {
      const res = await fetch(`${API_URL}/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createData)
      });
      const d = await res.json();
      if (d.success) {
        setUsers([d.user, ...users]);
        setShowCreate(false);
        setCreateData({ first_name: '', last_name: '', email: '', password: '', role: 'admin', company_id: '' });
      } else {
        alert('Erreur: ' + d.error);
      }
    } catch (e) { alert("Erreur serveur"); }
    setIsSaving(false);
  };

  const startEdit = (user) => {
    setEditingUser(user);
    setFormData({
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      role: user.role
    });
  };

  if (usersLoading || companiesLoading) return <div>Chargement des utilisateurs...</div>;

  return (
    <>
      {/* Barre d'actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
        <button className="primary-btn" onClick={() => { setShowCreate(true); setEditingUser(null); }}>
          <UserPlus size={16} /> Nouvel Utilisateur
        </button>
      </div>

      {/* Formulaire de création */}
      {showCreate && (
        <div className="card" style={{ marginBottom: '20px', padding: '25px', borderLeft: '4px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ margin: 0, color: '#065f46' }}>Créer un nouvel utilisateur</h3>
            <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8' }} onClick={() => setShowCreate(false)}><X size={20} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px', marginBottom: '15px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: 5, fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>Prénom *</label>
              <input type="text" className="large-input" value={createData.first_name} onChange={e => setCreateData({ ...createData, first_name: e.target.value })} placeholder="Prénom" />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 5, fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>Nom</label>
              <input type="text" className="large-input" value={createData.last_name} onChange={e => setCreateData({ ...createData, last_name: e.target.value })} placeholder="Nom de famille" />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 5, fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>Email *</label>
              <input type="email" className="large-input" value={createData.email} onChange={e => setCreateData({ ...createData, email: e.target.value })} placeholder="email@exemple.com" />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 5, fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>Mot de passe *</label>
              <input type="password" className="large-input" value={createData.password} onChange={e => setCreateData({ ...createData, password: e.target.value })} placeholder="Mot de passe initial" />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 5, fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>Rôle</label>
              <select className="filter-select" style={{ width: '100%' }} value={createData.role} onChange={e => setCreateData({ ...createData, role: e.target.value })}>
                <option value="admin">Administrateur</option>
                <option value="superadmin">SuperAdmin (Plateforme)</option>
                <option value="cashier">Caissier</option>
                <option value="stock_manager">Gérant de Stock</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 5, fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>Entreprise</label>
              <select className="filter-select" style={{ width: '100%' }} value={createData.company_id} onChange={e => setCreateData({ ...createData, company_id: e.target.value })}>
                <option value="">– Aucune (Plateforme) –</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button className="secondary-btn" onClick={() => setShowCreate(false)}>Annuler</button>
            <button className="primary-btn" onClick={handleCreate} disabled={isSaving} style={{ backgroundColor: '#10b981', borderColor: '#10b981' }}>
              {isSaving ? 'Création...' : 'Créer l\'utilisateur'}
            </button>
          </div>
        </div>
      )}

      {/* Formulaire de modification */}
      {editingUser && (
        <div className="card" style={{ marginBottom: '20px', padding: '20px', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ margin: 0 }}>Modifier l'utilisateur</h3>
            <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8' }} onClick={() => setEditingUser(null)}><X size={20} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px', marginTop: '10px' }}>
            <input type="text" className="large-input" value={formData.first_name} onChange={e => setFormData({ ...formData, first_name: e.target.value })} placeholder="Prénom" />
            <input type="text" className="large-input" value={formData.last_name} onChange={e => setFormData({ ...formData, last_name: e.target.value })} placeholder="Nom" />
            <input type="email" className="large-input" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="Email" />
            <select className="filter-select" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}>
              <option value="admin">Administrateur</option>
              <option value="superadmin">SuperAdmin (Plateforme)</option>
              <option value="cashier">Caissier</option>
              <option value="stock_manager">Gérant de Stock</option>
            </select>
          </div>
          <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
            <button className="primary-btn" onClick={handleUpdate} disabled={isSaving}>{isSaving ? 'Enregistrement...' : 'Mettre à jour'}</button>
            <button className="secondary-btn" onClick={() => setEditingUser(null)}>Annuler</button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Utilisateur</th>
                <th>Email</th>
                <th>Rôle</th>
                <th>Entreprise</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>Aucun utilisateur trouvé</td></tr>
              ) : users.map(u => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className="user-avatar" style={{ width: '32px', height: '32px', fontSize: '12px' }}>
                        {u.first_name?.[0]}{u.last_name?.[0]}
                      </div>
                      <strong>{u.first_name} {u.last_name}</strong>
                    </div>
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <span className={`status-badge ${u.role === 'superadmin' ? 'warning' : 'success'}`} style={{ textTransform: 'uppercase', fontSize: '10px' }}>
                      {u.role}
                    </span>
                  </td>
                  <td>{u.companies ? u.companies.name : <em style={{ color: '#94a3b8' }}>Plateforme</em>}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <button className="icon-btn" onClick={() => startEdit(u)} title="Modifier"><Edit2 size={16} /></button>
                      <button className="icon-btn" style={{ color: '#ef4444' }} onClick={() => handleDelete(u.id)} title="Supprimer"><Trash2 size={16} /></button>
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

export default UsersManager;

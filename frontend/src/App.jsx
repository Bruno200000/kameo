import React, { useState, useEffect } from 'react';
import {
  Grid, ShoppingCart, Package, Layers, FileText, Truck,
  Users, Settings, CreditCard, PenTool, X, Menu, Bell, Plus,
  DollarSign, Box, AlertTriangle, ArrowUpRight, Image as ImageIcon,
  Edit2, Trash2, LogOut, UserPlus, Search, Filter, CheckCircle, Clock, Smartphone, Mail, TrendingUp, TrendingDown, Wallet, ArrowRightLeft, Shield, PlusCircle, Check, Printer, Building, AlertCircle
} from 'lucide-react';

import AdminPanel from './admin/AdminPanel';
import UsersManager from './admin/UsersManager';
import { useFetch, API_URL } from './hooks/useFetch';
import { StatCard } from './components/StatCard';
import SalesChart from './components/SalesChart';
import LoginPage from './pages/LoginPage';

const INVOICE_PREFS_KEY = 'kameo_invoice_preferences';

const getCleanImageUrl = (url) => {
  if (!url) return null;
  // Si l'URL contient localhost alors qu'on est en ligne, on l'invalide pour afficher l'icône de secours
  if (url.includes('localhost') && window.location.hostname !== 'localhost') {
    return null;
  }
  return url;
};

const getHeaders = (extra = {}) => {
  try {
    const storedUser = localStorage.getItem('kameo_current_user');
    const user = storedUser ? JSON.parse(storedUser) : null;
    const activeCompany = localStorage.getItem('kameo_active_company_id');
    const companyId = activeCompany !== null ? activeCompany : (user?.company_id || '');
    return {
      'X-Company-Id': companyId,
      'X-User-Data': JSON.stringify(user || {}),
      ...extra
    };
  } catch (e) {
    return { ...extra };
  }
};

const CompanySwitcher = ({ currentUser }) => {
  const [companies, setCompanies] = useState([]);
  const activeCompany = localStorage.getItem('kameo_active_company_id');
  const [selected, setSelected] = useState(activeCompany !== null ? activeCompany : (currentUser.company_id || ''));

  useEffect(() => {
    if (currentUser?.role !== 'superadmin') return;
    fetch(`${API_URL}/admin/companies`, { headers: getHeaders() })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setCompanies(data); })
      .catch(e => console.error(e));
  }, [currentUser]);

  if (currentUser?.role !== 'superadmin') return null;

  const handleChange = (e) => {
    const val = e.target.value;
    setSelected(val);
    localStorage.setItem('kameo_active_company_id', val);
    window.location.reload();
  };

  return (
    <select value={selected} onChange={handleChange} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.85rem', marginRight: '15px', backgroundColor: '#f8fafc', fontWeight: 600 }}>
      <option value="">-- Toutes les entreprises --</option>
      {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
  );
};

const AppLoader = () => (
  <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at top, #1e40af 0%, #0f172a 55%)' }}>
    <div style={{ textAlign: 'center', color: 'white' }}>
      <div style={{ position: 'relative', width: '92px', height: '92px', margin: '0 auto 18px' }}>
        <div style={{ position: 'absolute', inset: 0, border: '3px solid rgba(255,255,255,0.15)', borderTop: '3px solid #60a5fa', borderRadius: '50%', animation: 'kameoSpin 1.2s linear infinite' }} />
        <div style={{ position: 'absolute', inset: '12px', border: '3px solid rgba(255,255,255,0.12)', borderBottom: '3px solid #22d3ee', borderRadius: '50%', animation: 'kameoSpinReverse 1s linear infinite' }} />
        <div style={{ position: 'absolute', inset: '28px', borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #22d3ee)' }} />
      </div>
      <h2 style={{ margin: '0 0 8px', fontSize: '1.4rem', letterSpacing: '0.3px' }}>KAméo</h2>
      <p style={{ margin: 0, color: '#bfdbfe' }}>Chargement en cours...</p>
      <style>{`
        @keyframes kameoSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes kameoSpinReverse { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
      `}</style>
    </div>
  </div>
);

export default function App() {
  const AUTH_STORAGE_KEY = 'kameo_current_user';
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('kameo_sidebar_collapsed') === 'true';
  });
  const [globalSearch, setGlobalSearch] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [toasts, setToasts] = useState([]);

  const addToast = (title, message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, title, message, type, fading: false }]);
    setTimeout(() => {
      removeToast(id);
    }, 5000);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, fading: true } : t));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 300);
  };

  // Utilisateur connecté dynamique
  const [currentUser, setCurrentUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [supportNotice, setSupportNotice] = useState('');
  const [companyValidationStatus, setCompanyValidationStatus] = useState('active');
  const [companyNextBilling, setCompanyNextBilling] = useState(null);
  const [companyPlanId, setCompanyPlanId] = useState('trial');

  // Données globales pour les notifications
  const [productsData] = useFetch('/products', []);
  const [salesData] = useFetch('/sales', []);

  // Calcul des alertes en temps réel
  const stockAlerts = productsData.filter(p => p.quantity <= (p.alert_threshold || 5)).map(p => ({
    id: `stock-${p.id}`,
    type: 'STOCK',
    icon: <AlertTriangle size={16} color="#f59e0b" />,
    title: 'Stock critique',
    desc: `${p.name} - ${p.quantity} restants`,
    color: '#fffbeb',
    page: 'products'
  }));

  const unpaidAlerts = salesData.filter(s => s.status !== 'paid').map(s => ({
    id: `sale-${s.id}`,
    type: 'PAYMENT',
    icon: <DollarSign size={16} color="#3b82f6" />,
    title: 'Paiement en attente',
    desc: `Vente #${s.id.slice(0, 5)} - Reste: ${s.total_amount - (s.paid_amount || 0)} F`,
    color: '#eff6ff',
    page: 'sales'
  }));

  const allNotifications = [...stockAlerts, ...unpaidAlerts];

  useEffect(() => {
    const saved = localStorage.getItem(AUTH_STORAGE_KEY);
    if (saved) {
      try {
        setCurrentUser(JSON.parse(saved));
      } catch (err) {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    }
    setLoadingAuth(false);
  }, []);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch(`${API_URL}/settings`, {
          headers: getHeaders()
        });
        if (!res.ok) return;
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          console.warn(`Reponse non JSON pour /settings (status=${res.status}, content-type=${contentType || 'n/a'})`);
          return;
        }
        const settings = await res.json();
        if (settings?.subscription_status) {
          setCompanyValidationStatus(settings.subscription_status);
        }
        if (settings?.expiry_date) {
          setCompanyNextBilling(settings.expiry_date);
        }
        if (settings?.plan_id) {
          setCompanyPlanId(settings.plan_id);
        }
      } catch (e) {
        console.error('Erreur chargement statut entreprise', e);
      }
    };
    if (currentUser) fetchSettings();
  }, [currentUser]);

  useEffect(() => {
    const onApi404 = (event) => {
      const endpoint = event?.detail?.endpoint || 'ressource';
      setCurrentPage('contacts');
      setSupportNotice(`La ressource ${endpoint} est introuvable (404). Vous avez été redirigé vers le support.`);
    };
    window.addEventListener('kameo_api_404', onApi404);
    return () => window.removeEventListener('kameo_api_404', onApi404);
  }, []);

  const handleLoginSuccess = (user) => {
    const normalizedUser = {
      id: user.id || null,
      name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || 'Utilisateur',
      email: user.email || '',
      role: user.role || 'cashier',
      company_id: user.company_id || null
    };
    setCurrentUser(normalizedUser);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(normalizedUser));
  };

  const toggleSidebar = () => {
    const nextValue = !isSidebarCollapsed;
    setIsSidebarCollapsed(nextValue);
    localStorage.setItem('kameo_sidebar_collapsed', String(nextValue));
  };

  if (loadingAuth) return <AppLoader />;
  if (!currentUser) return <LoginPage onLoginSuccess={handleLoginSuccess} />;

  if (currentUser && !['superadmin'].includes(currentUser.role) && companyValidationStatus !== 'active') {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h2>Accès restreint</h2>
        <p>Votre plan est en attente de validation par le superadmin.</p>
        <p>Statut actuel : <strong style={{ color: '#d97706' }}>{companyValidationStatus}</strong></p>
        <p>Merci de patienter, un administrateur va valider votre accès.</p>
      </div>
    );
  }

  const renderContent = () => {
    // Protection de la route Admin
    if (currentPage === 'admin' && currentUser.role !== 'superadmin') {
      return <div style={{ padding: '40px', textAlign: 'center' }}><h2>Accès Refusé</h2><p>Vous n'avez pas les droits pour accéder à cette section.</p></div>;
    }

    switch (currentPage) {
      case 'dashboard': return <Dashboard onNavigate={setCurrentPage} />;
      case 'pos': return <POS />;
      case 'products': return <Products />;
      case 'stock': return <Stock />;
      case 'sales': return <Sales />;
      case 'purchases': return <Purchases />;
      case 'finance': return <FinanceModule />;
      case 'contacts': return <Contacts />;
      case 'settings': return <SettingsPage currentUser={currentUser} />;
      case 'subscription': return <Subscription />;
      case 'users': return <UsersManager />;
      case 'admin': return <AdminPanel />;
      default: return <div style={{ padding: '20px' }}>Page inconnue</div>;
    }
  };

  const getPageTitle = () => {
    const titles = { 
      dashboard: "Tableau de bord", 
      pos: "Caisse (POS)", 
      products: "Catalogue Produits", 
      stock: "Mouvements de stock", 
      sales: "Ventes & Factures", 
      purchases: "Achats Fournisseurs", 
      finance: "Finance & Trésorerie", 
      contacts: "Annuaire Contacts", 
      settings: "Paramètres", 
      subscription: "Mon Abonnement", 
      users: "Gestion Utilisateurs", 
      admin: "Administration Plateforme" 
    };
    return titles[currentPage] || "KAméo";
  };

  const showHeaderActions = ['dashboard', 'pos'].includes(currentPage);

  const searchablePages = {
    dashboard: ["tableau de bord", "dashboard", "stats", "kpi"],
    pos: ["caisse", "pos", "vente", "encaisser"],
    products: ["produits", "catalogue", "references", "stock produit"],
    stock: ["mouvements", "stock", "inventaire", "entree", "sortie"],
    sales: ["ventes", "factures", "invoice", "chiffre"],
    purchases: ["achats", "fournisseurs", "bon de commande", "depenses achat"],
    finance: ["finance", "tresorerie", "recettes", "depenses", "balance"],
    contacts: ["contacts", "clients", "fournisseurs", "annuaire"],
    settings: ["parametres", "settings", "configuration"],
    subscription: ["abonnement", "plan", "pricing", "subscription"],
    users: ["utilisateurs", "equipe", "staff", "users", "compte"],
    admin: ["admin", "administration", "plateforme"]
  };

  const handleGlobalSearchSubmit = (e) => {
    if (e.key !== 'Enter') return;
    const query = globalSearch.trim().toLowerCase();
    if (!query) return;
    const targetPage = Object.entries(searchablePages).find(([, keywords]) =>
      keywords.some(k => k.includes(query) || query.includes(k))
    )?.[0];
    if (targetPage) {
      setCurrentPage(targetPage);
      setIsMobileMenuOpen(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: { 'X-Company-Id': currentUser?.company_id || '' }
      });
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      setCurrentUser(null);
    }
  };

  return (
    <div className="app-container">
      <aside className={`sidebar ${isMobileMenuOpen ? 'open' : ''} ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header" style={{ minHeight: '80px' }}>
          <div className="logo" style={{ cursor: 'pointer' }} onClick={() => setCurrentPage('dashboard')}>
            <div style={{
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderRadius: '12px',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <img src="/logo.png" alt="Logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} onError={(e) => e.target.parentElement.style.display = 'none'} />
            </div>
            <span className="logo-text" style={{ fontSize: '22px', letterSpacing: '-0.5px' }}>KAméo</span>
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            {!isMobileMenuOpen && (
              <button className="mobile-toggle" onClick={toggleSidebar} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', opacity: 0.7 }}>
                <Menu size={20} />
              </button>
            )}
            <button className="mobile-toggle" onClick={() => setIsMobileMenuOpen(false)} style={{ display: isMobileMenuOpen ? 'flex' : 'none', alignItems: 'center', justifyContent: 'center', padding: '8px' }}>
              <X size={20} />
            </button>
          </div>
        </div>


        <nav className="sidebar-nav">
          <p className="nav-section">PRINCIPAL</p>
          <NavItem icon={<Grid size={18} />} label="Tableau de bord" active={currentPage === 'dashboard'} onClick={() => setCurrentPage('dashboard')} />
          <NavItem icon={<ShoppingCart size={18} />} label="Caisse (POS)" active={currentPage === 'pos'} onClick={() => setCurrentPage('pos')} />
          <p className="nav-section">INVENTAIRE</p>
          <NavItem icon={<Package size={18} />} label="Produits" active={currentPage === 'products'} onClick={() => setCurrentPage('products')} />
          <NavItem icon={<Layers size={18} />} label="Mouvements" active={currentPage === 'stock'} onClick={() => setCurrentPage('stock')} />
          <p className="nav-section">FINANCES</p>
          <NavItem icon={<FileText size={18} />} label="Ventes & Factures" active={currentPage === 'sales'} onClick={() => setCurrentPage('sales')} />
          <NavItem icon={<Truck size={18} />} label="Achats" active={currentPage === 'purchases'} onClick={() => setCurrentPage('purchases')} />
          <NavItem icon={<Wallet size={18} />} label="Finance (Trésorerie)" active={currentPage === 'finance'} onClick={() => setCurrentPage('finance')} />
          <p className="nav-section">GESTION</p>
          <NavItem icon={<Users size={18} />} label="Contacts" active={currentPage === 'contacts'} onClick={() => setCurrentPage('contacts')} />
          <NavItem icon={<Settings size={18} />} label="Paramètres" active={currentPage === 'settings'} onClick={() => setCurrentPage('settings')} />
          <NavItem icon={<CreditCard size={18} />} label="Abonnement" active={currentPage === 'subscription'} onClick={() => setCurrentPage('subscription')} />

          {currentUser.role === 'superadmin' && (
            <>
              <p className="nav-section">ADMINISTRATION</p>
              <NavItem icon={<Users size={18} />} label="Utilisateurs" active={currentPage === 'users'} onClick={() => setCurrentPage('users')} />
              <NavItem icon={<Shield size={18} />} label="Gestion Plateforme" active={currentPage === 'admin'} onClick={() => setCurrentPage('admin')} />
            </>
          )}
          {currentUser.role === 'admin' && (
            <>
              <p className="nav-section">ADMINISTRATION</p>
              <NavItem icon={<Users size={18} />} label="Utilisateurs" active={currentPage === 'users'} onClick={() => setCurrentPage('users')} />
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">
              {currentUser.name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('')}
            </div>
            <div className="user-details">
              <span className="user-name">{currentUser.name}</span>
              <span className="user-role">{currentUser.role === 'superadmin' ? 'Propriétaire' : currentUser.role}</span>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout} title="Déconnexion">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <main className="main-content">
        {supportNotice ? (
          <div style={{ margin: '16px 20px 0', backgroundColor: '#fff7ed', border: '1px solid #fdba74', color: '#9a3412', padding: '10px 14px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
            <span>{supportNotice}</span>
            <button type="button" onClick={() => setSupportNotice('')} style={{ border: 'none', background: 'transparent', color: '#9a3412', cursor: 'pointer', fontWeight: 600 }}>Fermer</button>
          </div>
        ) : null}
        <header className="topbar">
          <div className="topbar-left">
            <button className="mobile-toggle-btn" onClick={() => setIsMobileMenuOpen(true)}><Menu size={20} /></button>
            <h1 className="page-title">{getPageTitle()}</h1>
          </div>
          <div className="topbar-right">
            <CompanySwitcher currentUser={currentUser} />
            
            <div style={{ position: 'relative' }}>
              <button className="icon-btn notification-btn" onClick={() => setShowNotifications(v => !v)} style={{ position: 'relative' }}>
                <Bell size={20} />
                {allNotifications.length > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-5px',
                    right: '-5px',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    padding: '2px 6px',
                    borderRadius: '10px',
                    border: '2px solid white'
                  }}>
                    {allNotifications.length}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div style={{
                  position: 'absolute',
                  top: '120%',
                  right: 0,
                  width: '300px',
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                  border: '1px solid #e2e8f0',
                  zIndex: 1000,
                  overflow: 'hidden'
                }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>Notifications</span>
                    <button onClick={() => setShowNotifications(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={16} /></button>
                  </div>
                  <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                    {allNotifications.length === 0 ? (
                      <div style={{ padding: '30px 20px', textAlign: 'center', color: '#94a3b8' }}>
                        <Bell size={32} style={{ marginBottom: '10px', opacity: 0.2, margin: '0 auto' }} />
                        <p style={{ fontSize: '0.85rem', margin: 0 }}>Aucune notification</p>
                      </div>
                    ) : (
                      allNotifications.map((n) => (
                        <div 
                          key={n.id} 
                          onClick={() => { setCurrentPage(n.page); setShowNotifications(false); }}
                          style={{ 
                            padding: '12px 16px', 
                            borderBottom: '1px solid #f1f5f9', 
                            cursor: 'pointer',
                            transition: 'background-color 0.2s',
                            display: 'flex',
                            gap: '12px'
                          }}
                          onMouseOver={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                          onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <div style={{ 
                            width: '32px', 
                            height: '32px', 
                            borderRadius: '8px', 
                            backgroundColor: n.type === 'stock' ? '#fff1f2' : '#fefce8',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            {n.icon}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1e293b', marginBottom: '2px' }}>{n.title}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: '1.4' }}>{n.desc}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  {allNotifications.length > 0 && (
                    <div style={{ padding: '10px', textAlign: 'center', borderTop: '1px solid #f1f5f9', backgroundColor: '#f8fafc' }}>
                      <button 
                        onClick={() => { setCurrentPage('dashboard'); setShowNotifications(false); }}
                        style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                      >
                        Voir le tableau de bord
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {showHeaderActions && (
              <button className="primary-btn" onClick={() => setCurrentPage('pos')}>
                <Plus size={16} /> Nouvelle Vente
              </button>
            )}
          </div>
        </header>

        <div className="page-wrapper">{renderContent()}</div>
      </main>

      {isMobileMenuOpen && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 40 }}
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Modern Notifications Container */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type} ${t.fading ? 'toast-fade-out' : ''}`}>
            <div className="toast-icon">
              {t.type === 'success' ? <CheckCircle size={20} /> : (t.type === 'error' ? <AlertCircle size={20} /> : <AlertTriangle size={20} />)}
            </div>
            <div className="toast-content">
              <div className="toast-title">{t.title}</div>
              <div className="toast-message">{t.message}</div>
            </div>
            <button className="toast-close" onClick={() => removeToast(t.id)}><X size={16} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

const NavItem = ({ icon, label, active, onClick }) => (
  <button
    className={`nav-item ${active ? 'active' : ''}`}
    onClick={onClick}
    style={{ position: 'relative' }}
  >
    {icon}
    <span style={{ flex: 1 }}>{label}</span>
    {active && <div style={{
      position: 'absolute',
      right: '12px',
      width: '6px',
      height: '6px',
      borderRadius: '50%',
      backgroundColor: '#60a5fa',
      boxShadow: '0 0 10px #3b82f6'
    }} />}
  </button>
);



// ==========================================
// COMPOSANTS DES PAGES
// ==========================================

const SuperAdminDashboard = () => {
  const [stats, statsLoading] = useFetch('/admin/stats', { totalCompanies: 0, totalUsers: 0, activeSubscriptions: 0, mrr: 0 });
  const [companies, companiesLoading] = useFetch('/admin/companies', []);

  if (statsLoading || companiesLoading) return <div style={{ padding: '40px', textAlign: 'center' }}><div className="spinner"></div> Chargement du tableau SaaS...</div>;

  const recentCompanies = companies.slice(0, 5);

  return (
    <>
      <div className="dashboard-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
        <StatCard icon={<Building size={24} />} title="Entreprises Inscrites" value={stats?.totalCompanies || 0} color="blue" />
        <StatCard icon={<Users size={24} />} title="Utilisateurs Globaux" value={stats?.totalUsers || 0} color="purple" />
        <StatCard icon={<CheckCircle size={24} />} title="Abonnements Actifs" value={stats?.activeSubscriptions || 0} color="green" />
        <StatCard icon={<DollarSign size={24} />} title="Revenu Mensuel (MRR)" value={`${(stats?.mrr || 0).toLocaleString()} F`} color="emerald" />
      </div>

      <div className="card" style={{ padding: '20px' }}>
        <h3 style={{ marginTop: 0, color: '#1e293b' }}>Dernières entreprises inscrites</h3>
        {(recentCompanies || []).length === 0 ? <p style={{ color: '#94a3b8' }}>Aucune entreprise.</p> : (
          <div className="table-responsive">
            <table className="data-table">
              <thead><tr><th>Nom</th><th>Email</th><th>Plan</th><th>Statut</th></tr></thead>
              <tbody>
                {(recentCompanies || []).map(c => (
                  <tr key={c.id}>
                    <td><strong>{c.name}</strong></td>
                    <td>{c.email}</td>
                    <td>{c.plan_id}</td>
                    <td><span className={`status-badge ${c.subscription_status === 'active' ? 'success' : 'error'}`}>{c.subscription_status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
};

const InvoicePreview = ({ model, settings, prefs }) => {
  const dummyData = {
    sale: {
      id: "PRO-2026-001",
      sale_date: new Date().toISOString(),
      customer_name: "Jean Dupont",
      total_amount: 3370000,
      paid_amount: 2200000,
      remaining_amount: 1170000,
      status: "partial",
      cart: [
        { name: "Ordinateur HP Bureau (Intel Core i3)", selling_price: 662000, cartQuantity: 5 },
        { name: "Stabilisateur 2000Va", selling_price: 60000, cartQuantity: 1 }
      ]
    },
    company: {
      name: settings.name || "KAméo SaaS",
      address: settings.address || "Quartier Commerce, Bouaké",
      phone: settings.phone || "+225 07 00 00 00",
      email: settings.email || "contact@kameo.com",
      logoUrl: prefs.logoUrl
    }
  };

  const renderModel = () => {
    switch (model) {
      case 'model4': // Multi Services Informatqiue Style
        return (
          <div style={{ background: '#fff', padding: '20px', fontSize: '12px', border: '1px solid #ddd', minHeight: '400px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '2px solid #2563eb', paddingBottom: '10px' }}>
              <div style={{ textAlign: 'left' }}>
                {dummyData.company.logoUrl && <img src={dummyData.company.logoUrl} style={{ maxWidth: '60px' }} />}
                <div style={{ color: '#2563eb', fontWeight: 'bold', fontSize: '18px' }}>{dummyData.company.name}</div>
                <div style={{ color: '#64748b', fontSize: '10px' }}>Informatiques - Bureautiques - Services</div>
              </div>
              <div style={{ textAlign: 'right', fontSize: '10px' }}>
                <div>NCC: 2404242 H</div>
                <div>REGIME: TEE</div>
                <div style={{ fontWeight: 'bold' }}>BOUAKE LE : {new Date().toLocaleDateString()}</div>
              </div>
            </div>

            <h3 style={{ textAlign: 'center', margin: '20px 0', textDecoration: 'underline' }}>FACTURE PROFORMA NÂ°0022</h3>

            <div style={{ marginBottom: '15px', fontWeight: 'bold' }}>DOIT : {dummyData.sale.customer_name}</div>

            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #2563eb' }}>
              <thead style={{ background: '#dbeafe', color: '#2563eb' }}>
                <tr>
                  <th style={{ border: '1px solid #2563eb', padding: '8px', textAlign: 'left' }}>DESIGNATIONS</th>
                  <th style={{ border: '1px solid #2563eb', padding: '8px' }}>QTE</th>
                  <th style={{ border: '1px solid #2563eb', padding: '8px' }}>PU.TTC</th>
                  <th style={{ border: '1px solid #2563eb', padding: '8px' }}>PT.TTC</th>
                </tr>
              </thead>
              <tbody>
                {dummyData.sale.cart.map((item, id) => (
                  <tr key={id}>
                    <td style={{ border: '1px solid #2563eb', padding: '8px' }}>{item.name}</td>
                    <td style={{ border: '1px solid #2563eb', padding: '8px', textAlign: 'center' }}>{item.cartQuantity}</td>
                    <td style={{ border: '1px solid #2563eb', padding: '8px', textAlign: 'right' }}>{item.selling_price.toLocaleString()}</td>
                    <td style={{ border: '1px solid #2563eb', padding: '8px', textAlign: 'right' }}>{(item.cartQuantity * item.selling_price).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="3" style={{ border: '1px solid #2563eb', padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>TOTAL TTC</td>
                  <td style={{ border: '1px solid #2563eb', padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>{dummyData.sale.total_amount.toLocaleString()} F</td>
                </tr>
              </tfoot>
            </table>

            <div style={{ marginTop: 'auto', textAlign: 'right', paddingTop: '40px', fontStyle: 'italic' }}>LA DIRECTION</div>
            <div style={{ textAlign: 'center', fontSize: '10px', color: '#ef4444', marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '10px' }}>{dummyData.company.address}</div>
          </div>
        );
      case 'model5': // QSS Style
        return (
          <div style={{ background: '#fff', padding: '20px', fontSize: '11px', border: '1px solid #000', color: '#000' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '20px', marginBottom: '15px' }}>
              <div style={{ border: '2px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '24px' }}>QSS</div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{dummyData.company.name}</div>
                <div style={{ fontSize: '10px' }}>QUINCAILLERIE GÉNÉRALE - TOUT POUR LE BÂTIMENT</div>
                <div style={{ fontSize: '9px' }}>Contact: {dummyData.company.phone}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '10px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000' }}>
                <tbody>
                  <tr><td style={{ border: '1px solid #000', padding: '4px', background: '#eee' }}>FACTURE NÂ°</td><td style={{ padding: '4px' }}>1</td></tr>
                  <tr><td style={{ border: '1px solid #000', padding: '4px', background: '#eee' }}>DATE</td><td style={{ padding: '4px' }}>{new Date().toLocaleDateString()}</td></tr>
                  <tr><td style={{ border: '1px solid #000', padding: '4px', background: '#eee' }}>HEURE</td><td style={{ padding: '4px' }}>12:52</td></tr>
                </tbody>
              </table>
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000' }}>
                <tbody>
                  <tr><td style={{ border: '1px solid #000', padding: '4px', background: '#eee', textAlign: 'center' }}>CLIENT</td></tr>
                  <tr><td style={{ border: '1px solid #000', padding: '10px', height: '40px' }}>{dummyData.sale.customer_name}</td></tr>
                </tbody>
              </table>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000' }}>
              <thead style={{ background: '#eee' }}>
                <tr>
                  <th style={{ border: '1px solid #000', padding: '4px' }}>CODE/REF</th>
                  <th style={{ border: '1px solid #000', padding: '4px' }}>DESIGNATION</th>
                  <th style={{ border: '1px solid #000', padding: '4px' }}>QTE</th>
                  <th style={{ border: '1px solid #000', padding: '4px' }}>PT HT</th>
                </tr>
              </thead>
              <tbody>
                {dummyData.sale.cart.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ border: '1px solid #000', padding: '4px' }}>{idx + 1}</td>
                    <td style={{ border: '1px solid #000', padding: '4px' }}>{item.name}</td>
                    <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>{item.cartQuantity}</td>
                    <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>{(item.cartQuantity * item.selling_price).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px', marginTop: '10px' }}>
              <div style={{ border: '1px solid #000', padding: '5px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <strong>CACHET/SIGNATURE</strong>
                <div style={{ height: '40px' }}></div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000' }}>
                <tbody>
                  <tr><td style={{ padding: '4px', border: '1px solid #000' }}>BRUT HT</td><td style={{ textAlign: 'right', padding: '4px' }}>{dummyData.sale.total_amount.toLocaleString()}</td></tr>
                  <tr><td style={{ padding: '4px', border: '1px solid #000' }}>TVA (0%)</td><td style={{ textAlign: 'right', padding: '4px' }}>0</td></tr>
                  <tr><td style={{ padding: '4px', border: '1px solid #000', fontWeight: 'bold', background: '#eee' }}>NET A PAYER</td><td style={{ textAlign: 'right', padding: '4px', fontWeight: 'bold', background: '#eee' }}>{dummyData.sale.total_amount.toLocaleString()}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      default:
        return (
          <div style={{ background: '#fff', padding: '20px', border: '1px solid #eee', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
              <div style={{ color: prefs.accentColor || '#3b82f6', fontWeight: 600 }}>{dummyData.company.name}</div>
              <div>Facture {dummyData.sale.id}</div>
            </div>
            <div style={{ borderBottom: '1px solid #f1f5f9', marginBottom: '10px' }}></div>
            <div style={{ fontSize: '12px' }}>
              Client: {dummyData.sale.customer_name}<br />
              Articles: {dummyData.sale.cart.length}
            </div>
            <div style={{ marginTop: '20px', textAlign: 'right', fontWeight: 'bold' }}>
              Total: {dummyData.sale.total_amount.toLocaleString()} F
            </div>
          </div>
        );
    }
  };

  return (
    <div className="preview-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#64748b', fontSize: '0.85rem', fontWeight: 600 }}>
        <ImageIcon size={16} /> Aperçu en temps réel
      </div>
      <div style={{ transform: 'scale(0.85)', transformOrigin: 'top center', boxShadow: '0 8px 30px rgba(0,0,0,0.1)' }}>
        {renderModel()}
      </div>
    </div>
  );
};

const Dashboard = ({ onNavigate }) => {
  const storedUser = JSON.parse(localStorage.getItem('kameo_current_user') || '{}');
  const activeCompany = localStorage.getItem('kameo_active_company_id');
  const isGlobalSuperAdmin = storedUser?.role === 'superadmin' && !activeCompany;

  const [stats, statsLoading] = useFetch('/dashboard/stats', { sales_today: 0, sales_month: 0, stock_value: 0, low_stock_items: 0, active_customers: 0, historical_sales: [] }, isGlobalSuperAdmin);
  const [sales] = useFetch('/sales', [], isGlobalSuperAdmin);
  const [products] = useFetch('/products', [], isGlobalSuperAdmin);

  if (isGlobalSuperAdmin) {
    return <SuperAdminDashboard />;
  }

  // Filtrer les produits en stock critique (<= 5)
  const criticalStockProducts = products.filter(p => p.quantity <= 5).sort((a, b) => a.quantity - b.quantity);

  if (statsLoading) return <div style={{ padding: '40px', textAlign: 'center' }}><div className="spinner"></div> Chargement du tableau de bord...</div>;

  return (
    <>
      <div className="dashboard-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px' }}>
        <StatCard icon={<DollarSign size={24} />} title="Ventes (Aujourd'hui)" value={`${stats.sales_today} F`} color="blue" />
        <StatCard icon={<TrendingUp size={24} />} title="Ventes (Ce mois)" value={`${stats.sales_month || 0} F`} color="emerald" />
        <StatCard icon={<Box size={24} />} title="Valeur du stock" value={`${stats.stock_value} F`} color="green" />
        <StatCard icon={<AlertTriangle size={24} />} title="Ruptures" value={stats.low_stock_items} color="red" valueColor="red" />
        <StatCard icon={<Users size={24} />} title="Clients actifs" value={stats.active_customers} color="purple" trendUp trend="+4 ce mois" />
      </div>

      <div className="dashboard-grid" style={{ marginBottom: '20px' }}>
        <div className="card" style={{ padding: '20px' }}>
          <SalesChart data={stats.historical_sales} />
        </div>
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h3 style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '10px' }}>Performance Hebdomadaire</h3>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#10b981' }}>+18.4%</div>
          <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '5px 0' }}>Par rapport à la semaine dernière</p>
          <div style={{ marginTop: '15px', height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: '70%', height: '100%', background: '#10b981' }}></div>
          </div>
          <p style={{ fontSize: '0.75rem', marginTop: '10px' }}>Objectif mensuel: <strong>70% atteint</strong></p>
        </div>
      </div>
      <div className="dashboard-grid">
        <div className="card">
          <div className="card-header">
            <h2>Dernières Ventes</h2><button type="button" className="card-link" style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => onNavigate('sales')}>Voir tout</button>
          </div>
          <div className="table-responsive">
            <table className="data-table">
              <thead><tr><th>Date</th><th>Montant</th><th>Statut</th></tr></thead>
              <tbody>
                {sales.length === 0 ? <tr><td colSpan="3" style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>Aucune vente récente</td></tr> : null}
                {sales.slice(0, 5).map(s => (
                  <tr key={s.id}>
                    <td>{new Date(s.sale_date).toLocaleString()}</td>
                    <td style={{ fontWeight: 600 }}>{s.total_amount} F</td>
                    <td><span className="status-badge success">Payé</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Alertes Stock</h2><button type="button" className="card-link" style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => onNavigate('stock')}>Gérer</button>
          </div>
          <ul className="item-list">
            {criticalStockProducts.length === 0 ? (
              <li className="item" style={{ textAlign: 'center', padding: '20px', color: '#10b981' }}>
                <div className="item-icon" style={{ color: 'white', backgroundColor: '#10b981' }}><Check size={20} /></div>
                <div className="item-info"><h4>Aucune alerte stock</h4><p>Tous les produits ont un stock suffisant</p></div>
              </li>
            ) : (
              criticalStockProducts.slice(0, 5).map(product => (
                <li key={product.id} className="item" style={{ cursor: 'pointer' }} onClick={() => onNavigate('products')}>
                  <div className="item-icon" style={{ color: 'white', backgroundColor: product.quantity <= 1 ? '#ef4444' : '#f59e0b', padding: '0', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {getCleanImageUrl(product.image_url) ? (
                      <img src={getCleanImageUrl(product.image_url)} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; e.target.parentElement.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>'; }} />
                    ) : (
                      <Package size={20} />
                    )}
                  </div>
                  <div className="item-info">
                    <h4>{product.name}</h4>
                    <p>Réf: {product.reference || 'Non définie'}</p>
                  </div>
                  <div className="item-action">
                    <span className={`stock-count ${product.quantity <= 1 ? 'critical' : 'warning'}`}>
                      {product.quantity} rest.
                    </span>
                  </div>
                </li>
              ))
            )}
          </ul>
          {criticalStockProducts.length > 5 && (
            <div style={{ padding: '10px 16px', textAlign: 'center', borderTop: '1px solid #f1f5f9' }}>
              <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0' }}>
                {criticalStockProducts.length - 5} autre{criticalStockProducts.length - 5 > 1 ? 's' : ''} produit{criticalStockProducts.length - 5 > 1 ? 's' : ''} en stock critique
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};



// Composant POS existant conservé identique
const POS = () => {
  const [products] = useFetch('/products', []);
  const [contacts] = useFetch('/contacts', { customers: [], suppliers: [] });
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('payer'); // 'payer', 'partiel', 'credit'

  const filteredProducts = products.filter(p =>
    (p.name && p.name.toLowerCase().includes(search.toLowerCase())) ||
    (p.reference && p.reference.toLowerCase().includes(search.toLowerCase()))
  );

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, cartQuantity: item.cartQuantity + 1 } : item);
      }
      return [...prev, { ...product, cartQuantity: 1 }];
    });
  };

  const updateQuantity = (id, delta) => {
    setCart(prev =>
      prev
        .map(item => item.id === id ? { ...item, cartQuantity: item.cartQuantity + delta } : item)
        .filter(item => item.cartQuantity > 0)
    );
  };

  const removeFromCart = (id) => setCart(prev => prev.filter(item => item.id !== id));

  const updatePrice = (id, newPrice) => {
    const numPrice = Number(newPrice) || 0;
    const item = cart.find(item => item.id === id);

    if (item && numPrice < (item.purchase_price || 0)) {
      addToast('Erreur', `Le prix de vente (${numPrice} F) ne peut pas être inférieur au prix d'achat (${item.purchase_price} F).`, 'error');
      return;
    }

    setCart(prev =>
      prev.map(item => item.id === id ? { ...item, selling_price: numPrice } : item)
    );
  };

  const total = cart.reduce((sum, item) => sum + (Number(item.selling_price) * item.cartQuantity), 0);
  const remainingAmount = Math.max(0, total - Number(paidAmount || 0));
  const paymentStatus = paymentMode === 'payer' ? 'paid' : (paymentMode === 'partiel' ? 'partial' : 'pending');

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setIsProcessing(true);
    try {
      const response = await fetch(`${API_URL}/sales`, {
        method: 'POST',
        credentials: 'include',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          cart,
          totalAmount: total,
          paidAmount: Number(paidAmount || 0),
          remainingAmount: remainingAmount,
          status: paymentStatus,
          customerId: selectedCustomerId
        })
      });
      const data = await response.json();
      if (data.success) {
        addToast('Succès', paymentStatus === 'paid'
          ? 'Vente enregistrée avec succès !'
          : `Vente enregistrée ! Acompte: ${paidAmount} F, Reste: ${remainingAmount} F`, 'success');
        setCart([]);
        setPaidAmount('');
      } else {
        addToast('Erreur', data.error || 'Erreur lors de l\'enregistrement', 'error');
      }
    } catch (err) { addToast('Erreur', 'Erreur de connexion au serveur.', 'error'); }
    setIsProcessing(false);
  };

  return (
    <div className="pos-layout" style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div className="card" style={{ flex: '1 1 300px', padding: 'var(--pos-padding, 20px)', minWidth: '300px' }}>
        <div className="search-filters" style={{ marginBottom: '20px', position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: 12, top: 12, color: '#94a3b8' }} />
          <input type="text" placeholder="Rechercher un produit à ajouter..." className="large-input" style={{ width: '100%', paddingLeft: 40 }} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '15px', maxHeight: '600px', overflowY: 'auto' }}>
          {filteredProducts.map(p => (
            <div key={p.id} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '15px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s', backgroundColor: '#fff' }} onClick={() => addToCart(p)}>
              <div style={{ backgroundColor: '#f1f5f9', width: '100px', height: '100px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', overflow: 'hidden' }}>
                {getCleanImageUrl(p.image_url) ? (
                  <img src={getCleanImageUrl(p.image_url)} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/100?text=?'; }} />
                ) : (
                  <Package size={32} color="#64748b" />
                )}
              </div>
              <h4 style={{ margin: '0 0 5px 0', fontSize: '0.9rem', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</h4>
              <p style={{ margin: 0, fontWeight: 'bold', color: '#3b82f6' }}>{p.selling_price} F</p>
            </div>
          ))}
        </div>
      </div>
      <div className="card cart-container" style={{ flex: '1 1 340px', maxWidth: '400px', minWidth: '320px', padding: '0', display: 'flex', flexDirection: 'column', minHeight: '600px' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc', borderRadius: '8px 8px 0 0' }}>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}><ShoppingCart color="#3b82f6" /> Panier Actuel</h2>
        </div>
        <div style={{ padding: '20px', flex: '1', overflowY: 'auto' }}>
          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: '40px' }}><ShoppingCart size={48} style={{ opacity: 0.2, margin: '0 auto 10px' }} /><p>Le panier est vide</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {cart.map(item => (
                <div key={item.id} style={{ display: 'flex', gap: '10px', alignItems: 'center', borderBottom: '1px dashed #e2e8f0', paddingBottom: '10px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '4px', overflow: 'hidden', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {getCleanImageUrl(item.image_url) ? (
                      <img src={getCleanImageUrl(item.image_url)} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <Package size={16} color="#64748b" />
                    )}
                  </div>
                  <div style={{ flex: 1, paddingRight: 10, minWidth: 0 }}>
                    <h5 style={{ margin: '0 0 2px', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</h5>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <input
                        type="number"
                        value={item.selling_price}
                        onChange={(e) => updatePrice(item.id, e.target.value)}
                        style={{
                          width: '120px',
                          padding: '4px 8px',
                          fontSize: '0.85rem',
                          border: '2px solid #3b82f6',
                          borderRadius: '6px',
                          backgroundColor: '#eff6ff',
                          color: '#1e40af',
                          fontWeight: '600'
                        }}
                        min={item.purchase_price || 0}
                      />
                      <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '500' }}>F</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: '4px' }}>
                      <button style={{ border: 'none', background: 'transparent', padding: '1px 6px', cursor: 'pointer', fontSize: '1rem' }} onClick={() => updateQuantity(item.id, -1)}>-</button>
                      <span style={{ fontSize: '0.8rem', fontWeight: 'bold', width: '16px', textAlign: 'center' }}>{item.cartQuantity}</span>
                      <button style={{ border: 'none', background: 'transparent', padding: '1px 6px', cursor: 'pointer', fontSize: '1rem' }} onClick={() => updateQuantity(item.id, 1)}>+</button>
                    </div>
                    <button style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', padding: '2px' }} onClick={() => removeFromCart(item.id)}><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ padding: '20px', borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Client (Optionnel)</label>
          <div style={{ position: 'relative', marginBottom: '10px' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Chercher client..."
              className="large-input"
              style={{ width: '100%', paddingLeft: 35, fontSize: '0.85rem' }}
              value={customerSearch}
              onChange={e => setCustomerSearch(e.target.value)}
            />
          </div>
          <select
            className="filter-select"
            style={{ width: '100%', marginBottom: '15px', padding: '10px' }}
            value={selectedCustomerId}
            onChange={e => setSelectedCustomerId(e.target.value)}
          >
            <option value="">Client de passage (Anonyme)</option>
            {contacts.customers
              .filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()) || (c.contact_info && c.contact_info.includes(customerSearch)))
              .map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
          </select>
        </div>
        <div style={{ padding: '20px', borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc', borderRadius: '0 0 8px 8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', fontSize: '1.1rem' }}>
            <span style={{ fontWeight: '500', color: '#64748b' }}>Total :</span>
            <span style={{ fontWeight: 'bold', color: '#1e293b' }}>{total} F</span>
          </div>

          {/* Boutons de mode de paiement */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
            <button
              onClick={() => {
                setPaymentMode('payer');
                setPaidAmount(total.toString());
              }}
              style={{
                flex: 1,
                padding: '10px',
                border: paymentMode === 'payer' ? '2px solid #10b981' : '1px solid #e2e8f0',
                borderRadius: '6px',
                backgroundColor: paymentMode === 'payer' ? '#dcfce7' : '#fff',
                color: paymentMode === 'payer' ? '#166534' : '#64748b',
                fontWeight: paymentMode === 'payer' ? '600' : '500',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              Payer
            </button>
            <button
              onClick={() => {
                setPaymentMode('partiel');
                setPaidAmount('');
              }}
              style={{
                flex: 1,
                padding: '10px',
                border: paymentMode === 'partiel' ? '2px solid #f59e0b' : '1px solid #e2e8f0',
                borderRadius: '6px',
                backgroundColor: paymentMode === 'partiel' ? '#fffbeb' : '#fff',
                color: paymentMode === 'partiel' ? '#92400e' : '#64748b',
                fontWeight: paymentMode === 'partiel' ? '600' : '500',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              Partiel
            </button>
            <button
              onClick={() => {
                setPaymentMode('credit');
                setPaidAmount('0');
              }}
              style={{
                flex: 1,
                padding: '10px',
                border: paymentMode === 'credit' ? '2px solid #8b5cf6' : '1px solid #e2e8f0',
                borderRadius: '6px',
                backgroundColor: paymentMode === 'credit' ? '#f3e8ff' : '#fff',
                color: paymentMode === 'credit' ? '#6d28d9' : '#64748b',
                fontWeight: paymentMode === 'credit' ? '600' : '500',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              Crédit
            </button>
          </div>

          {/* Champ d'acompte visible uniquement pour paiement partiel */}
          {paymentMode === 'partiel' && (
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Montant payé (acompte)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="number"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  placeholder={total.toString()}
                  className="large-input"
                  style={{ flex: 1, padding: '8px 12px', fontSize: '1rem', border: '2px solid #f59e0b', backgroundColor: '#fffbeb' }}
                />
                <span style={{ fontWeight: 'bold', color: '#92400e' }}>F</span>
              </div>
              {Number(paidAmount || 0) > 0 && (
                <div style={{ marginTop: '8px', padding: '8px 12px', backgroundColor: '#fffbeb', borderRadius: '6px', border: '1px solid #fde68a' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                    <span style={{ color: '#92400e' }}>Reste à payer:</span>
                    <span style={{ fontWeight: 'bold', color: '#92400e' }}>
                      {Math.max(0, total - Number(paidAmount || 0))} F
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Message pour crédit */}
          {paymentMode === 'credit' && (
            <div style={{ marginBottom: '15px', padding: '10px 12px', backgroundColor: '#f3e8ff', borderRadius: '6px', border: '1px solid #e9d5ff' }}>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#6d28d9', fontWeight: '500' }}>
                Vente en crédit - Le montant total ({total} F) sera ajouté à la dette du client
              </p>
            </div>
          )}

          <button className="primary-btn w-100" style={{ padding: '15px', fontSize: '1.1rem', backgroundColor: cart.length === 0 ? '#cbd5e1' : (paymentMode === 'partiel' ? '#f59e0b' : paymentMode === 'credit' ? '#8b5cf6' : '#10b981'), cursor: cart.length === 0 ? 'not-allowed' : 'pointer' }} disabled={cart.length === 0 || isProcessing} onClick={handleCheckout}>
            {isProcessing
              ? 'Enregistrement...'
              : (paymentMode === 'payer'
                ? `Payer ${total} F`
                : (paymentMode === 'partiel'
                  ? `Acompte ${Number(paidAmount || 0) > 0 ? paidAmount : 0} F`
                  : `Vente crédit ${total} F`))
            }
          </button>
        </div>
      </div>
    </div>
  );
};

const Products = () => {
  const [products, , setProducts] = useFetch('/products', []);
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [editingProductId, setEditingProductId] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState({ name: '', reference: '', selling_price: '', purchase_price: '', quantity: '', category: 'Outillage', image_url: '' });

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const uploadFormData = new FormData();
    uploadFormData.append('image', file);

    setIsUploading(true);
    try {
      const res = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        headers: getHeaders(),
        body: uploadFormData,
      });
      const data = await res.json();
      if (data.success) {
        setFormData(prev => ({ ...prev, image_url: data.imageUrl }));
      } else {
        console.error("Erreur upload API:", data.error);
        addToast('Erreur', 'Erreur lors du téléversement : ' + (data.error || "Une erreur inconnue est survenue"), 'error');
      }
    } catch (err) {
      console.error("Erreur réseau/connexion:", err);
      addToast('Erreur', 'Erreur de connexion au serveur pour le téléversement : ' + err.message, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const filteredProducts = products.filter((p) => {
    const text = `${p.name || ''} ${p.reference || ''}`.toLowerCase();
    const matchesSearch = text.includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || (p.category || 'Général') === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSave = async () => {
    if (!formData.name || !formData.selling_price) return addToast('Erreur', "Le nom et le prix de vente sont requis.", 'error');
    setIsSaving(true);
    try {
      const res = await fetch(`${API_URL}/products`, {
        method: 'POST',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.success) {
        addToast('Succès', 'Produit ajouté avec succès !', 'success');
        setProducts([data.product, ...products]);
        setShowAdd(false);
        setFormData({ name: '', reference: '', selling_price: '', purchase_price: '', quantity: '', category: 'Outillage', image_url: '' });
      } else {
        addToast('Erreur', data.error || 'L\'insertion du produit a échoué', 'error');
      }
    } catch (err) {
      addToast('Erreur', 'Erreur de connexion au serveur : ' + err.message, 'error');
    }
    setIsSaving(false);
  };

  const handleEditOpen = (product) => {
    setEditingProductId(product.id);
    setFormData({
      name: product.name || '',
      reference: product.reference || '',
      selling_price: product.selling_price || '',
      purchase_price: product.purchase_price || '',
      quantity: product.quantity || '',
      category: product.category || 'Outillage',
      image_url: product.image_url || ''
    });
    setShowAdd(false);
    setShowEdit(true);
    setShowDetail(false);
  };

  const handleShowDetail = (product) => {
    setSelectedProduct(product);
    setShowDetail(true);
    setShowAdd(false);
    setShowEdit(false);
  };

  const handleEditSave = async () => {
    if (!editingProductId) return;
    if (!formData.name || !formData.selling_price) return addToast('Attention', "Le nom et le prix de vente sont requis.", 'warning');
    setIsSaving(true);
    try {
      const res = await fetch(`${API_URL}/products/${editingProductId}`, {
        method: 'PATCH',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(formData)
      });
      const resData = await res.json();
      if (resData.success) {
        addToast('Succès', 'Produit mis à jour !', 'success');
        setProducts(products.map(p => (p.id === editingProductId ? resData.product : p)));
        setShowEdit(false);
        setEditingProductId(null);
        setFormData({ name: '', reference: '', selling_price: '', purchase_price: '', quantity: '', category: 'Outillage', image_url: '' });
      } else {
        addToast('Erreur', resData.error || 'Mise à jour échouée', 'error');
      }
    } catch (err) {
      addToast('Erreur', 'Erreur de connexion au serveur : ' + err.message, 'error');
    }
    setIsSaving(false);
  };

  const handleDelete = async (product) => {
    const ok = window.confirm(`Supprimer le produit "${product.name}" ?`);
    if (!ok) return;
    try {
      const res = await fetch(`${API_URL}/products/${product.id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      const d = await res.json();
      if (d.success) {
        addToast('Succès', 'Produit supprimé', 'success');
        setProducts(products.filter(p => p.id !== product.id));
      } else {
        addToast('Erreur', d.error || 'Suppression impossible', 'error');
      }
    } catch (err) {
      addToast('Erreur', 'Erreur serveur', 'error');
    }
  };

  return (
    <>
      <div className="page-top-actions">
        <div className="search-filters">
          <Search size={16} style={{ position: 'absolute', left: 15, top: 12, color: '#94a3b8' }} />
          <input type="text" placeholder="Rechercher un produit..." className="large-input" style={{ paddingLeft: 40 }} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          <select className="filter-select" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}><option value="all">Toutes les catégories</option><option value="Outillage">Outillage</option><option value="Quincaillerie">Quincaillerie</option><option value="Peinture">Peinture</option><option value="Général">Général</option></select>
        </div>
        <button className="primary-btn" onClick={() => setShowAdd(!showAdd)}><Plus size={16} /> Nouveau Produit</button>
      </div>

      {showAdd && (
        <div className="card mt-4" style={{ borderLeft: '4px solid #3b82f6', backgroundColor: '#f8fafc', padding: '25px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0, color: '#1e293b' }}>Créer un nouveau produit</h3>
            <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8' }} onClick={() => setShowAdd(false)}><X size={20} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '25px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: 5, fontSize: '0.9rem', color: '#475569', fontWeight: 600 }}>Nom du produit *</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Ex: Perceuse..." className="large-input" style={{ width: '100%', borderColor: '#cbd5e1' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 5, fontSize: '0.9rem', color: '#475569', fontWeight: 600 }}>Référence</label>
              <input type="text" name="reference" value={formData.reference} onChange={handleChange} placeholder="Ex: PC-18V" className="large-input" style={{ width: '100%', borderColor: '#cbd5e1' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 5, fontSize: '0.9rem', color: '#475569', fontWeight: 600 }}>Catégorie</label>
              <select name="category" value={formData.category} onChange={handleChange} className="filter-select" style={{ width: '100%', borderColor: '#cbd5e1' }}>
                <option>Outillage</option><option>Quincaillerie</option><option>Peinture</option><option>Général</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 5, fontSize: '0.9rem', color: '#475569', fontWeight: 600 }}>Prix d'achat (F)</label>
              <input type="number" name="purchase_price" value={formData.purchase_price} onChange={handleChange} placeholder="0" className="large-input" style={{ width: '100%', borderColor: '#cbd5e1' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 5, fontSize: '0.9rem', color: '#475569', fontWeight: 600 }}>Prix de vente (F) *</label>
              <input type="number" name="selling_price" value={formData.selling_price} onChange={handleChange} placeholder="0" className="large-input" style={{ width: '100%', borderColor: '#cbd5e1' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 5, fontSize: '0.9rem', color: '#475569', fontWeight: 600 }}>Stock initial</label>
              <input type="number" name="quantity" value={formData.quantity} onChange={handleChange} placeholder="0" className="large-input" style={{ width: '100%', borderColor: '#cbd5e1' }} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', marginBottom: 5, fontSize: '0.9rem', color: '#475569', fontWeight: 600 }}>Image du produit</label>
              <div style={{ display: 'flex', gap: '15px', alignItems: 'center', backgroundColor: 'white', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                <div style={{ flex: 1 }}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                    id="file-upload-add"
                  />
                  <label
                    htmlFor="file-upload-add"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 16px',
                      backgroundColor: '#f1f5f9',
                      color: '#475569',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      border: '1px solid #e2e8f0'
                    }}
                  >
                    <ImageIcon size={18} /> {isUploading ? 'Téléversement...' : 'Choisir une image'}
                  </label>
                </div>
                {getCleanImageUrl(formData.image_url) && (
                  <div style={{ width: '60px', height: '60px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0', flexShrink: 0 }}>
                    <img src={getCleanImageUrl(formData.image_url)} alt="Aperçu" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
            <button className="secondary-btn" onClick={() => setShowAdd(false)}>Annuler</button>
            <button className="primary-btn" onClick={handleSave} disabled={isSaving} style={{ backgroundColor: '#10b981', borderColor: '#10b981' }}>
              {isSaving ? 'Enregistrement...' : 'Enregistrer le produit'}
            </button>
          </div>
        </div>
      )}

      {showEdit && (
        <div className="card mt-4" style={{ borderLeft: '4px solid #f59e0b', backgroundColor: '#fffbeb', padding: '25px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0, color: '#92400e' }}>Modifier le produit</h3>
            <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8' }} onClick={() => setShowEdit(false)}><X size={20} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '25px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: 5, fontSize: '0.9rem', color: '#475569', fontWeight: 600 }}>Nom du produit *</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange} className="large-input" style={{ width: '100%', borderColor: '#fcd34d' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 5, fontSize: '0.9rem', color: '#475569', fontWeight: 600 }}>Référence</label>
              <input type="text" name="reference" value={formData.reference} onChange={handleChange} className="large-input" style={{ width: '100%', borderColor: '#fcd34d' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 5, fontSize: '0.9rem', color: '#475569', fontWeight: 600 }}>Catégorie</label>
              <select name="category" value={formData.category} onChange={handleChange} className="filter-select" style={{ width: '100%', borderColor: '#fcd34d' }}>
                <option>Outillage</option><option>Quincaillerie</option><option>Peinture</option><option>Général</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 5, fontSize: '0.9rem', color: '#475569', fontWeight: 600 }}>Prix d'achat (F)</label>
              <input type="number" name="purchase_price" value={formData.purchase_price} onChange={handleChange} className="large-input" style={{ width: '100%', borderColor: '#fcd34d' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 5, fontSize: '0.9rem', color: '#475569', fontWeight: 600 }}>Prix de vente (F) *</label>
              <input type="number" name="selling_price" value={formData.selling_price} onChange={handleChange} className="large-input" style={{ width: '100%', borderColor: '#fcd34d' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 5, fontSize: '0.9rem', color: '#475569', fontWeight: 600 }}>Stock</label>
              <input type="number" name="quantity" value={formData.quantity} onChange={handleChange} className="large-input" style={{ width: '100%', borderColor: '#fcd34d' }} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', marginBottom: 5, fontSize: '0.9rem', color: '#475569', fontWeight: 600 }}>Image du produit</label>
              <div style={{ display: 'flex', gap: '15px', alignItems: 'center', backgroundColor: 'white', padding: '10px', borderRadius: '8px', border: '1px solid #fcd34d' }}>
                <div style={{ flex: 1 }}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                    id="file-upload-edit"
                  />
                  <label
                    htmlFor="file-upload-edit"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 16px',
                      backgroundColor: '#fffbeb',
                      color: '#92400e',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      border: '1px solid #fde68a'
                    }}
                  >
                    <ImageIcon size={18} /> {isUploading ? 'Téléversement...' : 'Changer l\'image'}
                  </label>
                </div>
                {getCleanImageUrl(formData.image_url) && (
                  <div style={{ width: '60px', height: '60px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #fde68a', flexShrink: 0 }}>
                    <img src={getCleanImageUrl(formData.image_url)} alt="Aperçu" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px', borderTop: '1px solid #fde68a', paddingTop: '20px' }}>
            <button className="secondary-btn" onClick={() => setShowEdit(false)}>Annuler</button>
            <button className="primary-btn" onClick={handleEditSave} disabled={isSaving} style={{ backgroundColor: '#f59e0b', borderColor: '#f59e0b' }}>
              {isSaving ? 'Mise à jour...' : 'Mettre à jour'}
            </button>
          </div>
        </div>
      )}

      {showDetail && selectedProduct && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="card" style={{ width: '90%', maxWidth: '600px', padding: '30px', position: 'relative', backgroundColor: 'white' }}>
            <button style={{ position: 'absolute', top: 15, right: 15, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }} onClick={() => setShowDetail(false)}><X size={24} /></button>
            <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
              <div style={{ flex: '0 0 200px', height: '200px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {getCleanImageUrl(selectedProduct.image_url) ? (
                  <img src={getCleanImageUrl(selectedProduct.image_url)} alt={selectedProduct.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <ImageIcon size={64} color="#cbd5e1" />
                )}
              </div>
              <div style={{ flex: '1' }}>
                <span style={{ backgroundColor: '#e2e8f0', padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem', color: '#475569', fontWeight: 600 }}>{selectedProduct.category || 'Général'}</span>
                <h2 style={{ margin: '10px 0 5px', color: '#1e293b' }}>{selectedProduct.name}</h2>
                <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '20px' }}>Réf: {selectedProduct.reference || 'Non renseignée'}</p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div>
                    <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '2px' }}>Prix de vente</p>
                    <p style={{ fontSize: '1.2rem', fontWeight: 800, color: '#3b82f6' }}>{selectedProduct.selling_price.toLocaleString()} F</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '2px' }}>Prix d'achat</p>
                    <p style={{ fontSize: '1.2rem', fontWeight: 700, color: '#475569' }}>{(selectedProduct.purchase_price || 0).toLocaleString()} F</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '2px' }}>Stock actuel</p>
                    <p style={{ fontSize: '1.2rem', fontWeight: 700, color: selectedProduct.quantity <= (selectedProduct.alert_threshold || 5) ? '#ef4444' : '#10b981' }}>{selectedProduct.quantity} unités</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '2px' }}>Marge brute</p>
                    <p style={{ fontSize: '1.2rem', fontWeight: 700, color: '#10b981' }}>{(selectedProduct.selling_price - (selectedProduct.purchase_price || 0)).toLocaleString()} F</p>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'flex-end', gap: '15px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
              <button className="secondary-btn" onClick={() => setShowDetail(false)}>Fermer</button>
              <button className="primary-btn" onClick={() => handleEditOpen(selectedProduct)}>Modifier le produit</button>
            </div>
          </div>
        </div>
      )}

      <div className="card mt-4">
        <div className="table-responsive">
          <table className="data-table">
            <thead><tr><th>Image</th><th>Référence & Nom</th><th>Catégorie</th><th>Prix Achat</th><th>Prix Vente</th><th>Stock</th><th>Actions</th></tr></thead>
            <tbody>
              {filteredProducts.length === 0 ? <tr><td colSpan="7" style={{ textAlign: 'center', padding: '40px' }}><Package size={48} color="#cbd5e1" style={{ opacity: 0.5, margin: '0 auto 10px' }} /><p style={{ color: '#94a3b8' }}>Aucun produit correspondant</p></td></tr> : ""}
              {filteredProducts.map(p => (
                <tr key={p.id} className="table-row-hover">
                  <td>
                    <div style={{ width: '40px', height: '40px', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {getCleanImageUrl(p.image_url) ? (
                        <img src={getCleanImageUrl(p.image_url)} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/40?text=?'; }} />
                      ) : (
                        <ImageIcon size={18} color="#94a3b8" />
                      )}
                    </div>
                  </td>
                  <td><strong>{p.name}</strong><br /><span className="sub-text" style={{ fontSize: '0.8rem', color: '#64748b' }}>{p.reference || 'N/A'}</span></td>
                  <td><span style={{ backgroundColor: '#e2e8f0', padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem', color: '#475569' }}>{p.category || 'Général'}</span></td>
                  <td style={{ color: '#64748b' }}>{p.purchase_price || 0} F</td>
                  <td style={{ fontWeight: 600, color: '#3b82f6' }}>{p.selling_price} F</td>
                  <td>
                    {p.quantity <= (p.alert_threshold || 5)
                      ? <span className="status-badge error" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><AlertTriangle size={12} /> {p.quantity} (Alerte)</span>
                      : <span className="status-badge success">{p.quantity}</span>
                    }
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 5 }}>
                      <button className="secondary-btn" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => handleShowDetail(p)}>Détails</button>
                      <button className="icon-btn" title="Modifier" onClick={() => handleEditOpen(p)}><Edit2 size={16} /></button>
                      <button className="icon-btn" title="Supprimer" style={{ color: '#ef4444' }} onClick={() => handleDelete(p)}><Trash2 size={16} /></button>
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

const Stock = () => {
  const [stock, , setStock] = useFetch('/stock', []);
  const [products] = useFetch('/products', []);
  const [showAdd, setShowAdd] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({ productId: '', type: 'IN', quantity: '', reason: '' });
  const [editingMovement, setEditingMovement] = useState(null);

  const handleEdit = (m) => {
    setEditingMovement(m);
    setFormData({ productId: m.product_id, type: m.movement_type, quantity: m.quantity, reason: m.reason || '' });
    setShowAdd(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer ce mouvement ? Le stock du produit sera automatiquement ajusté pour revenir à son état précédent.")) return;
    try {
      const res = await fetch(`${API_URL}/stock/${id}`, { method: 'DELETE', headers: getHeaders() });
      if (res.ok) {
        setStock(stock.filter(s => s.id !== id));
        addToast('Succès', 'Mouvement supprimé et stock synchronisé', 'success');
      }
    } catch (e) { addToast('Erreur', 'Erreur lors de la suppression', 'error'); }
  };


  // Récupérer currentUser depuis le contexte global
  const currentUser = JSON.parse(localStorage.getItem('kameo_auth') || '{}');
  console.log('currentUser dans Stock:', currentUser);
  const productNamesById = products.reduce((acc, p) => ({ ...acc, [p.id]: p.name }), {});
  const filteredStock = stock.filter((s) => {
    const typeOk = typeFilter === 'ALL' || s.movement_type === typeFilter;
    const haystack = `${s.reason || ''} ${s.product_id || ''} ${productNamesById[s.product_id] || ''}`.toLowerCase();
    const textOk = haystack.includes(searchTerm.toLowerCase());
    return typeOk && textOk;
  });

  const handleSave = async () => {
    if (!formData.productId || !formData.quantity) return addToast('Attention', "Veuillez sélectionner un produit et préciser la quantité.", 'warning');
    setIsSaving(true);
    try {
      const url = editingMovement ? `${API_URL}/stock/${editingMovement.id}` : `${API_URL}/stock`;
      const method = editingMovement ? 'PATCH' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          product_id: formData.productId,
          movement_type: formData.type,
          quantity: Number(formData.quantity),
          reason: formData.reason
        })
      });
      const resData = await res.json();
      if (resData.success) {
        addToast('Succès', editingMovement ? 'Mouvement mis à jour !' : 'Mouvement enregistré !', 'success');
        if (editingMovement) {
          setStock(stock.map(s => s.id === editingMovement.id ? resData.movement : s));
        } else {
          setStock([resData.movement, ...stock]);
        }
        setShowAdd(false);
        setEditingMovement(null);
        setFormData({ productId: '', type: 'IN', quantity: '', reason: '' });
      } else {
        addToast('Erreur', resData.error || 'Erreur lors de l\'enregistrement', 'error');
      }
    } catch (err) { addToast('Erreur', 'Erreur serveur', 'error'); }
    setIsSaving(false);
  };


  return (
    <>
      <div className="page-top-actions">
        <div className="search-filters">
          <Filter size={16} style={{ position: 'absolute', left: 15, top: 12, color: '#94a3b8' }} />
          <input type="text" placeholder="Produit, raison..." className="large-input" style={{ paddingLeft: 40 }} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          <select className="filter-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}><option value="ALL">Tous les types</option><option value="IN">Entrées</option><option value="OUT">Sorties</option></select>
        </div>
        <button className="primary-btn" onClick={() => setShowAdd(!showAdd)} style={{ backgroundColor: '#8b5cf6', borderColor: '#8b5cf6' }}><Layers size={16} /> Déclarer un mouvement</button>
      </div>

      {showAdd && (
        <div className="card mt-4" style={{ borderLeft: '4px solid #8b5cf6', backgroundColor: '#f5f3ff', padding: '25px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0, color: '#4c1d95' }}>{editingMovement ? 'Modifier le mouvement' : 'Déclarer un mouvement d\'inventaire'}</h3>
            <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6d28d9' }} onClick={() => { setShowAdd(false); setEditingMovement(null); setFormData({ productId: '', type: 'IN', quantity: '', reason: '' }); }}><X size={20} /></button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '25px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: 5, fontSize: '0.9rem', color: '#4c1d95', fontWeight: 600 }}>Produit ciblé *</label>
              <select value={formData.productId} onChange={e => setFormData({ ...formData, productId: e.target.value })} className="large-input" style={{ width: '100%', borderColor: '#c4b5fd' }}>
                <option value="">-- Sélectionnez un produit --</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} (Boîte, etc.)</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 5, fontSize: '0.9rem', color: '#4c1d95', fontWeight: 600 }}>Type</label>
              <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })} className="filter-select" style={{ width: '100%', borderColor: '#c4b5fd' }}>
                <option value="IN">Entrée (+ Stock)</option>
                <option value="OUT">Sortie (- Caisse, Perte)</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 5, fontSize: '0.9rem', color: '#4c1d95', fontWeight: 600 }}>Quantité modifiée *</label>
              <input type="number" value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: e.target.value })} placeholder="0" className="large-input" style={{ width: '100%', borderColor: '#c4b5fd' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 5, fontSize: '0.9rem', color: '#4c1d95', fontWeight: 600 }}>Justificatif (Ex: Casse)</label>
              <input type="text" value={formData.reason} onChange={e => setFormData({ ...formData, reason: e.target.value })} placeholder="Ex: Inventaire 2024" className="large-input" style={{ width: '100%', borderColor: '#c4b5fd' }} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px', borderTop: '1px solid #ddd6fe', paddingTop: '20px' }}>
            <button className="secondary-btn" onClick={() => setShowAdd(false)} style={{ color: '#5b21b6' }}>Annuler</button>
            <button className="primary-btn" onClick={handleSave} disabled={isSaving || !formData.productId} style={{ backgroundColor: '#8b5cf6', borderColor: '#8b5cf6', color: 'white' }}>
              {isSaving ? 'Enregistrement...' : 'Valider'}
            </button>
          </div>
        </div>
      )}

      {filteredStock.length === 0 && !showAdd ? (
        <div className="card mt-4" style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '400px', border: '2px dashed #cbd5e1', backgroundColor: '#f8fafc', boxShadow: 'none'
        }}>
          <div style={{
            width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#f3e8ff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px'
          }}>
            <Layers size={36} color="#8b5cf6" />
          </div>
          <h3 style={{ color: '#1e293b', fontSize: '1.5rem', marginBottom: '10px' }}>Le journal de stock est vide</h3>
          <p style={{ color: '#64748b', maxWidth: '450px', textAlign: 'center', marginBottom: '30px', lineHeight: '1.6' }}>
            Toutes les entrées (ex: réapprovisionnements) et les sorties (ex: cas extrêmes, pertes) sont enregistrées ici pour un audit rigoureux de votre inventaire.
          </p>
          <button className="primary-btn" style={{ padding: '12px 24px', fontSize: '1.05rem', boxShadow: '0 4px 10px rgba(139, 92, 246, 0.4)', display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#8b5cf6', borderColor: '#8b5cf6' }} onClick={() => setShowAdd(true)}>
            <Layers size={18} /> Déclarer un mouvement
          </button>
        </div>
      ) : filteredStock.length > 0 ? (
        <div className="card mt-4">
          <table className="data-table">
            <thead><tr><th>Date & Heure</th><th>Type de Mouvement</th><th>Produit</th><th>Stock Actuel</th><th>Justificatif / Raison</th><th>Quantité Modifiée</th><th>Actions</th></tr></thead>
            <tbody>
              {filteredStock.map(s => (
                <tr key={s.id} className="table-row-hover">
                  <td><Clock size={14} style={{ verticalAlign: 'middle', marginRight: 5, color: '#64748b' }} /> {new Date(s.movement_date || new Date()).toLocaleString()}</td>
                  <td>
                    <span className={s.movement_type === 'OUT' ? "status-badge error" : "status-badge success"} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {s.movement_type === 'OUT' ? <ArrowUpRight size={12} /> : <ArrowUpRight size={12} style={{ transform: 'rotate(90deg)' }} />}
                      {s.movement_type === 'OUT' ? 'Sortie Stock' : 'Entrée Stock'}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'monospace', color: '#64748b', fontSize: '0.85rem' }}>
                    <div style={{ fontWeight: '500', marginBottom: '2px' }}>
                      {s.products?.name || productNamesById[s.product_id] || (s.product_id ? `${s.product_id.substring(0, 8)}...` : 'N/A')}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: '600', backgroundColor: '#dcfce7', padding: '2px 6px', borderRadius: '4px', display: 'inline-block' }}>
                      Stock: {s.products?.quantity || 'N/A'}
                    </div>
                  </td>
                  <td>{s.reason || '-'}</td>
                  <td style={{ fontWeight: 'bold', color: s.movement_type === 'OUT' ? '#ef4444' : '#10b981', fontSize: '1.1rem' }}>{s.movement_type === 'OUT' ? '-' : '+'}{s.quantity}</td>
                  <td>
                    {(currentUser.role === 'admin' || currentUser.role === 'superadmin') && (
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button
                          onClick={() => handleEdit(s)}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: '#f59e0b',
                            cursor: 'pointer',
                            padding: '2px',
                            fontSize: '0.9rem'
                          }}
                          title="Modifier le mouvement"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(s.id)}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: '#ef4444',
                            cursor: 'pointer',
                            padding: '2px',
                            fontSize: '0.9rem'
                          }}
                          title="Supprimer le mouvement"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
};

const Sales = () => {
  const [sales, , setSales] = useFetch('/sales', []);
  const [products] = useFetch('/products', []);
  const [customers] = useFetch('/contacts?type=customer', []);
  const [companySettings] = useFetch('/settings', { name: 'Mon entreprise', phone: '', address: '', currency: 'XOF' });
  const [showAdd, setShowAdd] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedSale, setSelectedSale] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [isPaying, setIsPaying] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState({ open: false, sale: null, amount: '' });

  const openPaymentDialog = (sale) => {
    const remainingAmount = Number(sale.remaining_amount ?? (Number(sale.total_amount || 0) - Number(sale.paid_amount || 0)));
    setPaymentDialog({ open: true, sale, amount: remainingAmount > 0 ? String(remainingAmount) : '0' });
    setPaymentError('');
  };

  const closePaymentDialog = () => {
    setPaymentDialog({ open: false, sale: null, amount: '' });
    setPaymentError('');
  };

  const executePayment = async () => {
    if (!paymentDialog.sale) return;
    const sale = paymentDialog.sale;
    const remainingAmount = Number(sale.remaining_amount ?? (Number(sale.total_amount || 0) - Number(sale.paid_amount || 0)));
    const amount = Number(paymentDialog.amount);

    if (!amount || amount <= 0) {
      setPaymentError('Veuillez saisir un montant valide.');
      return;
    }
    if (amount > remainingAmount) {
      setPaymentError(`Le montant ne peut pas dépasser le reste à payer (${remainingAmount} F).`);
      return;
    }

    setPaymentError('');
    setIsPaying(true);

    try {
      const res = await fetch(`${API_URL}/sales/${sale.id}/payment`, {
        method: 'POST',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          paymentAmount: amount,
          newRemainingAmount: remainingAmount - amount,
          newStatus: remainingAmount - amount <= 0 ? 'paid' : 'partial'
        })
      });

      if (!res.ok) {
        let errMsg = `HTTP ${res.status}`;
        try {
          const errorBody = await res.json();
          errMsg += errorBody?.error ? ` - ${errorBody.error}` : ` - ${JSON.stringify(errorBody)}`;
        } catch (parseErr) {
          const text = await res.text();
          errMsg += ` - ${text}`;
        }
        throw new Error(errMsg);
      }

      const data = await res.json();
      if (data.success) {
        setSales(sales.map(s => s.id === sale.id ? data.sale : s));
        setSelectedSale(data.sale);
        closePaymentDialog();
        addToast('Succès', 'Règlement enregistré avec succès.', 'success');
      } else {
        setPaymentError(data.error || 'Erreur lors du règlement');
      }
    } catch (err) {
      setPaymentError(err.message || 'Erreur de connexion au serveur.');
    } finally {
      setIsPaying(false);
    }
  };

  const [formData, setFormData] = useState({ 
    totalAmount: '', 
    customerName: '', 
    customerId: '',
    status: 'paid',
    saleDate: new Date().toISOString().split('T')[0],
    items: [] // { productId, quantity, unitPrice }
  });

  const filteredSales = sales.filter((s) => {
    const ref = String(s.id || '').toLowerCase();
    const date = new Date(s.sale_date).toLocaleString().toLowerCase();
    const textOk = ref.includes(searchTerm.toLowerCase()) || date.includes(searchTerm.toLowerCase());
    const statusOk = statusFilter === 'all' || (s.status || 'paid') === statusFilter;
    return textOk && statusOk;
  });

  const handleSave = async () => {
    if (!formData.totalAmount) return addToast('Attention', "Le montant total est requis.", 'warning');
    setIsSaving(true);

    const total = formData.items.length > 0 
      ? formData.items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unitPrice)), 0)
      : (Number(formData.totalAmount) || 0);

    let initialPaid = 0;
    let initialRemaining = total;

    if (formData.status === 'paid') {
      initialPaid = total;
      initialRemaining = 0;
    }

    try {
      const res = await fetch(`${API_URL}/sales`, {
        method: 'POST',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          sale_date: new Date(formData.saleDate).toISOString(),
          customer_id: formData.customerId || null,
          customer_name: formData.customerName,
          total_amount: total,
          paid_amount: initialPaid,
          remaining_amount: initialRemaining,
          status: formData.status,
          sale_items: formData.items.map(item => ({
            product_id: item.productId,
            quantity: Number(item.quantity),
            unit_price: Number(item.unitPrice)
          }))
        })
      });
      const resData = await res.json();
      if (resData.success) {
        addToast('Succès', 'Vente enregistrée !', 'success');
        // Réinitialiser le formulaire
        setFormData({ 
          totalAmount: '', 
          customerName: '', 
          customerId: '',
          status: 'paid',
          saleDate: new Date().toISOString().split('T')[0],
          items: []
        });
        setShowAdd(false);
        // Obtenir la nouvelle vente ajoutée (pour affichage dynamique instantané)
        const newSale = {
          id: resData.sale_id,
          sale_date: new Date().toISOString(),
          total_amount: total,
          paid_amount: initialPaid,
          remaining_amount: initialRemaining,
          status: formData.status
        };
        setSales([newSale, ...sales]);
        setShowAdd(false);
        setFormData({ totalAmount: '', customerName: '', status: 'paid' });
      } else {
        addToast('Erreur', resData.error || 'Erreur lors de l\'enregistrement', 'error');
      }
    } catch (err) { addToast('Erreur', 'Erreur serveur', 'error'); }
    setIsSaving(false);
  };

  const printInvoice = (sale) => {
    const s = companySettings || {};
    const invoicePrefix = s.invoice_prefix || 'FAC';
    const accentColor = s.invoice_color || '#2563eb';
    const footerText = s.invoice_footer || 'Merci pour votre confiance.';
    const logoUrl = s.invoice_logo || '';
    const invoiceFormat = s.invoice_format || 'A4';
    const invoiceNumber = `${invoicePrefix}-${String(sale.id || '').substring(0, 8).toUpperCase()}`;
    const companyName = s.name || 'KAméo';
    const companyPhone = s.phone || '-';
    const companyAddress = s.address || '-';
    const currency = s.currency || 'XOF';
    const model = s.invoice_model || 'model1';
    const conditions = s.invoice_conditions || 'Paiement à la réception';
    const notes = s.invoice_notes || '';

    let html = '';

    if (invoiceFormat === 'THERMAL') {
      html = `
        <html>
          <head>
            <style>
              body { font-family: 'Courier New', monospace; width: 80mm; margin: 0; padding: 5mm; font-size: 12px; }
              .center { text-align: center; }
              .bold { font-weight: bold; }
              .divider { border-bottom: 1px dashed #000; margin: 5px 0; }
              table { width: 100%; font-size: 11px; }
              .total { font-size: 14px; margin-top: 10px; }
            </style>
          </head>
          <body>
            <div class="center bold">${companyName}</div>
            <div class="center">${companyAddress}</div>
            <div class="center">Tél: ${companyPhone}</div>
            <div class="divider"></div>
            <div class="bold">FACT NÂ°: ${invoiceNumber}</div>
            <div>Date: ${new Date(sale.sale_date).toLocaleString()}</div>
            <div>Client: ${sale.customer_name || 'Comptoir'}</div>
            <div class="divider"></div>
            <table>
              <thead>
                <tr><th align="left">ART</th><th align="center">QTE</th><th align="right">TOTAL</th></tr>
              </thead>
              <tbody>
                ${sale.cart && sale.cart.length > 0 ? sale.cart.map(item => `
                  <tr>
                    <td>${item.name}</td>
                    <td align="center">${item.cartQuantity}</td>
                    <td align="right">${(item.cartQuantity * item.selling_price).toLocaleString()}</td>
                  </tr>
                `).join('') : `
                  <tr><td>Vente globale</td><td>1</td><td align="right">${Number(sale.total_amount).toLocaleString()}</td></tr>
                `}
              </tbody>
            </table>
            <div class="divider"></div>
            <div class="total bold" align="right">TOTAL: ${Number(sale.total_amount).toLocaleString()} ${currency}</div>
            <div class="center" style="margin-top: 5px;">${conditions}</div>
            <div class="center" style="margin-top: 15px;">${notes ? notes + '<br/>' : ''}${footerText}</div>

            <script>
              window.onload = function() {
                setTimeout(() => { window.print(); window.close(); }, 500);
              };
            </script>
          </body>
        </html>
      `;
    } else if (model === 'model4') {
      html = `
        <html>
          <head>
            <style>
              body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1e293b; }
              .header { display: flex; justify-content: space-between; border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
              .logo-area { display: flex; align-items: center; gap: 15px; }
              .company-name { font-size: 24px; font-weight: 800; color: #2563eb; }
              .tax-info { font-size: 12px; text-align: right; }
              .title { text-align: center; font-size: 22px; font-weight: 800; text-decoration: underline; margin: 40px 0; }
              .client-area { margin-bottom: 30px; font-size: 16px; font-weight: bold; }
              .items-table { width: 100%; border-collapse: collapse; border: 1px solid #2563eb; }
              .items-table th { background: #dbeafe; color: #2563eb; padding: 12px; border: 1px solid #2563eb; }
              .items-table td { padding: 12px; border: 1px solid #2563eb; }
              .total-row { font-weight: bold; background: #f8fafc; }
              .footer-text { margin-top: 50px; text-align: center; font-size: 11px; color: #ef4444; }
              .direction { text-align: right; margin-top: 60px; font-style: italic; font-weight: bold; }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="logo-area">
                ${logoUrl ? `<img src="${logoUrl}" height="60" />` : ''}
                <div>
                  <div class="company-name">${companyName}</div>
                  <div style="font-size: 12px; color: #64748b;">Informatiques - Bureautiques - Services</div>
                </div>
              </div>
              <div class="tax-info">
                <div>NCC: 2404242 H</div>
                <div>REGIME: TEE</div>
                <div style="margin-top: 10px; font-weight: bold;">BOUAKE LE : ${new Date(sale.sale_date).toLocaleDateString()}</div>
              </div>
            </div>
            <div class="title">FACTURE PROFORMA N°${invoiceNumber}</div>
            <div class="client-area">DOIT : ${sale.customer_name || 'SOLDE'}</div>
            <table class="items-table">
              <thead>
                <tr><th>DESIGNATIONS</th><th>QTE</th><th>PU.TTC</th><th>PT.TTC</th></tr>
              </thead>
              <tbody>
                ${(sale.cart || []).map(item => `
                  <tr>
                    <td>${item.name}</td>
                    <td align="center">${item.cartQuantity}</td>
                    <td align="right">${Number(item.selling_price).toLocaleString()}</td>
                    <td align="right">${(Number(item.cartQuantity) * Number(item.selling_price)).toLocaleString()}</td>
                  </tr>
                `).join('')}
                <tr class="total-row">
                  <td colspan="3" align="right">TOTAL TTC</td>
                  <td align="right">${Number(sale.total_amount).toLocaleString()} ${currency}</td>
                </tr>
              </tbody>
            </table>
            <div class="direction">LA DIRECTION</div>
            <div class="footer-text">${companyAddress}</div>
          </body>
        </html>
      `;
    } else if (model === 'model5') {
      html = `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; padding: 40px; color: #000; font-size: 13px; }
              .logo-box { border: 3px solid #000; padding: 20px; text-align: center; font-size: 32px; font-weight: 900; margin-bottom: 20px; }
              .items-table { width: 100%; border-collapse: collapse; border: 1px solid #000; }
              .items-table th { background: #eee; border: 1px solid #000; padding: 8px; }
              .items-table td { border: 1px solid #000; padding: 8px; }
              .totals-table { width: 250px; margin-left: auto; border-collapse: collapse; border: 1px solid #000; margin-top: 20px; }
              .totals-table td { border: 1px solid #000; padding: 8px; }
              .box { border: 1px solid #000; padding: 10px; margin-bottom: 20px; }
            </style>
          </head>
          <body>
            <div style="display: flex; gap: 40px; margin-bottom: 30px;">
              <div style="width: 150px; border: 3px solid #000; height: 100px; display: flex; align-items: center; justify-content: center; font-size: 40px; font-weight: 900;">QSS</div>
              <div style="flex: 1; text-align: center;">
                <div style="font-size: 24px; font-weight: 900;">${companyName}</div>
                <div>TOUT POUR LE BÂTIMENT</div>
                <div>Contact: ${companyPhone}</div>
              </div>
            </div>
            <div style="display: flex; gap: 40px;">
              <div style="flex: 1;">
                <table class="items-table">
                  <tr><td bgcolor="#eee">FACTURE N°</td><td>${invoiceNumber}</td></tr>
                  <tr><td bgcolor="#eee">DATE</td><td>${new Date(sale.sale_date).toLocaleDateString()}</td></tr>
                </table>
              </div>
              <div style="flex: 1;">
                <div class="box"><strong>CLIENT:</strong><br/>${sale.customer_name || 'Comptoir'}</div>
              </div>
            </div>
            <table class="items-table" style="margin-top: 20px;">
              <thead>
                <tr><th>REF</th><th>DESIGNATION</th><th>QTE</th><th>TOTAL HT</th></tr>
              </thead>
              <tbody>
                ${(sale.cart || []).map((item, idx) => `
                  <tr>
                    <td>${idx + 1}</td>
                    <td>${item.name}</td>
                    <td align="center">${item.cartQuantity}</td>
                    <td align="right">${(item.cartQuantity * item.selling_price).toLocaleString()}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <table class="totals-table">
              <tr><td>TOTAL BRUT HT</td><td align="right">${Number(sale.total_amount).toLocaleString()}</td></tr>
              <tr style="background: #eee; font-weight: bold;"><td>NET A PAYER</td><td align="right">${Number(sale.total_amount).toLocaleString()} ${currency}</td></tr>
            </table>
          </body>
        </html>
      `;
    } else {
      // Modèle Standard (1, 2, 3) - Template A4 de base
      html = `
        <html>
          <head>
            <title>Facture ${invoiceNumber}</title>
            <style>
              @page { margin: 20mm; }
              body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; color: #1f2937; line-height: 1.6; }
              .invoice-container { max-width: 800px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07); }
              .invoice-header { background: linear-gradient(135deg, ${accentColor} 0%, ${accentColor}dd 100%); color: white; padding: 30px; display: flex; justify-content: space-between; align-items: center; }
              .company-info { flex: 1; }
              .company-name { font-size: 24px; font-weight: 700; margin: 0 0 8px 0; }
              .items-table { width: 100%; border-collapse: collapse; margin: 20px 0; background: white; }
              .items-table th { background: #f8fafc; padding: 16px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid ${accentColor}; }
              .items-table td { padding: 16px; border-bottom: 1px solid #f1f5f9; }
              .total-section { background: ${accentColor}; color: white; padding: 24px 30px; border-radius: 8px; margin: 20px 0; display: flex; justify-content: space-between; align-items: center; }
            </style>
          </head>
          <body>
            <div class="invoice-container">
              <div class="invoice-header">
                <div class="company-info">
                  ${logoUrl ? `<img src="${logoUrl}" style="height: 60px; margin-bottom: 10px;" />` : ''}
                  <div class="company-name">${companyName}</div>
                  <div>${companyAddress}</div>
                  <div>Tel: ${companyPhone}</div>
                </div>
                <div style="text-align: right">
                  <div style="font-size: 20px; font-weight: bold;">FACTURE</div>
                  <div>N° ${invoiceNumber}</div>
                  <div>Date: ${new Date(sale.sale_date).toLocaleDateString()}</div>
                </div>
              </div>
              <div style="padding: 30px;">
                <div style="margin-bottom: 20px; padding: 15px; background: #f8fafc; border-radius: 8px;">
                   <strong>CLIENT:</strong><br/>
                   ${sale.customer_name || 'Comptoir'}
                </div>
                <table class="items-table">
                  <thead>
                    <tr>
                      <th>Désignation</th>
                      <th style="text-align: center">Qté</th>
                      <th style="text-align: right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${(sale.cart || []).length > 0 ? sale.cart.map(item => `
                      <tr>
                        <td>${item.name}</td>
                        <td align="center">${item.cartQuantity}</td>
                        <td align="right">${(Number(item.cartQuantity) * Number(item.selling_price)).toLocaleString()}</td>
                      </tr>
                    `).join('') : `
                      <tr>
                        <td>Vente globale</td>
                        <td align="center">1</td>
                        <td align="right">${Number(sale.total_amount).toLocaleString()}</td>
                      </tr>
                    `}
                  </tbody>
                </table>
                <div class="total-section">
                  <span>NET A PAYER</span>
                  <span style="font-size: 26px; font-weight: 800;">${Number(sale.total_amount).toLocaleString()} ${currency}</span>
                </div>
                <div style="margin-top: 40px; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 20px; color: #64748b; font-size: 13px;">
                   ${footerText}
                </div>
              </div>
            </div>
            <script>
              window.onload = function() {
                setTimeout(() => { window.print(); window.close(); }, 500);
              };
            </script>
          </body>
        </html>
      `;
    }

    printDocument.open();
    printDocument.write(html);
    printDocument.close();

    // Attendre que le contenu soit chargé puis imprimer
    setTimeout(() => {
      printFrame.contentWindow.focus();
      printFrame.contentWindow.print();

      // Nettoyer l'iframe après impression
      setTimeout(() => {
        document.body.removeChild(printFrame);
      }, 1000);
    }, 500);
  };

  const handlePayment = (sale) => {
    openPaymentDialog(sale);
  };

  const duplicateSale = (sale) => {
    setFormData({
      totalAmount: sale.total_amount || '',
      customerName: sale.customer_name || '',
      status: sale.status || 'paid'
    });
    setShowAdd(true);
  };

  return (
    <>
      <div className="page-top-actions">
        <div className="search-filters">
          <Search size={16} style={{ position: 'absolute', left: 15, top: 12, color: '#94a3b8' }} />
          <input type="text" placeholder="Rechercher par N° facture ou client..." className="large-input" style={{ paddingLeft: 40 }} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="all">Tous les statuts</option><option value="paid">Payé</option><option value="pending">En attente</option></select>
        </div>
        <button className="primary-btn" onClick={() => setShowAdd(!showAdd)}><FileText size={16} /> Créer une Facture Manuelle</button>
      </div>

      {showAdd && (
        <div className="card mt-4" style={{ borderLeft: '4px solid #10b981', backgroundColor: '#ecfdf5', padding: '25px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0, color: '#065f46' }}>Saisir une facture manuelle</h3>
            <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#059669' }} onClick={() => setShowAdd(false)}><X size={20} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '25px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: 5, fontSize: '0.9rem', color: '#065f46', fontWeight: 600 }}>Date de la vente</label>
              <input type="date" value={formData.saleDate} onChange={e => setFormData({ ...formData, saleDate: e.target.value })} className="large-input" style={{ width: '100%', borderColor: '#6ee7b7' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 5, fontSize: '0.9rem', color: '#065f46', fontWeight: 600 }}>Client (Sélectionner)</label>
              <select 
                value={formData.customerId} 
                onChange={e => {
                  const c = (customers || []).find(x => x.id === e.target.value);
                  setFormData({ ...formData, customerId: e.target.value, customerName: c ? c.name : '' });
                }} 
                className="filter-select" 
                style={{ width: '100%', borderColor: '#6ee7b7' }}
              >
                <option value="">Client de passage / Autre</option>
                {(customers || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 5, fontSize: '0.9rem', color: '#065f46', fontWeight: 600 }}>Nom du Client (si non listé)</label>
              <input type="text" value={formData.customerName} onChange={e => setFormData({ ...formData, customerName: e.target.value })} placeholder="Ex: Client X" className="large-input" style={{ width: '100%', borderColor: '#6ee7b7' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 5, fontSize: '0.9rem', color: '#065f46', fontWeight: 600 }}>Statut de paiement</label>
              <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })} className="filter-select" style={{ width: '100%', borderColor: '#6ee7b7' }}>
                <option value="paid">Payée (Totalité)</option>
                <option value="pending">En attente / Crédit</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '25px', backgroundColor: 'white', padding: '15px', borderRadius: '10px', border: '1px solid #a7f3d0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h4 style={{ margin: 0, color: '#065f46' }}>Articles de la facture</h4>
              <button 
                onClick={() => setFormData({ ...formData, items: [...formData.items, { productId: '', quantity: 1, unitPrice: 0 }] })}
                className="secondary-btn"
                style={{ fontSize: '0.8rem', padding: '5px 10px' }}
              >
                + Ajouter un article
              </button>
            </div>
            
            {formData.items.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {formData.items.map((item, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '10px', alignItems: 'center' }}>
                    <select 
                      value={item.productId} 
                      onChange={e => {
                        const p = (products || []).find(x => x.id === e.target.value);
                        const newItems = [...formData.items];
                        newItems[idx] = { ...newItems[idx], productId: e.target.value, unitPrice: p ? p.selling_price : 0 };
                        setFormData({ ...formData, items: newItems });
                      }}
                      className="filter-select"
                      style={{ width: '100%' }}
                    >
                      <option value="">Sélectionner un produit</option>
                      {(products || []).map(p => <option key={p.id} value={p.id}>{p.name} ({p.selling_price} F)</option>)}
                    </select>
                    <input 
                      type="number" 
                      placeholder="Qté" 
                      value={item.quantity} 
                      onChange={e => {
                        const newItems = [...formData.items];
                        newItems[idx].quantity = e.target.value;
                        setFormData({ ...formData, items: newItems });
                      }}
                      className="large-input"
                    />
                    <input 
                      type="number" 
                      placeholder="Prix Unit." 
                      value={item.unitPrice} 
                      onChange={e => {
                        const newItems = [...formData.items];
                        newItems[idx].unitPrice = e.target.value;
                        setFormData({ ...formData, items: newItems });
                      }}
                      className="large-input"
                    />
                    <button 
                      onClick={() => {
                        const newItems = formData.items.filter((_, i) => i !== idx);
                        setFormData({ ...formData, items: newItems });
                      }}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
                <div style={{ textAlign: 'right', marginTop: '10px', fontWeight: 700, color: '#065f46', fontSize: '1.1rem' }}>
                  Total calculé : {formData.items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unitPrice)), 0).toLocaleString()} F
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px', color: '#64748b', fontSize: '0.9rem' }}>
                Aucun article ajouté. Vous pouvez aussi saisir un montant global ci-dessous.
                <div style={{ marginTop: '10px' }}>
                  <label style={{ display: 'block', marginBottom: 5, fontSize: '0.9rem', color: '#065f46', fontWeight: 600 }}>Montant Global (F)</label>
                  <input type="number" value={formData.totalAmount} onChange={e => setFormData({ ...formData, totalAmount: e.target.value })} placeholder="0" className="large-input" style={{ width: '100%', borderColor: '#6ee7b7' }} />
                </div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px', borderTop: '1px solid #a7f3d0', paddingTop: '20px' }}>
            <button className="secondary-btn" onClick={() => setShowAdd(false)} style={{ color: '#047857' }}>Annuler</button>
            <button className="primary-btn" onClick={handleSave} disabled={isSaving} style={{ backgroundColor: '#10b981', borderColor: '#10b981', color: 'white' }}>
              {isSaving ? 'Génération...' : 'Valider la Facture'}
            </button>
          </div>
        </div>
      )}

      {filteredSales.length === 0 && !showAdd ? (
        <div className="card mt-4" style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '400px', border: '2px dashed #cbd5e1', backgroundColor: '#f8fafc', boxShadow: 'none'
        }}>
          <div style={{
            width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#dcfce7',
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px'
          }}>
            <FileText size={36} color="#10b981" />
          </div>
          <h3 style={{ color: '#1e293b', fontSize: '1.5rem', marginBottom: '10px' }}>Aucune vente réalisée</h3>
          <p style={{ color: '#64748b', maxWidth: '450px', textAlign: 'center', marginBottom: '30px', lineHeight: '1.6' }}>
            Que ce soit par la Caisse (POS) ou générées manuellement, toutes vos factures apparaîtront ici pour faciliter votre suivi comptable complet.
          </p>
          <button className="primary-btn" style={{ padding: '12px 24px', fontSize: '1.05rem', boxShadow: '0 4px 10px rgba(16, 185, 129, 0.4)', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => setShowAdd(true)}>
            <FileText size={18} /> Créer une Facture Manuelle
          </button>
        </div>
      ) : filteredSales.length > 0 ? (
        <div className="card mt-4">
          <div className="table-responsive">
            <table className="data-table">
              <thead><tr><th>Date</th><th>Référence Facture</th><th>Client</th><th>Vendeur</th><th>Montant de Vente</th><th>Statut</th><th>Actions</th></tr></thead>
              <tbody>
                {filteredSales.map(s => (
                  <tr key={s.id} className="table-row-hover">
                    <td>{new Date(s.sale_date).toLocaleString()}</td>
                    <td
                      style={{ color: '#3b82f6', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}
                      onClick={() => setSelectedSale(s)}
                    >
                      FAC-{s.id.substring(0, 8).toUpperCase()}
                    </td>
                    <td>{s.customers?.name || 'Client de passage'}</td>
                    <td style={{ fontSize: '0.85rem', color: '#64748b' }}>{s.created_by_name || 'Système'}</td>
                    <td style={{ fontWeight: 'bold', color: '#10b981' }}>+ {s.total_amount} F</td>
                    <td>
                      <span className={s.status === 'paid' ? "status-badge success" : "status-badge warning"} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <CheckCircle size={12} /> {s.status === 'paid' ? 'Payé' : 'En attente'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => printInvoice(s)}
                          style={{ border: '1px solid #bfdbfe', background: 'linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%)', color: '#1d4ed8', padding: '6px 10px', fontSize: '0.78rem', fontWeight: 600, borderRadius: '8px', cursor: 'pointer' }}
                        >
                          PDF
                        </button>
                        <button
                          onClick={() => setSelectedSale(s)}
                          style={{ border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', color: '#334155', padding: '6px 10px', fontSize: '0.78rem', fontWeight: 600, borderRadius: '8px', cursor: 'pointer' }}
                        >
                          Details
                        </button>
                        {(s.status === 'partial' || s.status === 'pending') && (
                          <button
                            onClick={() => openPaymentDialog(s)}
                            style={{ border: '1px solid #fbbf24', background: 'linear-gradient(180deg, #fef3c7 0%, #fde68a 100%)', color: '#92400e', padding: '6px 10px', fontSize: '0.78rem', fontWeight: 600, borderRadius: '8px', cursor: 'pointer' }}
                          >
                            Règlement
                          </button>
                        )}
                        <button
                          onClick={() => duplicateSale(s)}
                          style={{ border: '1px solid #ddd6fe', background: 'linear-gradient(180deg, #f5f3ff 0%, #ede9fe 100%)', color: '#6d28d9', padding: '6px 10px', fontSize: '0.78rem', fontWeight: 600, borderRadius: '8px', cursor: 'pointer' }}
                        >
                          Dupliquer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {selectedSale && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="card" style={{ width: '90%', maxWidth: '600px', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>Details de la vente</h3>
              <button onClick={() => setSelectedSale(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px', backgroundColor: '#f8fafc', padding: '15px', borderRadius: '10px' }}>
              <div><strong>Référence :</strong> FAC-{String(selectedSale.id).substring(0, 8).toUpperCase()}</div>
              <div><strong>Date :</strong> {new Date(selectedSale.sale_date).toLocaleString()}</div>
              <div><strong>Client :</strong> {selectedSale.customers?.name || 'Client de passage'}</div>
              <div><strong>Vendeur :</strong> {selectedSale.created_by_name || 'Système'}</div>
              <div><strong>Montant Total :</strong> {Number(selectedSale.total_amount || 0).toLocaleString()} F</div>
              <div><strong>Montant Payé :</strong> {(selectedSale.status === 'paid' ? selectedSale.total_amount : (selectedSale.paid_amount || 0)).toLocaleString()} F</div>
              <div><strong>Reste à Payer :</strong> {(selectedSale.status === 'paid' ? 0 : (selectedSale.remaining_amount || 0)).toLocaleString()} F</div>
              <div><strong>Statut :</strong>
                <span className={selectedSale.status === 'paid' ? "status-badge success" : selectedSale.status === 'partial' ? "status-badge warning" : "status-badge error"} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {selectedSale.status === 'paid' ? 'Payé' : selectedSale.status === 'partial' ? 'Partiel' : 'En attente'}
                </span>
              </div>
            </div>

            <h4 style={{ borderBottom: '1px solid #eee', paddingBottom: '8px' }}>Articles vendus</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              {selectedSale.sale_items?.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                  <div style={{ width: '40px', height: '40px', backgroundColor: '#f1f5f9', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {getCleanImageUrl(item.products?.image_url) ? (
                      <img src={getCleanImageUrl(item.products?.image_url)} alt={item.products?.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <Package size={24} color="#94a3b8" />
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{item.products?.name || 'Produit inconnu'}</div>
                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{item.quantity} x {item.unit_price} F</div>
                  </div>
                  <div style={{ fontWeight: 700 }}>{item.quantity * item.unit_price} F</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '6px' }}>
              <button onClick={() => printInvoice(selectedSale)} style={{ border: '1px solid #bfdbfe', background: 'linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%)', color: '#1d4ed8', padding: '9px 14px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}>Imprimer</button>
              <button onClick={() => setSelectedSale(null)} style={{ border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', padding: '9px 14px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {paymentDialog.open && paymentDialog.sale && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10010, padding: '12px' }}>
          <div style={{ width: '100%', maxWidth: '520px', background: '#ffffff', borderRadius: '14px', boxShadow: '0 20px 40px rgba(15, 23, 42, 0.25)', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <div style={{ background: 'linear-gradient(90deg, #2563eb, #0ea5e9)', color: '#ffffff', padding: '18px 20px' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Règlement Partiel - Facture</h3>
              <p style={{ margin: '8px 0 0', color: '#dbeafe', fontSize: '0.9rem' }}>Evitez le popup natif, utilisez une interface claire et professionnelle.</p>
            </div>
            <div style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>N° Facture</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>FAC-{String(paymentDialog.sale.id).substring(0, 8).toUpperCase()}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                <div style={{ backgroundColor: '#f8fafc', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Montant total</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>{Number(paymentDialog.sale.total_amount || 0).toLocaleString()} F</div>
                </div>
                <div style={{ backgroundColor: '#f8fafc', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Reste à payer</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#dc2626' }}>{Number(paymentDialog.sale.remaining_amount ?? (Number(paymentDialog.sale.total_amount || 0) - Number(paymentDialog.sale.paid_amount || 0))).toLocaleString()} F</div>
                </div>
              </div>
              <label style={{ display: 'block', marginBottom: '6px', color: '#334155', fontWeight: 600 }}>Somme à régler</label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <input
                  type="number"
                  value={paymentDialog.amount}
                  onChange={(e) => setPaymentDialog(prev => ({ ...prev, amount: e.target.value }))}
                  min="0"
                  step="1"
                  style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px 12px', fontSize: '1rem', color: '#0f172a' }}
                  placeholder="Montant en F"
                />
                <button
                  onClick={() => {
                    const remaining = Number(paymentDialog.sale.remaining_amount ?? (Number(paymentDialog.sale.total_amount || 0) - Number(paymentDialog.sale.paid_amount || 0)));
                    setPaymentDialog(prev => ({ ...prev, amount: String(remaining) }));
                    setPaymentError('');
                  }}
                  style={{ border: '1px solid #93c5fd', backgroundColor: '#bfdbfe', color: '#1d4ed8', borderRadius: '8px', padding: '10px 12px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Reste
                </button>
              </div>
              {paymentError && <div style={{ marginBottom: '12px', color: '#dc2626', fontWeight: 600 }}>{paymentError}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  onClick={closePaymentDialog}
                  style={{ border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', color: '#334155', borderRadius: '8px', padding: '10px 16px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Annuler
                </button>
                <button
                  onClick={executePayment}
                  disabled={isPaying}
                  style={{ border: 'none', backgroundColor: '#2563eb', color: '#ffffff', borderRadius: '8px', padding: '10px 16px', fontWeight: 700, cursor: isPaying ? 'not-allowed' : 'pointer', opacity: isPaying ? 0.65 : 1 }}
                >
                  {isPaying ? 'Validation...' : 'Valider Paiement'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const Purchases = () => {
  const [purchases, , setPurchases] = useFetch('/purchases', []);
  const [contacts] = useFetch('/contacts', { customers: [], suppliers: [] });
  const [products] = useFetch('/products', []);
  const [showAdd, setShowAdd] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [formData, setFormData] = useState({
    totalAmount: '',
    reference: '',
    supplierName: '',
    supplierId: '',
    productId: '',
    quantity: '',
    status: 'pending'
  });
  const [editingId, setEditingId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const filteredPurchases = purchases.filter((p) => {
    const ref = `${p.reference || ''} ${p.id || ''}`.toLowerCase();
    const supplier = `${p.supplier_name || ''}`.toLowerCase();
    const textOk = ref.includes(searchTerm.toLowerCase()) || supplier.includes(searchTerm.toLowerCase());
    const statusOk = statusFilter === 'all' || (p.status || 'pending') === statusFilter;
    return textOk && statusOk;
  });

  const handleSave = async () => {
    if (!formData.totalAmount) {
      setToastMessage({ type: 'warning', text: 'Le montant total est requis.' });
      return setTimeout(() => setToastMessage(null), 3000);
    }
    setIsSaving(true);
    try {
      const url = editingId ? `${API_URL}/purchases/${editingId}` : `${API_URL}/purchases`;
      const method = editingId ? 'PATCH' : 'POST';

      const dbPayload = {
        totalAmount: formData.totalAmount,
        reference: formData.reference,
        supplierName: formData.supplierName,
        supplierId: formData.supplierId,
        productId: formData.productId,
        quantity: formData.quantity,
        status: formData.status
      };

      const res = await fetch(url, {
        method: method,
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(dbPayload)
      });
      const resData = await res.json();
      if (resData.success) {
        setToastMessage({ type: 'success', text: editingId ? 'Achat modifié avec succès !' : 'Achat enregistré avec succès !' });
        setTimeout(() => setToastMessage(null), 3000);
        if (editingId) {
          setPurchases(purchases.map(p => p.id === editingId ? resData.purchase : p));
        } else {
          setPurchases([resData.purchase, ...purchases]);
        }
        setShowAdd(false);
        setFormData({
          totalAmount: '',
          reference: '',
          supplierName: '',
          supplierId: '',
          productId: '',
          quantity: '',
          status: 'pending'
        });
        setEditingId(null);
      } else {
        setToastMessage({ type: 'error', text: resData.error || 'Erreur d\'enregistrement' });
        setTimeout(() => setToastMessage(null), 4000);
      }
    } catch (err) { 
        setToastMessage({ type: 'error', text: 'Erreur serveur: ' + err.message });
        setTimeout(() => setToastMessage(null), 4000);
    }
    setIsSaving(false);
  };

  return (
    <>
      <div className="page-top-actions">
        <div className="search-filters">
          <Search size={16} style={{ position: 'absolute', left: 15, top: 12, color: '#94a3b8' }} />
          <input type="text" placeholder="Rechercher un bon de commande..." className="large-input" style={{ paddingLeft: 40 }} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="all">Tous les statuts</option><option value="pending">En attente</option><option value="received">Reçus</option></select>
        </div>
        <button className="primary-btn" onClick={() => setShowAdd(!showAdd)}><Plus size={16} /> Nouveau Bon de Commande</button>
      </div>

      {toastMessage && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 9999,
          background: toastMessage.type === 'success' ? '#10b981' : toastMessage.type === 'warning' ? '#f59e0b' : '#ef4444',
          color: 'white', padding: '12px 24px', borderRadius: '8px',
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
          display: 'flex', alignItems: 'center', gap: '10px',
          animation: 'slideIn 0.3s ease-out'
        }}>
          {toastMessage.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
          <span style={{ fontWeight: 500 }}>{toastMessage.text}</span>
        </div>
      )}

      {showAdd && (
        <div className="card mt-4" style={{ border: '1px solid #e2e8f0', backgroundColor: '#ffffff', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: '1px solid #f1f5f9', paddingBottom: '15px' }}>
            <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.25rem', fontWeight: 600 }}>{editingId ? 'Modifier un Achat Fournisseur (BC)' : 'Enregistrer un Achat Fournisseur (BC)'}</h3>
            <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', borderRadius: '50%', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor='#f1f5f9'} onMouseOut={e => e.currentTarget.style.backgroundColor='transparent'} onClick={() => setShowAdd(false)}>
              <X size={20} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '25px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>Fournisseur</label>
              <select
                value={formData.supplierId}
                onChange={e => {
                  const s = contacts.suppliers.find(sup => sup.id === e.target.value);
                  setFormData({ ...formData, supplierId: e.target.value, supplierName: s ? s.name : '' });
                }}
                className="large-input"
                style={{ width: '100%' }}
              >
                <option value="">-- Sélectionner un fournisseur --</option>
                {contacts.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <input
                type="text"
                value={formData.supplierName}
                onChange={e => setFormData({ ...formData, supplierName: e.target.value })}
                placeholder="Ou saisir un fournisseur manuel..."
                className="large-input"
                style={{ width: '100%', marginTop: '10px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>Article / Produit</label>
              <select
                value={formData.productId}
                onChange={e => setFormData({ ...formData, productId: e.target.value })}
                className="large-input"
                style={{ width: '100%' }}
              >
                <option value="">-- Sélectionner un article --</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>Quantité</label>
              <input type="number" value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: e.target.value })} placeholder="Ex: 50" className="large-input" style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>Référence BC (Optionnel)</label>
              <input type="text" value={formData.reference} onChange={e => setFormData({ ...formData, reference: e.target.value })} placeholder="Ex: BC-2024-001" className="large-input" style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>Coût Total (F) *</label>
              <input type="number" value={formData.totalAmount} onChange={e => setFormData({ ...formData, totalAmount: e.target.value })} placeholder="Ex: 150000" className="large-input" style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>Statut de l'Achat</label>
              <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })} className="large-input" style={{ width: '100%' }}>
                <option value="pending">En attente de réception</option>
                <option value="received">Réceptionné</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid #f1f5f9', paddingTop: '20px' }}>
            <button className="secondary-btn" onClick={() => setShowAdd(false)}>Annuler</button>
            <button className="primary-btn" onClick={handleSave} disabled={isSaving}>
              {isSaving ? (editingId ? 'Modification...' : 'Enregistrement...') : (editingId ? 'Valider la modification' : 'Enregistrer l\'achat')}
            </button>
          </div>
        </div>
      )}

      {filteredPurchases.length === 0 && !showAdd ? (
        <div className="card mt-4" style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '400px', border: '2px dashed #cbd5e1', backgroundColor: '#f8fafc', boxShadow: 'none'
        }}>
          <div style={{
            width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#e0e7ff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px'
          }}>
            <Truck size={36} color="#4f46e5" />
          </div>
          <h3 style={{ color: '#1e293b', fontSize: '1.5rem', marginBottom: '10px' }}>Suivez vos dépenses fournisseurs</h3>
          <p style={{ color: '#64748b', maxWidth: '450px', textAlign: 'center', marginBottom: '30px', lineHeight: '1.6' }}>
            Gérez l'historique de vos achats pour avoir une visibilité parfaite sur vos décaissements et piloter intelligemment vos futurs réapprovisionnements.
          </p>
          <button className="primary-btn" style={{ padding: '12px 24px', fontSize: '1.05rem', boxShadow: '0 4px 10px rgba(59, 130, 246, 0.4)', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => setShowAdd(true)}>
            <Plus size={18} /> Créer votre premier achat
          </button>
        </div>
      ) : filteredPurchases.length > 0 ? (
        <div className="card mt-4">
          <div className="table-responsive">
            <table className="data-table">
              <thead><tr><th>Date</th><th>Référence BC</th><th>Fournisseur</th><th>Articles</th><th>Montant de l'Achat</th><th>Statut</th><th>Actions</th></tr></thead>
              <tbody>
                {filteredPurchases.map(p => (
                  <tr key={p.id} className="table-row-hover">
                    <td>{new Date(p.purchase_date).toLocaleDateString()}</td>
                    <td
                      style={{ color: '#3b82f6', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}
                      onClick={() => setSelectedPurchase(p)}
                    >
                      {p.reference || `BC-${p.id.substring(0, 8).toUpperCase()}`}
                    </td>
                    <td>{p.supplier_name || 'Non spécifié'}</td>
                    <td style={{ fontSize: '0.85rem', color: '#64748b' }}>
                      {p.purchase_items && p.purchase_items.length > 0
                        ? p.purchase_items.map(item => `${item.quantity}x ${item.products?.name}`).join(', ')
                        : 'Aucun article spécifié'}
                    </td>
                    <td style={{ fontWeight: 'bold', color: '#ef4444' }}> - {p.total_amount} F</td>
                    <td><span className={p.status === 'received' ? "status-badge success" : "status-badge warning"} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle size={12} /> {p.status === 'received' ? 'Reçu' : 'En attente'}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button
                          className="secondary-btn"
                          style={{ padding: '4px 8px', fontSize: '0.8rem', backgroundColor: '#3b82f6', borderColor: '#3b82f6', color: 'white' }}
                          onClick={() => setSelectedPurchase(p)}
                        >
                          Voir
                        </button>
                        <button
                          className="secondary-btn"
                          style={{ padding: '4px 8px', fontSize: '0.8rem', backgroundColor: '#f59e0b', borderColor: '#f59e0b', color: 'white' }}
                          onClick={() => {
                            setFormData({
                              totalAmount: p.total_amount,
                              reference: p.reference || '',
                              supplierName: p.supplier_name || '',
                              supplierId: p.supplier_id || '',
                              productId: p.purchase_items?.[0]?.product_id || '',
                              quantity: p.purchase_items?.[0]?.quantity || '',
                              status: p.status || 'pending'
                            });
                            setEditingId(p.id);
                            setShowAdd(true);
                          }}
                        >
                          Modifier
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
      {selectedPurchase && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="card" style={{ width: '90%', maxWidth: '650px', padding: '0', overflow: 'hidden', borderRadius: '15px' }}>
            <div style={{ background: '#f59e0b', color: 'white', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Fiche d'Achat : {selectedPurchase.reference || `BC-${selectedPurchase.id.substring(0, 8).toUpperCase()}`}</h3>
              <button onClick={() => setSelectedPurchase(null)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}><X size={24} /></button>
            </div>

            <div style={{ padding: '25px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '25px', backgroundColor: '#fffbeb', padding: '15px', borderRadius: '10px' }}>
                <div>
                  <div style={{ fontSize: '0.8rem', color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Fournisseur</div>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{selectedPurchase.supplier_name || 'Non spécifié'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.8rem', color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Date de commande</div>
                  <div style={{ fontWeight: 600 }}>{new Date(selectedPurchase.purchase_date).toLocaleString()}</div>
                </div>
              </div>

              <h4 style={{ borderBottom: '2px solid #fde68a', paddingBottom: '10px', marginBottom: '15px', color: '#92400e' }}>Articles Commandés</h4>
              <div className="table-responsive" style={{ marginBottom: '20px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ backgroundColor: '#f8fafc' }}>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '10px', fontSize: '0.85rem' }}>Article</th>
                      <th style={{ textAlign: 'center', padding: '10px', fontSize: '0.85rem' }}>Qté</th>
                      <th style={{ textAlign: 'right', padding: '10px', fontSize: '0.85rem' }}>P.U</th>
                      <th style={{ textAlign: 'right', padding: '10px', fontSize: '0.85rem' }}>Sous-total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPurchase.purchase_items && selectedPurchase.purchase_items.length > 0 ? (
                      selectedPurchase.purchase_items.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px 10px' }}>{item.products?.name || 'Produit inconnu'}</td>
                          <td style={{ padding: '12px 10px', textAlign: 'center' }}>{item.quantity}</td>
                          <td style={{ padding: '12px 10px', textAlign: 'right' }}>{Number(item.unit_price).toLocaleString()} F</td>
                          <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 600 }}>{(item.quantity * item.unit_price).toLocaleString()} F</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Aucun article détaillé pour cet achat global.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '20px', borderTop: '2px solid #f1f5f9', paddingTop: '20px' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.9rem', color: '#64748b' }}>TOTAL GÉNÉRAL</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ef4444' }}>{Number(selectedPurchase.total_amount).toLocaleString()} F</div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: selectedPurchase.status === 'received' ? '#059669' : '#d97706', fontWeight: 600 }}>
                  {selectedPurchase.status === 'received' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                  Statut : {selectedPurchase.status === 'received' ? 'Marchandise Reçue' : 'En attente de livraison'}
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="secondary-btn" onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><Printer size={16} /> Imprimer BC</button>
                  <button className="primary-btn" onClick={() => setSelectedPurchase(null)} style={{ backgroundColor: '#f59e0b', borderColor: '#f59e0b' }}>Fermer</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const Contacts = () => {
  const [contacts, , setContacts] = useFetch('/contacts', { customers: [], suppliers: [] });
  const [showAdd, setShowAdd] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({ name: '', type: 'client', contact_info: '', current_debt: '' });
  const loweredSearch = searchTerm.toLowerCase();
  const filteredCustomers = contacts.customers.filter((c) =>
    `${c.name || ''} ${c.contact_info || ''}`.toLowerCase().includes(loweredSearch)
  );
  const filteredSuppliers = contacts.suppliers.filter((s) =>
    `${s.name || ''} ${s.contact_info || ''}`.toLowerCase().includes(loweredSearch)
  );

  const handleSave = async () => {
    if (!formData.name) return addToast('Attention', "Le nom est requis.", 'warning');
    setIsSaving(true);
    try {
      const res = await fetch(`${API_URL}/contacts`, {
        method: 'POST',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(formData)
      });
      const resData = await res.json();
      if (resData.success) {
        addToast('Succès', 'Contact ajouté !', 'success');
        if (formData.type === 'client') {
          setContacts({ ...contacts, customers: [resData.contact, ...contacts.customers] });
        } else {
          setContacts({ ...contacts, suppliers: [resData.contact, ...contacts.suppliers] });
        }
        setShowAdd(false);
        setFormData({ name: '', type: 'client', contact_info: '', current_debt: '' });
      } else {
        addToast('Erreur', resData.error || 'Erreur lors de l\'enregistrement', 'error');
      }
    } catch (err) { addToast('Erreur', 'Erreur serveur', 'error'); }
    setIsSaving(false);
  };

  return (
    <>
      <div className="page-top-actions">
        <div className="search-filters">
          <Search size={16} style={{ position: 'absolute', left: 15, top: 12, color: '#94a3b8' }} />
          <input type="text" placeholder="Rechercher par nom, téléphone..." className="large-input" style={{ paddingLeft: 40 }} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <button className="primary-btn" onClick={() => setShowAdd(!showAdd)} style={{ backgroundColor: '#eab308', borderColor: '#eab308', color: '#fff' }}><UserPlus size={16} /> Ajouter Client / Fournisseur</button>
      </div>

      {showAdd && (
        <div className="card mt-4" style={{ borderLeft: '4px solid #eab308', backgroundColor: '#fefce8', padding: '25px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0, color: '#854d0e' }}>Ajouter un Profil</h3>
            <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#a16207' }} onClick={() => setShowAdd(false)}><X size={20} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '25px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: 5, fontSize: '0.9rem', color: '#854d0e', fontWeight: 600 }}>Type de relation *</label>
              <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })} className="filter-select" style={{ width: '100%', borderColor: '#fde047' }}>
                <option value="client">Client (Acheteur)</option>
                <option value="fournisseur">Fournisseur (Vendeur)</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 5, fontSize: '0.9rem', color: '#854d0e', fontWeight: 600 }}>Nom / Raison Sociale *</label>
              <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ex: Jean Dupont" className="large-input" style={{ width: '100%', borderColor: '#fde047' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 5, fontSize: '0.9rem', color: '#854d0e', fontWeight: 600 }}>Téléphone / Email</label>
              <input type="text" value={formData.contact_info} onChange={e => setFormData({ ...formData, contact_info: e.target.value })} placeholder="Ex: +221 77..." className="large-input" style={{ width: '100%', borderColor: '#fde047' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 5, fontSize: '0.9rem', color: '#854d0e', fontWeight: 600 }}>Dette initiale / Solde (F)</label>
              <input type="number" value={formData.current_debt} onChange={e => setFormData({ ...formData, current_debt: e.target.value })} placeholder="0" className="large-input" style={{ width: '100%', borderColor: '#fde047' }} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px', borderTop: '1px solid #fef08a', paddingTop: '20px' }}>
            <button className="secondary-btn" onClick={() => setShowAdd(false)} style={{ color: '#a16207' }}>Annuler</button>
            <button className="primary-btn" onClick={handleSave} disabled={isSaving || !formData.name} style={{ backgroundColor: '#eab308', borderColor: '#eab308', color: 'white' }}>
              {isSaving ? 'Enregistrement...' : 'Enregistrer le profil'}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginTop: '20px' }}>
        {/* Colonne Clients */}
        <div style={{ flex: '1 1 300px' }}>
          <h3 style={{ marginBottom: '15px', color: '#475569', display: 'flex', alignItems: 'center', gap: '8px' }}><Users size={20} /> Vos Clients VIP ({filteredCustomers.length})</h3>
          {filteredCustomers.length === 0 ? (
            <div className="card text-center" style={{ padding: '30px', color: '#94a3b8' }}>Aucun client enregistré en BDD.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {filteredCustomers.map(c => (
                <div key={c.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#e0e7ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>{(c.name || 'C').charAt(0).toUpperCase()}</div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 5px 0' }}>{c.name}</h4>
                    <div style={{ display: 'flex', gap: '10px', fontSize: '0.8rem', color: '#64748b' }}>
                      {c.contact_info && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Smartphone size={12} /> {c.contact_info}</span>}
                      {c.current_debt > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ef4444', fontWeight: 'bold' }}> Dette: {c.current_debt} F</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Colonne Fournisseurs */}
        <div style={{ flex: '1 1 300px' }}>
          <h3 style={{ marginBottom: '15px', color: '#475569', display: 'flex', alignItems: 'center', gap: '8px' }}><Truck size={20} /> Vos Fournisseurs ({filteredSuppliers.length})</h3>
          {filteredSuppliers.length === 0 ? (
            <div className="card text-center" style={{ padding: '30px', color: '#94a3b8' }}>Aucun fournisseur enregistré en BDD.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {filteredSuppliers.map(s => (
                <div key={s.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}><Truck size={18} /></div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 5px 0' }}>{s.name}</h4>
                    <div style={{ display: 'flex', gap: '10px', fontSize: '0.8rem', color: '#64748b' }}>
                      {s.contact_info && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Smartphone size={12} /> {s.contact_info}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

const SettingsPage = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState('general');
  const [settings, settingsLoading, setSettings] = useFetch('/settings', { 
    name: '', email: '', phone: '', address: '', currency: 'XOF',
    invoice_prefix: 'FAC', invoice_footer: 'Merci pour votre confiance.', 
    invoice_color: '#2563eb', invoice_format: 'A4', invoice_model: 'model1',
    invoice_conditions: 'Paiement à la livraison', invoice_notes: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pwdData, setPwdData] = useState({ current: '', next: '', confirm: '' });

  // On n'utilise plus d'état local invoicePrefs pour éviter tout décalage avec la BDD


  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch(`${API_URL}/settings`, {
        method: 'POST',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(settings)
      });
      const d = await res.json();
      if (d.success) {
        setSaveStatus('success');
        localStorage.setItem(INVOICE_PREFS_KEY, JSON.stringify(settings));
        setTimeout(() => setSaveStatus(null), 3000);
      } else {
        console.error("Détails erreur sauvegarde:", d.message || d.error);
        setSaveStatus('error');
      }
    } catch (e) {
      console.error("Erreur technique sauvegarde:", e);
      setSaveStatus('error');
    }
    setIsSaving(false);
  };


  const handleInvoiceLogoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const uploadFormData = new FormData();
    uploadFormData.append('image', file);
    setIsUploadingLogo(true);

    try {
      const res = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        headers: getHeaders(),
        body: uploadFormData
      });
      const data = await res.json();
      if (data.success) {
        setSettings(prev => ({ ...prev, invoice_logo: data.imageUrl }));
      } else {
        setSaveStatus('error');
      }
    } catch (err) {
      setSaveStatus('error');
    } finally {
      setIsUploadingLogo(false);
    }
  };


  if (settingsLoading) return <div style={{ padding: '40px', textAlign: 'center' }}>Chargement des paramètres...</div>;

  const handlePasswordChange = async () => {
    if (!pwdData.current || !pwdData.next || !pwdData.confirm) return;
    if (pwdData.next !== pwdData.confirm) {
      setSaveStatus('pwd_mismatch');
      return;
    }
    setIsSaving(true);
    try {
      const savedUser = localStorage.getItem('kameo_current_user');
      const userId = savedUser ? JSON.parse(savedUser).id : null;
      const res = await fetch(`${API_URL}/auth/password`, {
        method: 'PATCH',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ currentPassword: pwdData.current, newPassword: pwdData.next, userId })
      });
      const d = await res.json();
      if (!d.success) {
        setSaveStatus('pwd_mismatch');
        setIsSaving(false);
        return;
      }
    } catch (e) {
      setSaveStatus('error');
      setIsSaving(false);
      return;
    }
    setIsSaving(false);
    setShowPasswordModal(false);
    setPwdData({ current: '', next: '', confirm: '' });
    setSaveStatus('pwd_success');
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const TabButton = ({ id, label, icon }) => (
    <button
      onClick={() => setActiveTab(id)}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 20px', border: 'none', borderRadius: '8px',
        backgroundColor: activeTab === id ? '#eff6ff' : 'transparent',
        color: activeTab === id ? '#2563eb' : '#64748b',
        fontWeight: activeTab === id ? '600' : 'normal',
        cursor: 'pointer', transition: '0.2s', width: '100%', textAlign: 'left'
      }}
    >
      {icon} {label}
    </button>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '30px', alignItems: 'start' }}>
      <div className="card" style={{ padding: '15px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <TabButton id="general" label="Informations" icon={<Users size={18} />} />
        <TabButton id="shop" label="Ma Boutique" icon={<Smartphone size={18} />} />
        {(currentUser.role === 'admin' || currentUser.role === 'superadmin') && (
          <TabButton id="security" label="Sécurité" icon={<Shield size={18} />} />
        )}
      </div>

      <div className="card" style={{ padding: '30px', position: 'relative' }}>
        {saveStatus === 'success' && (
          <div style={{ position: 'absolute', top: 20, right: 30, backgroundColor: '#dcfce7', color: '#166534', padding: '8px 15px', borderRadius: '20px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', animation: 'fadeIn 0.3s' }}>
            <CheckCircle size={16} /> Modification enregistrée
          </div>
        )}
        {saveStatus === 'error' && (
          <div style={{ position: 'absolute', top: 20, right: 30, backgroundColor: '#fee2e2', color: '#991b1b', padding: '8px 15px', borderRadius: '20px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} /> Erreur de sauvegarde
          </div>
        )}
        {saveStatus === 'pwd_mismatch' && (
          <div style={{ position: 'absolute', top: 20, right: 30, backgroundColor: '#fef3c7', color: '#92400e', padding: '8px 15px', borderRadius: '20px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} /> Les mots de passe ne correspondent pas
          </div>
        )}
        {saveStatus === 'pwd_success' && (
          <div style={{ position: 'absolute', top: 20, right: 30, backgroundColor: '#dcfce7', color: '#166534', padding: '8px 15px', borderRadius: '20px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle size={16} /> Mot de passe mis a jour
          </div>
        )}

        <form onSubmit={handleSave}>
          {activeTab === 'general' && (
            <div>
              <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#1e293b' }}>Informations Générales</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#475569', fontWeight: 500 }}>Nom de l'entreprise</label>
                  <input type="text" className="large-input" style={{ width: '100%' }} value={settings.name || ''} onChange={e => setSettings({ ...settings, name: e.target.value })} />
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#475569', fontWeight: 500 }}>Email de contact</label>
                  <input type="email" className="large-input" style={{ width: '100%', backgroundColor: '#f8fafc' }} value={settings.email || ''} disabled />
                  <small style={{ color: '#94a3b8' }}>Contactez le support pour changer l'email.</small>
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#475569', fontWeight: 500 }}>Téléphone professionnel</label>
                  <input type="text" className="large-input" style={{ width: '100%' }} value={settings.phone || ''} onChange={e => setSettings({ ...settings, phone: e.target.value })} />
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#475569', fontWeight: 500 }}>Adresse physique</label>
                  <input type="text" className="large-input" style={{ width: '100%' }} value={settings.address || ''} onChange={e => setSettings({ ...settings, address: e.target.value })} />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'shop' && (
            <div style={{ display: 'flex', gap: '40px', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, maxWidth: '400px' }}>
                <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#1e293b' }}>Configuration Boutique</h3>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#475569', fontWeight: 500 }}>Devise de facturation</label>
                  <select className="filter-select" style={{ width: '100%', padding: '10px' }} value={settings.currency || 'XOF'} onChange={e => setSettings({ ...settings, currency: e.target.value })}>
                    <option value="XOF">Franc CFA (XOF)</option>
                    <option value="EUR">Euro (€)</option>
                    <option value="USD">Dollar ($)</option>
                  </select>
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#475569', fontWeight: 500 }}>Format des factures</label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <div onClick={() => setSettings({ ...settings, invoice_format: 'A4' })} style={{ flex: 1, padding: '15px', border: settings.invoice_format === 'A4' ? '2px solid #3b82f6' : '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: settings.invoice_format === 'A4' ? '#eff6ff' : '#fff', textAlign: 'center', cursor: 'pointer' }}>
                      <FileText size={24} color="#3b82f6" style={{ marginBottom: 5 }} />
                      <div style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>A4 Professionnel</div>
                    </div>
                    <div onClick={() => setSettings({ ...settings, invoice_format: 'THERMAL' })} style={{ flex: 1, padding: '15px', border: settings.invoice_format === 'THERMAL' ? '2px solid #3b82f6' : '1px solid #e2e8f0', borderRadius: '8px', textAlign: 'center', cursor: 'pointer', backgroundColor: settings.invoice_format === 'THERMAL' ? '#eff6ff' : '#fff' }}>
                      <Smartphone size={24} color="#64748b" style={{ marginBottom: 5 }} />
                      <div style={{ fontSize: '0.8rem' }}>Ticket Thermique</div>
                    </div>
                  </div>
                </div>
                <div style={{ marginBottom: '20px', marginTop: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#475569', fontWeight: 500 }}>Modèle de facture</label>
                  <select className="filter-select" style={{ width: '100%', padding: '10px' }} value={settings.invoice_model || 'model1'} onChange={e => setSettings({ ...settings, invoice_model: e.target.value })}>
                    <option value="model1">Modèle 1 (Standard)</option>
                    <option value="model2">Modèle 2 (Moderne)</option>
                    <option value="model3">Modèle 3 (Minimaliste)</option>
                    <option value="model4">Modèle 4 (Multi Services - Bleu)</option>
                    <option value="model5">Modèle 5 (Quincaillerie - QSS)</option>
                  </select>
                </div>
                <div style={{ marginTop: '25px', padding: '16px', border: '1px solid #e2e8f0', borderRadius: '10px', backgroundColor: '#f8fafc' }}>
                  <h4 style={{ marginTop: 0, marginBottom: '12px', color: '#1e293b' }}>Personnalisation facture</h4>
                  <div style={{ marginBottom: '10px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', color: '#475569', fontWeight: 500 }}>Prefixe facture</label>
                    <input type="text" className="large-input" style={{ width: '100%' }} value={settings.invoice_prefix || 'FAC'} onChange={e => setSettings({ ...settings, invoice_prefix: e.target.value })} placeholder="Ex: FAC" />
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', color: '#475569', fontWeight: 500 }}>Texte pied de page</label>
                    <input type="text" className="large-input" style={{ width: '100%' }} value={settings.invoice_footer || ''} onChange={e => setSettings({ ...settings, invoice_footer: e.target.value })} placeholder="Merci pour votre confiance." />
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', color: '#475569', fontWeight: 500 }}>URL du logo</label>
                    <input type="text" className="large-input" style={{ width: '100%' }} value={settings.invoice_logo || ''} onChange={e => setSettings({ ...settings, invoice_logo: e.target.value })} placeholder="https://..." />
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', color: '#475569', fontWeight: 500 }}>Téléversement du logo</label>
                    <input type="file" accept="image/*" onChange={handleInvoiceLogoUpload} style={{ width: '100%' }} />
                    {isUploadingLogo ? (
                      <small style={{ color: '#2563eb' }}>Téléversement en cours...</small>
                    ) : settings.invoice_logo ? (
                      <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img src={settings.invoice_logo} alt="Logo factures" style={{ height: '45px', borderRadius: '6px', objectFit: 'contain', border: '1px solid #e2e8f0' }} />
                        <span style={{ color: '#475569', fontSize: '0.85rem' }}>Aperçu</span>
                      </div>
                    ) : null}
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', color: '#475569', fontWeight: 500 }}>Conditions de paiement</label>
                    <input type="text" className="large-input" style={{ width: '100%' }} value={settings.invoice_conditions || ''} onChange={e => setSettings({ ...settings, invoice_conditions: e.target.value })} placeholder="Ex: Paiement à 30 jours" />
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', color: '#475569', fontWeight: 500 }}>Note additionnelle</label>
                    <textarea rows={3} className="large-input" style={{ width: '100%' }} value={settings.invoice_notes || ''} onChange={e => setSettings({ ...settings, invoice_notes: e.target.value })} placeholder="Ex: Merci pour votre confiance" />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', color: '#475569', fontWeight: 500 }}>Couleur principale</label>
                    <input type="color" value={settings.invoice_color || '#2563eb'} onChange={e => setSettings({ ...settings, invoice_color: e.target.value })} />
                  </div>
                </div>

              </div>

               {/* FACTURE PREVIEW PANEL */}
               <div style={{ flex: 1, padding: '20px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'center', position: 'sticky', top: '20px' }}>
                 <div style={{ 
                    width: settings.invoice_format === 'THERMAL' ? '280px' : '100%', 
                    maxWidth: settings.invoice_format === 'THERMAL' ? '280px' : '480px', 
                    backgroundColor: '#fff', 
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', 
                    padding: settings.invoice_format === 'THERMAL' ? '15px' : '30px', 
                    borderRadius: '4px',
                    borderTop: settings.invoice_model === 'model2' ? `8px solid ${settings.invoice_color || '#2563eb'}` : 'none',
                    border: settings.invoice_model === 'model5' ? `2px solid ${settings.invoice_color || '#2563eb'}` : 'none',
                    minHeight: settings.invoice_format === 'THERMAL' ? '350px' : '650px',
                    display: 'flex',
                    flexDirection: 'column'
                  }}>
                    {/* Aperçu Header */}
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: settings.invoice_model === 'model3' ? 'column' : settings.invoice_model === 'model2' ? 'row-reverse' : 'row', 
                      justifyContent: 'space-between', 
                      alignItems: settings.invoice_model === 'model3' ? 'center' : 'flex-start',
                      marginBottom: '20px',
                      borderBottom: settings.invoice_model === 'model1' ? '1px solid #e2e8f0' : 'none',
                      paddingBottom: settings.invoice_model === 'model1' ? '15px' : '0'
                    }}>
                      {settings.invoice_logo ? (
                        <img src={settings.invoice_logo} alt="logo" style={{ height: settings.invoice_format === 'THERMAL' ? '30px' : '45px', objectFit: 'contain' }} />
                      ) : (
                        <div style={{ width: '80px', height: '40px', backgroundColor: '#e2e8f0', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#94a3b8' }}>VOTRE LOGO</div>
                      )}
                      <div style={{ textAlign: settings.invoice_model === 'model3' ? 'center' : settings.invoice_model === 'model2' ? 'left' : 'right', marginTop: settings.invoice_model === 'model3' ? '15px' : '0' }}>
                        <div style={{ fontWeight: 'bold', fontSize: settings.invoice_format === 'THERMAL' ? '1rem' : '1.3rem', color: settings.invoice_model === 'model4' ? (settings.invoice_color || '#2563eb') : '#1e293b' }}>
                          {settings.invoice_prefix || 'FAC'}-2026-001
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Aujourd'hui</div>
                      </div>
                    </div>
                    
                    {/* Aperçu Corps (Body) */}
                    <div style={{ fontSize: '0.8rem', color: '#334155', marginBottom: '20px', flex: 1 }}>
                      <div style={{ marginBottom: '15px', padding: settings.invoice_model === 'model5' ? '10px' : '0', backgroundColor: settings.invoice_model === 'model5' ? '#f8fafc' : 'transparent', border: settings.invoice_model === 'model5' ? '1px dashed #cbd5e1' : 'none' }}>
                        <strong>Client :</strong> John Doe<br/>
                        <span style={{ color: '#64748b' }}>+225 00 00 00 00 00</span>
                      </div>
                      
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                        <thead>
                          <tr style={{ backgroundColor: settings.invoice_model === 'model4' ? (settings.invoice_color || '#2563eb') : '#f1f5f9', color: settings.invoice_model === 'model4' ? '#fff' : '#475569', textAlign: 'left' }}>
                            <th style={{ padding: '8px' }}>Désignation</th>
                            <th style={{ padding: '8px', textAlign: 'right' }}>Prix</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr><td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>1x Produit A</td><td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0', textAlign: 'right' }}>15 000</td></tr>
                          <tr><td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>2x Produit B</td><td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0', textAlign: 'right' }}>20 000</td></tr>
                        </tbody>
                      </table>
                      <div style={{ textAlign: 'right', marginTop: '12px', fontWeight: 'bold', fontSize: '0.9rem', color: settings.invoice_color || '#2563eb' }}>
                        Total TTC : 35 000 {settings.currency || 'XOF'}
                      </div>
                    </div>

                    {/* Aperçu Pied de page (Footer) */}
                    <div style={{ borderTop: `2px solid ${settings.invoice_color || '#2563eb'}`, paddingTop: '15px', fontSize: '0.7rem', color: '#64748b', textAlign: 'center' }}>
                      <div style={{ marginBottom: '5px', fontWeight: 'bold', color: '#475569' }}>{settings.invoice_conditions || 'Paiement à la livraison'}</div>
                      <div>{settings.invoice_notes && <>{settings.invoice_notes}<br/></>}{settings.invoice_footer || 'Merci pour votre confiance.'}</div>
                   </div>
                 </div>
               </div>

            </div>
          )}

          {activeTab === 'security' && (
            <div>
              <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#1e293b' }}>Sécurité du compte</h3>
              <p style={{ color: '#64748b', marginBottom: '25px' }}>Gérez vos accès et la protection de vos données de vente.</p>
              <div style={{ padding: '20px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', color: '#1e293b' }}>Mot de passe</div>
                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Dernière modification il y a 3 mois</div>
                  </div>
                  <button type="button" className="secondary-btn" onClick={() => setShowPasswordModal(true)}>Modifier</button>
                </div>
              </div>
              <div style={{ padding: '20px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', color: '#1e293b' }}>Authentification à double facteur (2FA)</div>
                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Ajoutez une couche de sécurité supplémentaire à votre compte.</div>
                  </div>
                  <div className="status-badge" style={{ backgroundColor: '#fee2e2', color: '#991b1b', cursor: 'pointer' }}>Désactivé</div>
                </div>
                <div style={{ marginTop: '15px', padding: '15px', backgroundColor: '#fff', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569' }}>
                    Une fois activé, vous devrez saisir un code envoyé par <strong>Email</strong> ou généré par une application comme <strong>Google Authenticator</strong> pour vous connecter.
                  </p>
                  <button type="button" className="primary-btn" style={{ marginTop: '10px', fontSize: '0.8rem', padding: '6px 12px' }}>Configurer la 2FA</button>
                </div>
              </div>

              <div style={{ padding: '20px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                <div style={{ fontWeight: 'bold', color: '#1e293b', marginBottom: '10px' }}>Sessions actives</div>
                <div style={{ fontSize: '0.85rem', color: '#64748b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <div>
                    <strong>Windows 10 â€¢ Chrome</strong>
                    <div>Dakar, Sénégal (Actuel)</div>
                  </div>
                  <span style={{ color: '#059669', fontWeight: 600 }}>En ligne</span>
                </div>
                <button type="button" style={{ marginTop: '15px', background: 'transparent', border: 'none', color: '#ef4444', fontSize: '0.85rem', cursor: 'pointer', padding: 0 }}>Déconnecter tous les autres appareils</button>
              </div>

              <div style={{ padding: '20px', backgroundColor: '#fff5f5', borderRadius: '12px', border: '1px solid #feb2b2' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', color: '#c53030' }}>Zone de danger</div>
                    <div style={{ fontSize: '0.85rem', color: '#c53030' }}>Suppression définitive du compte et des données</div>
                  </div>
                  <button type="button" style={{ padding: '8px 15px', borderRadius: '6px', border: '1px solid #c53030', color: '#c53030', backgroundColor: 'transparent', cursor: 'not-allowed', opacity: 0.7 }} disabled>Supprimer (bientôt)</button>
                </div>
              </div>
            </div>
          )}

          <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="primary-btn" disabled={isSaving} style={{ padding: '12px 30px' }}>
              {isSaving ? 'Enregistrement...' : 'Enregistrer les changements'}
            </button>
          </div>
        </form>

        {showPasswordModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
            <div className="card" style={{ width: '90%', maxWidth: '420px', padding: '25px' }}>
              <h3 style={{ marginTop: 0 }}>Changer le mot de passe</h3>
              <input type="password" className="large-input" style={{ width: '100%', marginBottom: '10px' }} placeholder="Mot de passe actuel" value={pwdData.current} onChange={e => setPwdData({ ...pwdData, current: e.target.value })} />
              <input type="password" className="large-input" style={{ width: '100%', marginBottom: '10px' }} placeholder="Nouveau mot de passe" value={pwdData.next} onChange={e => setPwdData({ ...pwdData, next: e.target.value })} />
              <input type="password" className="large-input" style={{ width: '100%', marginBottom: '20px' }} placeholder="Confirmer le nouveau mot de passe" value={pwdData.confirm} onChange={e => setPwdData({ ...pwdData, confirm: e.target.value })} />
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" className="secondary-btn w-100" onClick={() => setShowPasswordModal(false)}>Annuler</button>
                <button type="button" className="primary-btn w-100" onClick={handlePasswordChange}>Valider</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


const Subscription = ({ companyPlanId, companyNextBilling }) => {
  const [isAnnual, setIsAnnual] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('mobile_money');
  const [subscribeMessage, setSubscribeMessage] = useState('');
  const [contactForm, setContactForm] = useState({ company: '', phone: '', details: '' });

  const [subscriptionInfo, setSubscriptionInfo] = useState(() => {
    // Si companyPlanId est fourni (superadmin mode), utiliser ces données
    if (companyPlanId) {
      const planMap = { 'pro': 'Pro', 'trial': 'Essai', 'enterprise': 'Entreprise' };
      const planName = planMap[companyPlanId.toLowerCase()] || 'Essai';
      return {
        plan: planName,
        status: 'active',
        startDate: null,
        expiryDate: companyNextBilling || null,
        billing: 'Mensuel'
      };
    }
    // Sinon, utiliser localStorage pour l'utilisateur normal
    try {
      const stored = JSON.parse(localStorage.getItem('KameoSubscription'));
      if (stored && stored.plan && stored.expiryDate) {
        return stored;
      }
    } catch (e) {
      // ignore parse error
    }
    return { plan: 'Essai', status: 'inactive', startDate: null, expiryDate: null, billing: 'Mensuel' };
  });

  // Mettre à jour subscriptionInfo quand les props changent (superadmin change d'entreprise)
  useEffect(() => {
    if (companyPlanId) {
      const planMap = { 'pro': 'Pro', 'trial': 'Essai', 'enterprise': 'Entreprise' };
      const planName = planMap[companyPlanId.toLowerCase()] || 'Essai';
      setSubscriptionInfo({
        plan: planName,
        status: 'active',
        startDate: null,
        expiryDate: companyNextBilling || null,
        billing: 'Mensuel'
      });
    }
  }, [companyPlanId, companyNextBilling]);

  const getDaysLeft = () => {
    if (!subscriptionInfo.expiryDate) return null;
    const remaining = Math.ceil((new Date(subscriptionInfo.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return remaining;
  };

  const makeSubscription = async (selectedPlan) => {
    const now = new Date();
    const durationDays = selectedPlan === 'Pro' ? (isAnnual ? 365 : 30) : 14;
    const expiry = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

    const info = {
      plan: selectedPlan,
      status: 'active',
      startDate: now.toISOString(),
      expiryDate: expiry.toISOString(),
      billing: isAnnual ? 'Annuel' : 'Mensuel'
    };

    setSubscriptionInfo(info);
    localStorage.setItem('KameoSubscription', JSON.stringify(info));

    // Demande de validation par superadmin
    try {
      const res = await fetch(`${API_URL}/subscription/request`, {
        method: 'POST',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ plan_id: selectedPlan === 'Pro' ? 'pro' : 'trial' })
      });
      const data = await res.json();
      if (data.success) {
        setSubscribeMessage(`Demande envoyée au superadmin. Statut: en attente de validation`);
      } else {
        setSubscribeMessage(`Erreur de demande d'abonnement: ${data.error || 'erreur serveur'}`);
      }
    } catch (err) {
      setSubscribeMessage(`Erreur réseau lors de la demande d'abonnement.`);
    }
  };

  const daysLeft = getDaysLeft();
  const isExpiringSoon = daysLeft !== null && daysLeft <= 7 && daysLeft >= 0;
  const isExpired = daysLeft !== null && daysLeft < 0;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h2 style={{ fontSize: '2.5rem', color: '#0f172a', fontWeight: '800', marginBottom: '15px' }}>Votre Plan KAméo</h2>
        
        {subscriptionInfo.plan === 'Pro' ? (
          <div style={{ 
            marginTop: '30px', 
            padding: '40px', 
            borderRadius: '24px', 
            background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)', 
            color: 'white',
            boxShadow: '0 20px 25px -5px rgba(59, 130, 246, 0.2)',
            maxWidth: '800px',
            margin: '0 auto'
          }}>
            <div style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '8px', 
              backgroundColor: 'rgba(255,255,255,0.2)', 
              padding: '8px 16px', 
              borderRadius: '20px',
              fontSize: '0.9rem',
              fontWeight: 700,
              marginBottom: '20px'
            }}>
              <CheckCircle size={18} /> PLAN PROFESSIONNEL ACTIF
            </div>
            <h1 style={{ fontSize: '3rem', margin: '0 0 10px', fontWeight: 900 }}>Vous êtes en version PRO</h1>
            <p style={{ fontSize: '1.2rem', opacity: 0.9, marginBottom: '30px' }}>
              Toutes les fonctionnalités de KAméo sont débloquées pour votre entreprise.
            </p>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
              gap: '20px',
              textAlign: 'left',
              backgroundColor: 'rgba(255,255,255,0.1)',
              padding: '20px',
              borderRadius: '16px'
            }}>
              <div>
                <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>Date de début</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{subscriptionInfo.startDate ? new Date(subscriptionInfo.startDate).toLocaleDateString() : '-'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>Prochain renouvellement</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{subscriptionInfo.expiryDate ? new Date(subscriptionInfo.expiryDate).toLocaleDateString() : '-'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>Type de facturation</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{subscriptionInfo.billing || 'Mensuel'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>Statut</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#4ade80' }}>Actif</div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <p style={{ color: '#64748b', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>Évoluez à votre rythme. Choisissez la puissance dont votre quincaillerie a besoin pour se développer sans limites.</p>

            {subscriptionInfo.status === 'active' ? (
              <div style={{ marginTop: '25px', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '16px 20px', borderRadius: '12px', border: '1px solid #a5b4fc', backgroundColor: '#eef2ff', color: '#3730a3' }}>
                <div style={{ fontWeight: 700 }}>Abonnement actif : {subscriptionInfo.plan}</div>
                <div>Début : {subscriptionInfo.startDate ? new Date(subscriptionInfo.startDate).toLocaleDateString() : '-'}</div>
                <div>Expiration : {subscriptionInfo.expiryDate ? new Date(subscriptionInfo.expiryDate).toLocaleDateString() : '-'}</div>
                {isExpired ? (
                  <div style={{ color: '#dc2626', fontWeight: 700 }}>Votre abonnement est expiré. Renouvelez maintenant.</div>
                ) : (
                  <div style={{ color: isExpiringSoon ? '#b45309' : '#16a34a', fontWeight: 700 }}>
                    {daysLeft} jour{daysLeft === 1 ? '' : 's'} restants {isExpiringSoon ? '(fin bientôt!)' : ''}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ marginTop: '25px', display: 'inline-flex', padding: '16px 20px', borderRadius: '12px', border: '1px dashed #cbd5e1', backgroundColor: '#f8fafc', color: '#64748b' }}>
                Vous êtes en période d'essai. Passez en plan Pro pour débloquer toutes les fonctionnalités.
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', marginTop: '30px' }}>
              <span style={{ fontWeight: isAnnual ? 'normal' : 'bold', color: isAnnual ? '#94a3b8' : '#1e293b' }}>Mensuel</span>
              <div
                style={{ width: '50px', height: '26px', backgroundColor: '#3b82f6', borderRadius: '20px', position: 'relative', cursor: 'pointer', transition: '0.3s' }}
                onClick={() => setIsAnnual(!isAnnual)}
              >
                <div style={{ width: '20px', height: '20px', backgroundColor: 'white', borderRadius: '50%', position: 'absolute', top: '3px', left: isAnnual ? '27px' : '3px', transition: '0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}></div>
              </div>
              <span style={{ fontWeight: isAnnual ? 'bold' : 'normal', color: isAnnual ? '#1e293b' : '#94a3b8' }}>Annuel <span className="status-badge success" style={{ marginLeft: '5px', fontSize: '0.75rem' }}>-20%</span></span>
            </div>
          </>
        )}

        {subscribeMessage && (
          <div style={{ marginTop: '12px', color: '#047857', backgroundColor: '#dcfce7', border: '1px solid #86efac', borderRadius: '8px', padding: '10px' }}>{subscribeMessage}</div>
        )}
      </div>

      {subscriptionInfo.plan !== 'Pro' && (
        <div style={{ display: 'flex', gap: '30px', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Basic */}
          <div className="card" style={{ flex: '1 1 320px', maxWidth: '350px', padding: '40px 30px', border: '1px solid #e2e8f0', borderTop: '5px solid #94a3b8', borderRadius: '16px', backgroundColor: '#f8fafc', transition: 'transform 0.3s', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
            <h3 style={{ fontSize: '1.5rem', color: '#475569', margin: '0 0 10px' }}>Découverte</h3>
            <p style={{ color: '#64748b', fontSize: '0.95rem', minHeight: '40px' }}>Pour tester KAméo et se familiariser avec l'outil.</p>
            <p style={{ fontSize: '2.5rem', fontWeight: '800', margin: '20px 0', color: '#1e293b' }}>0 F <span style={{ fontSize: '1rem', color: '#94a3b8', fontWeight: 'normal' }}>/ 14 jrs</span></p>
            {subscriptionInfo.plan === 'Essai' ? (
              <button className="secondary-btn w-100" style={{ padding: '12px', fontSize: '1.05rem', marginBottom: '30px', borderRadius: '8px', backgroundColor: '#e2e8f0', color: '#475569', border: 'none' }} disabled>Plan Actuel</button>
            ) : (
              <button className="secondary-btn w-100" style={{ padding: '12px', fontSize: '1.05rem', marginBottom: '30px', borderRadius: '8px', backgroundColor: '#e2e8f0', color: '#475569', border: 'none' }} onClick={() => { setShowPayment(true); }}>Passer au Pro</button>
            )}
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, color: '#475569', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <li style={{ display: 'flex', gap: '10px', alignItems: 'center' }}><CheckCircle size={18} color="#10b981" /> 1 Utilisateur</li>
              <li style={{ display: 'flex', gap: '10px', alignItems: 'center' }}><CheckCircle size={18} color="#10b981" /> Jusqu'à 50 produits</li>
              <li style={{ display: 'flex', gap: '10px', alignItems: 'center', color: '#94a3b8' }}><X size={18} color="#cbd5e1" /> Facturation exportable</li>
              <li style={{ display: 'flex', gap: '10px', alignItems: 'center', color: '#94a3b8' }}><X size={18} color="#cbd5e1" /> Support prioritaire</li>
            </ul>
          </div>

          {/* Pro */}
          <div className="card" style={{ flex: '1 1 320px', maxWidth: '380px', padding: '40px 30px', border: '2px solid #3b82f6', borderRadius: '16px', position: 'relative', boxShadow: '0 20px 40px -10px rgba(59, 130, 246, 0.25)', zIndex: 10, transform: 'scale(1.05)' }}>
            <div style={{ display: 'inline-block', background: 'linear-gradient(90deg, #2563eb, #8b5cf6)', color: 'white', padding: '6px 16px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '900', letterSpacing: '1px', marginBottom: '15px' }}>RECOMMANDÉ</div>
            <h3 style={{ fontSize: '1.5rem', color: '#2563eb', margin: '0 0 10px' }}>Professionnel</h3>
            <p style={{ color: '#64748b', fontSize: '0.95rem', minHeight: '40px' }}>L'outil complet pour gérer et scaler votre commerce au quotidien.</p>
            <p style={{ fontSize: '2.5rem', fontWeight: '800', margin: '20px 0', color: '#0f172a' }}>
              {isAnnual ? '28 000 F' : '35 000 F'} <span style={{ fontSize: '1rem', color: '#94a3b8', fontWeight: 'normal' }}>/ mois</span>
            </p>
            {subscriptionInfo.plan === 'Pro' ? (
              <button className="primary-btn w-100" style={{ padding: '14px', fontSize: '1.1rem', marginBottom: '30px', borderRadius: '8px', backgroundColor: '#6d28d9', border: 'none', boxShadow: '0 4px 10px rgba(107, 40, 217, 0.4)', color: '#fff' }} disabled>Plan Actuel</button>
            ) : (
              <button className="primary-btn w-100" style={{ padding: '14px', fontSize: '1.1rem', marginBottom: '30px', borderRadius: '8px', background: 'linear-gradient(90deg, #2563eb, #3b82f6)', border: 'none', boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)' }} onClick={() => setShowPayment(true)}>Mettre à niveau</button>
            )}
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, color: '#1e293b', display: 'flex', flexDirection: 'column', gap: '15px', fontWeight: '500' }}>
              <li style={{ display: 'flex', gap: '10px', alignItems: 'center' }}><CheckCircle size={18} color="#2563eb" /> 5 Utilisateurs simultanés</li>
              <li style={{ display: 'flex', gap: '10px', alignItems: 'center' }}><CheckCircle size={18} color="#2563eb" /> Produits & Stocks illimités</li>
              <li style={{ display: 'flex', gap: '10px', alignItems: 'center' }}><CheckCircle size={18} color="#2563eb" /> Code-barres & POS rapide</li>
              <li style={{ display: 'flex', gap: '10px', alignItems: 'center' }}><CheckCircle size={18} color="#2563eb" /> Facturation PDF & Rapports</li>
              <li style={{ display: 'flex', gap: '10px', alignItems: 'center' }}><CheckCircle size={18} color="#2563eb" /> Support dédié 7/7</li>
            </ul>
          </div>

          {/* Enterprise */}
          <div className="card" style={{ flex: '1 1 320px', maxWidth: '350px', padding: '40px 30px', border: '1px solid #1e293b', borderTop: '5px solid #a855f7', borderRadius: '16px', backgroundColor: '#0f172a', transition: 'transform 0.3s', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ fontSize: '1.5rem', color: '#f8fafc', margin: '0 0 10px' }}>Entreprise</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.95rem', minHeight: '40px' }}>La puissance absolue pour les réseaux de franchises.</p>
            <p style={{ fontSize: '2.5rem', fontWeight: '800', margin: '20px 0', color: '#ffffff' }}>Sur devis</p>
            <button className="primary-btn w-100" style={{ padding: '12px', fontSize: '1.05rem', marginBottom: '30px', borderRadius: '8px', backgroundColor: 'transparent', color: '#d8b4fe', border: '2px solid #a855f7' }} onClick={() => setShowContact(true)}>Contacter un expert</button>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, color: '#f1f5f9', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <li style={{ display: 'flex', gap: '10px', alignItems: 'center' }}><CheckCircle size={18} color="#a855f7" /> Utilisateurs illimités</li>
              <li style={{ display: 'flex', gap: '10px', alignItems: 'center' }}><CheckCircle size={18} color="#a855f7" /> Multi-boutiques / Dépôts</li>
              <li style={{ display: 'flex', gap: '10px', alignItems: 'center' }}><CheckCircle size={18} color="#a855f7" /> VIP & Formation sur site</li>
              <li style={{ display: 'flex', gap: '10px', alignItems: 'center' }}><CheckCircle size={18} color="#a855f7" /> API ouverte intégrée</li>
            </ul>
          </div>
        </div>
      )}  {/* Modale Paiement */}
      {showPayment && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="card" style={{ width: '90%', maxWidth: '450px', padding: '30px', position: 'relative' }}>
            <button style={{ position: 'absolute', top: 15, right: 15, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }} onClick={() => setShowPayment(false)}><X size={20} /></button>
            <h3 style={{ marginTop: 0, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px' }}><CreditCard size={24} color="#3b82f6" /> Mettre à niveau</h3>
            <p style={{ color: '#64748b', marginBottom: '20px' }}>Saisie sécurisée pour le plan Professionnel - {isAnnual ? 'Facturation Annuelle' : 'Facturation Mensuelle'}</p>

            <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '15px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', color: '#64748b' }}><span>Abonnement Pro</span><span>{isAnnual ? (35000 * 12).toLocaleString() + ' F' : '35 000 F'}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', color: '#10b981', fontWeight: 'bold' }}><span>{isAnnual ? 'Réduction Annuelle (-20%)' : 'Remises'}</span><span>{isAnnual ? '- ' + (7000 * 12).toLocaleString() + ' F' : '- 0 F'}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1.2rem', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #e2e8f0', color: '#1e293b' }}><span>Total à régler</span><span>{isAnnual ? (28000 * 12).toLocaleString() + ' F' : '35 000 F'}</span></div>
            </div>

            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#475569', fontSize: '0.9rem' }}>Méthode de paiement</label>
            <select className="large-input" style={{ width: '100%', marginBottom: '20px', backgroundColor: '#f8fafc' }} value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
              <option value="mobile_money">Mobile Money (Wave, Orange, Free, MTN...)</option>
              <option value="card">Carte Bancaire (Visa, MasterCard)</option>
            </select>

            <button className="primary-btn w-100" style={{ padding: '14px', fontSize: '1.1rem', backgroundColor: '#3b82f6', border: 'none', boxShadow: '0 4px 10px rgba(59, 130, 246, 0.3)' }} onClick={() => {
              makeSubscription('Pro');
              setSubscribeMessage(`Paiement validé via ${paymentMethod === 'card' ? 'Carte' : 'Mobile Money'} : plan Professionnel activé.`);
              setShowPayment(false);
            }}>
              Payer {isAnnual ? (28000 * 12).toLocaleString() + ' F' : '35 000 F'}
            </button>
          </div>
        </div>
      )}

      {/* Modale Contact Expert */}
      {showContact && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="card" style={{ width: '90%', maxWidth: '450px', padding: '30px', position: 'relative' }}>
            <button style={{ position: 'absolute', top: 15, right: 15, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }} onClick={() => setShowContact(false)}><X size={20} /></button>
            <h3 style={{ marginTop: 0, color: '#1e293b' }}>Contacter l'équipe VIP</h3>
            <p style={{ color: '#64748b', marginBottom: '20px' }}>Laissez-nous vos coordonnées, un expert KAméo vous rappellera sous 24h pour discuter d'un déploiement multi-boutiques.</p>

            <input type="text" placeholder="Nom de votre franchise" className="large-input" style={{ width: '100%', marginBottom: '15px' }} value={contactForm.company} onChange={e => setContactForm({ ...contactForm, company: e.target.value })} />
            <input type="text" placeholder="Numéro de téléphone" className="large-input" style={{ width: '100%', marginBottom: '15px' }} value={contactForm.phone} onChange={e => setContactForm({ ...contactForm, phone: e.target.value })} />
            <textarea placeholder="Quel est votre volume de stock ou nombre de boutiques ?" className="large-input" style={{ width: '100%', marginBottom: '20px', minHeight: '80px' }} value={contactForm.details} onChange={e => setContactForm({ ...contactForm, details: e.target.value })}></textarea>

            <button className="primary-btn w-100" style={{ padding: '14px', fontSize: '1.05rem', backgroundColor: '#8b5cf6', borderColor: '#8b5cf6', boxShadow: '0 4px 10px rgba(139, 92, 246, 0.3)' }} onClick={() => { if (!contactForm.company || !contactForm.phone) return; setSubscribeMessage(`Demande entreprise envoyée pour ${contactForm.company}.`); setContactForm({ company: '', phone: '', details: '' }); setShowContact(false); }}>
              Demander mon devis
            </button>
          </div>
        </div>
      )}
      {subscribeMessage && (
        <div style={{ marginTop: '20px', textAlign: 'center', color: '#166534', backgroundColor: '#dcfce7', border: '1px solid #86efac', borderRadius: '8px', padding: '12px' }}>
          {subscribeMessage}
        </div>
      )}
    </div>
  );
};

const FinanceModule = () => {
  const [fin, finLoading, setFin] = useFetch('/finance/summary', { totalRecettes: 0, totalDepenses: 0, balance: 0, history: [] });
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('RECETTE'); // RECETTE or DEPENSE
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({ amount: '', label: '' });
  const [financeSearch, setFinanceSearch] = useState('');
  const filteredHistory = (fin.history || []).filter((tx) =>
    `${tx.label || ''} ${tx.type || ''} ${tx.amount || ''}`.toLowerCase().includes(financeSearch.toLowerCase())
  );

  const refreshData = async () => {
    const res = await fetch(`${API_URL}/finance/summary`, {
      headers: getHeaders()
    });
    const d = await res.json();
    setFin(d);
  };

  const handleExport = () => {
    const rows = filteredHistory.map((tx) => `${new Date(tx.date).toLocaleDateString()};${tx.label};${tx.type};${tx.amount}`);
    const csv = ['date;libelle;type;montant', ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'finance-export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSave = async () => {
    if (!formData.amount) return addToast('Attention', "Le montant est requis.", 'warning');
    setIsSaving(true);
    try {
      const endpoint = modalType === 'RECETTE' ? '/sales' : '/purchases';
      const body = modalType === 'RECETTE'
        ? { totalAmount: formData.amount, status: 'paid' }
        : { totalAmount: formData.amount, supplierName: formData.label || 'Divers' };

      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body)
      });

      const resData = await res.json();
      if (resData.success) {
        addToast('Succès', 'Opération enregistrée !', 'success');
        await refreshData();
        setShowModal(false);
        setFormData({ amount: '', label: '' });
      } else {
        addToast('Erreur', resData.error || 'Erreur lors de l\'enregistrement', 'error');
      }
    } catch (err) { addToast('Erreur', 'Erreur serveur', 'error'); }
    setIsSaving(false);
  };

  if (finLoading) return <div>Chargement de la trésorerie...</div>;

  return (
    <div style={{ padding: '0 0 40px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px', marginBottom: '20px' }}>
        <button className="primary-btn" onClick={() => { setModalType('RECETTE'); setShowModal(true); }} style={{ backgroundColor: '#10b981', borderColor: '#10b981', color: 'white' }}>
          <PlusCircle size={18} /> Nouvelle Recette
        </button>
        <button className="primary-btn" onClick={() => { setModalType('DEPENSE'); setShowModal(true); }} style={{ backgroundColor: '#ef4444', borderColor: '#ef4444', color: 'white' }}>
          <PlusCircle size={18} /> Nouvelle Dépense
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '30px' }}>
        <div className="card" style={{ padding: '25px', display: 'flex', alignItems: 'center', gap: '20px', borderLeft: '4px solid #10b981' }}>
          <div style={{ width: 50, height: 50, borderRadius: '12px', backgroundColor: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp color="#10b981" />
          </div>
          <div>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '5px' }}>Total Recettes</p>
            <h2 style={{ margin: 0, fontSize: '1.8rem', color: '#1e293b' }}>{(fin.totalRecettes || 0).toLocaleString()} F</h2>
          </div>
        </div>

        <div className="card" style={{ padding: '25px', display: 'flex', alignItems: 'center', gap: '20px', borderLeft: '4px solid #ef4444' }}>
          <div style={{ width: 50, height: 50, borderRadius: '12px', backgroundColor: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingDown color="#ef4444" />
          </div>
          <div>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '5px' }}>Total Dépenses</p>
            <h2 style={{ margin: 0, fontSize: '1.8rem', color: '#1e293b' }}>{(fin.totalDepenses || 0).toLocaleString()} F</h2>
          </div>
        </div>

        <div className="card" style={{ padding: '25px', display: 'flex', alignItems: 'center', gap: '20px', borderLeft: '4px solid #3b82f6', backgroundColor: '#f0f7ff' }}>
          <div style={{ width: 50, height: 50, borderRadius: '12px', backgroundColor: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Wallet color="#3b82f6" />
          </div>
          <div>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '5px' }}>Solde Net (Bénéfice)</p>
            <h2 style={{ margin: 0, fontSize: '1.8rem', color: (fin.balance || 0) >= 0 ? '#3b82f6' : '#ef4444' }}>{(fin.balance || 0).toLocaleString()} F</h2>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', alignItems: 'start' }}>
        <div className="card">
          <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, color: '#1e293b' }}>Flux de Trésorerie Récents</h3>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input type="text" className="large-input" style={{ padding: '8px 10px', width: '220px' }} placeholder="Filtrer les flux..." value={financeSearch} onChange={e => setFinanceSearch(e.target.value)} />
              <button className="secondary-btn" style={{ fontSize: '0.8rem' }} onClick={handleExport}>Exporter CSV</button>
            </div>
          </div>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Type</th>
                  <th style={{ textAlign: 'right' }}>Montant</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.length === 0 ? (
                  <tr><td colSpan="4" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Aucun flux enregistré</td></tr>
                ) : (
                  filteredHistory.map((tx, idx) => (
                    <tr key={idx} className="table-row-hover">
                      <td>{new Date(tx.date).toLocaleDateString()}</td>
                      <td>{tx.label}</td>
                      <td>
                        <span className={`status-badge ${tx.type === 'RECETTE' ? 'success' : 'error'}`} style={{ fontSize: '0.75rem' }}>
                          {tx.type}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: tx.type === 'RECETTE' ? '#10b981' : '#ef4444' }}>
                        {tx.type === 'RECETTE' ? '+' : '-'}{tx.amount.toLocaleString()} F
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card" style={{ padding: '25px' }}>
          <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#1e293b' }}>Répartition Globale</h3>
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem' }}>
              <span style={{ color: '#64748b' }}>Recettes</span>
              <span style={{ fontWeight: 'bold', color: '#10b981' }}>{(fin.totalRecettes || 0).toLocaleString()} F</span>
            </div>
            <div style={{ width: '100%', height: '10px', backgroundColor: '#e2e8f0', borderRadius: '5px', overflow: 'hidden' }}>
              <div style={{
                width: (fin.totalRecettes + fin.totalDepenses) > 0 ? `${(fin.totalRecettes / (fin.totalRecettes + fin.totalDepenses)) * 100}%` : '0%',
                height: '100%', backgroundColor: '#10b981'
              }}></div>
            </div>
          </div>
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem' }}>
              <span style={{ color: '#64748b' }}>Dépenses</span>
              <span style={{ fontWeight: 'bold', color: '#ef4444' }}>{(fin.totalDepenses || 0).toLocaleString()} F</span>
            </div>
            <div style={{ width: '100%', height: '10px', backgroundColor: '#e2e8f0', borderRadius: '5px', overflow: 'hidden' }}>
              <div style={{
                width: (fin.totalRecettes + fin.totalDepenses) > 0 ? `${(fin.totalDepenses / (fin.totalRecettes + fin.totalDepenses)) * 100}%` : '0%',
                height: '100%', backgroundColor: '#ef4444'
              }}></div>
            </div>
          </div>
          <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
            <p style={{ margin: 1, fontSize: '0.85rem', color: '#64748b', textAlign: 'center' }}>
              <Shield size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} />
              Données synchronisées en temps réel avec Supabase
            </p>
          </div>
        </div>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="card" style={{ width: '90%', maxWidth: '400px', padding: '30px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#1e293b' }}>
              {modalType === 'RECETTE' ? 'âž• Enregistrer une Recette' : 'âž– Enregistrer une Dépense'}
            </h3>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 500 }}>Montant (F) *</label>
              <input
                type="number"
                value={formData.amount}
                onChange={e => setFormData({ ...formData, amount: e.target.value })}
                className="large-input"
                style={{ width: '100%', borderColor: modalType === 'RECETTE' ? '#10b981' : '#ef4444' }}
                placeholder="0"
              />
            </div>

            <div style={{ marginBottom: '25px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 500 }}>Libellé / Note</label>
              <input
                type="text"
                value={formData.label}
                onChange={e => setFormData({ ...formData, label: e.target.value })}
                className="large-input"
                style={{ width: '100%' }}
                placeholder="Ex: Vente comptoir, Achat ciment, etc."
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="secondary-btn w-100" onClick={() => setShowModal(false)} disabled={isSaving}>Annuler</button>
              <button
                className="primary-btn w-100"
                onClick={handleSave}
                disabled={isSaving}
                style={{ backgroundColor: modalType === 'RECETTE' ? '#10b981' : '#ef4444', borderColor: modalType === 'RECETTE' ? '#10b981' : '#ef4444', color: 'white' }}
              >
                {isSaving ? 'Enregistrement...' : 'Valider'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};




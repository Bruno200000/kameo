// require('dotenv').config(); // Supprimé pour Vercel - variables injectées automatiquement
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');

const app = express();

// Configuration de Multer pour le stockage en mémoire (Vercel n'a pas d'accès disque persistent)
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Limite de 5MB
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Seules les images (jpeg, jpg, png, webp) sont autorisées"));
  }
});

// Utilisation directe de l'API REST de Supabase avec Fetch natif de Node.js
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';

const supabaseHeaders = {
  apikey: supabaseKey,
  Authorization: `Bearer ${supabaseKey}`,
  'Content-Type': 'application/json'
};

const supabaseFetch = async (path, options = {}) => {
  const url = `${supabaseUrl}/rest/v1/${path}`;
  try {
    const response = await fetch(url, {
      ...options,
      headers: { ...supabaseHeaders, ...(options.headers || {}) }
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Erreur Supabase sur ${path}: ${response.status}`, errorText);
      throw new Error(`Erreur HTTP: ${response.status} - ${errorText}`);
    }
    if (response.status === 204) return null;
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  } catch (err) {
    console.error(`ECHEC FETCH sur ${url}:`, err.message);
    throw err;
  }
};

const getOrCreateCompanyId = async () => {
  const companies = await supabaseFetch('companies?select=id&limit=1');
  if (companies && companies.length > 0) return companies[0].id;

  const newCompany = await supabaseFetch('companies', {
    method: 'POST',
    headers: { 'Prefer': 'return=representation' },
    body: JSON.stringify({
      name: "Ma Quincaillerie Démo",
      email: "contact@quincaillerie.demo"
    })
  });
  if (newCompany && newCompany.length > 0) return newCompany[0].id;
  throw new Error("Impossible de configurer l'entreprise.");
};

app.use(cors());
app.use(express.json());

// --- ROUTES DE L'API REST ---

app.get('/', (req, res) => {
  res.json({ message: "Bienvenue sur l'API KAméo SaaS connectée à Supabase via requêtes natives" });
});

// Déconnexion
app.post('/api/auth/logout', (req, res) => {
  res.json({ success: true });
});

// Changement de mot de passe
app.patch('/api/auth/password', async (req, res) => {
  try {
    const { currentPassword, newPassword, userId } = req.body;
    if (!newPassword) return res.status(400).json({ error: 'Nouveau mot de passe requis' });

    if (userId) {
      const user = await supabaseFetch(`users?id=eq.${userId}&password_hash=eq.${currentPassword}&select=id`);
      if (!user || user.length === 0) {
        return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
      }
      await supabaseFetch(`users?id=eq.${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ password_hash: newPassword })
      });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur changement mot de passe' });
  }
});

// Authentification (Login)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email et mot de passe requis" });

    const users = await supabaseFetch(`users?email=eq.${email}&password_hash=eq.${password}&select=*,companies(name)&limit=1`);

    if (users && users.length > 0) {
      res.json({ success: true, user: users[0] });
    } else {
      res.status(401).json({ error: "Identifiants incorrects" });
    }
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur lors de la connexion" });
  }
});

// Récupérer les infos de l'utilisateur actuel
app.get('/api/auth/me', async (req, res) => {
  try {
    const users = await supabaseFetch('users?select=*,companies(name)&limit=1');
    if (users && users.length > 0) {
      res.json(users[0]);
    } else {
      res.status(404).json({ error: "Utilisateur non trouvé" });
    }
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Récupérer les réglages de la plateforme
app.get('/api/admin/config', async (req, res) => {
  try {
    const config = await supabaseFetch('platform_settings?select=key,value');
    const settings = {};
    if (config) config.forEach(c => settings[c.key] = c.value);
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: "Erreur config" });
  }
});

// Modifier les réglages de la plateforme
app.patch('/api/admin/config', async (req, res) => {
  try {
    const updates = req.body;
    for (const key in updates) {
      await supabaseFetch(`platform_settings?key=eq.${key}`, {
        method: 'PATCH',
        body: JSON.stringify({ value: updates[key].toString() })
      });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erreur mise à jour config" });
  }
});

// Dashboard Stats
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const salesData = await supabaseFetch('sales?select=total_amount,sale_date&status=eq.paid');
    const productsData = await supabaseFetch('products?select=quantity,selling_price,alert_threshold');
    const customersData = await supabaseFetch('customers?select=id');

    let sales_total = 0;
    const salesByDay = {};

    if (salesData && Array.isArray(salesData)) {
      salesData.forEach(s => {
        const amount = Number(s.total_amount || 0);
        sales_total += amount;
        const day = new Date(s.sale_date).toISOString().split('T')[0];
        salesByDay[day] = (salesByDay[day] || 0) + amount;
      });
    }

    const historical_sales = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('fr-FR', { weekday: 'short' });
      historical_sales.push({ label, amount: salesByDay[dateStr] || 0 });
    }

    let stock_value = 0;
    let low_stock_items = 0;
    if (productsData && Array.isArray(productsData)) {
      productsData.forEach(p => {
        stock_value += (p.quantity * Number(p.selling_price || 0));
        if (p.quantity <= p.alert_threshold) low_stock_items++;
      });
    }

    res.json({
      sales_today: sales_total || 0,
      sales_change: "+12.5%",
      stock_value: stock_value || 0,
      low_stock_items: low_stock_items || 0,
      active_customers: (customersData && customersData.length) || 0,
      historical_sales
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Finance Summary
app.get('/api/finance/summary', async (req, res) => {
  try {
    const sales = await supabaseFetch('sales?select=total_amount,sale_date,status&order=sale_date.desc') || [];
    const purchases = await supabaseFetch('purchases?select=total_amount,purchase_date,status&order=purchase_date.desc') || [];

    const totalRecettes = sales.filter(s => s.status === 'paid').reduce((sum, s) => sum + Number(s.total_amount), 0);
    const totalDepenses = purchases.reduce((sum, p) => sum + Number(p.total_amount), 0);

    const history = [
      ...sales.map(s => ({ id: s.id, type: 'RECETTE', amount: s.total_amount, date: s.sale_date, label: 'Vente' })),
      ...purchases.map(p => ({ id: p.id, type: 'DEPENSE', amount: p.total_amount, date: p.purchase_date, label: 'Achat' }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({
      totalRecettes,
      totalDepenses,
      balance: totalRecettes - totalDepenses,
      history: history.slice(0, 20)
    });
  } catch (err) {
    res.status(500).json({ error: "Erreur API finance" });
  }
});

// Produits
app.get('/api/products', async (req, res) => {
  try {
    const data = await supabaseFetch('products?select=*&order=created_at.desc');
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur interne" });
  }
});

// Ajouter un nouveau produit
app.post('/api/products', async (req, res) => {
  try {
    const { name, reference, category, purchase_price, selling_price, quantity, image_url } = req.body;
    const companyId = await getOrCreateCompanyId();

    const newProduct = {
      company_id: companyId,
      name, reference,
      category: category || 'Général',
      purchase_price: Number(purchase_price) || 0,
      selling_price: Number(selling_price) || 0,
      quantity: Number(quantity) || 0,
      image_url: image_url || null,
      alert_threshold: 5
    };

    const prodRes = await supabaseFetch('products', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(newProduct)
    });

    res.status(201).json(prodRes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur création produit" });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Export pour Vercel Serverless
module.exports = app;


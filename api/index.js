const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');

const app = express();
const router = express.Router();

// Configuration de Multer pour le stockage en mémoire
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

// Utilisation directe de l'API REST de Supabase
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

// --- ROUTES DU ROUTER (Serviront sous /api et /) ---

router.get('/', (req, res) => {
  res.json({ message: "Bienvenue sur l'API KAméo SaaS connectée à Supabase" });
});

router.post('/auth/logout', (req, res) => {
  res.json({ success: true });
});

router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email et mot de passe requis" });

    const users = await supabaseFetch(`users?email=eq.${encodeURIComponent(email)}&password_hash=eq.${encodeURIComponent(password)}&select=*,companies(name)&limit=1`);
    
    if (users && users.length > 0) {
      res.json({ success: true, user: users[0] });
    } else {
      res.status(401).json({ error: "Identifiants incorrects" });
    }
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get('/auth/me', async (req, res) => {
  try {
    const users = await supabaseFetch('users?select=*,companies(name)&limit=1');
    if (users && users.length > 0) res.json(users[0]);
    else res.status(404).json({ error: "Non trouvé" });
  } catch (err) { res.status(500).json({ error: "Erreur" }); }
});

router.get('/settings', async (req, res) => {
  try {
    const data = await supabaseFetch('companies?select=*&limit=1');
    if (!data || data.length === 0) {
      const companyId = await getOrCreateCompanyId();
      const newData = await supabaseFetch(`companies?id=eq.${companyId}&select=*`);
      return res.json(newData[0]);
    }
    res.json(data[0]);
  } catch (err) { res.status(500).json({ error: "Erreur" }); }
});

router.get('/dashboard/stats', async (req, res) => {
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

    res.json({ sales_today: sales_total, sales_change: "+12.5%", stock_value, low_stock_items, active_customers: customersData.length, historical_sales });
  } catch (err) { res.status(500).json({ error: "Erreur" }); }
});

router.get('/products', async (req, res) => {
  try {
    const data = await supabaseFetch('products?select=*&order=created_at.desc');
    res.json(data || []);
  } catch (err) { res.status(500).json({ error: "Erreur" }); }
});

router.post('/sales', async (req, res) => {
  try {
    const { cart, totalAmount, paidAmount, remainingAmount, status, customerId } = req.body;
    const companyId = await getOrCreateCompanyId();
    const saleRes = await supabaseFetch('sales', { 
      method: 'POST', 
      headers: { 'Prefer': 'return=representation' }, 
      body: JSON.stringify({ company_id: companyId, total_amount: totalAmount, paid_amount: paidAmount, remaining_amount: remainingAmount, status, customer_id: customerId })
    });
    if (saleRes && saleRes.length > 0) res.json({ success: true, sale_id: saleRes[0].id });
    else res.status(500).json({ error: "Erreur" });
  } catch (err) { res.status(500).json({ error: "Erreur" }); }
});

router.get('/contacts', async (req, res) => {
  try {
    const customers = await supabaseFetch('customers?select=*&order=created_at.desc');
    const suppliers = await supabaseFetch('suppliers?select=*&order=created_at.desc');
    res.json({ customers: customers || [], suppliers: suppliers || [] });
  } catch (err) { res.status(500).json({ error: "Erreur" }); }
});

router.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

router.get('/status', (req, res) => {
  res.json({ 
    status: 'Alive', 
    env: process.env.NODE_ENV,
    routes: ['/auth/login', '/settings', '/health', '/status']
  });
});

// Admin config
router.get('/admin/config', async (req, res) => {
  try {
    const config = await supabaseFetch('platform_settings?select=key,value');
    const settings = {};
    if (config) config.forEach(c => settings[c.key] = c.value);
    res.json(settings);
  } catch (err) { res.status(500).json({ error: "Erreur" }); }
});

// Appliquer le router
app.use('/api', router);  // Pour le routage via Vercel (URL complète /api/...)
app.use('/', router);     // Pour le routage interne ou direct (URL /...)

module.exports = app;

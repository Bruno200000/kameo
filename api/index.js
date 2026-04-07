const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');

const app = express();
const router = express.Router();

// Configuration de Multer pour le stockage en mémoire (Vercel)
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // Limite de 5MB
});

// Utilisation directe de l'API REST de Supabase avec Fetch
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';

// Ajout explicite de UTF-8 pour éviter les caractères illisibles
const supabaseHeaders = {
  apikey: supabaseKey,
  Authorization: `Bearer ${supabaseKey}`,
  'Content-Type': 'application/json; charset=utf-8'
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

// --- ROUTES DU ROUTER ---

router.get('/', (req, res) => {
  res.json({ message: "API KAméo SaaS Opérationnelle (Vercel + Supabase Storage)" });
});

// Auth
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
  } catch (err) { res.status(500).json({ error: "Erreur serveur" }); }
});

router.patch('/auth/password', async (req, res) => {
  try {
    const { currentPassword, newPassword, userId } = req.body;
    if (userId) {
      const user = await supabaseFetch(`users?id=eq.${userId}&password_hash=eq.${encodeURIComponent(currentPassword)}&select=id`);
      if (!user || user.length === 0) return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
      await supabaseFetch(`users?id=eq.${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ password_hash: newPassword })
      });
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Erreur changement' }); }
});

router.get('/settings', async (req, res) => {
  try {
    const data = await supabaseFetch('companies?select=*&limit=1');
    res.json(data && data.length > 0 ? data[0] : {});
  } catch (err) { res.status(500).json({ error: "Erreur" }); }
});

router.get('/dashboard/stats', async (req, res) => {
  try {
    const salesData = await supabaseFetch('sales?select=total_amount,sale_date&status=eq.paid');
    const productsData = await supabaseFetch('products?select=quantity,selling_price,alert_threshold');
    const customersData = await supabaseFetch('customers?select=id');

    let sales_total = 0;
    const salesByDay = {};
    if (salesData) salesData.forEach(s => {
      const amount = Number(s.total_amount || 0);
      sales_total += amount;
      const day = new Date(s.sale_date).toISOString().split('T')[0];
      salesByDay[day] = (salesByDay[day] || 0) + amount;
    });

    const historical_sales = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      historical_sales.push({ label: d.toLocaleDateString('fr-FR', { weekday: 'short' }), amount: salesByDay[dateStr] || 0 });
    }

    let stock_value = 0;
    let low_stock_items = 0;
    if (productsData) productsData.forEach(p => {
      stock_value += (p.quantity * Number(p.selling_price || 0));
      if (p.quantity <= p.alert_threshold) low_stock_items++;
    });

    res.json({ sales_today: sales_total, stock_value, low_stock_items, active_customers: (customersData ? customersData.length : 0), historical_sales });
  } catch (err) { res.status(500).json({ error: "Erreur" }); }
});

router.get('/products', async (req, res) => {
  try {
    const data = await supabaseFetch('products?select=*&order=created_at.desc');
    res.json(data || []);
  } catch (err) { res.status(500).json({ error: "Erreur" }); }
});

router.post('/products', async (req, res) => {
  try {
    const companyId = await getOrCreateCompanyId();
    const prodRes = await supabaseFetch('products', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify({ ...req.body, company_id: companyId, alert_threshold: 5 })
    });
    if (prodRes && prodRes.length > 0) res.json({ success: true, product: prodRes[0] });
    else res.status(500).json({ error: "Echec insertion" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Aucun fichier" });

    const fileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(req.file.originalname)}`;
    const bucketName = 'images';
    const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucketName}/${fileName}`;

    // Upload vers Supabase Storage
    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': req.file.mimetype,
        'upsert': 'true'
      },
      body: req.file.buffer
    });

    if (!uploadResponse.ok) {
      const errText = await uploadResponse.text();
      throw new Error(`Upload fail: ${uploadResponse.status} - ${errText}`);
    }

    // URL Publique de l'image
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucketName}/${fileName}`;
    res.json({ success: true, imageUrl: publicUrl });
  } catch (err) {
    console.error("Erreur Upload:", err.message);
    res.status(500).json({ error: "Erreur téléversement vers Supabase Storage" });
  }
});

router.get('/sales', async (req, res) => {
  try {
    const data = await supabaseFetch('sales?select=*&order=sale_date.desc');
    res.json(data || []);
  } catch (err) { res.status(500).json({ error: "Erreur" }); }
});

router.post('/sales', async (req, res) => {
  try {
    const companyId = await getOrCreateCompanyId();
    const saleRes = await supabaseFetch('sales', { 
      method: 'POST', 
      headers: { 'Prefer': 'return=representation' }, 
      body: JSON.stringify({ ...req.body, company_id: companyId })
    });
    if (saleRes && saleRes.length > 0) res.json({ success: true, sale_id: saleRes[0].id });
    else res.status(500).json({ error: "Echec insertion" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/contacts', async (req, res) => {
  try {
    const customers = await supabaseFetch('customers?select=*&order=created_at.desc');
    const suppliers = await supabaseFetch('suppliers?select=*&order=created_at.desc');
    res.json({ customers: customers || [], suppliers: suppliers || [] });
  } catch (err) { res.status(500).json({ error: "Erreur" }); }
});

router.get('/status', (req, res) => {
  res.json({ status: 'Online', storage: 'Supabase enabled', utf8: 'Active' });
});

app.use('/api', router);
app.use('/', router);

module.exports = app;

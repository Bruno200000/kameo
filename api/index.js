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

// --- ROUTES DE L'API REST (Sans préfixe /api car monté sur /api dans Vercel) ---

app.get('/', (req, res) => {
  res.json({ message: "Bienvenue sur l'API KAméo SaaS connectée à Supabase" });
});

// Authentification
app.post('/auth/logout', (req, res) => {
  res.json({ success: true });
});

app.post('/auth/login', async (req, res) => {
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
    res.status(500).json({ error: "Erreur serveur lors de la connexion" });
  }
});

app.get('/auth/me', async (req, res) => {
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

app.patch('/auth/password', async (req, res) => {
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

// Administration & Config
app.get('/admin/config', async (req, res) => {
  try {
    const config = await supabaseFetch('platform_settings?select=key,value');
    const settings = {};
    if (config) config.forEach(c => settings[c.key] = c.value);
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: "Erreur config" });
  }
});

app.patch('/admin/config', async (req, res) => {
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

// Dashboard & Finance
app.get('/dashboard/stats', async (req, res) => {
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
    res.status(500).json({ error: "Erreur serveur" });
  }
});

app.get('/finance/summary', async (req, res) => {
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
app.get('/products', async (req, res) => {
  try {
    const data = await supabaseFetch('products?select=*&order=created_at.desc');
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur interne" });
  }
});

app.post('/products', async (req, res) => {
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

    res.json({ success: true, product: (prodRes && prodRes[0]) || null });
  } catch (err) {
    res.status(500).json({ error: "Erreur ajout produit" });
  }
});

app.patch('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    const updated = await supabaseFetch(`products?id=eq.${id}`, {
      method: 'PATCH',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(updateData)
    });
    res.json({ success: true, product: (updated && updated[0]) || null });
  } catch (err) {
    res.status(500).json({ error: "Erreur modification produit" });
  }
});

app.delete('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await supabaseFetch(`products?id=eq.${id}`, { method: 'DELETE' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erreur suppression produit" });
  }
});

// Ventes
app.get('/sales', async (req, res) => {
  try {
    const data = await supabaseFetch('sales?select=*&order=sale_date.desc');
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: "Erreur récupération ventes" });
  }
});

app.post('/sales', async (req, res) => {
  try {
    const { cart, totalAmount, paidAmount, remainingAmount, status, customerId } = req.body;
    const companyId = await getOrCreateCompanyId();

    const saleData = {
      company_id: companyId,
      total_amount: Number(totalAmount) || 0,
      paid_amount: Number(paidAmount) || 0,
      remaining_amount: Number(remainingAmount) || 0,
      status: status || 'paid',
      customer_id: customerId || null
    };

    const saleRes = await supabaseFetch('sales', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(saleData)
    });
    
    if (!saleRes || saleRes.length === 0) throw new Error("Echec insertion vente");
    const saleId = saleRes[0].id;

    if (cart && cart.length > 0) {
      const saleItems = cart.map(item => ({
        sale_id: saleId,
        product_id: item.id,
        quantity: item.cartQuantity,
        unit_price: item.selling_price,
        total: item.cartQuantity * item.selling_price
      }));
      await supabaseFetch('sale_items', { method: 'POST', body: JSON.stringify(saleItems) });

      for (const item of cart) {
        const prodData = await supabaseFetch(`products?id=eq.${item.id}&select=quantity`);
        const currentQty = (prodData && prodData[0]) ? prodData[0].quantity : 0;
        await supabaseFetch(`products?id=eq.${item.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ quantity: currentQty - item.cartQuantity })
        });
        await supabaseFetch('stock_movements', {
          method: 'POST',
          body: JSON.stringify({
            company_id: companyId,
            product_id: item.id,
            movement_type: 'OUT',
            quantity: -item.cartQuantity,
            reason: `Vente #${saleId.split('-')[0]}`
          })
        });
      }
    }
    res.json({ success: true, sale_id: saleId });
  } catch (err) {
    res.status(500).json({ error: "Erreur enregistrement vente" });
  }
});

// Achats
app.get('/purchases', async (req, res) => {
  try {
    const data = await supabaseFetch('purchases?select=*&order=purchase_date.desc');
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: "Erreur récupération achats" });
  }
});

app.post('/purchases', async (req, res) => {
  try {
    const { totalAmount, reference, supplierName, status } = req.body;
    const companyId = await getOrCreateCompanyId();
    const newPurchase = {
      company_id: companyId,
      supplier_name: supplierName || null,
      reference: reference || null,
      total_amount: Number(totalAmount) || 0,
      status: status || 'pending'
    };
    const purRes = await supabaseFetch('purchases', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(newPurchase)
    });
    res.json({ success: true, purchase: (purRes && purRes[0]) || null });
  } catch (err) {
    res.status(500).json({ error: "Erreur ajout achat" });
  }
});

// Stock
app.get('/stock', async (req, res) => {
  try {
    const data = await supabaseFetch('stock_movements?select=*,products:product_id(name,quantity)&order=movement_date.desc');
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: "Erreur récupération stock" });
  }
});

app.post('/stock', async (req, res) => {
  try {
    const { product_id, movement_type, quantity, reason } = req.body;
    const companyId = await getOrCreateCompanyId();
    const moveRes = await supabaseFetch('stock_movements', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify({ company_id: companyId, product_id, movement_type, quantity, reason })
    });
    const prod = await supabaseFetch(`products?id=eq.${product_id}&select=quantity`);
    if (prod && prod.length > 0) {
      let newQty = Number(prod[0].quantity) || 0;
      newQty = (movement_type === 'IN') ? newQty + Number(quantity) : newQty - Number(quantity);
      await supabaseFetch(`products?id=eq.${product_id}`, { method: 'PATCH', body: JSON.stringify({ quantity: Math.max(0, newQty) }) });
    }
    res.json({ success: true, movement: (moveRes && moveRes[0]) || null });
  } catch (err) {
    res.status(500).json({ error: "Erreur mouvement stock" });
  }
});

// Contacts
app.get('/contacts', async (req, res) => {
  try {
    const customers = await supabaseFetch('customers?select=*&order=created_at.desc');
    const suppliers = await supabaseFetch('suppliers?select=*&order=created_at.desc');
    res.json({ customers: customers || [], suppliers: suppliers || [] });
  } catch (err) {
    res.status(500).json({ error: "Erreur récupération contacts" });
  }
});

app.post('/contacts', async (req, res) => {
  try {
    const { type, name, contact_info, current_debt } = req.body;
    const companyId = await getOrCreateCompanyId();
    const table = type === 'fournisseur' ? 'suppliers' : 'customers';
    const cRes = await supabaseFetch(table, {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify({ company_id: companyId, name, contact_info, current_debt: Number(current_debt) || 0 })
    });
    res.json({ success: true, contact: (cRes && cRes[0]) || null });
  } catch (err) {
    res.status(500).json({ error: "Erreur ajout contact" });
  }
});

// Paramètres Entreprise
app.get('/settings', async (req, res) => {
  try {
    const data = await supabaseFetch('companies?select=*&limit=1');
    if (!data || data.length === 0) {
      const companyId = await getOrCreateCompanyId();
      const newData = await supabaseFetch(`companies?id=eq.${companyId}&select=*`);
      return res.json(newData[0]);
    }
    res.json(data[0]);
  } catch (err) {
    res.status(500).json({ error: "Erreur récupération paramètres" });
  }
});

app.post('/settings', async (req, res) => {
  try {
    const companyId = await getOrCreateCompanyId();
    await supabaseFetch(`companies?id=eq.${companyId}`, {
      method: 'PATCH',
      body: JSON.stringify(req.body)
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erreur mise à jour paramètres" });
  }
});

// Admin Plateforme
app.get('/admin/companies', async (req, res) => {
  try {
    const data = await supabaseFetch('companies?select=*&order=created_at.desc');
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: "Erreur récupération entreprises" });
  }
});

app.post('/admin/companies', async (req, res) => {
  try {
    const { name, email, phone, address, plan_id, password } = req.body;
    const companyData = await supabaseFetch('companies', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify({ name, email, phone, address, plan_id: plan_id || 'trial', subscription_status: 'active' })
    });
    if (!companyData || companyData.length === 0) throw new Error("Echec création entreprise");
    await supabaseFetch('users', {
      method: 'POST',
      body: JSON.stringify({ company_id: companyData[0].id, first_name: 'Admin', last_name: name, email, password_hash: password || '123456', role: 'admin' })
    });
    res.json({ success: true, company: companyData[0] });
  } catch (err) {
    res.status(500).json({ error: "Erreur création entreprise" });
  }
});

app.get('/admin/users', async (req, res) => {
  try {
    const data = await supabaseFetch('users?select=*,companies:company_id(name)');
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: "Erreur récupération utilisateurs" });
  }
});

app.post('/admin/users', async (req, res) => {
  try {
    const userRes = await supabaseFetch('users', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify({ ...req.body, role: req.body.role || 'admin', password_hash: req.body.password })
    });
    res.json({ success: true, user: (userRes && userRes[0]) || null });
  } catch (err) {
    res.status(500).json({ error: "Erreur création utilisateur" });
  }
});

app.delete('/admin/users/:id', async (req, res) => {
  try {
    await supabaseFetch(`users?id=eq.${req.params.id}`, { method: 'DELETE' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erreur suppression utilisateur" });
  }
});

app.patch('/admin/users/:id', async (req, res) => {
  try {
    await supabaseFetch(`users?id=eq.${req.params.id}`, { method: 'PATCH', body: JSON.stringify(req.body) });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erreur modification utilisateur" });
  }
});

app.get('/admin/stats', async (req, res) => {
  try {
    const companies = await supabaseFetch('companies?select=plan_id,created_at') || [];
    const users = await supabaseFetch('users?select=id') || [];
    const products = await supabaseFetch('products?select=id') || [];
    res.json({ total_companies: companies.length, total_users: users.length, total_products: products.length });
  } catch (err) {
    res.status(500).json({ error: "Erreur statistiques" });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Upload (Memory storage simulation for Vercel)
app.post('/upload', upload.single('image'), (req, res) => {
  res.status(501).json({ error: "Le téléversement local n'est pas supporté sur Vercel. Utilisez un service comme Cloudinary." });
});

module.exports = app;

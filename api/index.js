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

const supabaseFetch = async (path, options = {}, req = null) => {
  let url = `${supabaseUrl}/rest/v1/${path}`;
  
  const companyId = req?.headers?.['x-company-id'];
  let filterCompanyId = companyId;
  
  if (req?.headers?.['x-user-data']) {
     try {
       const u = JSON.parse(req.headers['x-user-data']);
       if (u.role !== 'superadmin' && !filterCompanyId) {
         filterCompanyId = u.company_id || 'UNAUTHORIZED';
       }
     } catch(e) {}
  }

  const isExcluded = path.includes('sale_items') || path.includes('purchase_items') || path.includes('companies') || path.includes('platform_settings');
  const isUserPath = path.includes('users');

  if (filterCompanyId && !isExcluded && !isUserPath) {
    const separator = path.includes('?') ? '&' : '?';
    url += `${separator}company_id=eq.${filterCompanyId}`;
  }

  let finalBody = options.body;
  if ((options.method === 'POST' || options.method === 'PATCH') && companyId && options.body && !isExcluded) {
    try {
      const parsedBody = JSON.parse(options.body);
      if (Array.isArray(parsedBody)) {
        finalBody = JSON.stringify(parsedBody.map(item => ({ ...item, company_id: companyId })));
      } else if (typeof parsedBody === 'object' && parsedBody !== null) {
        finalBody = JSON.stringify({ ...parsedBody, company_id: companyId });
      }
    } catch (e) {
      // Ignorer si pas JSON
    }
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers: { 
        ...supabaseHeaders, 
        ...(options.headers || {}),
        // Pour les POST/PATCH, on s'assure d'inclure le company_id si on l'a
        ...((options.method === 'POST' || options.method === 'PATCH') && companyId ? { 'Prefer': 'return=representation' } : {})
      },
      body: finalBody
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

app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Company-Id', 'X-User-Data']
}));
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

// Réglages Entreprise
router.get('/settings', async (req, res) => {
  try {
    const data = await supabaseFetch('companies?select=*&limit=1', {}, req);
    res.json(data && data.length > 0 ? data[0] : {});
  } catch (err) { res.status(500).json({ error: "Erreur" }); }
});

router.post('/settings', async (req, res) => {
  try {
    const companyId = req.headers['x-company-id'];
    await supabaseFetch(`companies?id=eq.${companyId}`, {
      method: 'PATCH',
      body: JSON.stringify(req.body)
    }, req);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Erreur mise à jour" }); }
});

// Dashboard
router.get('/dashboard/stats', async (req, res) => {
  try {
    const salesData = await supabaseFetch('sales?select=total_amount,sale_date&status=eq.paid', {}, req);
    const productsData = await supabaseFetch('products?select=quantity,selling_price,alert_threshold', {}, req);
    const customersData = await supabaseFetch('customers?select=id', {}, req);

    let sales_today = 0;
    let sales_month = 0;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const salesByDay = {};

    if (salesData) salesData.forEach(s => {
      const amount = Number(s.total_amount || 0);
      const d = new Date(s.sale_date);
      const day = d.toISOString().split('T')[0];
      
      if (day === todayStr) sales_today += amount;
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) sales_month += amount;
      
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

    res.json({ sales_today, sales_month, stock_value, low_stock_items, active_customers: (customersData ? customersData.length : 0), historical_sales });
  } catch (err) { res.status(500).json({ error: "Erreur" }); }
});

// Finance
router.get('/finance/summary', async (req, res) => {
  try {
    const sales = await supabaseFetch('sales?select=total_amount,sale_date,status&order=sale_date.desc', {}, req) || [];
    const purchases = await supabaseFetch('purchases?select=total_amount,purchase_date,status&order=purchase_date.desc', {}, req) || [];
    const totalRecettes = sales.filter(s => s.status === 'paid').reduce((sum, s) => sum + Number(s.total_amount), 0);
    const totalDepenses = purchases.reduce((sum, p) => sum + Number(p.total_amount), 0);
    const history = [
      ...sales.map(s => ({ id: s.id, type: 'RECETTE', amount: s.total_amount, date: s.sale_date, label: 'Vente' })),
      ...purchases.map(p => ({ id: p.id, type: 'DEPENSE', amount: p.total_amount, date: p.purchase_date, label: 'Achat' }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json({ totalRecettes, totalDepenses, balance: totalRecettes - totalDepenses, history: history.slice(0, 20) });
  } catch (err) { res.status(500).json({ error: "Erreur finance" }); }
});

// Produits
router.get('/products', async (req, res) => {
  try {
    const data = await supabaseFetch('products?select=*&order=created_at.desc', {}, req);
    res.json(data || []);
  } catch (err) { res.status(500).json({ error: "Erreur" }); }
});

router.post('/products', async (req, res) => {
  try {
    const prodRes = await supabaseFetch('products', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify({ ...req.body, alert_threshold: 5 })
    }, req);
    if (prodRes && prodRes.length > 0) res.json({ success: true, product: prodRes[0] });
    else res.status(500).json({ error: "Echec insertion" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/products/:id', async (req, res) => {
  try {
    const updated = await supabaseFetch(`products?id=eq.${req.params.id}`, {
      method: 'PATCH',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(req.body)
    }, req);
    if (updated && updated.length > 0) res.json({ success: true, product: updated[0] });
    else res.status(404).json({ error: "Produit non trouvé" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/products/:id', async (req, res) => {
  try {
    await supabaseFetch(`products?id=eq.${req.params.id}`, { method: 'DELETE' }, req);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Upload
router.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Aucun fichier" });
    
    if (!supabaseUrl || !supabaseKey) {
      console.error("ERREUR CRITIQUE: Configuration Supabase manquante");
      return res.status(500).json({ error: "Configuration serveur incomplète (Supabase URL/Key manquante)" });
    }

    const fileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(req.file.originalname)}`;
    const bucketName = 'images';
    const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucketName}/${fileName}`;
    
    console.log(`Tentative d'upload vers Supabase: ${uploadUrl}`);
    
    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': req.file.mimetype, 'upsert': 'true' },
      body: req.file.buffer
    });
    
    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.text();
      console.error(`Echec upload Supabase (Status: ${uploadResponse.status}):`, errorData);
      throw new Error(`Supabase Storage error: ${uploadResponse.status} - ${errorData}`);
    }
    
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucketName}/${fileName}`;
    res.json({ success: true, imageUrl: publicUrl });
  } catch (err) { 
    console.error("Détail erreur upload:", err);
    res.status(500).json({ error: "Erreur upload: " + err.message }); 
  }
});

// Ventes
router.get('/sales', async (req, res) => {
  try {
    const data = await supabaseFetch('sales?select=*,customers(name),sale_items(product_id,quantity,unit_price,products(name,image_url))&order=sale_date.desc', {}, req);
    res.json(data || []);
  } catch (err) { res.status(500).json({ error: "Erreur" }); }
});

router.post('/sales', async (req, res) => {
  try {
    const user = JSON.parse(req.headers['x-user-data'] || '{}');
    const companyId = req.headers['x-company-id'] || user.company_id;
    const { cart, customerId, totalAmount, paidAmount, remainingAmount, paymentMode, status, ...otherData } = req.body;
    
    // Créer la vente sans le cart, avec mapping camelCase -> snake_case
    const saleToCreate = {
      ...otherData,
      company_id: companyId || null,
      customer_id: customerId || null,
      total_amount: totalAmount,
      paid_amount: paidAmount,
      remaining_amount: remainingAmount,
      payment_mode: paymentMode,
      status: status,
      created_by: user.id || null
    };
    
    const saleRes = await supabaseFetch('sales', { 
      method: 'POST', 
      headers: { 'Prefer': 'return=representation' }, 
      body: JSON.stringify(saleToCreate)
    }, req);
    
    if (saleRes && saleRes.length > 0) {
      const saleId = saleRes[0].id;
      
      // Créer les sale_items si cart est présent
      if (cart && Array.isArray(cart) && cart.length > 0) {
        const saleItems = cart.map(item => ({
          sale_id: saleId,
          product_id: item.id,
          quantity: item.cartQuantity || 1,
          unit_price: item.selling_price || item.price,
          total: (item.cartQuantity || 1) * (item.selling_price || item.price)
        }));
        
        // Créer tous les sale_items en une requête
        await supabaseFetch('sale_items', {
          method: 'POST',
          headers: { 'Prefer': 'return=minimal' },
          body: JSON.stringify(saleItems)
        }, req);
      }
      
      res.json({ success: true, sale_id: saleId });
    } else {
      res.status(500).json({ error: "Echec insertion" });
    }
  } catch (err) { 
    console.error("Erreur création vente:", err);
    res.status(500).json({ error: err.message }); 
  }
});

router.post('/sales/:id/payment', async (req, res) => {
  try {
    const { paymentAmount, newStatus } = req.body;
    const existing = await supabaseFetch(`sales?id=eq.${req.params.id}&select=paid_amount,total_amount`, {}, req);
    if (!existing || existing.length === 0) return res.status(404).json({ error: 'Vente non trouvée' });
    
    const newPaid = Number(existing[0].paid_amount) + Number(paymentAmount);
    const updated = await supabaseFetch(`sales?id=eq.${req.params.id}`, {
      method: 'PATCH',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify({ paid_amount: newPaid, status: newStatus || (newPaid >= existing[0].total_amount ? 'paid' : 'partial') })
    }, req);
    res.json({ success: true, sale: updated[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Achats
router.get('/purchases', async (req, res) => {
  try {
    const data = await supabaseFetch('purchases?select=*,suppliers(name),purchase_items(quantity,unit_price,products(name))&order=purchase_date.desc', {}, req);
    res.json(data || []);
  } catch (err) { res.status(500).json({ error: "Erreur" }); }
});

router.post('/purchases', async (req, res) => {
  try {
    const { totalAmount, reference, supplierName, status, supplierId, productId, quantity } = req.body;
    const user = JSON.parse(req.headers['x-user-data'] || '{}');
    const companyId = req.headers['x-company-id'] || user.company_id;

    const newPurchase = {
      company_id: companyId,
      supplier_id: supplierId || null,
      supplier_name: supplierName || null,
      reference: reference || null,
      total_amount: Number(totalAmount) || 0,
      status: status || 'pending',
      created_by: user.id || null
    };

    const purRes = await supabaseFetch('purchases', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(newPurchase)
    }, req);

    if (!purRes || purRes.length === 0) return res.status(500).json({ error: "Echec insertion achat" });
    const purchaseId = purRes[0].id;

    if (productId && quantity) {
      const qty = Number(quantity);
      const unitPrice = qty > 0 ? (Number(totalAmount) / qty) : 0;

      await supabaseFetch('purchase_items', {
        method: 'POST',
        body: JSON.stringify({
          purchase_id: purchaseId,
          product_id: productId,
          quantity: qty,
          unit_price: unitPrice,
          total: Number(totalAmount)
        })
      }, req);

      if (status === 'received') {
        const prodData = await supabaseFetch(`products?id=eq.${productId}&select=quantity`, {}, req);
        const currentQty = (prodData && prodData[0]) ? prodData[0].quantity : 0;
        await supabaseFetch(`products?id=eq.${productId}`, { method: 'PATCH', body: JSON.stringify({ quantity: currentQty + qty }) }, req);

        await supabaseFetch('stock_movements', {
          method: 'POST',
          body: JSON.stringify({
            product_id: productId,
            movement_type: 'IN',
            quantity: qty,
            reason: `Achat #${purchaseId.split('-')[0]} (${reference || 'Sans ref'})`
          })
        }, req);
      }
    }
    res.json({ success: true, purchase: purRes[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/purchases/:id', async (req, res) => {
  try {
    const { totalAmount, reference, supplierName, status, supplierId, productId, quantity } = req.body;
    
    // Pour la modification, on construit un objet de mise à jour propre
    const updateData = {};
    if (totalAmount !== undefined) updateData.total_amount = Number(totalAmount);
    if (reference !== undefined) updateData.reference = reference;
    if (supplierName !== undefined) updateData.supplier_name = supplierName;
    if (status !== undefined) updateData.status = status;
    if (supplierId !== undefined) updateData.supplier_id = supplierId;

    const purRes = await supabaseFetch(`purchases?id=eq.${req.params.id}`, {
      method: 'PATCH',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(updateData)
    }, req);
    
    if (!purRes || purRes.length === 0) return res.status(404).json({ error: "Achat non trouvé" });
    res.json({ success: true, purchase: purRes[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Stocks
router.get('/stock', async (req, res) => {
  try {
    const data = await supabaseFetch('stock_movements?select=*,products:product_id(name,quantity)&order=movement_date.desc', {}, req);
    res.json(data || []);
  } catch (err) { res.status(500).json({ error: "Erreur" }); }
});

router.post('/stock', async (req, res) => {
  try {
    const moveRes = await supabaseFetch('stock_movements', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(req.body)
    }, req);
    
    // Mise à jour de la quantité produit associée
    const prod = await supabaseFetch(`products?id=eq.${req.body.product_id}&select=quantity`, {}, req);
    if (prod && prod.length > 0) {
      const newQty = req.body.movement_type === 'IN' ? prod[0].quantity + req.body.quantity : prod[0].quantity - req.body.quantity;
      await supabaseFetch(`products?id=eq.${req.body.product_id}`, { method: 'PATCH', body: JSON.stringify({ quantity: Math.max(0, newQty) }) }, req);
    }
    res.json({ success: true, movement: moveRes[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Contacts
router.get('/contacts', async (req, res) => {
  try {
    const customers = await supabaseFetch('customers?select=*&order=created_at.desc', {}, req);
    const suppliers = await supabaseFetch('suppliers?select=*&order=created_at.desc', {}, req);
    res.json({ customers: customers || [], suppliers: suppliers || [] });
  } catch (err) { res.status(500).json({ error: "Erreur" }); }
});

router.post('/contacts', async (req, res) => {
  try {
    const table = req.body.type === 'fournisseur' ? 'suppliers' : 'customers';
    const cRes = await supabaseFetch(table, {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(req.body)
    }, req);
    res.json({ success: true, contact: cRes[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Admin
router.get('/admin/config', async (req, res) => {
  try {
    const config = await supabaseFetch('platform_settings?select=key,value', {}, req);
    const settings = {};
    if (config) config.forEach(c => settings[c.key] = c.value);
    res.json(settings);
  } catch (err) { res.status(500).json({ error: "Erreur config" }); }
});

router.patch('/admin/config', async (req, res) => {
  try {
    for (const key in req.body) {
      await supabaseFetch(`platform_settings?key=eq.${key}`, { method: 'PATCH', body: JSON.stringify({ value: req.body[key].toString() }) }, req);
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Erreur MAJ config" }); }
});

router.get('/admin/companies', async (req, res) => {
  try {
    const data = await supabaseFetch('companies?select=*&order=created_at.desc', {}, req);
    res.json(data || []);
  } catch (err) { res.status(500).json({ error: "Erreur" }); }
});

router.post('/admin/companies', async (req, res) => {
  try {
    const { password, ...companyPayload } = req.body;
    const companyData = await supabaseFetch('companies', { method: 'POST', headers: { 'Prefer': 'return=representation' }, body: JSON.stringify(companyPayload) }, req);
    
    if (companyData && companyData.length > 0) {
      const newCompanyId = companyData[0].id;
      if (password) {
        const newAdmin = {
          first_name: 'Admin',
          last_name: companyData[0].name,
          email: companyData[0].email,
          password_hash: password,
          role: 'admin',
          company_id: newCompanyId
        };
        await supabaseFetch('users', { method: 'POST', body: JSON.stringify(newAdmin) }, req);
      }
      res.json({ success: true, company: companyData[0] });
    } else {
      res.status(500).json({ error: "Échec de création entreprise" });
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/admin/users', async (req, res) => {
  try {
    const data = await supabaseFetch('users?select=*,companies(name)&order=created_at.desc', {}, req);
    res.json(data || []);
  } catch (err) { res.status(500).json({ error: "Erreur" }); }
});

router.post('/admin/users', async (req, res) => {
  try {
    const { password, ...otherData } = req.body;
    const dbPayload = password ? { ...otherData, password_hash: password } : req.body;
    const userData = await supabaseFetch('users', { method: 'POST', headers: { 'Prefer': 'return=representation' }, body: JSON.stringify(dbPayload) }, req);
    res.json({ success: true, user: userData[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/admin/users/:id', async (req, res) => {
  try {
    const updated = await supabaseFetch(`users?id=eq.${req.params.id}`, { method: 'PATCH', headers: { 'Prefer': 'return=representation' }, body: JSON.stringify(req.body) }, req);
    res.json({ success: true, user: updated[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/admin/users/:id', async (req, res) => {
  try {
    await supabaseFetch(`users?id=eq.${req.params.id}`, { method: 'DELETE' }, req);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/admin/stats', async (req, res) => {
  try {
    const companies = await supabaseFetch('companies?select=id,plan_id,subscription_status', {}, req);
    const users = await supabaseFetch('users?select=id', {}, req);
    
    let activeSubscriptions = 0;
    let saasRevenue = 0;
    
    // Exemple de grille tarifaire mensuelle
    const PRICING = { pro: 15000, enterprise: 50000 };

    if (companies) {
      companies.forEach(c => {
         // Seules les entreprises validées et payantes génèrent du CA
         if (c.subscription_status === 'active' && c.plan_id && c.plan_id !== 'trial') {
            activeSubscriptions++;
            saasRevenue += (PRICING[c.plan_id] || 0);
         }
      });
    }

    res.json({ 
      totalCompanies: companies?.length || 0, 
      totalUsers: users?.length || 0, 
      activeSubscriptions,
      mrr: saasRevenue 
    });
  } catch (err) { res.status(500).json({ error: "Erreur stats" }); }
});

router.get('/status', (req, res) => {
  res.json({ status: 'Online', storage: 'Supabase enabled', version: '1.2.5-full' });
});

app.use('/api', router);
app.use('/', router);

module.exports = app;

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

const supabaseFetch = async (resourcePath, options = {}, req = null) => {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Configuration Supabase manquante (URL/KEY)");
  }
  let url = `${supabaseUrl}/rest/v1/${resourcePath}`;

  const rawCompanyId = req?.headers?.['x-company-id'];
  let userData = null;
  if (req?.headers?.['x-user-data']) {
    try { userData = JSON.parse(req.headers['x-user-data']); } catch (e) { }
  }

  // Déterminer l'ID de l'entreprise cible (Switcher uniquement pour Superadmin, sinon profil forcé)
  let effectiveCompanyId = (userData?.role === 'superadmin') 
    ? (rawCompanyId || null) 
    : (userData?.company_id || null);

  // Exclure les tables qui n'ont pas de colonne company_id
  // Déterminer la table de base pour savoir si on applique le filtre
  const baseTable = resourcePath.split(/[?\/]/)[0];
  const isExcluded = ['companies', 'platform_settings', 'sale_items', 'purchase_items', 'order_items', 'quote_items', 'delivery_note_items'].includes(baseTable);
  const isUserPath = baseTable === 'users';

  // Si Superadmin en vue globale, on peut accepter un company_id direct dans le body pour les créations
  if (!effectiveCompanyId && (options.method === 'POST' || options.method === 'PATCH') && !isExcluded) {
    try {
      const parsedBody = JSON.parse(options.body || '{}');
      if (parsedBody && parsedBody.company_id) {
        effectiveCompanyId = parsedBody.company_id;
      }
    } catch (e) { }
  }

  // Appliquer le filtre de lecture (GET)
  if (effectiveCompanyId && !isExcluded && !isUserPath) {
    const separator = resourcePath.includes('?') ? '&' : '?';
    url += `${separator}company_id=eq.${effectiveCompanyId}`;
  }

  // Enrichissement obligatoire pour les créations/modifications
  let finalBody = options.body;
  if ((options.method === 'POST' || options.method === 'PATCH') && !isExcluded) {
    if (!effectiveCompanyId) {
      throw new Error("Opération impossible : Aucune entreprise sélectionnée ou associée.");
    }

    try {
      const parsedBody = JSON.parse(options.body);
      if (Array.isArray(parsedBody)) {
        finalBody = JSON.stringify(parsedBody.map(item => ({ ...item, company_id: effectiveCompanyId })));
      } else if (typeof parsedBody === 'object' && parsedBody !== null) {
        finalBody = JSON.stringify({ ...parsedBody, company_id: effectiveCompanyId });
      }
    } catch (e) { }
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...supabaseHeaders,
        ...(options.headers || {}),
        ...((options.method === 'POST' || options.method === 'PATCH') && effectiveCompanyId ? { 'Prefer': 'return=representation' } : {})
      },
      body: finalBody
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Erreur Supabase sur ${resourcePath}: ${response.status}`, errorText);
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

const resolveCustomerId = async ({ customerId, customerName, req }) => {
  if (customerId) return customerId;

  const name = String(customerName || '').trim();
  if (!name) return null;

  const existing = await supabaseFetch(
    `customers?select=id&name=eq.${encodeURIComponent(name)}&limit=1`,
    {},
    req
  );
  if (existing && existing.length > 0) return existing[0].id;

  const created = await supabaseFetch('customers', {
    method: 'POST',
    headers: { 'Prefer': 'return=representation' },
    body: JSON.stringify({ name })
  }, req);

  return created && created.length > 0 ? created[0].id : null;
};

const getPlatformSettings = async (req = null) => {
  const config = await supabaseFetch('platform_settings?select=key,value', {}, req);
  const settings = {};
  if (config) config.forEach(c => settings[c.key] = c.value);
  return settings;
};

const upsertPlatformSetting = async (key, value, req = null) => {
  const safeKey = encodeURIComponent(key);
  const existing = await supabaseFetch(`platform_settings?key=eq.${safeKey}&select=key&limit=1`, {}, req);
  const payload = { value: String(value ?? '') };

  if (existing && existing.length > 0) {
    await supabaseFetch(`platform_settings?key=eq.${safeKey}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }, req);
    return;
  }

  await supabaseFetch('platform_settings', {
    method: 'POST',
    body: JSON.stringify({ key, ...payload })
  }, req);
};

const isTrialCountdownEnabled = (settings = {}) => settings.trial_countdown_enabled !== 'false';

const getTrialDays = (settings = {}) => {
  const days = Number(settings.trial_days);
  return Number.isFinite(days) && days > 0 ? days : 14;
};

const calculateTrialEndsAt = (createdAt, settings = {}) => {
  const start = createdAt ? new Date(createdAt) : new Date();
  if (isNaN(start.getTime())) return null;
  start.setDate(start.getDate() + getTrialDays(settings));
  return start.toISOString();
};

const enrichTrialCompany = (company, settings = {}) => {
  if (!company) return company;
  const isTrial = (company.plan_id || 'trial') === 'trial';
  const countdownEnabled = isTrialCountdownEnabled(settings);
  const trialEndsAt = company.trial_ends_at || (isTrial ? calculateTrialEndsAt(company.created_at, settings) : null);
  const trialEndsTime = trialEndsAt ? new Date(trialEndsAt).getTime() : null;
  const trialExpired = Boolean(isTrial && countdownEnabled && trialEndsTime && trialEndsTime <= Date.now());
  const computedStatus = trialExpired && company.subscription_status === 'active'
    ? 'trial_expired'
    : (company.subscription_status || 'active');

  return {
    ...company,
    trial_ends_at: trialEndsAt,
    trial_countdown_enabled: countdownEnabled,
    trial_expired: trialExpired,
    computed_subscription_status: computedStatus
  };
};

const persistTrialExpirationIfNeeded = async (company, settings = {}, req = null) => {
  const enriched = enrichTrialCompany(company, settings);
  if (enriched?.trial_expired && company.subscription_status === 'active') {
    await supabaseFetch(`companies?id=eq.${company.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ subscription_status: 'trial_expired' })
    }, req);
    return { ...enriched, subscription_status: 'trial_expired', computed_subscription_status: 'trial_expired' };
  }
  return enriched;
};

const getCompanyById = async (companyId) => {
  if (!companyId) return null;
  const data = await supabaseFetch(`companies?id=eq.${encodeURIComponent(companyId)}&select=id,name,plan_id,subscription_status,trial_ends_at,created_at&limit=1`);
  return data && data.length > 0 ? data[0] : null;
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
      const user = users[0];
      // Update last login timestamp in background
      supabaseFetch(`users?id=eq.${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ last_login_at: new Date().toISOString() })
      }).catch(e => console.error('Error updating last_login_at', e));

      res.json({ success: true, user });
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
        body: JSON.stringify({ 
          password_hash: newPassword,
          password_changed_at: new Date().toISOString()
        })
      });
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Erreur changement' }); }
});

router.post('/auth/ping', async (req, res) => {
  try {
    const userHeader = req.headers['x-user-data'];
    if (!userHeader) return res.status(401).json({ error: 'Non authentifié' });
    const user = JSON.parse(userHeader);
    await supabaseFetch(`users?id=eq.${user.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ last_login_at: new Date().toISOString() })
    }, req);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Erreur ping' }); }
});

router.get('/auth/security-status', async (req, res) => {
  try {
    const userHeader = req.headers['x-user-data'];
    if (!userHeader) return res.status(401).json({ error: 'Non authentifié' });
    const user = JSON.parse(userHeader);
    const data = await supabaseFetch(`users?id=eq.${user.id}&select=two_factor_enabled,last_login_at,password_changed_at`);
    res.json(data && data.length > 0 ? data[0] : {});
  } catch (err) { res.status(500).json({ error: 'Erreur' }); }
});

router.patch('/auth/security-status', async (req, res) => {
  try {
    const userHeader = req.headers['x-user-data'];
    if (!userHeader) return res.status(401).json({ error: 'Non authentifié' });
    const user = JSON.parse(userHeader);
    const { two_factor_enabled } = req.body;
    await supabaseFetch(`users?id=eq.${user.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ two_factor_enabled })
    });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Erreur' }); }
});

// Réglages Entreprise
router.get('/settings', async (req, res) => {
  try {
    let userData = {};
    try { userData = JSON.parse(req.headers['x-user-data'] || '{}'); } catch (e) { }
    let companyId = req.headers['x-company-id'];
    if (userData?.role !== 'superadmin' && userData?.company_id) {
      companyId = userData.company_id;
    }
    if (!companyId) return res.json({});
    // On filtre explicitement par ID pour être sûr de récupérer la bonne entreprise
    const data = await supabaseFetch(`companies?id=eq.${companyId}&select=*&limit=1`, {}, req);
    const settings = await getPlatformSettings(req);
    let company = data && data.length > 0 ? data[0] : {};
    company = await persistTrialExpirationIfNeeded(company, settings, req);
    
    // Mapping du logo
    if (company.logo_url) {
      company.invoice_logo = company.logo_url;
    }
    
    res.json(company);
  } catch (err) { res.status(500).json({ error: "Erreur" }); }
});

router.post('/settings', async (req, res) => {
  try {
    let userData = {};
    try { userData = JSON.parse(req.headers['x-user-data'] || '{}'); } catch (e) { }
    let companyId = req.headers['x-company-id'];
    if (userData?.role !== 'superadmin' && userData?.company_id) {
      companyId = userData.company_id;
    }
    if (!companyId) return res.status(400).json({ error: "ID Entreprise manquant" });

    // On nettoie le body pour ne pas envoyer de champs protégés/système à Supabase
    const payload = { ...req.body };
    const fieldsToExclude = ['id', 'created_at', 'updated_at', 'email', 'owner_id', 'subscription_status', 'validation_status'];
    fieldsToExclude.forEach(f => delete payload[f]);

    // Mapping du logo vers la colonne existante
    if (payload.invoice_logo !== undefined) {
      payload.logo_url = payload.invoice_logo;
      delete payload.invoice_logo;
    }

    console.log(`Mise à jour paramètres pour ${companyId}:`, Object.keys(payload));

    const result = await supabaseFetch(`companies?id=eq.${companyId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }, req);
    
    res.json({ success: true, data: result });
  } catch (err) { 
    console.error("ERREUR SETTINGS POST:", err.message);
    res.status(500).json({ 
      success: false, 
      error: "Erreur mise à jour", 
      message: err.message 
    }); 
  }
});

router.use(async (req, res, next) => {
  try {
    if (req.path.startsWith('/auth') || req.path.startsWith('/admin') || req.path === '/settings') return next();

    const user = JSON.parse(req.headers['x-user-data'] || '{}');
    if (!user || user.role === 'superadmin') return next();

    const settings = await getPlatformSettings(req);
    if (settings.maintenance_mode === 'true') {
      return res.status(503).json({
        error: settings.maintenance_message || "L'application est temporairement en maintenance.",
        maintenance: true
      });
    }

    const company = await persistTrialExpirationIfNeeded(await getCompanyById(user.company_id), settings, req);
    const status = company?.computed_subscription_status || company?.subscription_status || 'active';
    if (status !== 'active') {
      return res.status(403).json({
        error: status === 'trial_expired'
          ? "Votre periode d'essai est terminee. Contactez le superadmin."
          : "Votre compagnie est bloquee. Contactez le superadmin.",
        company_status: status,
        company_blocked: true
      });
    }

    next();
  } catch (err) {
    next();
  }
});


// Dashboard
router.get('/dashboard/stats', async (req, res) => {
  try {
    const salesData = await supabaseFetch('sales?status=neq.canceled&select=total_amount,paid_amount,sale_date,status', {}, req);
    const productsData = await supabaseFetch('products?select=quantity,selling_price,alert_threshold', {}, req);
    const customersData = await supabaseFetch('customers?select=id', {}, req);

    let sales_today = 0;
    let sales_month = 0;
    const now = new Date();
    
    // Comparaison de dates plus robuste
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const salesByDay = {};

    if (salesData) {
      salesData.forEach(s => {
        const amount = Number(s.paid_amount || 0); // Utiliser le montant réellement payé
        const d = new Date(s.sale_date);
        const saleDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const dayStr = saleDay.toISOString().split('T')[0];

        if (saleDay.getTime() === today.getTime()) sales_today += amount;
        if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
          sales_month += amount;
        }

        salesByDay[dayStr] = (salesByDay[dayStr] || 0) + amount;
      });
    }

    const historical_sales = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      historical_sales.push({ 
        label: d.toLocaleDateString('fr-FR', { weekday: 'short' }), 
        amount: salesByDay[dateStr] || 0 
      });
    }

    let stock_value = 0;
    let low_stock_items = 0;
    if (productsData) {
      productsData.forEach(p => {
        const qty = Number(p.quantity || 0);
        const price = Number(p.selling_price || 0);
        stock_value += (qty * price);
        if (qty <= (p.alert_threshold || 5)) low_stock_items++;
      });
    }

    res.json({ 
      success: true,
      sales_today, 
      sales_month, 
      stock_value, 
      low_stock_items, 
      active_customers: (customersData ? customersData.length : 0), 
      historical_sales 
    });
  } catch (err) { 
    console.error("Dashboard Stats Error:", err.message);
    res.status(500).json({ error: "Erreur lors du calcul des statistiques" }); 
  }
});

// Finance
router.get('/finance/summary', async (req, res) => {
  try {
    const sales = await supabaseFetch('sales?status=neq.canceled&select=total_amount,paid_amount,sale_date,status&order=sale_date.desc', {}, req) || [];
    const purchases = await supabaseFetch('purchases?select=total_amount,purchase_date,status&order=purchase_date.desc', {}, req) || [];
    const totalRecettes = sales.reduce((sum, s) => sum + Number(s.paid_amount || 0), 0);
    const totalDepenses = purchases.reduce((sum, p) => sum + Number(p.total_amount), 0);
    const history = [
      ...sales.map(s => ({ id: s.id, type: 'RECETTE', amount: s.paid_amount, date: s.sale_date, label: 'Vente' })),
      ...purchases.map(p => ({ id: p.id, type: 'DEPENSE', amount: p.total_amount, date: p.purchase_date, label: 'Achat' }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json({ totalRecettes, totalDepenses, balance: totalRecettes - totalDepenses, history: history.slice(0, 20) });
  } catch (err) { res.status(500).json({ error: "Erreur finance" }); }
});

// Produits
router.get('/products', async (req, res) => {
  try {
    const data = await supabaseFetch('products?select=*,companies(name)&order=created_at.desc', {}, req);
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
    if (prodRes && prodRes.length > 0) {
      const product = prodRes[0];
      res.json({ success: true, product });

      // Si quantité initiale > 0, créer un mouvement de stock
      if (Number(req.body.quantity) > 0) {
        await supabaseFetch('stock_movements', {
          method: 'POST',
          body: JSON.stringify({
            product_id: product.id,
            movement_type: 'IN',
            quantity: Number(req.body.quantity),
            stock_after: Number(req.body.quantity),
            reason: 'Initialisation stock (Création produit)'
          })
        }, req);
      }
    }
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
    const data = await supabaseFetch('sales?select=*,companies(name),customers(name,contact_info),sale_items(product_id,quantity,unit_price,total,products(name,image_url))&order=sale_date.desc', {}, req);
    res.json(data || []);
  } catch (err) { res.status(500).json({ error: "Erreur" }); }
});

router.post('/sales', async (req, res) => {
  try {
    const user = JSON.parse(req.headers['x-user-data'] || '{}');
    const { 
      cart, 
      customerId, customerName,
      totalAmount, paidAmount, remainingAmount, 
      status, sale_date
    } = req.body;

    const resolvedCustomerId = await resolveCustomerId({ customerId, customerName, req });

    // Mapping strict vers les colonnes exactes de la table sales
    const saleToCreate = {
      customer_id: resolvedCustomerId,
      total_amount: Number(totalAmount) || 0,
      paid_amount: Number(paidAmount) || 0,
      remaining_amount: Number(remainingAmount) || 0,
      status: status || 'paid',
      user_id: user.id || null
    };

    // Ajouter la date seulement si fournie
    if (sale_date) saleToCreate.sale_date = sale_date;

    const saleRes = await supabaseFetch('sales', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(saleToCreate)
    }, req);

    if (saleRes && saleRes.length > 0) {
      const saleId = saleRes[0].id;
      const storedRemaining = Number(saleToCreate.remaining_amount || 0);

      if (saleToCreate.status === 'partial' && resolvedCustomerId && storedRemaining > 0) {
        const customerData = await supabaseFetch(`customers?id=eq.${resolvedCustomerId}&select=current_debt`, {}, req);
        const currentDebt = Number(customerData?.[0]?.current_debt || 0);
        await supabaseFetch(`customers?id=eq.${resolvedCustomerId}`, {
          method: 'PATCH',
          body: JSON.stringify({ current_debt: currentDebt + storedRemaining })
        }, req);
      }

      // 1. Créer les sale_items si cart est présent
      if (cart && Array.isArray(cart) && cart.length > 0) {
        const saleItems = cart.map(item => ({
          sale_id: saleId,
          product_id: item.id,
          quantity: item.cartQuantity || 1,
          unit_price: item.selling_price || item.price,
          total: (item.cartQuantity || 1) * (item.selling_price || item.price)
        }));

        await supabaseFetch('sale_items', {
          method: 'POST',
          headers: { 'Prefer': 'return=minimal' },
          body: JSON.stringify(saleItems)
        }, req);

        // 2. Mettre à jour le stock et créer les mouvements
        for (const item of cart) {
          try {
            // Récupérer le stock actuel
            const prodData = await supabaseFetch(`products?id=eq.${item.id}&select=quantity`, {}, req);
            const currentQty = (prodData && prodData[0]) ? prodData[0].quantity : 0;
            const newQty = currentQty - item.cartQuantity;

            // Mettre à jour la quantité
            await supabaseFetch(`products?id=eq.${item.id}`, {
              method: 'PATCH',
              body: JSON.stringify({ quantity: Math.max(0, newQty) })
            }, req);

            // Créer le mouvement de stock
            await supabaseFetch('stock_movements', {
              method: 'POST',
              body: JSON.stringify({
                product_id: item.id,
                movement_type: 'OUT',
                quantity: Math.abs(Number(item.cartQuantity || 0)),
                stock_after: Math.max(0, newQty),
                reason: `Vente #${saleId.split('-')[0]}${status === 'partial' ? ' (Paiement partiel)' : ''}`
              })
            }, req);
          } catch (err) {
            console.error(`Erreur mise à jour stock pour produit ${item.id}:`, err.message);
          }
        }
      }

      // 3. Récupérer la vente complète avec les jointures pour le frontend
      const fullSale = await supabaseFetch(`sales?id=eq.${saleId}&select=*,companies(name),customers(name,contact_info),sale_items(product_id,quantity,unit_price,total,products(name,image_url))`, {}, req);
      
      res.json({ success: true, sale: (fullSale && fullSale.length > 0) ? fullSale[0] : { id: saleId } });
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
    const existing = await supabaseFetch(`sales?id=eq.${req.params.id}&select=paid_amount,total_amount,remaining_amount,customer_id`, {}, req);
    if (!existing || existing.length === 0) return res.status(404).json({ error: 'Vente non trouvée' });

    const total = Number(existing[0].total_amount);
    const currentRemaining = Number(existing[0].remaining_amount ?? (total - Number(existing[0].paid_amount || 0)));
    const amount = Number(paymentAmount);
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Montant du paiement invalide' });
    if (amount > currentRemaining) return res.status(400).json({ error: 'Montant du paiement depasse le reste a payer' });

    const newPaid = Number(existing[0].paid_amount || 0) + amount;
    const newRemaining = Math.max(0, total - newPaid);
    
    const updated = await supabaseFetch(`sales?id=eq.${req.params.id}`, {
      method: 'PATCH',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify({ 
        paid_amount: newPaid, 
        remaining_amount: newRemaining,
        status: newStatus || (newRemaining <= 0 ? 'paid' : 'partial') 
      })
    }, req);

    if (existing[0].customer_id && amount > 0) {
      const customerData = await supabaseFetch(`customers?id=eq.${existing[0].customer_id}&select=current_debt`, {}, req);
      const currentDebt = Number(customerData?.[0]?.current_debt || 0);
      await supabaseFetch(`customers?id=eq.${existing[0].customer_id}`, {
        method: 'PATCH',
        body: JSON.stringify({ current_debt: Math.max(0, currentDebt - amount) })
      }, req);
    }
    // Récupérer la vente mise à jour avec toutes ses relations
    const fullSale = await supabaseFetch(`sales?id=eq.${req.params.id}&select=*,companies(name),customers(name,contact_info),sale_items(product_id,quantity,unit_price,total,products(name,image_url))`, {}, req);
    
    res.json({ success: true, sale: (fullSale && fullSale.length > 0) ? fullSale[0] : updated[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/sales/:id/cancel', async (req, res) => {
  try {
    const saleId = req.params.id;
    const existing = await supabaseFetch(
      `sales?id=eq.${saleId}&select=*,sale_items(product_id,quantity)`,
      {},
      req
    );
    if (!existing || existing.length === 0) return res.status(404).json({ error: 'Vente non trouvée' });

    const sale = existing[0];
    if (sale.status === 'canceled') return res.status(400).json({ error: 'Cette vente est déjà annulée' });

    const items = Array.isArray(sale.sale_items) ? sale.sale_items : [];
    for (const item of items) {
      if (!item.product_id) continue;
      const restoreQty = Math.abs(Number(item.quantity || 0));
      if (!restoreQty) continue;

      const prodData = await supabaseFetch(`products?id=eq.${item.product_id}&select=quantity`, {}, req);
      const currentQty = Number(prodData?.[0]?.quantity || 0);
      const newQty = currentQty + restoreQty;

      await supabaseFetch(`products?id=eq.${item.product_id}`, {
        method: 'PATCH',
        body: JSON.stringify({ quantity: newQty })
      }, req);

      await supabaseFetch('stock_movements', {
        method: 'POST',
        body: JSON.stringify({
          product_id: item.product_id,
          movement_type: 'IN',
          quantity: restoreQty,
          stock_after: newQty,
          reason: `Annulation vente #${saleId.split('-')[0]}`
        })
      }, req);
    }

    const remainingDebt = Number(sale.remaining_amount || 0);
    if (sale.customer_id && remainingDebt > 0) {
      const customerData = await supabaseFetch(`customers?id=eq.${sale.customer_id}&select=current_debt`, {}, req);
      const currentDebt = Number(customerData?.[0]?.current_debt || 0);
      await supabaseFetch(`customers?id=eq.${sale.customer_id}`, {
        method: 'PATCH',
        body: JSON.stringify({ current_debt: Math.max(0, currentDebt - remainingDebt) })
      }, req);
    }

    await supabaseFetch(`sales?id=eq.${saleId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'canceled',
        paid_amount: 0,
        remaining_amount: 0
      })
    }, req);

    const fullSale = await supabaseFetch(`sales?id=eq.${saleId}&select=*,companies(name),customers(name,contact_info),sale_items(product_id,quantity,unit_price,total,products(name,image_url))`, {}, req);
    res.json({ success: true, sale: (fullSale && fullSale.length > 0) ? fullSale[0] : { ...sale, status: 'canceled', paid_amount: 0, remaining_amount: 0 } });
  } catch (err) {
    console.error("Erreur annulation vente:", err);
    res.status(500).json({ error: err.message });
  }
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

    const newPurchase = {
      supplier_id: supplierId || null,
      supplier_name: supplierName || null,
      reference: reference || null,
      total_amount: Number(totalAmount) || 0,
      status: status || 'pending'
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
            stock_after: currentQty + qty,
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
    const normalizedQuantity = Math.abs(Number(req.body.quantity || 0));
    const moveRes = await supabaseFetch('stock_movements', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify({ ...req.body, quantity: normalizedQuantity })
    }, req);

    const moveId = moveRes[0].id;

    // Mise à jour de la quantité produit associée
    const prod = await supabaseFetch(`products?id=eq.${req.body.product_id}&select=quantity`, {}, req);
    if (prod && prod.length > 0) {
      const currentQty = prod[0].quantity;
      const newQty = req.body.movement_type === 'IN' ? currentQty + normalizedQuantity : currentQty - normalizedQuantity;
      const finalQty = Math.max(0, newQty);

      await supabaseFetch(`products?id=eq.${req.body.product_id}`, { 
        method: 'PATCH', 
        body: JSON.stringify({ quantity: finalQty }) 
      }, req);

      // Mettre à jour le mouvement avec le stock_after
      await supabaseFetch(`stock_movements?id=eq.${moveId}`, {
        method: 'PATCH',
        body: JSON.stringify({ stock_after: finalQty })
      }, req);

      moveRes[0].stock_after = finalQty;
    }
    res.json({ success: true, movement: moveRes[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/stock/:id', async (req, res) => {
  try {
    const { product_id, movement_type, quantity, reason } = req.body;
    const normalizedQuantity = Math.abs(Number(quantity || 0));
    const oldRes = await supabaseFetch(`stock_movements?id=eq.${req.params.id}`, {}, req);
    if (!oldRes || oldRes.length === 0) return res.status(404).json({ error: "Mouvement non trouvé" });
    const oldM = oldRes[0];

    const updatedRes = await supabaseFetch(`stock_movements?id=eq.${req.params.id}`, {
      method: 'PATCH',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify({ product_id, movement_type, quantity: normalizedQuantity, reason })
    }, req);
    const newM = updatedRes[0];

    const prod = await supabaseFetch(`products?id=eq.${product_id}&select=quantity`, {}, req);
    if (prod && prod.length > 0) {
      let currentQty = prod[0].quantity;
      if (oldM.movement_type === 'IN') currentQty -= Math.abs(Number(oldM.quantity || 0));
      else currentQty += Math.abs(Number(oldM.quantity || 0));
      if (newM.movement_type === 'IN') currentQty += Math.abs(Number(newM.quantity || 0));
      else currentQty -= Math.abs(Number(newM.quantity || 0));
      await supabaseFetch(`products?id=eq.${product_id}`, { method: 'PATCH', body: JSON.stringify({ quantity: Math.max(0, currentQty) }) }, req);
    }
    res.json({ success: true, movement: newM });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/stock/:id', async (req, res) => {
  try {
    const mRes = await supabaseFetch(`stock_movements?id=eq.${req.params.id}`, {}, req);
    if (!mRes || mRes.length === 0) return res.status(404).json({ error: "Mouvement non trouvé" });
    const m = mRes[0];
    await supabaseFetch(`stock_movements?id=eq.${req.params.id}`, { method: 'DELETE' }, req);
    const prod = await supabaseFetch(`products?id=eq.${m.product_id}&select=quantity`, {}, req);
    if (prod && prod.length > 0) {
      const movementQty = Math.abs(Number(m.quantity || 0));
      const newQty = m.movement_type === 'IN' ? prod[0].quantity - movementQty : prod[0].quantity + movementQty;
      await supabaseFetch(`products?id=eq.${m.product_id}`, { method: 'PATCH', body: JSON.stringify({ quantity: Math.max(0, newQty) }) }, req);
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// Contacts
router.get('/contacts', async (req, res) => {
  try {
    const customers = await supabaseFetch('customers?select=*&order=created_at.desc', {}, req);
    const suppliers = await supabaseFetch('suppliers?select=*&order=created_at.desc', {}, req);
    
    // Support spécifique pour renvoyer un tableau direct selon le type (utile pour frontend App.jsx)
    const { type } = req.query;
    if (type === 'customer') return res.json(customers || []);
    if (type === 'fournisseur') return res.json(suppliers || []);

    res.json({ customers: customers || [], suppliers: suppliers || [] });
  } catch (err) { res.status(500).json({ error: "Erreur" }); }
});

router.post('/contacts', async (req, res) => {
  try {
    const { type, name, contact_info, current_debt } = req.body;
    if (!name) return res.status(400).json({ error: "Le nom est requis" });

    const table = type === 'fournisseur' ? 'suppliers' : 'customers';
    const contactToCreate = {
      name,
      contact_info: contact_info || null,
      current_debt: Number(current_debt) || 0
    };

    const cRes = await supabaseFetch(table, {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(contactToCreate)
    }, req);
    res.json({ success: true, contact: cRes[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Admin
router.get('/admin/config', async (req, res) => {
  try {
    res.json(await getPlatformSettings(req));
  } catch (err) { res.status(500).json({ error: "Erreur config" }); }
});

router.patch('/admin/config', async (req, res) => {
  try {
    for (const key in req.body) {
      await upsertPlatformSetting(key, req.body[key], req);
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Erreur MAJ config" }); }
});

router.get('/admin/companies', async (req, res) => {
  try {
    const settings = await getPlatformSettings(req);
    const data = await supabaseFetch('companies?select=*&order=created_at.desc', {}, req);
    const companies = await Promise.all((data || []).map(company => persistTrialExpirationIfNeeded(company, settings, req)));
    res.json(companies);
  } catch (err) { res.status(500).json({ error: "Erreur" }); }
});

router.post('/admin/companies', async (req, res) => {
  try {
    const { password, ...companyPayload } = req.body;
    const settings = await getPlatformSettings(req);
    const planId = companyPayload.plan_id || 'trial';
    const payload = {
      ...companyPayload,
      plan_id: planId,
      subscription_status: companyPayload.subscription_status || 'active',
      trial_ends_at: planId === 'trial'
        ? (companyPayload.trial_ends_at || calculateTrialEndsAt(new Date().toISOString(), settings))
        : (companyPayload.trial_ends_at || null)
    };
    const companyData = await supabaseFetch('companies', { method: 'POST', headers: { 'Prefer': 'return=representation' }, body: JSON.stringify(payload) }, req);

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
      res.json({ success: true, company: enrichTrialCompany(companyData[0], settings) });
    } else {
      res.status(500).json({ error: "Échec de création entreprise" });
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/admin/companies/:id', async (req, res) => {
  try {
    const settings = await getPlatformSettings(req);
    const payload = { ...req.body };
    if (payload.plan_id && payload.plan_id !== 'trial' && payload.trial_ends_at === undefined) {
      payload.trial_ends_at = null;
    }
    const updated = await supabaseFetch(`companies?id=eq.${req.params.id}`, { method: 'PATCH', headers: { 'Prefer': 'return=representation' }, body: JSON.stringify(payload) }, req);
    res.json({ success: true, company: updated ? enrichTrialCompany(updated[0], settings) : null });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/admin/companies/:id', async (req, res) => {
  try {
    await supabaseFetch(`companies?id=eq.${req.params.id}`, { method: 'DELETE' }, req);
    res.json({ success: true });
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
  const errors = [];
  try {
    const fetchSafe = async (resource) => {
      try {
        return await supabaseFetch(resource, {}, req) || [];
      } catch (e) {
        errors.push(`${resource}: ${e.message}`);
        console.error(`[Admin Stats Debug] Failed ${resource}:`, e.message);
        return [];
      }
    };

    const companies = await fetchSafe('companies?select=*&order=created_at.asc');
    const users = await fetchSafe('users?select=*');

    const PRICING = { pro: 15000, enterprise: 50000, trial: 0, free: 0 };

    let mrr = 0;
    companies.forEach(c => {
      if (c && c.subscription_status === 'active' && c.plan_id !== 'trial') {
        mrr += (PRICING[c.plan_id] || 0);
      }
    });

    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const yearMonth = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      months.push({ 
        label: d.toLocaleString('fr-FR', { month: 'short' }), 
        yearKey: yearMonth, 
        companies: 0, 
        mrr: 0 
      });
    }

    companies.forEach(c => {
      if (!c || !c.created_at) return;
      const date = new Date(c.created_at);
      if (isNaN(date.getTime())) return;
      const yearMonth = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
      const monthData = months.find(m => m.yearKey === yearMonth);
      if (monthData) {
        monthData.companies++;
        if (c.subscription_status === 'active' && c.plan_id !== 'trial') {
          monthData.mrr += (PRICING[c.plan_id] || 0);
        }
      }
    });

    const growthTrend = months.map(({ label, companies, mrr }) => ({ label, companies, mrr }));
    const unpaidCompanies = companies.filter(c => c && (c.subscription_status === 'pending' || c.subscription_status === 'rejected'));

    res.json({
      success: true,
      totalCompanies: companies.length,
      totalUsers: users.length,
      activeSubscriptions: companies.filter(c => c && c.subscription_status === 'active' && c.plan_id && c.plan_id !== 'trial').length,
      mrr,
      unpaidCount: unpaidCompanies.length,
      unpaidCompanies,
      growthTrend,
      debug: errors.length > 0 ? errors : undefined
    });
  } catch (err) { 
    console.error("Admin Stats Critical Error:", err.message);
    res.status(200).json({ 
      success: false,
      error: "Erreur stats: " + err.message,
      totalCompanies: 0,
      unpaidCompanies: [],
      debug: errors.concat([err.message])
    }); 
  }
});

// --- API DEVIS (QUOTES) ---
router.get('/quotes', async (req, res) => {
  try {
    const data = await supabaseFetch('quotes?select=*,customers(name,contact_info),quote_items(product_id,quantity,unit_price,total,products(name,image_url))&order=quote_date.desc', {}, req);
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: "Erreur lors de la récupération des devis" });
  }
});

router.post('/quotes', async (req, res) => {
  try {
    const { cart, totalAmount, status, customerId, customerName, valid_until } = req.body;
    const resolvedCustomerId = await resolveCustomerId({ customerId, customerName, req });

    const quoteData = {
      total_amount: Number(totalAmount) || 0,
      status: status || 'draft',
      customer_id: resolvedCustomerId,
      valid_until: valid_until || null
    };

    const quoteRes = await supabaseFetch('quotes', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(quoteData)
    }, req);

    if (!quoteRes || quoteRes.length === 0) {
      return res.status(500).json({ error: "Échec de l'insertion du devis" });
    }
    const quoteId = quoteRes[0].id;

    if (cart && cart.length > 0) {
      const quoteItems = cart.map(item => ({
        quote_id: quoteId,
        product_id: item.id,
        quantity: item.cartQuantity,
        unit_price: item.selling_price,
        total: item.cartQuantity * item.selling_price
      }));

      await supabaseFetch('quote_items', {
        method: 'POST',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify(quoteItems)
      }, req);
    }

    const fullQuote = await supabaseFetch(`quotes?id=eq.${quoteId}&select=*,customers(name,contact_info),quote_items(product_id,quantity,unit_price,total,products(name,image_url))`, {}, req);
    res.json({ success: true, quote: (fullQuote && fullQuote.length > 0) ? fullQuote[0] : quoteRes[0] });
  } catch (err) {
    res.status(500).json({ error: "Erreur lors de la création du devis: " + err.message });
  }
});

router.patch('/quotes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    const updated = await supabaseFetch(`quotes?id=eq.${id}`, {
      method: 'PATCH',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(updateData)
    }, req);

    if (!updated || updated.length === 0) {
      return res.status(404).json({ error: "Devis introuvable" });
    }
    res.json({ success: true, quote: updated[0] });
  } catch (err) {
    res.status(500).json({ error: "Erreur lors de la modification du devis: " + err.message });
  }
});

router.post('/quotes/:id/convert-to-order', async (req, res) => {
  try {
    const { id } = req.params;
    const quoteData = await supabaseFetch(`quotes?id=eq.${id}&select=*,quote_items(*)`, {}, req);
    if (!quoteData || quoteData.length === 0) {
      return res.status(404).json({ error: "Devis introuvable" });
    }
    const quote = quoteData[0];

    const userHeader = req.headers['x-user-data'];
    const user = userHeader ? JSON.parse(userHeader) : null;

    const orderData = {
      customer_id: quote.customer_id,
      user_id: user ? user.id : null,
      quote_id: quote.id,
      total_amount: quote.total_amount,
      status: 'pending'
    };

    const orderRes = await supabaseFetch('orders', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(orderData)
    }, req);

    if (!orderRes || orderRes.length === 0) {
      return res.status(500).json({ error: "Échec de l'insertion de la commande" });
    }
    const orderId = orderRes[0].id;

    if (quote.quote_items && quote.quote_items.length > 0) {
      const orderItems = quote.quote_items.map(item => ({
        order_id: orderId,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.total
      }));

      await supabaseFetch('order_items', {
        method: 'POST',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify(orderItems)
      }, req);
    }

    await supabaseFetch(`quotes?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'converted' })
    }, req);

    res.json({ success: true, orderId });
  } catch (err) {
    res.status(500).json({ error: "Erreur lors de la conversion en commande: " + err.message });
  }
});

// --- API COMMANDES (ORDERS) ---
router.get('/orders', async (req, res) => {
  try {
    const data = await supabaseFetch('orders?select=*,customers(name,contact_info),order_items(product_id,quantity,unit_price,total,products(name,image_url))&order=order_date.desc', {}, req);
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: "Erreur lors de la récupération des commandes" });
  }
});

router.post('/orders', async (req, res) => {
  try {
    const { cart, totalAmount, status, customerId, customerName } = req.body;
    const resolvedCustomerId = await resolveCustomerId({ customerId, customerName, req });

    const orderData = {
      total_amount: Number(totalAmount) || 0,
      status: status || 'pending',
      customer_id: resolvedCustomerId
    };

    const orderRes = await supabaseFetch('orders', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(orderData)
    }, req);

    if (!orderRes || orderRes.length === 0) {
      return res.status(500).json({ error: "Échec de l'insertion de la commande" });
    }
    const orderId = orderRes[0].id;

    if (cart && cart.length > 0) {
      const orderItems = cart.map(item => ({
        order_id: orderId,
        product_id: item.id,
        quantity: item.cartQuantity,
        unit_price: item.selling_price,
        total: item.cartQuantity * item.selling_price
      }));

      await supabaseFetch('order_items', {
        method: 'POST',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify(orderItems)
      }, req);
    }

    const fullOrder = await supabaseFetch(`orders?id=eq.${orderId}&select=*,customers(name,contact_info),order_items(product_id,quantity,unit_price,total,products(name,image_url))`, {}, req);
    res.json({ success: true, order: (fullOrder && fullOrder.length > 0) ? fullOrder[0] : orderRes[0] });
  } catch (err) {
    res.status(500).json({ error: "Erreur lors de la création de la commande: " + err.message });
  }
});

router.patch('/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    const updated = await supabaseFetch(`orders?id=eq.${id}`, {
      method: 'PATCH',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(updateData)
    }, req);

    if (!updated || updated.length === 0) {
      return res.status(404).json({ error: "Commande introuvable" });
    }
    res.json({ success: true, order: updated[0] });
  } catch (err) {
    res.status(500).json({ error: "Erreur lors de la modification de la commande: " + err.message });
  }
});

router.post('/orders/:id/convert-delivery', async (req, res) => {
  try {
    const { id } = req.params;
    
    const ordersData = await supabaseFetch(`orders?id=eq.${id}&select=*,order_items(*)`, {}, req);
    if (!ordersData || ordersData.length === 0) {
      return res.status(404).json({ error: "Commande introuvable" });
    }
    const order = ordersData[0];
    
    if (order.status === 'delivered') {
      return res.status(400).json({ error: "Cette commande a déjà été livrée (Bon de livraison déjà généré)" });
    }

    const userHeader = req.headers['x-user-data'];
    const user = userHeader ? JSON.parse(userHeader) : null;

    const deliveryNoteData = {
      customer_id: order.customer_id,
      user_id: user ? user.id : null,
      order_id: order.id,
      status: 'delivered'
    };

    const dnRes = await supabaseFetch('delivery_notes', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(deliveryNoteData)
    }, req);

    if (!dnRes || dnRes.length === 0) {
      return res.status(500).json({ error: "Échec de la création du bon de livraison" });
    }
    const deliveryNoteId = dnRes[0].id;

    if (order.order_items && order.order_items.length > 0) {
      const dnItems = order.order_items.map(item => ({
        delivery_note_id: deliveryNoteId,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.total
      }));

      await supabaseFetch('delivery_note_items', {
        method: 'POST',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify(dnItems)
      }, req);

      for (const item of order.order_items) {
        if (item.product_id) {
          const prodData = await supabaseFetch(`products?id=eq.${item.product_id}&select=quantity`, {}, req);
          const currentQty = (prodData && prodData[0]) ? prodData[0].quantity : 0;

          await supabaseFetch(`products?id=eq.${item.product_id}`, {
            method: 'PATCH',
            body: JSON.stringify({ quantity: currentQty - item.quantity })
          }, req);

          await supabaseFetch('stock_movements', {
            method: 'POST',
            body: JSON.stringify({
              product_id: item.product_id,
              movement_type: 'OUT',
              quantity: Math.abs(Number(item.quantity || 0)),
              stock_after: currentQty - item.quantity,
              reason: `Livraison Commande #${order.id.split('-')[0]}`
            })
          }, req);
        }
      }
    }

    await supabaseFetch(`orders?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'delivered' })
    }, req);

    res.json({ success: true, deliveryNoteId });
  } catch (err) {
    res.status(500).json({ error: "Erreur lors de la conversion en bon de livraison: " + err.message });
  }
});

// --- API BONS DE LIVRAISON (DELIVERY NOTES) ---
router.get('/delivery-notes', async (req, res) => {
  try {
    const data = await supabaseFetch('delivery_notes?select=*,customers(name,contact_info),delivery_note_items(product_id,quantity,unit_price,total,products(name,image_url))&order=delivery_date.desc', {}, req);
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: "Erreur lors de la récupération des bons de livraison" });
  }
});

router.get('/status', (req, res) => {
  res.json({ status: 'Online', storage: 'Supabase enabled', version: '1.2.5-full' });
});

app.use('/api', router);
app.use('/', router);

module.exports = app;

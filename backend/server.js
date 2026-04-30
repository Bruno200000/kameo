const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Charger les variables d'environnement depuis le dossier local du backend
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const port = process.env.PORT || 5000;

console.log('--- Configuration Backend KAméo ---');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'DÉFINIE' : 'MANQUANTE');
console.log('PORT:', port);
console.log('-----------------------------------');

// Configuration de Multer pour le stockage local des images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

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

// Servir les fichiers statiques du dossier uploads
app.use('/uploads', express.static('uploads'));

// Utilisation directe de l'API REST de Supabase avec Fetch natif de Node.js (sans librairie externe)
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

app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Company-Id', 'X-User-Data']
}));
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

    // Vérifier l'ancien mot de passe si userId fourni
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

// Récupérer les infos de l'utilisateur actuel (simulation)
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
    const updates = req.body; // { key: value }
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
    const salesData = await supabaseFetch('sales?select=total_amount,paid_amount,sale_date');
    const productsData = await supabaseFetch('products?select=quantity,selling_price,alert_threshold');
    const customersData = await supabaseFetch('customers?select=id');

    let sales_total = 0;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const salesByDay = {}; 
    
    if (salesData && Array.isArray(salesData)) {
      salesData.forEach(s => {
        const amount = Number(s.paid_amount || 0); // Utiliser le montant réellement payé
        const d = new Date(s.sale_date);
        const saleDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const dayStr = saleDay.toISOString().split('T')[0];
        
        if (saleDay.getTime() === today.getTime()) sales_total += amount;
        salesByDay[dayStr] = (salesByDay[dayStr] || 0) + amount;
      });
    }

    // Format last 7 days for the chart
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
    if (productsData && Array.isArray(productsData)) {
      productsData.forEach(p => {
        const qty = Number(p.quantity || 0);
        const price = Number(p.selling_price || 0);
        stock_value += (qty * price);
        if (qty <= (p.alert_threshold || 5)) low_stock_items++;
      });
    }

    res.json({
      success: true,
      sales_today: sales_total || 0,
      stock_value: stock_value || 0,
      low_stock_items: low_stock_items || 0,
      active_customers: (customersData && customersData.length) || 0,
      historical_sales
    });
  } catch (err) {
    console.error("Dashboard Stats Error:", err.message);
    res.status(500).json({ error: "Erreur serveur lors du calcul des statistiques" });
  }
});

// Finance Summary
app.get('/api/finance/summary', async (req, res) => {
  try {
    const sales = await supabaseFetch('sales?select=total_amount,paid_amount,sale_date,status&order=sale_date.desc') || [];
    const purchases = await supabaseFetch('purchases?select=total_amount,purchase_date,status&order=purchase_date.desc') || [];
    
    const totalRecettes = sales.reduce((sum, s) => sum + Number(s.paid_amount || 0), 0);
    const totalDepenses = purchases.reduce((sum, p) => sum + Number(p.total_amount), 0);
    
    // Fusionner pour un historique complet
    const history = [
      ...sales.map(s => ({ id: s.id, type: 'RECETTE', amount: s.paid_amount, date: s.sale_date, label: 'Vente' })),
      ...purchases.map(p => ({ id: p.id, type: 'DEPENSE', amount: p.total_amount, date: p.purchase_date, label: 'Achat' }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({
      totalRecettes,
      totalDepenses,
      balance: totalRecettes - totalDepenses,
      history: history.slice(0, 20) // Top 20 transactions
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
    
    // Obtenir ou créer l'entreprise par défaut
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

    if (!prodRes || prodRes.length === 0) {
      return res.status(500).json({ error: "L'insertion du produit a échoué" });
    }

    res.json({ success: true, product: prodRes[0] });
    
    // Si quantité initiale > 0, créer un mouvement de stock
    if (Number(quantity) > 0) {
      await supabaseFetch('stock_movements', {
        method: 'POST',
        body: JSON.stringify({
          company_id: companyId,
          product_id: prodRes[0].id,
          movement_type: 'IN',
          quantity: Number(quantity),
          stock_after: Number(quantity),
          reason: 'Initialisation stock (Création produit)'
        })
      });
    }
  } catch (err) {
    res.status(500).json({ error: "Erreur lors de l'ajout: " + err.message });
  }
});

// Modifier un produit
app.patch('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    if (updateData.purchase_price !== undefined) updateData.purchase_price = Number(updateData.purchase_price) || 0;
    if (updateData.selling_price !== undefined) updateData.selling_price = Number(updateData.selling_price) || 0;
    if (updateData.quantity !== undefined) updateData.quantity = Number(updateData.quantity) || 0;

    const updated = await supabaseFetch(`products?id=eq.${id}`, {
      method: 'PATCH',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(updateData)
    });

    if (!updated || updated.length === 0) {
      return res.status(404).json({ error: "Produit introuvable" });
    }
    res.json({ success: true, product: updated[0] });
  } catch (err) {
    res.status(500).json({ error: "Erreur lors de la modification: " + err.message });
  }
});

// Supprimer un produit
app.delete('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await supabaseFetch(`products?id=eq.${id}`, {
      method: 'DELETE'
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erreur lors de la suppression: " + err.message });
  }
});

// Route pour l'upload d'image
app.post('/api/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Aucun fichier n'a été téléversé." });
    }
    const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    res.json({ success: true, imageUrl });
  } catch (err) {
    res.status(500).json({ error: "Erreur lors du téléversement: " + err.message });
  }
});

// Ventes
app.get('/api/sales', async (req, res) => {
  try {
    const data = await supabaseFetch('sales?select=*,customers(name),sale_items(product_id,quantity,unit_price,products(name,image_url))&order=sale_date.desc');
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur interne" });
  }
});

// Enregistrer une nouvelle  Vente depuis le POS
app.post('/api/sales', async (req, res) => {
  try {
    const { cart, totalAmount, paidAmount, remainingAmount, status, customerId, customerName, sale_date } = req.body;
    
    // 1. Obtenir l'entreprise
    const companyId = await getOrCreateCompanyId();

    // 2. Insérer la vente
    const total = Number(totalAmount) || 0;
    let paid = Number(paidAmount) || 0;
    let remaining = Number(remainingAmount);

    if (status === 'paid') {
      paid = total; remaining = 0;
    } else if (status === 'pending') {
      paid = 0; remaining = total;
    } else if (status === 'partial') {
      if (!Number.isFinite(remaining)) remaining = total - paid;
      if (remaining < 0) remaining = 0;
    } else {
      paid = total; remaining = 0;
    }

    const saleData = {
      company_id: companyId,
      total_amount: total,
      paid_amount: paid,
      remaining_amount: Number.isFinite(Number(remaining)) ? remaining : (total - paid),
      status: status || 'paid',
      customer_id: customerId || null,
      customer_name: customerName || null,
      cart: (cart && cart.length > 0) ? cart : null  // Stocker le panier en JSONB
    };

    // Ajouter la date seulement si fournie (facture manuelle)
    if (sale_date) saleData.sale_date = sale_date;

    const saleRes = await supabaseFetch('sales', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(saleData)
    });
    
    if (!saleRes || saleRes.length === 0) {
      return res.status(500).json({ error: "Echec insertion vente" });
    }
    const saleId = saleRes[0].id;

    // 3. Si c'est un paiement partiel, créer une dette client
    if (status === 'partial' && customerId && remainingAmount > 0) {
      // Mettre à jour la dette du client
      const customerData = await supabaseFetch(`customers?id=eq.${customerId}&select=current_debt`);
      const currentDebt = (customerData && customerData[0] && customerData[0].current_debt) || 0;
      
      await supabaseFetch(`customers?id=eq.${customerId}`, {
        method: 'PATCH',
        body: JSON.stringify({ current_debt: currentDebt + remainingAmount })
      });
    }

    // 4. Insérer les articles individuels, mettre à jour le stock et créer les mouvements
    if (cart && cart.length > 0) {
      const saleItems = cart.map(item => ({
        sale_id: saleId,
        product_id: item.id,
        quantity: item.cartQuantity,
        unit_price: item.selling_price,
        total: item.cartQuantity * item.selling_price
      }));
      
      // Enregistrer les détails de la vente
      await supabaseFetch('sale_items', {
        method: 'POST',
        body: JSON.stringify(saleItems)
      });

      // Mettre à jour le stock physique pour chaque produit
      for (const item of cart) {
        // 1. Récupérer le stock actuel
        const prodData = await supabaseFetch(`products?id=eq.${item.id}&select=quantity`);
        const currentQty = (prodData && prodData[0]) ? prodData[0].quantity : 0;
        
        // 2. Mettre à jour la quantité (décrémenter)
        await supabaseFetch(`products?id=eq.${item.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ quantity: currentQty - item.cartQuantity })
        });

        // 3. Créer le mouvement de stock historique
        await supabaseFetch('stock_movements', {
          method: 'POST',
          body: JSON.stringify({
            company_id: companyId,
            product_id: item.id,
            movement_type: 'OUT',
            quantity: -item.cartQuantity,
            stock_after: currentQty - item.cartQuantity,
            reason: `Vente #${saleId.split('-')[0]}${status === 'partial' ? ' (Paiement partiel)' : ''}`
          })
        });
      }
    }

    // 5. Récupérer la vente complète avec les jointures pour le frontend
    const fullSale = await supabaseFetch(`sales?id=eq.${saleId}&select=*,customers(name),sale_items(product_id,quantity,unit_price,products(name,image_url))`);
    
    res.json({ success: true, sale: (fullSale && fullSale.length > 0) ? fullSale[0] : { id: saleId } });
  } catch (err) {
    console.error("Erreur Checkout:", err.message);
    res.status(500).json({ error: "Erreur enregistrement de la vente: " + err.message });
  }
});

// Gérer le paiement d'une vente existante
app.post('/api/sales/:id/payment', async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentAmount, newRemainingAmount, newStatus } = req.body;

    console.log('Payment request for sale:', id);
    console.log('Payment data:', req.body);

    // Récupérer les valeurs actuelles pour calculer les totaux
    const existingSales = await supabaseFetch(`sales?id=eq.${id}&select=paid_amount,remaining_amount,total_amount,status`);
    if (!existingSales || existingSales.length === 0) {
      return res.status(404).json({ error: 'Vente non trouvée' });
    }

    const existingSale = existingSales[0];
    const currentPaid = Number(existingSale.paid_amount || 0);
    const currentRemaining = Number(existingSale.remaining_amount || 0);

    if (Number(paymentAmount) <= 0) {
      return res.status(400).json({ error: 'Montant du paiement invalide' });
    }

    if (Number(paymentAmount) > currentRemaining) {
      return res.status(400).json({ error: 'Montant du paiement dépasse le reste à payer' });
    }

    const total = Number(existingSale.total_amount || 0);
    const computedPaid = currentPaid + Number(paymentAmount);
    const computedRemaining = total - computedPaid;
    const computedStatus = newStatus || (computedRemaining <= 0 ? 'paid' : 'partial');

    const updateData = {
      paid_amount: computedPaid,
      remaining_amount: computedRemaining,
      status: computedStatus
    };

    const saleRes = await supabaseFetch(`sales?id=eq.${id}`, {
      method: 'PATCH',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(updateData)
    });

    console.log('Payment update response:', saleRes);

    if (!saleRes || saleRes.length === 0) return res.status(500).json({ error: "Echec mise à jour du paiement" });
    
    // Récupérer la vente mise à jour avec toutes ses relations
    const fullSale = await supabaseFetch(`sales?id=eq.${id}&select=*,customers(name),sale_items(product_id,quantity,unit_price,products(name,image_url))`);
    
    res.json({ success: true, sale: (fullSale && fullSale.length > 0) ? fullSale[0] : saleRes[0] });
  } catch (err) {
    console.error('Error in payment update:', err);
    res.status(500).json({ error: "Erreur lors du paiement: " + err.message });
  }
});

// Achats
app.get('/api/purchases', async (req, res) => {
  try {
    const data = await supabaseFetch('purchases?select=*&order=purchase_date.desc');
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur interne" });
  }
});

// Enregistrer un achat
app.post('/api/purchases', async (req, res) => {
  try {
    const { totalAmount, reference, supplierName, status, supplierId, productId, quantity } = req.body;
    const companyId = await getOrCreateCompanyId();
    
    const newPurchase = {
      company_id: companyId,
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
    });

    if (!purRes || purRes.length === 0) return res.status(500).json({ error: "Echec insertion achat" });
    const purchaseId = purRes[0].id;

    // Si un produit est spécifié, on crée l'item et on gère le stock
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
      });

      if (status === 'received') {
        const prodData = await supabaseFetch(`products?id=eq.${productId}&select=quantity`);
        const currentQty = (prodData && prodData[0]) ? prodData[0].quantity : 0;
        
        await supabaseFetch(`products?id=eq.${productId}`, {
          method: 'PATCH',
          body: JSON.stringify({ quantity: currentQty + qty })
        });

        await supabaseFetch('stock_movements', {
          method: 'POST',
          body: JSON.stringify({
            company_id: companyId,
            product_id: productId,
            movement_type: 'IN',
            quantity: qty,
            stock_after: currentQty + qty,
            reason: `Achat #${purchaseId.split('-')[0]} (${reference || 'Sans ref'})`
          })
        });
      }
    }
    
    res.json({ success: true, purchase: purRes[0] });
  } catch (err) {
    res.status(500).json({ error: "Erreur lors de l'ajout: " + err.message });
  }
});

// Modifier un achat existant
app.patch('/api/purchases/:id', async (req, res) => {
  try {
    console.log('PATCH request received for purchases/:id');
    console.log('req.params:', req.params);
    console.log('req.body:', req.body);
    
    const { id } = req.params;
    const { totalAmount, status, reference, supplierName, supplierId } = req.body;
    
    const updateData = {};
    if (totalAmount !== undefined) updateData.total_amount = Number(totalAmount) || 0;
    if (status !== undefined) updateData.status = status;
    if (reference !== undefined) updateData.reference = reference;
    if (supplierName !== undefined) updateData.supplier_name = supplierName;
    if (supplierId !== undefined) updateData.supplier_id = supplierId;
    
    console.log('updateData:', updateData);
    
    const purRes = await supabaseFetch(`purchases?id=eq.${id}`, {
      method: 'PATCH',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(updateData)
    });

    console.log('Supabase response:', purRes);

    if (!purRes || purRes.length === 0) return res.status(500).json({ error: "Echec modification achat" });
    
    res.json({ success: true, purchase: purRes[0] });
  } catch (err) {
    console.error('Error in PATCH purchases/:id:', err);
    res.status(500).json({ error: "Erreur lors de la modification: " + err.message });
  }
});

// Stock Mouvements
app.get('/api/stock', async (req, res) => {
  try {
    const data = await supabaseFetch('stock_movements?select=*,products:product_id(name,quantity)&order=movement_date.desc');
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur interne" });
  }
});

// Enregistrer un nouveau mouvement de stock manuel (IN/OUT)
app.post('/api/stock', async (req, res) => {
  try {
    const { product_id, movement_type, quantity, reason } = req.body;
    if (!product_id || !quantity) return res.status(400).json({ error: 'Produit et quantité requis' });
    const companyId = await getOrCreateCompanyId();
    
    // 1. Insérer le mouvement
    const movementData = {
      company_id: companyId,
      product_id,
      movement_type: movement_type || 'IN',
      quantity: Number(quantity) || 0,
      reason: reason || ''
    };
    
    const moveRes = await supabaseFetch('stock_movements', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(movementData)
    });

    if (!moveRes || moveRes.length === 0) return res.status(500).json({ error: "Echec insertion mouvement" });

    // 2. Mettre à jour le stock "en dur" dans la table products.
    const prod = await supabaseFetch(`products?id=eq.${product_id}&select=quantity`);
    if (prod && prod.length > 0) {
      let newQty = Number(prod[0].quantity) || 0;
      if (movement_type === 'IN') newQty += Number(quantity);
      else newQty -= Number(quantity);
      
      const finalQty = newQty < 0 ? 0 : newQty;
      
      await supabaseFetch(`products?id=eq.${product_id}`, {
        method: 'PATCH',
        body: JSON.stringify({ quantity: finalQty })
      });

      // Mettre à jour le mouvement avec le stock final calculé
      await supabaseFetch(`stock_movements?id=eq.${moveRes[0].id}`, {
        method: 'PATCH',
        body: JSON.stringify({ stock_after: finalQty })
      });
      
      moveRes[0].stock_after = finalQty;
    }

    res.json({ success: true, movement: moveRes[0] });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur: " + err.message });
  }
});

// Contacts (Clients & Fournisseurs)
app.get('/api/contacts', async (req, res) => {
  try {
    const customers = await supabaseFetch('customers?select=*&order=created_at.desc');
    const suppliers = await supabaseFetch('suppliers?select=*&order=created_at.desc');
    
    const { type } = req.query;
    if (type === 'customer') return res.json(customers || []);
    if (type === 'fournisseur') return res.json(suppliers || []);

    res.json({ customers: customers || [], suppliers: suppliers || [] });
  } catch (err) {
    res.status(500).json({ error: "Erreur API contacts" });
  }
});

// Ajouter un Contact
app.post('/api/contacts', async (req, res) => {
  try {
    const { type, name, contact_info, current_debt } = req.body;
    const companyId = await getOrCreateCompanyId();
    
    const newContact = {
      company_id: companyId,
      name,
      contact_info: contact_info || null,
      current_debt: Number(current_debt) || 0
    };
    
    const table = type === 'fournisseur' ? 'suppliers' : 'customers';
    const cRes = await supabaseFetch(table, {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(newContact)
    });
    
    if (!cRes || cRes.length === 0) return res.status(500).json({ error: "Echec insertion contact" });
    
    res.json({ success: true, contact: cRes[0] });
  } catch(err) {
    res.status(500).json({ error: "Erreur serveur: " + err.message });
  }
});

// Paramètres de l'entreprise
app.get('/api/settings', async (req, res) => {
  try {
    const data = await supabaseFetch('companies?select=*&limit=1');
    if (!data || data.length === 0) {
      // Si aucune entreprise, on en crée une par défaut
      const companyId = await getOrCreateCompanyId();
      const newData = await supabaseFetch(`companies?id=eq.${companyId}&select=*`);
      return res.json(newData[0]);
    }
    res.json(data[0]);
  } catch (err) {
    res.status(500).json({ error: "Erreur récupération paramètres" });
  }
});

app.post('/api/settings', async (req, res) => {
  try {
    const companyId = await getOrCreateCompanyId();
    
    // On nettoie le body pour ne pas envoyer de champs protégés/système à Supabase
    const payload = { ...req.body };
    const fieldsToExclude = ['id', 'created_at', 'updated_at', 'email', 'owner_id', 'subscription_status', 'validation_status'];
    fieldsToExclude.forEach(f => delete payload[f]);

    // Mapping du logo vers la colonne existante
    if (payload.invoice_logo !== undefined) {
      payload.logo_url = payload.invoice_logo;
      delete payload.invoice_logo;
    }
    
    await supabaseFetch(`companies?id=eq.${companyId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erreur mise à jour paramètres" });
  }
});

// Demande abonnement depuis l'entreprise (statut pending)
app.post('/api/subscription/request', async (req, res) => {
  try {
    const { plan_id } = req.body;
    const companies = await supabaseFetch('companies?select=*&limit=1');
    if (!companies || companies.length === 0) {
      return res.status(404).json({ success: false, error: 'Aucune entreprise trouvée.' });
    }
    const companyId = companies[0].id;

    const companyUpdate = {
      plan_id: plan_id || 'pro',
      subscription_status: 'pending'
    };

    await supabaseFetch(`companies?id=eq.${companyId}`, {
      method: 'PATCH',
      body: JSON.stringify(companyUpdate)
    });

    res.json({ success: true, plan_id: companyUpdate.plan_id, subscription_status: companyUpdate.subscription_status });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur initialisation abonnement: ' + err.message });
  }
});

// --- ROUTES ADMINISTRATION (PLATEFORME) ---

// Lister toutes les entreprises
app.get('/api/admin/companies', async (req, res) => {
  try {
    const data = await supabaseFetch('companies?select=*&order=created_at.desc');
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: "Erreur récupération entreprises" });
  }
});

// Créer une entreprise + Créer un utilisateur Admin pour cette entreprise
app.post('/api/admin/companies', async (req, res) => {
  try {
    const { name, email, phone, address, plan_id, password } = req.body;
    console.log("Tentative de création entreprise:", name, email);
    
    // 1. Créer l'entreprise
    const newCompany = {
      name, email, phone, address,
      plan_id: plan_id || 'trial',
      subscription_status: 'active'
    };
    
    console.log("Calling supabase companies...");
    const companyData = await supabaseFetch('companies', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(newCompany)
    });
    
    if (!companyData || companyData.length === 0) throw new Error("Echec création entreprise");
    const companyId = companyData[0].id;
    console.log("Entreprise créée ID:", companyId);

    // 2. Créer l'utilisateur Administrateur par défaut pour cette entreprise
    const newUser = {
      company_id: companyId,
      first_name: 'Admin',
      last_name: name,
      email: email, 
      password_hash: password || '123456', 
      role: 'admin'
    };

    console.log("Calling supabase users...");
    await supabaseFetch('users', {
      method: 'POST',
      body: JSON.stringify(newUser)
    });
    
    console.log("Utilisateur Admin créé avec succès");
    res.json({ success: true, company: companyData[0] });
  } catch (err) {
    console.error("ERREUR DÉTAILLÉE:", err);
    res.status(500).json({ error: "Erreur création entreprise: " + err.message });
  }
});

// Créer un utilisateur (Plateforme Admin)
app.post('/api/admin/users', async (req, res) => {
  try {
    const { first_name, last_name, email, password, role, company_id } = req.body;
    if (!first_name || !email || !password) {
      return res.status(400).json({ error: "Prénom, email et mot de passe sont requis." });
    }

    // Vérifier si l'email existe déjà
    const existing = await supabaseFetch(`users?email=eq.${encodeURIComponent(email)}&select=id`);
    if (existing && existing.length > 0) {
      return res.status(409).json({ error: "Un utilisateur avec cet email existe déjà." });
    }

    const newUser = {
      first_name,
      last_name: last_name || '',
      email,
      password_hash: password,
      role: role || 'admin',
      company_id: company_id || null
    };

    const userRes = await supabaseFetch('users', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(newUser)
    });

    if (!userRes || userRes.length === 0) {
      return res.status(500).json({ error: "Echec création utilisateur" });
    }

    res.json({ success: true, user: userRes[0] });
  } catch (err) {
    console.error("Erreur création utilisateur:", err);
    res.status(500).json({ error: "Erreur serveur: " + err.message });
  }
});

// Lister tous les utilisateurs (Plateforme)
app.get('/api/admin/users', async (req, res) => {
  try {
    const data = await supabaseFetch('users?select=*,companies:company_id(name)');
    res.json(data || []);
  } catch (err) {
    console.error("Erreur lister utilisateurs:", err);
    res.status(500).json({ error: "Erreur récupération utilisateurs: " + err.message });
  }
});

// Supprimer un utilisateur
app.delete('/api/admin/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await supabaseFetch(`users?id=eq.${id}`, { method: 'DELETE' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erreur suppression utilisateur" });
  }
});

// Modifier un utilisateur
app.patch('/api/admin/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await supabaseFetch(`users?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify(req.body)
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erreur modification utilisateur" });
  }
});

// Modifier une entreprise
app.patch('/api/admin/companies/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    await supabaseFetch(`companies?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updateData)
    });
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erreur mise à jour" });
  }
});

// Supprimer une entreprise
app.delete('/api/admin/companies/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await supabaseFetch(`companies?id=eq.${id}`, { method: 'DELETE' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erreur suppression" });
  }
});

// Statistiques Globales (Données Structurées pour le Dashboard SuperAdmin)
app.get('/api/admin/stats', async (req, res) => {
  const errors = [];
  try {
    const fetchSafe = async (resource) => {
      try {
        return await supabaseFetch(resource) || [];
      } catch (e) {
        errors.push(`${resource}: ${e.message}`);
        console.error(`[Stats Debug] Failed ${resource}:`, e.message);
        return [];
      }
    };

    const companies = await fetchSafe('companies?select=*&order=created_at.asc');
    const users = await fetchSafe('users?select=*');
    const products = await fetchSafe('products?select=*');
    
    console.log(`[Stats API] Found: ${companies.length} companies, ${users.length} users, ${products.length} products.`);
    const PRICING = { pro: 35000, enterprise: 50000, trial: 0, free: 0 };
    
    // Calcul sécurisé du MRR (somme des abonnements actifs payants)
    let mrr = 0;
    companies.forEach(c => {
      if (c && c.subscription_status === 'active' && c.plan_id && c.plan_id !== 'trial') {
        mrr += (PRICING[c.plan_id] || 0);
      }
    });

    // Initialisation sécurisée de la tendance (6 derniers mois)
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

    // Remplissage sécurisé de la tendance
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

    // Distribution des plans
    const planCounts = companies.reduce((acc, c) => {
      const p = c?.plan_id || 'trial';
      acc[p] = (acc[p] || 0) + 1;
      return acc;
    }, {});

    // Statuts d'abonnement
    const statusCounts = companies.reduce((acc, c) => {
      const s = c?.subscription_status || 'active';
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {});

    const activeSubscriptions = companies.filter(c => c && c.subscription_status === 'active' && c.plan_id && c.plan_id !== 'trial').length;
    const unpaidCompanies = companies.filter(c => c && (c.subscription_status === 'pending' || c.subscription_status === 'rejected'));

    const recentCompanies = [...companies]
      .sort((a,b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      .slice(0, 6)
      .map(c => ({ 
        id: c.id, 
        name: c.name || 'Inconnu', 
        email: c.email || '',
        phone: c.phone || '',
        plan_id: c.plan_id || 'trial', 
        subscription_status: c.subscription_status || 'pending', 
        created_at: c.created_at 
      }));

    res.json({
      totalCompanies: companies.length,
      totalUsers: users.length,
      totalProducts: products.length,
      activeSubscriptions,
      mrr,
      unpaidCount: unpaidCompanies.length,
      growthTrend,
      planDistribution: {
        trial: planCounts.trial || 0,
        pro: planCounts.pro || 0,
        enterprise: planCounts.enterprise || 0,
        free: planCounts.free || 0
      },
      subscriptionStatus: {
        active: statusCounts.active || 0,
        pending: statusCounts.pending || 0,
        rejected: statusCounts.rejected || 0
      },
      unpaidCompanies,
      recentCompanies,
      success: true,
      debug: errors.length > 0 ? errors : undefined
    });
  } catch (err) {
    console.error("CRITICAL Dashboard Stats Error:", err.message);
    res.status(200).json({ 
      success: false,
      error: "Erreur statistiques globales", 
      details: err.message,
      totalCompanies: 0,
      unpaidCompanies: [],
      debug: errors.concat([err.message])
    });
  }
});

app.listen(port, () => {
  console.log(`Serveur KAméo backend démarré sur : http://localhost:${port}`);
});


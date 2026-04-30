-- SCRIPT DE SÉCURISATION DE LA BASE DE DONNÉES (RLS)
-- À exécuter dans l'éditeur SQL de votre tableau de bord Supabase

-- 1. ACTIVER LE RLS SUR TOUTES LES TABLES
-- Cela force la base de données à vérifier les politiques pour chaque requête
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- 2. CRÉATION DES POLITIQUES D'ISOLATION (MULTI-TENANT)
-- Ces politiques garantissent qu'un utilisateur ne peut voir/modifier que les données 
-- appartenant à son entreprise (via company_id stocké dans le JWT).

-- Produits
CREATE POLICY "Isolation par entreprise : products" ON products
FOR ALL USING (
  company_id = (auth.jwt() -> 'user_metadata' ->> 'company_id')::uuid
);

-- Ventes
CREATE POLICY "Isolation par entreprise : sales" ON sales
FOR ALL USING (
  company_id = (auth.jwt() -> 'user_metadata' ->> 'company_id')::uuid
);

-- Items de Vente (Liaison via la table sales)
CREATE POLICY "Isolation par entreprise : sale_items" ON sale_items
FOR ALL USING (
  sale_id IN (SELECT id FROM sales WHERE company_id = (auth.jwt() -> 'user_metadata' ->> 'company_id')::uuid)
);

-- Achats
CREATE POLICY "Isolation par entreprise : purchases" ON purchases
FOR ALL USING (
  company_id = (auth.jwt() -> 'user_metadata' ->> 'company_id')::uuid
);

-- Clients
CREATE POLICY "Isolation par entreprise : customers" ON customers
FOR ALL USING (
  company_id = (auth.jwt() -> 'user_metadata' ->> 'company_id')::uuid
);

-- Fournisseurs
CREATE POLICY "Isolation par entreprise : suppliers" ON suppliers
FOR ALL USING (
  company_id = (auth.jwt() -> 'user_metadata' ->> 'company_id')::uuid
);

-- Mouvements de Stock
CREATE POLICY "Isolation par entreprise : stock_movements" ON stock_movements
FOR ALL USING (
  company_id = (auth.jwt() -> 'user_metadata' ->> 'company_id')::uuid
);

-- Utilisateurs (Voir uniquement les membres de sa propre entreprise)
CREATE POLICY "Isolation par entreprise : users" ON users
FOR ALL USING (
  company_id = (auth.jwt() -> 'user_metadata' ->> 'company_id')::uuid
);

-- Entreprise (Un utilisateur ne peut voir que les infos de son entreprise)
CREATE POLICY "Isolation par entreprise : companies" ON companies
FOR SELECT USING (
  id = (auth.jwt() -> 'user_metadata' ->> 'company_id')::uuid
);

-- 3. NOTES IMPORTANTES :
-- - Pour que ces politiques fonctionnent, vous devez configurer Supabase Auth.
-- - Lors de la création d'un utilisateur, ajoutez son company_id dans metadata :
--   auth.signUp({ email, password, options: { data: { company_id: '...' } } })

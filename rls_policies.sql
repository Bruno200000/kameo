-- Script RLS Supabase pour Kameo SaaS
-- A executer dans Supabase Dashboard > SQL Editor.
--
-- Prerequis important :
-- Ces policies utilisent Supabase Auth. Chaque utilisateur doit avoir dans son JWT :
--   user_metadata.company_id = UUID de son entreprise
--   user_metadata.role = 'superadmin' pour un acces plateforme complet
--
-- Exemple cote Auth :
-- auth.signUp({
--   email,
--   password,
--   options: { data: { company_id: '...', role: 'admin' } }
-- })

begin;

-- Fonctions utilitaires centralisees pour eviter de repeter la lecture du JWT.
create or replace function public.current_company_id()
returns uuid
language sql
stable
as $$
  select nullif(
    coalesce(
      auth.jwt() -> 'user_metadata' ->> 'company_id',
      auth.jwt() -> 'app_metadata' ->> 'company_id'
    ),
    ''
  )::uuid;
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
as $$
  select coalesce(
    auth.jwt() -> 'user_metadata' ->> 'role',
    auth.jwt() -> 'app_metadata' ->> 'role',
    ''
  );
$$;

create or replace function public.is_superadmin()
returns boolean
language sql
stable
as $$
  select public.current_user_role() = 'superadmin';
$$;

-- Activation du RLS sur toutes les tables applicatives.
alter table public.companies enable row level security;
alter table public.users enable row level security;
alter table public.suppliers enable row level security;
alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.stock_movements enable row level security;
alter table if exists public.platform_settings enable row level security;

-- Nettoyage idempotent des anciennes policies.
drop policy if exists "companies_select_by_company_or_superadmin" on public.companies;
drop policy if exists "companies_insert_superadmin" on public.companies;
drop policy if exists "companies_update_by_company_admin_or_superadmin" on public.companies;
drop policy if exists "companies_delete_superadmin" on public.companies;

drop policy if exists "users_by_company_or_superadmin" on public.users;
drop policy if exists "suppliers_by_company_or_superadmin" on public.suppliers;
drop policy if exists "customers_by_company_or_superadmin" on public.customers;
drop policy if exists "products_by_company_or_superadmin" on public.products;
drop policy if exists "sales_by_company_or_superadmin" on public.sales;
drop policy if exists "purchases_by_company_or_superadmin" on public.purchases;
drop policy if exists "stock_movements_by_company_or_superadmin" on public.stock_movements;
drop policy if exists "sale_items_by_sale_company_or_superadmin" on public.sale_items;
drop policy if exists "purchase_items_by_purchase_company_or_superadmin" on public.purchase_items;
do $$
begin
  if to_regclass('public.platform_settings') is not null then
    drop policy if exists "platform_settings_superadmin_only" on public.platform_settings;
  end if;
end $$;

-- Compatibilite avec les noms de l'ancien script.
drop policy if exists "Isolation par entreprise : products" on public.products;
drop policy if exists "Isolation par entreprise : sales" on public.sales;
drop policy if exists "Isolation par entreprise : sale_items" on public.sale_items;
drop policy if exists "Isolation par entreprise : purchases" on public.purchases;
drop policy if exists "Isolation par entreprise : customers" on public.customers;
drop policy if exists "Isolation par entreprise : suppliers" on public.suppliers;
drop policy if exists "Isolation par entreprise : stock_movements" on public.stock_movements;
drop policy if exists "Isolation par entreprise : users" on public.users;
drop policy if exists "Isolation par entreprise : companies" on public.companies;

-- Entreprises :
-- Les utilisateurs voient leur entreprise. Les superadmins voient et gerent tout.
create policy "companies_select_by_company_or_superadmin"
on public.companies
for select
to authenticated
using (public.is_superadmin() or id = public.current_company_id());

create policy "companies_insert_superadmin"
on public.companies
for insert
to authenticated
with check (public.is_superadmin());

create policy "companies_update_by_company_admin_or_superadmin"
on public.companies
for update
to authenticated
using (
  public.is_superadmin()
  or (id = public.current_company_id() and public.current_user_role() in ('admin'))
)
with check (
  public.is_superadmin()
  or (id = public.current_company_id() and public.current_user_role() in ('admin'))
);

create policy "companies_delete_superadmin"
on public.companies
for delete
to authenticated
using (public.is_superadmin());

-- Tables avec une colonne company_id.
create policy "users_by_company_or_superadmin"
on public.users
for all
to authenticated
using (public.is_superadmin() or company_id = public.current_company_id())
with check (public.is_superadmin() or company_id = public.current_company_id());

create policy "suppliers_by_company_or_superadmin"
on public.suppliers
for all
to authenticated
using (public.is_superadmin() or company_id = public.current_company_id())
with check (public.is_superadmin() or company_id = public.current_company_id());

create policy "customers_by_company_or_superadmin"
on public.customers
for all
to authenticated
using (public.is_superadmin() or company_id = public.current_company_id())
with check (public.is_superadmin() or company_id = public.current_company_id());

create policy "products_by_company_or_superadmin"
on public.products
for all
to authenticated
using (public.is_superadmin() or company_id = public.current_company_id())
with check (public.is_superadmin() or company_id = public.current_company_id());

create policy "sales_by_company_or_superadmin"
on public.sales
for all
to authenticated
using (public.is_superadmin() or company_id = public.current_company_id())
with check (public.is_superadmin() or company_id = public.current_company_id());

create policy "purchases_by_company_or_superadmin"
on public.purchases
for all
to authenticated
using (public.is_superadmin() or company_id = public.current_company_id())
with check (public.is_superadmin() or company_id = public.current_company_id());

create policy "stock_movements_by_company_or_superadmin"
on public.stock_movements
for all
to authenticated
using (public.is_superadmin() or company_id = public.current_company_id())
with check (public.is_superadmin() or company_id = public.current_company_id());

-- Tables de lignes sans company_id direct : isolation via la table parente.
create policy "sale_items_by_sale_company_or_superadmin"
on public.sale_items
for all
to authenticated
using (
  public.is_superadmin()
  or exists (
    select 1
    from public.sales s
    where s.id = sale_items.sale_id
      and s.company_id = public.current_company_id()
  )
)
with check (
  public.is_superadmin()
  or exists (
    select 1
    from public.sales s
    where s.id = sale_items.sale_id
      and s.company_id = public.current_company_id()
  )
);

create policy "purchase_items_by_purchase_company_or_superadmin"
on public.purchase_items
for all
to authenticated
using (
  public.is_superadmin()
  or exists (
    select 1
    from public.purchases p
    where p.id = purchase_items.purchase_id
      and p.company_id = public.current_company_id()
  )
)
with check (
  public.is_superadmin()
  or exists (
    select 1
    from public.purchases p
    where p.id = purchase_items.purchase_id
      and p.company_id = public.current_company_id()
  )
);

-- Parametres plateforme : uniquement superadmin, si la table existe.
do $$
begin
  if to_regclass('public.platform_settings') is not null then
    create policy "platform_settings_superadmin_only"
    on public.platform_settings
    for all
    to authenticated
    using (public.is_superadmin())
    with check (public.is_superadmin());
  end if;
end $$;

-- Activation du RLS sur les nouvelles tables
alter table if exists public.quotes enable row level security;
alter table if exists public.quote_items enable row level security;
alter table if exists public.orders enable row level security;
alter table if exists public.order_items enable row level security;
alter table if exists public.delivery_notes enable row level security;
alter table if exists public.delivery_note_items enable row level security;

-- Nettoyage idempotent des anciennes policies si existantes
drop policy if exists "quotes_by_company" on public.quotes;
drop policy if exists "orders_by_company" on public.orders;
drop policy if exists "delivery_notes_by_company" on public.delivery_notes;
drop policy if exists "quote_items_by_company" on public.quote_items;
drop policy if exists "order_items_by_company" on public.order_items;
drop policy if exists "delivery_note_items_by_company" on public.delivery_note_items;

-- Nouvelles politiques d'isolation par entreprise
create policy "quotes_by_company"
on public.quotes
for all
to authenticated
using (public.is_superadmin() or company_id = public.current_company_id())
with check (public.is_superadmin() or company_id = public.current_company_id());

create policy "orders_by_company"
on public.orders
for all
to authenticated
using (public.is_superadmin() or company_id = public.current_company_id())
with check (public.is_superadmin() or company_id = public.current_company_id());

create policy "delivery_notes_by_company"
on public.delivery_notes
for all
to authenticated
using (public.is_superadmin() or company_id = public.current_company_id())
with check (public.is_superadmin() or company_id = public.current_company_id());

create policy "quote_items_by_company"
on public.quote_items
for all
to authenticated
using (
  public.is_superadmin()
  or exists (
    select 1
    from public.quotes q
    where q.id = quote_items.quote_id
      and q.company_id = public.current_company_id()
  )
)
with check (
  public.is_superadmin()
  or exists (
    select 1
    from public.quotes q
    where q.id = quote_items.quote_id
      and q.company_id = public.current_company_id()
  )
);

create policy "order_items_by_company"
on public.order_items
for all
to authenticated
using (
  public.is_superadmin()
  or exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and o.company_id = public.current_company_id()
  )
)
with check (
  public.is_superadmin()
  or exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and o.company_id = public.current_company_id()
  )
);

create policy "delivery_note_items_by_company"
on public.delivery_note_items
for all
to authenticated
using (
  public.is_superadmin()
  or exists (
    select 1
    from public.delivery_notes dn
    where dn.id = delivery_note_items.delivery_note_id
      and dn.company_id = public.current_company_id()
  )
)
with check (
  public.is_superadmin()
  or exists (
    select 1
    from public.delivery_notes dn
    where dn.id = delivery_note_items.delivery_note_id
      and dn.company_id = public.current_company_id()
  )
);

commit;

-- Verification rapide apres execution :
-- select schemaname, tablename, rowsecurity
-- from pg_tables
-- where schemaname = 'public'
-- order by tablename;
--
-- Attention :
-- Si votre backend utilise la service_role key, Supabase contourne RLS par design.
-- Pour que ces policies protegent les requetes utilisateur, appelez Supabase avec
-- le JWT de l'utilisateur connecte, ou gardez la service_role key uniquement cote
-- serveur avec vos propres controles d'autorisation.

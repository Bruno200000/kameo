# Configuration Vercel Deployment Guide

## Structure du projet pour Vercel

```
/
├── api/
│   └── index.js          ← API Express Serverless (routes à /api/*)
├── frontend/
│   ├── src/
│   ├── package.json
│   ├── vite.config.js
│   └── dist/             ← Build output (généré au deployment)
├── vercel.json           ← Configuration Vercel
├── package.json          ← Root package.json pour monorepo
└── .env                  ← Clés API (NE PAS commiter)
```

## Étapes de déploiement

### 1. Préparer le dépôt Git
```bash
git add .
git commit -m "Configure Vercel deployment with Serverless API"
git push origin main
```

### 2. Sur Vercel Dashboard

1. **Créer un nouveau projet**
   - Allez sur [vercel.com](https://vercel.com)
   - Cliquez "Add New..." → "Project"
   - Sélectionnez votre repos GitHub

2. **Configurer les variables d'environnement**
   - Dans le projet Vercel, allez à **Settings** → **Environment Variables**
   - Ajouter ces variables:

```
SUPABASE_URL = https://nscsftfhndvbntgdsobc.supabase.co
SUPABASE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zY3NmdGZobmR2Ym50Z2Rzb2JjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4Njk3NTEsImV4cCI6MjA5MDQ0NTc1MX0.VTqitVf7LNH6WoTQhbT6T_fcdiHddVmO0Fp5x5VgqNU
JWT_SECRET = super_secret_jwt_key_here
NODE_ENV = production
```

3. **Déployer**
   - Cliquez sur "Deploy"
   - Vercel va:
     - Builder le frontend avec `npm run build`
     - Créer les Serverless Functions pour `/api`
     - Router les requêtes automatiquement

### 3. Vérifier le déploiement

**Frontend :** `https://your-project.vercel.app`
**API :** `https://your-project.vercel.app/api/health`

## Architecture

### Frontend (Vite React)
- Statique, servi depuis le CDN Vercel
- Variables d'env: `VITE_API_URL=/api`

### Backend (Express Serverless)
- Chaque requête `/api/*` déclenche une fonction
- Durée max: 60 secondes
- Mémoire: 1024 MB
- Accès direct à Supabase PostgreSQL

## Variables d'environnement gérées par Vercel

| Variable | Valeur |
|----------|--------|
| `SUPABASE_URL` | URL du projet Supabase |
| `SUPABASE_KEY` | Clé API Supabase (anon) |
| `JWT_SECRET` | Clé secrète pour JWT |
| `NODE_ENV` | `production` |

## Troubleshooting

### Error: "Build timed out"
- ✅ Vérifiez `frontend/package.json` a un script `build`
- ✅ Vérifiez que les dépendances sont listées

### Error: "Cannot find module"
- ✅ Exécutez `npm install` localement pour vérifier
- ✅ Commeitez le `package-lock.json`

### API non accessible
- ✅ Vérifiez les variables d'env sur Vercel Dashboard
- ✅ Vérifiez que `/api/index.js` exporte l'app Express

## Déploiement continu

Après le premier déploiement:
- Tout push sur `main` → redéploiement automatique
- Pull requests → preview deployments

## Notes importantes

⚠️ **Uploads de fichiers:**
- Les fichiers uploadés dans `/backend/uploads/` ne sont PAS persistants
- Solution: Utiliser un service cloud (AWS S3, Cloudinary, etc.)

⚠️ **Limite Serverless:**
- Timeout: 60 secondes max par requête
- Pas d'état entre les requêtes
- N'utilisez que Supabase pour la persistence

✅ **Avantages:**
- Scaling automatique
- Costs payez uniquement ce que vous utilisez
- Déploiement en 1 clic
- HTTPS automatique


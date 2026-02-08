# 🚀 Déploiement TURNKEY sur Vercel

## Guide étape par étape

### 1️⃣ Push le code sur GitHub

Le code est actuellement sur le serveur Emergent. Il faut le mettre sur GitHub.

**Option A : Via GitHub Desktop** (le plus simple si tu l'as)
**Option B : Via ligne de commande Git**
**Option C : Upload manuel sur github.com**

### 2️⃣ Connecter à Vercel

1. Va sur https://vercel.com
2. Clique sur "Add New Project"
3. Importe ton repo GitHub
4. Configure les variables d'environnement

### 3️⃣ Variables d'environnement à ajouter

```
GOOGLE_GEMINI_API_KEY=AIzaSyCdJJQ3TjgKI6OGIiH_X_kGtyUnEOUjB1U
ADMIN_DEFAULT_USERNAME=admin
ADMIN_DEFAULT_PASSWORD=admin123
MAX_UPLOAD_FILES=5
MAX_FILE_SIZE_MB=2
SESSION_RETENTION_HOURS=24
```

### 4️⃣ Déployer

Clique sur "Deploy" et attends 2-3 minutes.

---

## ⚠️ IMPORTANT : SQLite ne fonctionne pas sur Vercel

Vercel est "serverless" et ne peut pas stocker la base SQLite.

**Solution** : Utiliser Supabase (gratuit) ou Vercel Postgres (gratuit aussi)

Je peux te guider pour ça aussi si besoin !

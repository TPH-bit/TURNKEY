# TURNKEY - Documents Sourcés V1

SaaS de génération de documents DOCX sourcés avec système anti-hallucination robuste.

## 🚀 Fonctionnalités V1

### Interface Publique
- **Parcours verrouillé en 5 étapes**
  1. Profil (questionnaire 10 questions max)
  2. Requête (champ unique, 2000 caractères max)
  3. Upload documents (PDF, DOCX, TXT, MD, PPTX - 5 fichiers, 2 Mo max)
  4. QCM d'affinage (10 questions max)
  5. Génération + téléchargement DOCX

### Pipeline RAG Robuste (3 passes)
1. **Retrieval** : Web search (Wikipedia) + documents uploadés
2. **Evidence Selection** : Scoring sémantique + fiabilité des sources
3. **Grounded Writing** : Rédaction stricte avec citations obligatoires

### Système Anti-Hallucination
- Refus si pas assez de sources fiables
- Citations obligatoires (minimum 2 par section)
- Notes de bas de page + section "Sources & Références"
- Table "Sections → Sources" en fin de document

### Modération 13+ (2 couches)
- Règles déterministes (regex PII, mots-clés)
- Modération IA (catégorisation)
- Blocage automatique + log admin

### Interface Admin
- Dashboard analytics (funnel, taux complétion)
- File de modération (événements bloqués)
- Purge manuelle 24h
- Configuration système

### Sécurité & Conformité
- Rétention 24h (purge automatique)
- Pas de stockage PII
- Prompt interne jamais exposé
- RBAC admin (admin/moderator/analyst)

## 🛠 Stack Technique

- **Frontend + Backend** : Next.js 14 (App Router)
- **Database** : SQLite (avec migration Supabase prête)
- **Vector Store** : Embeddings en BLOB SQLite
- **LLM** : Claude 3.5 Sonnet (Anthropic)
- **Embeddings** : OpenAI text-embedding-3-small
- **Web Search** : Wikipedia API (V1 simplifié)
- **Génération DOCX** : docx lib
- **Extraction** :
  - PDF : pdf-lib
  - DOCX : mammoth
  - PPTX : jszip
  - TXT/MD : fs

## ⚡ Installation (30 minutes)

### 1. Prérequis
```bash
Node.js 18+
Yarn 1.22+
```

### 2. Cloner et installer
```bash
git clone <repo>
cd turnkey
yarn install
```

### 3. Configuration (.env)
Le fichier `.env` est déjà configuré avec :
```bash
# Database
DB_NAME=turnkey_db

# LLM & Embeddings (Clé universelle Emergent fournie)
EMERGENT_LLM_KEY=sk-emergent-65115C137De3f3621B

# Admin par défaut (CHANGER EN PRODUCTION)
ADMIN_DEFAULT_USERNAME=admin
ADMIN_DEFAULT_PASSWORD=admin123

# Limites système
MAX_UPLOAD_FILES=5
MAX_FILE_SIZE_MB=2
SESSION_RETENTION_HOURS=24
```

### 4. Lancer l'application
```bash
yarn dev
```

Application accessible sur : `http://localhost:3000`
Interface admin : `http://localhost:3000/admin`

## 📊 Structure Projet

```
/app
├── app/
│   ├── page.js                     # Interface publique
│   ├── layout.js                   # Layout global
│   ├── admin/page.js               # Interface admin
│   └── api/[[...path]]/route.js    # API routes
├── lib/
│   ├── db.js                       # SQLite + schémas
│   ├── llm.js                      # Provider Claude
│   ├── embeddings.js               # OpenAI embeddings + vector search
│   ├── moderation.js               # Modération 2 couches
│   ├── auth.js                     # Auth admin + RBAC
│   ├── analytics.js                # Tracking événements
│   ├── cleanup.js                  # Purge 24h
│   ├── config.js                   # Configuration système
│   ├── docx-generator.js           # Génération DOCX
│   ├── extraction/
│   │   ├── pdf.js                  # Extraction PDF
│   │   ├── docx.js                 # Extraction DOCX
│   │   ├── pptx.js                 # Extraction PPTX
│   │   ├── text.js                 # Extraction TXT/MD
│   │   └── index.js                # Router extraction
│   └── rag/
│       ├── retrieval.js            # Pass 1 : Retrieval
│       ├── evidence.js             # Pass 2 : Evidence selection
│       └── writer.js               # Pass 3 : Grounded writing
├── components/
│   ├── Stepper.jsx                 # Progress bar 5 étapes
│   ├── ProfileForm.jsx             # Étape A
│   ├── QueryInput.jsx              # Étape B
│   ├── FileUpload.jsx              # Étape C
│   ├── MCQForm.jsx                 # Étape D
│   └── GenerationView.jsx          # Étape E
├── data/
│   ├── turnkey.db                  # Database SQLite
│   └── moderation-rules.json       # Règles modération
├── uploads/                        # Fichiers uploadés (24h)
└── generated/                      # Documents générés (24h)
```

## 🔌 API Endpoints

### Public
- `GET /api/session/init` - Initialiser session
- `GET /api/session/status?sessionId=xxx` - Statut session
- `POST /api/profile/submit` - Soumettre profil
- `POST /api/query/submit` - Soumettre requête (avec modération)
- `POST /api/upload` - Upload documents
- `POST /api/mcq/submit` - Soumettre QCM
- `POST /api/generate` - Générer document
- `GET /api/documents/download/:id` - Télécharger DOCX
- `GET /api/documents/generated?sessionId=xxx` - Liste documents

### Admin
- `POST /api/admin/login` - Connexion admin
- `GET /api/admin/analytics?startDate=xxx&endDate=xxx` - Analytics
- `GET /api/admin/moderation` - Événements bloqués
- `POST /api/admin/purge` - Purge manuelle
- `POST /api/admin/users/create` - Créer utilisateur admin

## 🗄 Schéma Database

**Tables principales** :
- `sessions` - Sessions utilisateur (24h)
- `uploaded_documents` - Documents uploadés + texte extrait
- `generated_documents` - Documents DOCX générés
- `document_chunks` - Chunks + embeddings (vector search)
- `web_sources` - Cache sources web
- `moderation_events` - Log modération
- `analytics_events` - Tracking événements
- `admin_users` - Utilisateurs admin + RBAC
- `system_config` - Configuration
- `source_domains` - Allowlist/denylist domaines

## 🔒 Sécurité

### Implémenté
- ✅ Secrets en variables d'env
- ✅ Prompt interne jamais exposé
- ✅ Validation stricte input + upload
- ✅ Modération 2 couches
- ✅ Rate limiting session (24h auto-purge)
- ✅ RBAC admin (3 rôles)
- ✅ CORS strict
- ✅ Cookies HttpOnly

### Recommandations Production
- 🔄 Changer ADMIN_DEFAULT_PASSWORD
- 🔄 Ajouter HTTPS obligatoire
- 🔄 Rate limiting par IP (Vercel Edge Middleware)
- 🔄 Monitoring erreurs (Sentry)
- 🔄 Backup database régulier

## 📈 Analytics Événements

Événements trackés :
- `start` - Démarrage session
- `profile_complete` - Profil complété
- `query_submitted` - Requête soumise
- `upload_done` - Upload terminé
- `mcq_done` - QCM complété
- `doc_generated` - Document généré
- `doc_downloaded` - Document téléchargé
- `moderation_blocked` - Contenu bloqué

## 🔄 Purge Automatique 24h

### Manuelle (via Admin)
Interface Admin → Paramètres → Lancer la purge

### Automatique (Cron - À configurer)
Créer `/app/scripts/purge.js` :
```javascript
import { purgeExpiredSessions } from '../lib/cleanup.js';
purgeExpiredSessions();
```

Ajouter Vercel Cron (vercel.json) :
```json
{
  "crons": [{
    "path": "/api/cron/purge",
    "schedule": "0 */6 * * *"
  }]
}
```

Ou utiliser Supabase Scheduled Functions.

## 🚢 Déploiement Vercel

### 1. Push sur GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-repo>
git push -u origin main
```

### 2. Importer sur Vercel
- Connecter repo GitHub
- Variables d'env : copier depuis `.env`
- Deploy

### 3. Configuration Post-Deploy
- Changer `ADMIN_DEFAULT_PASSWORD`
- Configurer domaine custom
- Activer Vercel Cron pour purge

## 🔮 Migration Supabase (Préparée)

Le schéma SQLite est compatible Supabase Postgres. Pour migrer :

1. Créer projet Supabase
2. Remplacer `/app/lib/db.js` par client Supabase
3. Migrer schéma SQL (ajouter pgvector extension)
4. Configurer Storage buckets pour uploads
5. Activer RLS policies
6. Mettre à jour `.env` avec credentials Supabase

Scripts de migration SQL disponibles dans `/lib/db.js` (commentaires).

## 🆘 Troubleshooting

### Base de données corrompue
```bash
rm data/turnkey.db
# Relancer l'app (auto-recréation)
```

### Erreur "No session"
- Cookies bloqués ? Vérifier navigateur
- Session expirée ? Rafraîchir page

### Génération échoue "Pas assez de sources"
- Uploader plus de documents
- Reformuler requête plus précise
- Vérifier connexion internet (Wikipedia API)

### Admin login échoué
- Username/password par défaut : `admin` / `admin123`
- Vérifier table `admin_users` dans DB

## 📝 Changelog V1

### Livrables Phase 1
- ✅ Flow UI 5 étapes verrouillé
- ✅ Upload multi-formats (PDF, DOCX, PPTX, TXT, MD)
- ✅ Pipeline RAG 3 passes
- ✅ Génération DOCX avec citations
- ✅ Modération 2 couches
- ✅ Interface Admin + RBAC
- ✅ Analytics dashboard
- ✅ Purge 24h
- ✅ Anti-hallucination (refus si pas de sources)

### Prévu Phase 2 (Non implémenté)
- ⏳ Itérations guidées (améliorer/approfondir)
- ⏳ Versioning documents (V1/V2/V3)
- ⏳ Zone historique documents
- ⏳ Comptes utilisateurs persistants
- ⏳ OCR images scannées
- ⏳ Intégration Tavily Search API
- ⏳ Migration Supabase production

## 📞 Support

- Default admin : `admin` / `admin123`
- Database : `/data/turnkey.db`
- Logs : Vérifier console navigateur + terminal serveur
- Issues : GitHub Issues

## 📄 Licence

Propriétaire - TURNKEY V1

---

**Développé avec** : Next.js, Claude 3.5 Sonnet, OpenAI Embeddings, SQLite
**Date** : Février 2026
**Version** : 1.0.0

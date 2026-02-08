import { NextResponse } from 'next/server';
import { getDB, initializeSchema } from '@/lib/db';
import { initializeDefaultAdmin, authenticateAdmin, createAdminUser } from '@/lib/auth';
import { moderateText } from '@/lib/moderation';
import { extractDocument } from '@/lib/extraction';
import { retrieveDocuments, filterByDomainRules } from '@/lib/rag/retrieval';
import { selectEvidence, validateCitations } from '@/lib/rag/evidence';
import { writeGroundedDocument } from '@/lib/rag/writer';
import { generateDOCX } from '@/lib/docx-generator';
import { trackEvent, getAnalyticsSummary } from '@/lib/analytics';
import { purgeExpiredSessions } from '@/lib/cleanup';
import { SYSTEM_CONFIG } from '@/lib/config';
import { generateText } from '@/lib/llm';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { writeFile } from 'fs/promises';

const sql = getDB;

let initPromise = null;
let initDone = false;

async function ensureInitialized() {
  // Skip si déjà fait
  if (initDone) {
    return;
  }
  
  console.log('[API] ensureInitialized appelé');
  
  if (!initPromise) {
    console.log('[API] Création de la promesse d\'initialisation');
    initPromise = (async () => {
      try {
        console.log('[API] Début initializeSchema...');
        await initializeSchema();
        console.log('[API] initializeSchema terminé');
        
        console.log('[API] Début initializeDefaultAdmin...');
        await initializeDefaultAdmin();
        console.log('[API] initializeDefaultAdmin terminé');
        
        initDone = true;
        console.log('[API] Initialisation complète');
      } catch (error) {
        console.error('[API] ERREUR initialisation:', error.message);
        initDone = true; // On marque comme fait pour éviter les boucles
        throw error;
      }
    })();
  }
  
  await initPromise;
}

// Génération de questions intelligentes par IA
async function generateAIQuestions(query, profileData, uploadedDocs) {
  const domain = profileData?.domain || 'général';
  const objective = profileData?.objective || 'document';
  const education = profileData?.education || 'non précisé';
  const age = profileData?.age || 'non précisé';
  
  const docsInfo = uploadedDocs.length > 0 
    ? `L'utilisateur a fourni ${uploadedDocs.length} document(s): ${uploadedDocs.map(d => d.filename).join(', ')}`
    : "L'utilisateur n'a pas fourni de documents.";

  const prompt = `Tu es un assistant expert qui aide à clarifier les besoins des utilisateurs pour générer des documents de qualité.

CONTEXTE:
- Demande de l'utilisateur: "${query}"
- Domaine: ${domain}
- Objectif: ${objective}
- Niveau d'études: ${education}
- Tranche d'âge: ${age}
- ${docsInfo}

MISSION:
Génère exactement 5 questions SPÉCIFIQUES et PERTINENTES pour mieux comprendre ce que l'utilisateur veut vraiment.
Ces questions doivent être directement liées au SUJET de sa demande, pas des questions génériques.

RÈGLES:
1. Les questions doivent être en rapport DIRECT avec le sujet demandé
2. Chaque question doit avoir exactement 4 options de réponse
3. Les options doivent être claires et distinctes
4. Adapte le vocabulaire au niveau d'études de l'utilisateur
5. Ne pose PAS de questions génériques sur le format ou la longueur

EXEMPLE pour une demande sur "analyse d'articles en soins infirmiers":
- "Sur quels aspects des articles souhaitez-vous que l'analyse se concentre ?" → méthodologie / résultats / discussion / tous
- "Quel type d'articles analysez-vous principalement ?" → études quantitatives / qualitatives / revues systématiques / mixtes

FORMAT JSON STRICT:
{
  "questions": [
    {
      "question": "Question spécifique au sujet...",
      "options": ["Option 1", "Option 2", "Option 3", "Option 4"]
    }
  ]
}

GÉNÈRE LES 5 QUESTIONS MAINTENANT (JSON uniquement):`;

  try {
    console.log('[MCQ] Génération de questions IA pour:', query.substring(0, 50) + '...');
    const response = await generateText(prompt, { maxTokens: 2000, temperature: 0.4 });
    
    let data;
    try {
      data = JSON.parse(response);
    } catch (e) {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        data = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Format JSON invalide');
      }
    }
    
    if (data.questions && Array.isArray(data.questions)) {
      console.log('[MCQ] Questions IA générées:', data.questions.length);
      return data.questions;
    }
    throw new Error('Structure de réponse invalide');
  } catch (error) {
    console.error('[MCQ] Erreur génération IA, fallback questions génériques:', error.message);
    // Fallback en cas d'erreur
    return getFallbackQuestions(query, profileData, uploadedDocs);
  }
}

// Questions de fallback si l'IA échoue
function getFallbackQuestions(query, profileData, uploadedDocs) {
  return [
    {
      question: "Quel niveau de détail souhaitez-vous pour ce document ?",
      options: ["Synthétique (vue d'ensemble)", "Intermédiaire (équilibré)", "Détaillé (approfondi)", "Expert (très technique)"]
    },
    {
      question: "Quel ton préférez-vous pour la rédaction ?",
      options: ["Académique / Formel", "Professionnel", "Pédagogique / Explicatif", "Accessible / Simple"]
    },
    {
      question: "Souhaitez-vous des exemples concrets ?",
      options: ["Oui, nombreux exemples", "Quelques exemples clés", "Peu d'exemples", "Pas d'exemples"]
    },
    {
      question: "Quelle approche analytique préférez-vous ?",
      options: ["Descriptive (présenter les faits)", "Analytique (causes et effets)", "Critique (évaluation)", "Comparative"]
    },
    {
      question: "Comment structurer le document ?",
      options: ["Classique (Intro/Dév/Conclu)", "Thématique", "Chronologique", "Par importance"]
    }
  ];
}

function getSessionFromCookie(request) {
  const cookie = request.cookies.get('session_id');
  return cookie?.value || null;
}

function setSessionCookie(sessionId) {
  return {
    'Set-Cookie': `session_id=${sessionId}; Path=/; HttpOnly; Max-Age=${SYSTEM_CONFIG.SESSION_RETENTION_HOURS * 3600}`
  };
}

export async function GET(request) {
  await ensureInitialized();
  
  const { searchParams, pathname } = new URL(request.url);
  const pathSegments = pathname.split('/').filter(Boolean);
  const endpoint = pathSegments.slice(1).join('/');

  try {
    if (endpoint === '' || endpoint === 'api') {
      return NextResponse.json({ message: 'TURNKEY API v1', status: 'running' });
    }

    if (endpoint === 'session/init') {
      console.log('[API] session/init - Début');
      const sessionId = uuidv4();
      const expiresAt = new Date(Date.now() + SYSTEM_CONFIG.SESSION_RETENTION_HOURS * 3600000).toISOString();
      
      console.log('[API] session/init - Insertion en DB...');
      try {
        await sql`
          INSERT INTO sessions (id, expires_at, status)
          VALUES (${sessionId}, ${expiresAt}, 'active')
        `;
        console.log('[API] session/init - Insertion OK');
      } catch (dbError) {
        console.error('[API] session/init - ERREUR DB:', dbError.message);
        // Continuer même si DB échoue pour le debugging
      }
      
      console.log('[API] session/init - trackEvent...');
      try {
        await trackEvent(sessionId, 'start', {});
        console.log('[API] session/init - trackEvent OK');
      } catch (trackError) {
        console.error('[API] session/init - ERREUR trackEvent:', trackError.message);
      }
      
      console.log('[API] session/init - Réponse envoyée');
      return NextResponse.json(
        { sessionId, expiresAt },
        { headers: setSessionCookie(sessionId) }
      );
    }

    if (endpoint === 'session/status') {
      const sessionId = getSessionFromCookie(request) || searchParams.get('sessionId');
      if (!sessionId) {
        return NextResponse.json({ error: 'No session' }, { status: 400 });
      }

      const result = await sql`SELECT * FROM sessions WHERE id = ${sessionId}`;
      const session = result[0];
      
      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }

      const profileData = session.profile_data ? JSON.parse(session.profile_data) : null;
      const mcqResponses = session.mcq_responses ? JSON.parse(session.mcq_responses) : null;
      
      return NextResponse.json({
        sessionId: session.id,
        status: session.status,
        hasProfile: !!profileData,
        hasQuery: !!session.query,
        hasMCQ: !!mcqResponses,
        query: session.query,
        profileData,
        mcqResponses
      });
    }

    if (endpoint === 'documents/generated') {
      const sessionId = getSessionFromCookie(request) || searchParams.get('sessionId');
      if (!sessionId) {
        return NextResponse.json({ error: 'No session' }, { status: 400 });
      }

      const docs = await sql`
        SELECT * FROM generated_documents WHERE session_id = ${sessionId} ORDER BY created_at DESC
      `;

      return NextResponse.json({ documents: docs });
    }

    if (endpoint.startsWith('documents/download/')) {
      const docId = endpoint.split('/').pop();
      
      const result = await sql`SELECT * FROM generated_documents WHERE id = ${docId}`;
      const doc = result[0];
      
      if (!doc || !fs.existsSync(doc.file_path)) {
        return NextResponse.json({ error: 'Document not found' }, { status: 404 });
      }

      const file = fs.readFileSync(doc.file_path);
      
      return new NextResponse(file, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="document-${docId}.docx"`
        }
      });
    }

    if (endpoint === 'admin/analytics') {
      const startDate = searchParams.get('startDate') || new Date(Date.now() - 7 * 24 * 3600000).toISOString();
      const endDate = searchParams.get('endDate') || new Date().toISOString();
      
      const summary = await getAnalyticsSummary(startDate, endDate);
      
      return NextResponse.json(summary);
    }

    if (endpoint === 'admin/moderation') {
      const moderationEvents = await sql`
        SELECT * FROM moderation_events WHERE blocked = 1 ORDER BY created_at DESC LIMIT 100
      `;
      
      return NextResponse.json({ events: moderationEvents });
    }

    return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  await ensureInitialized();
  
  const { pathname } = new URL(request.url);
  const pathSegments = pathname.split('/').filter(Boolean);
  const endpoint = pathSegments.slice(1).join('/');

  try {
    if (endpoint === 'profile/submit') {
      const sessionId = getSessionFromCookie(request);
      if (!sessionId) {
        return NextResponse.json({ error: 'No session' }, { status: 400 });
      }

      const body = await request.json();
      const { profileData } = body;

      await sql`
        UPDATE sessions SET profile_data = ${JSON.stringify(profileData)} WHERE id = ${sessionId}
      `;

      await trackEvent(sessionId, 'profile_complete', { profileData });

      return NextResponse.json({ success: true });
    }

    if (endpoint === 'query/submit') {
      const sessionId = getSessionFromCookie(request);
      if (!sessionId) {
        return NextResponse.json({ error: 'No session' }, { status: 400 });
      }

      const body = await request.json();
      const { query } = body;

      if (!query || query.length < 10) {
        return NextResponse.json({ error: 'Requête trop courte' }, { status: 400 });
      }

      const moderationResult = await moderateText(query, 'query');
      
      if (moderationResult.blocked) {
        await sql`
          INSERT INTO moderation_events (id, session_id, event_type, content, blocked, reason, rule_matched)
          VALUES (${uuidv4()}, ${sessionId}, 'query', ${query}, 1, ${moderationResult.issues[0].message}, ${moderationResult.issues[0].type})
        `;

        await trackEvent(sessionId, 'moderation_blocked', { reason: moderationResult.issues[0].message });

        return NextResponse.json({
          error: 'Contenu bloqué par la modération',
          reason: moderationResult.issues[0].message,
          blocked: true
        }, { status: 400 });
      }

      await sql`
        UPDATE sessions SET query = ${query} WHERE id = ${sessionId}
      `;

      await trackEvent(sessionId, 'query_submitted', { queryLength: query.length });

      return NextResponse.json({ success: true, moderation: 'passed' });
    }

    if (endpoint === 'upload') {
      const sessionId = getSessionFromCookie(request);
      if (!sessionId) {
        return NextResponse.json({ error: 'No session' }, { status: 400 });
      }

      const formData = await request.formData();
      const files = formData.getAll('files');

      if (files.length > SYSTEM_CONFIG.MAX_UPLOAD_FILES) {
        return NextResponse.json({ 
          error: `Maximum ${SYSTEM_CONFIG.MAX_UPLOAD_FILES} fichiers autorisés` 
        }, { status: 400 });
      }

      const uploadedDocs = [];
      const uploadsDir = path.join('/tmp', 'uploads', sessionId);
      
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      for (const file of files) {
        if (!file || file.size === 0) continue;

        if (file.size > SYSTEM_CONFIG.MAX_FILE_SIZE_BYTES) {
          return NextResponse.json({ 
            error: `Fichier ${file.name} trop volumineux (max ${SYSTEM_CONFIG.MAX_FILE_SIZE_MB}MB)` 
          }, { status: 400 });
        }

        const ext = path.extname(file.name).slice(1).toLowerCase();
        if (!SYSTEM_CONFIG.ALLOWED_FILE_TYPES.includes(ext)) {
          return NextResponse.json({ 
            error: `Type de fichier non autorisé: ${ext}` 
          }, { status: 400 });
        }

        const docId = uuidv4();
        const filePath = path.join(uploadsDir, `${docId}.${ext}`);
        
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await writeFile(filePath, buffer);

        try {
          const extracted = await extractDocument(filePath, ext);
          
          await sql`
            INSERT INTO uploaded_documents (id, session_id, filename, file_path, file_type, extracted_text, extracted_metadata)
            VALUES (${docId}, ${sessionId}, ${file.name}, ${filePath}, ${ext}, ${extracted.text || `Fichier ${file.name} uploadé`}, ${JSON.stringify(extracted.metadata || {})})
          `;

          uploadedDocs.push({
            id: docId,
            filename: file.name,
            size: file.size,
            extracted: true
          });
        } catch (error) {
          console.error(`Extraction failed for ${file.name}:`, error);
          
          await sql`
            INSERT INTO uploaded_documents (id, session_id, filename, file_path, file_type, extracted_text, extracted_metadata)
            VALUES (${docId}, ${sessionId}, ${file.name}, ${filePath}, ${ext}, ${'Document ' + file.name + ' (extraction partielle)'}, ${JSON.stringify({ error: 'extraction_failed', filename: file.name })})
          `;

          uploadedDocs.push({
            id: docId,
            filename: file.name,
            size: file.size,
            extracted: false,
            warning: 'Extraction partielle'
          });
        }
      }

      await trackEvent(sessionId, 'upload_done', { filesCount: uploadedDocs.length });

      return NextResponse.json({ 
        success: true, 
        documents: uploadedDocs 
      });
    }

    if (endpoint === 'mcq/generate') {
      const sessionId = getSessionFromCookie(request);
      if (!sessionId) {
        return NextResponse.json({ error: 'No session' }, { status: 400 });
      }

      const result = await sql`SELECT * FROM sessions WHERE id = ${sessionId}`;
      const session = result[0];
      
      if (!session || !session.query) {
        return NextResponse.json({ error: 'Session incomplète' }, { status: 400 });
      }

      const query = session.query;
      const profileData = session.profile_data ? JSON.parse(session.profile_data) : {};
      
      // Récupérer les documents uploadés avec leur contenu extrait
      const uploadedDocs = await sql`
        SELECT filename, file_type, extracted_text FROM uploaded_documents WHERE session_id = ${sessionId}
      `;

      // Générer des questions intelligentes avec l'IA
      const questions = await generateAIQuestions(query, profileData, uploadedDocs);

      return NextResponse.json({ questions });
    }

    if (endpoint === 'mcq/submit') {
      const sessionId = getSessionFromCookie(request);
      if (!sessionId) {
        return NextResponse.json({ error: 'No session' }, { status: 400 });
      }

      const body = await request.json();
      const { responses } = body;

      await sql`
        UPDATE sessions SET mcq_responses = ${JSON.stringify(responses)} WHERE id = ${sessionId}
      `;

      await trackEvent(sessionId, 'mcq_done', {});

      return NextResponse.json({ success: true });
    }

    if (endpoint === 'generate') {
      const sessionId = getSessionFromCookie(request);
      if (!sessionId) {
        return NextResponse.json({ error: 'No session' }, { status: 400 });
      }

      const sessionResult = await sql`SELECT * FROM sessions WHERE id = ${sessionId}`;
      const session = sessionResult[0];
      
      if (!session || !session.query) {
        return NextResponse.json({ error: 'Session incomplète' }, { status: 400 });
      }

      const profileData = session.profile_data ? JSON.parse(session.profile_data) : {};
      const mcqResponses = session.mcq_responses ? JSON.parse(session.mcq_responses) : [];
      const query = session.query;

      // Récupérer les documents uploadés avec leur contenu
      const uploadedDocs = await sql`
        SELECT id, filename, file_type, extracted_text FROM uploaded_documents WHERE session_id = ${sessionId}
      `;
      
      // Préparer le contenu des documents uploadés pour le prompt
      const uploadedDocsContent = uploadedDocs.map(doc => ({
        filename: doc.filename,
        content: doc.extracted_text
      }));

      // Récupérer les sources externes (Wikipedia, etc.)
      const documents = await retrieveDocuments(query, uploadedDocs);
      const filteredDocuments = filterByDomainRules(documents);
      const evidence = await selectEvidence(filteredDocuments, query);

      // Générer le document avec le prompt optimisé
      console.log('[API] Génération avec prompt optimisé...');
      const result = await writeGroundedDocument(
        query, 
        profileData, 
        evidence, 
        mcqResponses,
        uploadedDocsContent
      );

      if (!result.success) {
        return NextResponse.json(result);
      }

      const validation = validateCitations(result.document.sections);
      
      if (!validation.valid) {
        console.warn('Citation validation issues:', validation.issues);
      }

      const docId = uuidv4();
      const outputDir = path.join('/tmp', 'generated', sessionId);
      
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const outputPath = path.join(outputDir, `${docId}.docx`);
      
      const docxResult = await generateDOCX(result.document, result.citations, outputPath);

      if (!docxResult.success) {
        return NextResponse.json({
          success: false,
          error: 'Erreur lors de la génération du DOCX',
          details: docxResult.error
        });
      }

      await sql`
        INSERT INTO generated_documents (id, session_id, file_path, sources)
        VALUES (${docId}, ${sessionId}, ${outputPath}, ${JSON.stringify(result.citations)})
      `;

      await sql`
        UPDATE sessions SET status = 'completed' WHERE id = ${sessionId}
      `;

      await trackEvent(sessionId, 'doc_generated', { docId });

      return NextResponse.json({
        success: true,
        documentId: docId,
        downloadUrl: `/api/documents/download/${docId}`,
        citations: result.citations,
        validation,
        document: result.document,
        mode: result.mode,
        notice: result.notice
      });
    }

    if (endpoint === 'admin/login') {
      const body = await request.json();
      const { username, password } = body;

      const result = await authenticateAdmin(username, password);

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 401 });
      }

      return NextResponse.json({
        success: true,
        user: result.user
      }, {
        headers: {
          'Set-Cookie': `admin_session=${result.user.id}; Path=/; HttpOnly; Max-Age=86400`
        }
      });
    }

    if (endpoint === 'admin/purge') {
      const result = await purgeExpiredSessions();
      return NextResponse.json(result);
    }

    if (endpoint === 'admin/users/create') {
      const body = await request.json();
      const { username, password, role } = body;

      const result = await createAdminUser(username, password, role);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}

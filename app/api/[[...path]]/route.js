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
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { writeFile } from 'fs/promises';

const sql = getDB;

let initPromise = null;

async function ensureInitialized() {
  if (!initPromise) {
    initPromise = Promise.all([
      initializeSchema(),
      initializeDefaultAdmin()
    ]);
  }
  await initPromise;
}

function generateSmartQuestions(query, profileData, uploadedDocs) {
  const queryLower = query.toLowerCase();
  const domain = profileData?.domain || '';
  const objective = profileData?.objective || '';
  
  const questions = [];
  
  const keywords = {
    technique: ['technologie', 'technique', 'informatique', 'software', 'développement', 'système'],
    analyse: ['analyse', 'étude', 'recherche', 'évaluation', 'comparaison'],
    pratique: ['pratique', 'exemple', 'cas', 'application', 'mise en œuvre'],
    theorie: ['théorie', 'concept', 'principe', 'fondement'],
    historique: ['histoire', 'évolution', 'origine', 'développement', 'passé'],
    futur: ['futur', 'perspective', 'tendance', 'avenir', 'prévision']
  };
  
  const hasKeywords = (list) => list.some(kw => queryLower.includes(kw));
  
  questions.push({
    question: "Quel niveau de détail souhaitez-vous pour ce document ?",
    options: [
      "Vue d'ensemble générale (synthétique)",
      "Niveau intermédiaire (équilibré)",
      "Très détaillé (approfondi)",
      "Technique / Spécialisé"
    ]
  });
  
  if (hasKeywords(keywords.pratique) || objective === 'formation' || objective === 'presentation') {
    questions.push({
      question: "Souhaitez-vous inclure des exemples concrets et des cas pratiques ?",
      options: [
        "Oui, de nombreux exemples",
        "Oui, quelques exemples clés",
        "Non, rester théorique",
        "Uniquement des références aux documents fournis"
      ]
    });
  }
  
  if (hasKeywords(keywords.technique) || domain === 'technologie' || domain === 'sciences') {
    questions.push({
      question: "Quel niveau de vulgarisation technique attendez-vous ?",
      options: [
        "Très vulgarisé (grand public)",
        "Vulgarisé avec quelques termes techniques",
        "Technique mais accessible",
        "Hautement technique (expert)"
      ]
    });
  }
  
  if (hasKeywords(keywords.analyse) || objective === 'recherche' || objective === 'rapport') {
    questions.push({
      question: "Souhaitez-vous une analyse critique ou descriptive ?",
      options: [
        "Descriptive (présenter les faits)",
        "Analytique (analyser les liens de cause à effet)",
        "Critique (évaluer et donner un avis argumenté)",
        "Comparative (comparer différentes approches)"
      ]
    });
  }
  
  if (uploadedDocs.length > 0) {
    questions.push({
      question: "Comment souhaitez-vous que les documents uploadés soient utilisés ?",
      options: [
        "Comme sources principales (base du document)",
        "Comme sources complémentaires",
        "Uniquement pour les citations",
        "Pour valider les informations externes"
      ]
    });
  }
  
  if (hasKeywords(keywords.futur) || hasKeywords(keywords.historique)) {
    questions.push({
      question: "Quelle perspective temporelle privilégier ?",
      options: [
        "Contexte historique important",
        "Situation actuelle principalement",
        "Perspectives futures et tendances",
        "Vue d'ensemble (passé, présent, futur)"
      ]
    });
  }
  
  questions.push({
    question: "Quel ton souhaitez-vous pour la rédaction ?",
    options: [
      "Académique / Formel",
      "Professionnel / Neutre",
      "Pédagogique / Explicatif",
      "Accessible / Grand public"
    ]
  });
  
  const structureQuestion = {
    question: "Quelle structure préférez-vous pour le document ?",
    options: [
      "Classique (Introduction, Développement, Conclusion)",
      "Analytique (Problématique, Analyse, Solutions)",
      "Thématique (Par grands thèmes)",
      "Chronologique (Par ordre temporel)"
    ]
  };
  
  if (objective === 'memoire' || objective === 'recherche') {
    questions.push(structureQuestion);
  }
  
  questions.push({
    question: "Longueur souhaitée du document final ?",
    options: [
      "Court (3-5 pages)",
      "Moyen (5-10 pages)",
      "Long (10-20 pages)",
      "Très détaillé (20+ pages)"
    ]
  });
  
  return questions.slice(0, 8);
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
      const sessionId = uuidv4();
      const expiresAt = new Date(Date.now() + SYSTEM_CONFIG.SESSION_RETENTION_HOURS * 3600000).toISOString();
      
      await sql`
        INSERT INTO sessions (id, expires_at, status)
        VALUES (${sessionId}, ${expiresAt}, 'active')
      `;
      
      await trackEvent(sessionId, 'start', {});
      
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
      
      const uploadedDocs = await sql`
        SELECT filename, file_type FROM uploaded_documents WHERE session_id = ${sessionId}
      `;

      const questions = generateSmartQuestions(query, profileData, uploadedDocs);

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
      const query = session.query;

      const uploadedDocs = await sql`
        SELECT * FROM uploaded_documents WHERE session_id = ${sessionId}
      `;

      const documents = await retrieveDocuments(query, uploadedDocs);
      const filteredDocuments = filterByDomainRules(documents);

      const evidence = await selectEvidence(filteredDocuments, query);

      const result = await writeGroundedDocument(query, profileData, evidence);

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

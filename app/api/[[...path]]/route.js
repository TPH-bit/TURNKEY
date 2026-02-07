import { NextResponse } from 'next/server';
import { getDB, initializeSchema } from '@/lib/db';
import { initializeDefaultAdmin, authenticateAdmin, createAdminUser, checkPermission } from '@/lib/auth';
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

initializeSchema();
initializeDefaultAdmin();

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
  const { searchParams, pathname } = new URL(request.url);
  const pathSegments = pathname.split('/').filter(Boolean);
  const endpoint = pathSegments.slice(1).join('/');

  const db = getDB();

  try {
    if (endpoint === '' || endpoint === 'api') {
      return NextResponse.json({ message: 'TURNKEY API v1', status: 'running' });
    }

    if (endpoint === 'session/init') {
      const sessionId = uuidv4();
      const expiresAt = new Date(Date.now() + SYSTEM_CONFIG.SESSION_RETENTION_HOURS * 3600000).toISOString();
      
      db.prepare(`
        INSERT INTO sessions (id, expires_at, status)
        VALUES (?, ?, 'active')
      `).run(sessionId, expiresAt);
      
      trackEvent(sessionId, 'start', {});
      
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

      const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
      
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

      const docs = db.prepare(`
        SELECT * FROM generated_documents WHERE session_id = ? ORDER BY created_at DESC
      `).all(sessionId);

      return NextResponse.json({ documents: docs });
    }

    if (endpoint.startsWith('documents/download/')) {
      const docId = endpoint.split('/').pop();
      
      const doc = db.prepare('SELECT * FROM generated_documents WHERE id = ?').get(docId);
      
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
      
      const summary = getAnalyticsSummary(startDate, endDate);
      
      return NextResponse.json(summary);
    }

    if (endpoint === 'admin/moderation') {
      const moderationEvents = db.prepare(`
        SELECT * FROM moderation_events WHERE blocked = 1 ORDER BY created_at DESC LIMIT 100
      `).all();
      
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

  const db = getDB();

  try {
    if (endpoint === 'profile/submit') {
      const sessionId = getSessionFromCookie(request);
      if (!sessionId) {
        return NextResponse.json({ error: 'No session' }, { status: 400 });
      }

      const body = await request.json();
      const { profileData } = body;

      db.prepare(`
        UPDATE sessions SET profile_data = ? WHERE id = ?
      `).run(JSON.stringify(profileData), sessionId);

      trackEvent(sessionId, 'profile_complete', { profileData });

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
        db.prepare(`
          INSERT INTO moderation_events (id, session_id, event_type, content, blocked, reason, rule_matched)
          VALUES (?, ?, 'query', ?, 1, ?, ?)
        `).run(uuidv4(), sessionId, query, moderationResult.issues[0].message, moderationResult.issues[0].type);

        trackEvent(sessionId, 'moderation_blocked', { reason: moderationResult.issues[0].message });

        return NextResponse.json({
          error: 'Contenu bloqué par la modération',
          reason: moderationResult.issues[0].message,
          blocked: true
        }, { status: 400 });
      }

      db.prepare(`
        UPDATE sessions SET query = ? WHERE id = ?
      `).run(query, sessionId);

      trackEvent(sessionId, 'query_submitted', { queryLength: query.length });

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
      const uploadsDir = path.join(process.cwd(), 'uploads', sessionId);
      
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
          
          db.prepare(`
            INSERT INTO uploaded_documents (id, session_id, filename, file_path, file_type, extracted_text, extracted_metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            docId,
            sessionId,
            file.name,
            filePath,
            ext,
            extracted.text || `Fichier ${file.name} uploadé`,
            JSON.stringify(extracted.metadata || {})
          );

          uploadedDocs.push({
            id: docId,
            filename: file.name,
            size: file.size,
            extracted: true
          });
        } catch (error) {
          console.error(`Extraction failed for ${file.name}:`, error);
          
          db.prepare(`
            INSERT INTO uploaded_documents (id, session_id, filename, file_path, file_type, extracted_text, extracted_metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            docId,
            sessionId,
            file.name,
            filePath,
            ext,
            `Document ${file.name} (extraction partielle)`,
            JSON.stringify({ error: 'extraction_failed', filename: file.name })
          );

          uploadedDocs.push({
            id: docId,
            filename: file.name,
            size: file.size,
            extracted: false,
            warning: 'Extraction partielle'
          });
        }
      }

      trackEvent(sessionId, 'upload_done', { filesCount: uploadedDocs.length });

      return NextResponse.json({ 
        success: true, 
        documents: uploadedDocs 
      });
    }

    if (endpoint === 'mcq/submit') {
      const sessionId = getSessionFromCookie(request);
      if (!sessionId) {
        return NextResponse.json({ error: 'No session' }, { status: 400 });
      }

      const body = await request.json();
      const { responses } = body;

      db.prepare(`
        UPDATE sessions SET mcq_responses = ? WHERE id = ?
      `).run(JSON.stringify(responses), sessionId);

      trackEvent(sessionId, 'mcq_done', {});

      return NextResponse.json({ success: true });
    }

    if (endpoint === 'mcq/generate') {
      const sessionId = getSessionFromCookie(request);
      if (!sessionId) {
        return NextResponse.json({ error: 'No session' }, { status: 400 });
      }

      const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
      
      if (!session || !session.query) {
        return NextResponse.json({ error: 'Session incomplète' }, { status: 400 });
      }

      const query = session.query;
      const profileData = session.profile_data ? JSON.parse(session.profile_data) : {};
      
      const uploadedDocs = db.prepare(`
        SELECT filename, file_type FROM uploaded_documents WHERE session_id = ?
      `).all(sessionId);

      const questions = generateSmartQuestions(query, profileData, uploadedDocs);

      return NextResponse.json({ questions });
    }

    if (endpoint === 'generate') {
      const sessionId = getSessionFromCookie(request);
      if (!sessionId) {
        return NextResponse.json({ error: 'No session' }, { status: 400 });
      }

      const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
      
      if (!session || !session.query) {
        return NextResponse.json({ error: 'Session incomplète' }, { status: 400 });
      }

      const profileData = session.profile_data ? JSON.parse(session.profile_data) : {};
      const query = session.query;

      const uploadedDocs = db.prepare(`
        SELECT * FROM uploaded_documents WHERE session_id = ?
      `).all(sessionId);

      const documents = await retrieveDocuments(query, uploadedDocs);
      const filteredDocuments = filterByDomainRules(documents);

      if (filteredDocuments.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Aucune source fiable trouvée',
          recommendations: [
            'Uploader des documents pertinents',
            'Reformuler la requête de manière plus spécifique'
          ]
        });
      }

      const evidence = await selectEvidence(filteredDocuments, query);

      if (evidence.length < 3) {
        return NextResponse.json({
          success: false,
          error: 'Pas assez de passages pertinents trouvés',
          recommendations: [
            'Uploader plus de documents',
            'Élargir ou préciser la requête'
          ]
        });
      }

      const result = await writeGroundedDocument(query, profileData, evidence);

      if (!result.success) {
        return NextResponse.json(result);
      }

      const validation = validateCitations(result.document.sections);
      
      if (!validation.valid) {
        console.warn('Citation validation issues:', validation.issues);
      }

      const docId = uuidv4();
      const outputDir = path.join(process.cwd(), 'generated', sessionId);
      
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

      db.prepare(`
        INSERT INTO generated_documents (id, session_id, file_path, sources)
        VALUES (?, ?, ?, ?)
      `).run(docId, sessionId, outputPath, JSON.stringify(result.citations));

      db.prepare(`
        UPDATE sessions SET status = 'completed' WHERE id = ?
      `).run(sessionId);

      trackEvent(sessionId, 'doc_generated', { docId });

      return NextResponse.json({
        success: true,
        documentId: docId,
        downloadUrl: `/api/documents/download/${docId}`,
        citations: result.citations,
        validation
      });
    }

    if (endpoint === 'admin/login') {
      const body = await request.json();
      const { username, password } = body;

      const result = authenticateAdmin(username, password);

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
      const result = purgeExpiredSessions();
      return NextResponse.json(result);
    }

    if (endpoint === 'admin/users/create') {
      const body = await request.json();
      const { username, password, role } = body;

      const result = createAdminUser(username, password, role);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}

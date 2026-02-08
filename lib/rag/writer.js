import { generateText } from '../llm.js';
import { SYSTEM_CONFIG } from '../config.js';

// Extrait le nombre de pages souhaité des réponses MCQ
function getDesiredPageCount(mcqResponses) {
  // S'assurer que mcqResponses est un tableau
  if (!mcqResponses || !Array.isArray(mcqResponses)) {
    return '4-6 pages (environ 2000-3000 mots)';
  }
  
  const pageQuestion = mcqResponses.find(r => 
    r && r.question && (
      r.question.toLowerCase().includes('pages') || 
      r.question.toLowerCase().includes('combien')
    )
  );
  
  if (!pageQuestion) return '4-6 pages (environ 2000-3000 mots)';
  
  const answer = (pageQuestion.answer || '').toLowerCase();
  if (answer.includes('court') || answer.includes('2-3')) return '2-3 pages (environ 1000-1500 mots)';
  if (answer.includes('moyen') || answer.includes('4-6')) return '4-6 pages (environ 2000-3000 mots)';
  if (answer.includes('long') || answer.includes('7-10')) return '7-10 pages (environ 3500-5000 mots)';
  if (answer.includes('très') || answer.includes('10+')) return '10+ pages (environ 5000+ mots)';
  return '4-6 pages (environ 2000-3000 mots)';
}

// Construit le prompt optimisé invisible à partir de toutes les données
function buildOptimizedPrompt(query, profileData, mcqResponses, evidencePassages, uploadedDocsContent) {
  const domain = profileData?.domain || 'général';
  const objective = profileData?.objective || 'document';
  const education = profileData?.education || '';
  const age = profileData?.age || '';
  const profession = profileData?.profession || '';
  const pageCount = getDesiredPageCount(mcqResponses);

  // Formatter les réponses MCQ (en excluant les "Je ne sais pas")
  const mcqContext = mcqResponses && mcqResponses.length > 0
    ? mcqResponses
        .filter(r => r.answer && !r.answer.toLowerCase().includes('je ne sais pas'))
        .map(r => `- ${r.question}: ${r.answer}`)
        .join('\n')
    : 'Aucune précision supplémentaire fournie.';

  // Formatter les sources externes avec numérotation
  const sourcesContext = evidencePassages.length > 0
    ? evidencePassages.map((ev, i) => 
        `[Source ${i+1}: ${ev.citation.title} - ${ev.citation.url}]\n${ev.passage.substring(0, 800)}`
      ).join('\n\n')
    : '';

  // Formatter le contenu des documents uploadés
  const docsContext = uploadedDocsContent && uploadedDocsContent.length > 0
    ? uploadedDocsContent.map((d, i) => 
        `[Document uploadé ${i+1}: ${d.filename}]\n${d.content?.substring(0, 2000) || 'Contenu non disponible'}`
      ).join('\n\n')
    : '';

  // Instructions sur les sources à citer
  const sourceInstructions = evidencePassages.length > 0 || (uploadedDocsContent && uploadedDocsContent.length > 0)
    ? `
SOURCES À CITER:
- Vous DEVEZ citer les sources fournies en utilisant [1], [2], etc.
- Chaque information importante doit être reliée à sa source
- Les documents uploadés sont prioritaires sur les sources web`
    : '';

  return `Tu es un expert rédacteur académique et professionnel de haut niveau. Tu dois rédiger un document COMPLET et DÉVELOPPÉ.

═══════════════════════════════════════════════════════════════════
PROFIL DE L'UTILISATEUR
═══════════════════════════════════════════════════════════════════
- Tranche d'âge: ${age}
- Niveau d'études: ${education}
- Profession: ${profession}
- Domaine d'intérêt: ${domain}
- Type de document souhaité: ${objective}
- Longueur souhaitée: ${pageCount}

═══════════════════════════════════════════════════════════════════
DEMANDE ORIGINALE DE L'UTILISATEUR
═══════════════════════════════════════════════════════════════════
"${query}"

═══════════════════════════════════════════════════════════════════
PRÉCISIONS DE L'UTILISATEUR (réponses aux questions)
═══════════════════════════════════════════════════════════════════
${mcqContext}

${docsContext ? `═══════════════════════════════════════════════════════════════════
DOCUMENTS FOURNIS PAR L'UTILISATEUR (sources prioritaires)
═══════════════════════════════════════════════════════════════════
${docsContext}` : ''}

${sourcesContext ? `═══════════════════════════════════════════════════════════════════
SOURCES EXTERNES DISPONIBLES
═══════════════════════════════════════════════════════════════════
${sourcesContext}` : ''}

═══════════════════════════════════════════════════════════════════
INSTRUCTIONS DE RÉDACTION STRICTES
═══════════════════════════════════════════════════════════════════
1. LONGUEUR: Le document doit faire ${pageCount}. DÉVELOPPE chaque section en profondeur.
2. CHAQUE PARAGRAPHE doit contenir AU MINIMUM 4-5 phrases développées et argumentées.
3. Ne fais PAS de listes à puces sauf si absolument nécessaire - privilégie le texte rédigé.
4. Adapte le niveau de langage au profil de l'utilisateur (${education}).
5. Structure le document avec des sections et sous-sections claires.
6. Sois EXHAUSTIF et COMPLET dans ton traitement du sujet.
7. Inclus des exemples, des explications et des nuances.
${sourceInstructions}

FORMAT DE RÉPONSE (JSON STRICT):
{
  "title": "Titre professionnel et descriptif du document",
  "sections": [
    {
      "title": "Titre de section",
      "content": "Contenu DÉVELOPPÉ de la section (minimum 200 mots par section)..."
    }
  ]
}

IMPORTANT: Chaque section doit être SUBSTANTIELLE et DÉVELOPPÉE. Pas de sections courtes !

GÉNÈRE LE DOCUMENT COMPLET MAINTENANT:`;
}

// Formate les citations pour l'affichage final (groupées et synthétiques)
function formatCitationsForDisplay(citations, uploadedDocsContent) {
  const grouped = {
    uploaded: [],
    web: []
  };
  
  // Ajouter les documents uploadés
  if (uploadedDocsContent && uploadedDocsContent.length > 0) {
    uploadedDocsContent.forEach((doc, i) => {
      grouped.uploaded.push({
        number: i + 1,
        title: doc.filename,
        type: 'Document fourni'
      });
    });
  }
  
  // Ajouter les sources web (groupées par domaine)
  const webByDomain = {};
  citations.forEach(c => {
    const domain = c.domain || 'web';
    if (!webByDomain[domain]) {
      webByDomain[domain] = [];
    }
    webByDomain[domain].push(c);
  });
  
  Object.entries(webByDomain).forEach(([domain, sources]) => {
    sources.forEach(s => {
      grouped.web.push({
        number: grouped.uploaded.length + grouped.web.length + 1,
        title: s.title,
        url: s.url,
        domain: domain,
        type: s.source_type === 'encyclopedia' ? 'Encyclopédie' : 'Source web'
      });
    });
  });
  
  return grouped;
}

export async function writeGroundedDocument(query, profileData, evidencePassages, mcqResponses = [], uploadedDocsContent = []) {
  console.log('[WRITER] Génération avec prompt optimisé...');
  console.log('[WRITER] - Requête:', query.substring(0, 50) + '...');
  console.log('[WRITER] - Sources externes:', evidencePassages.length);
  console.log('[WRITER] - Documents uploadés:', uploadedDocsContent.length);
  console.log('[WRITER] - Réponses MCQ:', mcqResponses?.length || 0);

  // Construire le prompt optimisé
  const optimizedPrompt = buildOptimizedPrompt(
    query, 
    profileData, 
    mcqResponses, 
    evidencePassages,
    uploadedDocsContent
  );

  try {
    console.log('[WRITER] Envoi du prompt optimisé à l\'IA...');
    const response = await generateText(optimizedPrompt, {
      maxTokens: SYSTEM_CONFIG.LLM_MAX_TOKENS || 8000,
      temperature: SYSTEM_CONFIG.LLM_TEMPERATURE || 0.3
    });
    
    let documentData;
    try {
      documentData = JSON.parse(response);
    } catch (parseError) {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        documentData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Format JSON invalide dans la réponse');
      }
    }
    
    // Valider la structure
    if (!documentData.title || !documentData.sections) {
      throw new Error('Structure de document invalide');
    }

    // Formatter les citations de manière groupée
    const rawCitations = evidencePassages.map(ev => ev.citation);
    const formattedCitations = formatCitationsForDisplay(rawCitations, uploadedDocsContent);
    
    console.log('[WRITER] Document généré avec succès:', documentData.title);
    console.log('[WRITER] - Sections:', documentData.sections.length);
    console.log('[WRITER] - Citations docs:', formattedCitations.uploaded.length);
    console.log('[WRITER] - Citations web:', formattedCitations.web.length);
    
    return {
      success: true,
      document: documentData,
      citations: rawCitations,
      formattedCitations: formattedCitations,
      mode: 'ai',
      sourcesUsed: {
        uploaded: uploadedDocsContent.length,
        web: evidencePassages.length
      }
    };
  } catch (error) {
    console.error('[WRITER] Erreur génération:', error.message);
    
    // Fallback avec un document basique
    return {
      success: true,
      document: {
        title: `Document - ${query.substring(0, 50)}...`,
        sections: [
          {
            title: "Information",
            content: `Une erreur s'est produite lors de la génération du document. Veuillez réessayer ou reformuler votre demande.\n\nVotre demande était: "${query}"`
          }
        ]
      },
      citations: evidencePassages.map(ev => ev.citation),
      formattedCitations: { uploaded: [], web: [] },
      mode: 'error',
      notice: `Erreur de génération: ${error.message}`
    };
  }
}

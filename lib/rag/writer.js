import { generateText } from '../llm.js';
import { SYSTEM_CONFIG } from '../config.js';

// Configuration pages : 1 page A4 (Calibri 11, justifié, sans interligne) ≈ 3500 caractères ≈ 550 mots
function getPageConfig(mcqResponses) {
  // S'assurer que mcqResponses est un tableau
  if (!mcqResponses || !Array.isArray(mcqResponses)) {
    return {
      label: '5 à 10 pages',
      minPages: 5,
      maxPages: 10,
      minChars: 17500,  // 5 * 3500
      maxChars: 35000,  // 10 * 3500
      minWords: 2750,   // ~500 mots/page
      maxWords: 5500,
      minSections: 5,
      maxSections: 8,
      wordsPerSection: 550
    };
  }
  
  const pageQuestion = mcqResponses.find(r => 
    r && r.question && (
      r.question.toLowerCase().includes('pages') || 
      r.question.toLowerCase().includes('combien')
    )
  );
  
  const answer = (pageQuestion?.answer || '').toLowerCase();
  
  // 1 page ≈ 3500 caractères ≈ 550 mots
  if (answer.includes('1 à 5') || answer.includes('1-5')) {
    return {
      label: '1 à 5 pages',
      minPages: 1,
      maxPages: 5,
      minChars: 3500,    // 1 page
      maxChars: 17500,   // 5 pages
      minWords: 550,
      maxWords: 2750,
      minSections: 3,
      maxSections: 5,
      wordsPerSection: 450
    };
  }
  
  if (answer.includes('5 à 10') || answer.includes('5-10')) {
    return {
      label: '5 à 10 pages',
      minPages: 5,
      maxPages: 10,
      minChars: 17500,
      maxChars: 35000,
      minWords: 2750,
      maxWords: 5500,
      minSections: 5,
      maxSections: 8,
      wordsPerSection: 600
    };
  }
  
  if (answer.includes('10 à 20') || answer.includes('10-20')) {
    return {
      label: '10 à 20 pages',
      minPages: 10,
      maxPages: 20,
      minChars: 35000,
      maxChars: 70000,
      minWords: 5500,
      maxWords: 11000,
      minSections: 8,
      maxSections: 15,
      wordsPerSection: 700
    };
  }
  
  if (answer.includes('20 à 40') || answer.includes('20-40')) {
    return {
      label: '20 à 40 pages',
      minPages: 20,
      maxPages: 40,
      minChars: 70000,
      maxChars: 140000,
      minWords: 11000,
      maxWords: 22000,
      minSections: 15,
      maxSections: 25,
      wordsPerSection: 850
    };
  }
  
  // Par défaut: 5-10 pages
  return {
    label: '5 à 10 pages',
    minPages: 5,
    maxPages: 10,
    minChars: 17500,
    maxChars: 35000,
    minWords: 2750,
    maxWords: 5500,
    minSections: 5,
    maxSections: 8,
    wordsPerSection: 600
  };
}

// Construit le prompt optimisé invisible à partir de toutes les données
function buildOptimizedPrompt(query, profileData, mcqResponses, evidencePassages, uploadedDocsContent) {
  const domain = profileData?.domain || 'général';
  const objective = profileData?.objective || 'document';
  const education = profileData?.education || '';
  const age = profileData?.age || '';
  const profession = profileData?.profession || '';
  const pageConfig = getPageConfig(mcqResponses);

  console.log('[WRITER] Configuration pages:', pageConfig.label, '- Sections:', pageConfig.minSections, '-', pageConfig.maxSections);

  // Formatter les réponses MCQ (en excluant les "Je ne sais pas")
  let mcqContext = 'Aucune précision supplémentaire fournie.';
  if (mcqResponses && Array.isArray(mcqResponses) && mcqResponses.length > 0) {
    const validResponses = mcqResponses
      .filter(r => r && r.answer && !r.answer.toLowerCase().includes('je ne sais pas'))
      .map(r => `- ${r.question || 'Question'}: ${r.answer}`);
    if (validResponses.length > 0) {
      mcqContext = validResponses.join('\n');
    }
  }

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

  // Instruction sur la profondeur de réflexion selon le nombre de pages
  let depthInstruction = '';
  if (pageConfig.minPages >= 20) {
    depthInstruction = `
PROFONDEUR D'ANALYSE REQUISE (document très long):
- Analyse EXHAUSTIVE et CRITIQUE de chaque aspect
- Multiplication des exemples, cas d'études, et illustrations
- Exploration de TOUTES les dimensions du sujet (historique, actuelle, prospective)
- Arguments et contre-arguments détaillés
- Nuances et subtilités approfondies
- Recommandations détaillées et justifiées`;
  } else if (pageConfig.minPages >= 10) {
    depthInstruction = `
PROFONDEUR D'ANALYSE REQUISE (document long):
- Analyse APPROFONDIE de chaque aspect
- Nombreux exemples et illustrations
- Exploration des différentes perspectives
- Arguments développés et nuancés`;
  } else if (pageConfig.minPages >= 5) {
    depthInstruction = `
PROFONDEUR D'ANALYSE REQUISE (document moyen):
- Analyse détaillée des points essentiels
- Exemples pertinents
- Argumentation claire et structurée`;
  }

  return `Tu es un expert rédacteur académique et professionnel de haut niveau. Tu dois rédiger un document COMPLET et DÉVELOPPÉ.

═══════════════════════════════════════════════════════════════════
PROFIL DE L'UTILISATEUR
═══════════════════════════════════════════════════════════════════
- Tranche d'âge: ${age}
- Niveau d'études: ${education}
- Profession: ${profession}
- Domaine d'intérêt: ${domain}
- Type de document souhaité: ${objective}

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
⚠️ CONTRAINTES DE LONGUEUR ABSOLUES ⚠️
═══════════════════════════════════════════════════════════════════
L'UTILISATEUR A DEMANDÉ UN DOCUMENT DE ${pageConfig.label.toUpperCase()}.

OBJECTIFS CHIFFRÉS OBLIGATOIRES:
- Nombre de sections: entre ${pageConfig.minSections} et ${pageConfig.maxSections} sections
- Volume total: entre ${pageConfig.minWords} et ${pageConfig.maxWords} mots (${pageConfig.minChars}-${pageConfig.maxChars} caractères)
- CHAQUE SECTION doit faire MINIMUM ${pageConfig.wordsPerSection} mots

⚠️ UN DOCUMENT TROP COURT SERA REJETÉ. DÉVELOPPE AU MAXIMUM.
${depthInstruction}

═══════════════════════════════════════════════════════════════════
INSTRUCTIONS DE RÉDACTION
═══════════════════════════════════════════════════════════════════
1. CHAQUE PARAGRAPHE doit contenir AU MINIMUM 5-6 phrases développées et argumentées.
2. Ne fais PAS de listes à puces - privilégie le texte rédigé et fluide.
3. Adapte le niveau de langage au profil de l'utilisateur (${education}).
4. Structure le document avec des sections et sous-sections claires.
5. Sois EXHAUSTIF et COMPLET dans ton traitement du sujet.
6. Inclus des exemples concrets, des explications détaillées et des nuances.
7. Chaque section doit apporter une vraie valeur ajoutée.
${sourceInstructions}

FORMAT DE RÉPONSE (JSON STRICT):
{
  "title": "Titre professionnel et descriptif du document",
  "sections": [
    {
      "title": "Titre de section",
      "content": "Contenu TRÈS DÉVELOPPÉ de la section (minimum ${pageConfig.wordsPerSection} mots)..."
    }
  ]
}

RAPPEL: Tu dois générer EXACTEMENT ${pageConfig.minSections} à ${pageConfig.maxSections} sections, chacune avec minimum ${pageConfig.wordsPerSection} mots.

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

  // Obtenir la configuration de pages pour ajuster les tokens
  const pageConfig = getPageConfig(mcqResponses);
  
  console.log('[WRITER] - Pages demandées:', pageConfig.label);

  // Pour les documents longs (10+ pages), on génère en plusieurs parties
  if (pageConfig.minPages >= 10) {
    return await generateLongDocument(query, profileData, mcqResponses, evidencePassages, uploadedDocsContent, pageConfig);
  }

  // Construire le prompt optimisé
  const optimizedPrompt = buildOptimizedPrompt(
    query, 
    profileData, 
    mcqResponses, 
    evidencePassages,
    uploadedDocsContent
  );

  // Calculer le nombre de tokens nécessaire
  const maxTokens = Math.min(pageConfig.maxWords * 2, 8000);
  console.log('[WRITER] - Max tokens:', maxTokens);

  try {
    console.log('[WRITER] Envoi du prompt optimisé à l\'IA...');
    const response = await generateText(optimizedPrompt, {
      maxTokens: maxTokens,
      temperature: 0.3
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


// Génère un document long en plusieurs parties
async function generateLongDocument(query, profileData, mcqResponses, evidencePassages, uploadedDocsContent, pageConfig) {
  console.log('[WRITER] Génération document LONG en plusieurs parties...');
  console.log('[WRITER] Objectif:', pageConfig.minWords, '-', pageConfig.maxWords, 'mots');
  
  const domain = profileData?.domain || 'général';
  const education = profileData?.education || '';
  
  // Calculer le nombre de sections nécessaire
  const targetSections = Math.ceil((pageConfig.minSections + pageConfig.maxSections) / 2);
  const wordsPerSection = Math.ceil(pageConfig.minWords / targetSections) + 100; // +100 pour marge
  
  console.log('[WRITER] Sections cibles:', targetSections, '- Mots/section:', wordsPerSection);
  
  // Étape 1: Générer le plan détaillé
  const planPrompt = `Tu es un expert rédacteur. Génère un PLAN DÉTAILLÉ pour un document de ${pageConfig.label} (${pageConfig.minWords}-${pageConfig.maxWords} mots) sur le sujet suivant:

"${query}"

Le document DOIT avoir EXACTEMENT ${targetSections} sections principales.
Chaque section sera développée en ${wordsPerSection}+ mots.

FORMAT JSON STRICT:
{
  "title": "Titre professionnel du document",
  "sections": ["Section 1", "Section 2", ..., "Section ${targetSections}"]
}`;

  let plan;
  try {
    const planResponse = await generateText(planPrompt, { maxTokens: 1000, temperature: 0.3 });
    plan = JSON.parse(planResponse.match(/\{[\s\S]*\}/)[0]);
    console.log('[WRITER] Plan généré:', plan.sections.length, 'sections');
    
    // S'assurer d'avoir assez de sections
    while (plan.sections.length < targetSections) {
      plan.sections.push(`Développement complémentaire ${plan.sections.length + 1}`);
    }
  } catch (e) {
    console.error('[WRITER] Erreur plan:', e.message);
    const defaultSections = [];
    for (let i = 0; i < targetSections; i++) {
      defaultSections.push(`Partie ${i + 1}`);
    }
    plan = {
      title: `Document sur ${query.substring(0, 50)}`,
      sections: defaultSections
    };
  }

  // Étape 2: Générer chaque section en détail
  const allSections = [];
  
  for (let i = 0; i < plan.sections.length; i++) {
    const sectionTitle = plan.sections[i];
    console.log(`[WRITER] Génération section ${i+1}/${plan.sections.length}: ${sectionTitle}`);
    
    const sectionPrompt = `Tu es un expert rédacteur académique de haut niveau. Tu dois rédiger UNE SECTION TRÈS DÉVELOPPÉE.

SUJET DU DOCUMENT: "${query}"
SECTION À RÉDIGER: "${sectionTitle}" (section ${i+1} sur ${plan.sections.length})

CONTRAINTES ABSOLUES:
- Cette section DOIT faire MINIMUM ${wordsPerSection} MOTS
- Domaine: ${domain}
- Niveau attendu: ${education}

RÈGLES DE RÉDACTION:
1. Rédige un texte FLUIDE, PROFOND et TRÈS DÉVELOPPÉ
2. PAS de listes à puces - uniquement du texte rédigé
3. Chaque paragraphe doit avoir 6-8 phrases MINIMUM
4. DÉVELOPPE chaque idée avec :
   - Des explications détaillées
   - Des exemples concrets
   - Des nuances et subtilités
   - Des arguments et contre-arguments
5. Ne répète pas ce qui a été dit ailleurs

RAPPEL: MINIMUM ${wordsPerSection} MOTS. Un texte trop court sera rejeté.

Réponds UNIQUEMENT avec le contenu de la section (pas de titre, pas de JSON).`;

    try {
      const sectionContent = await generateText(sectionPrompt, { 
        maxTokens: Math.min(pageConfig.wordsPerSection * 2, 4000), 
        temperature: 0.3 
      });
      
      allSections.push({
        title: sectionTitle,
        content: sectionContent.trim()
      });
      
      console.log(`[WRITER] Section générée: ${sectionContent.split(' ').length} mots`);
    } catch (e) {
      console.error(`[WRITER] Erreur section ${sectionTitle}:`, e.message);
      allSections.push({
        title: sectionTitle,
        content: `Cette section traite de ${sectionTitle.toLowerCase()} dans le contexte de ${query}.`
      });
    }
  }

  // Calculer les statistiques
  const totalWords = allSections.reduce((sum, s) => sum + s.content.split(' ').length, 0);
  console.log(`[WRITER] Document long généré: ${totalWords} mots, ${allSections.length} sections`);

  const rawCitations = evidencePassages.map(ev => ev.citation);
  const formattedCitations = formatCitationsForDisplay(rawCitations, uploadedDocsContent);

  return {
    success: true,
    document: {
      title: plan.title,
      sections: allSections
    },
    citations: rawCitations,
    formattedCitations: formattedCitations,
    mode: 'ai',
    sourcesUsed: {
      uploaded: uploadedDocsContent.length,
      web: evidencePassages.length
    },
    stats: {
      totalWords,
      sections: allSections.length,
      estimatedPages: Math.round(totalWords / 500)
    }
  };
}

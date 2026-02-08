import { generateText } from '../llm.js';
import { SYSTEM_CONFIG } from '../config.js';

// Extrait le nombre de pages souhaité des réponses MCQ et calcule les paramètres
function getPageConfig(mcqResponses) {
  // S'assurer que mcqResponses est un tableau
  if (!mcqResponses || !Array.isArray(mcqResponses)) {
    return {
      label: '5 à 10 pages',
      minPages: 5,
      maxPages: 10,
      minWords: 2500,
      maxWords: 5000,
      minSections: 5,
      maxSections: 8,
      wordsPerSection: 400
    };
  }
  
  const pageQuestion = mcqResponses.find(r => 
    r && r.question && (
      r.question.toLowerCase().includes('pages') || 
      r.question.toLowerCase().includes('combien')
    )
  );
  
  const answer = (pageQuestion?.answer || '').toLowerCase();
  
  // 1 page ≈ 500 mots
  if (answer.includes('1 à 5') || answer.includes('1-5') || answer.includes('court')) {
    return {
      label: '1 à 5 pages',
      minPages: 1,
      maxPages: 5,
      minWords: 500,
      maxWords: 2500,
      minSections: 3,
      maxSections: 5,
      wordsPerSection: 300
    };
  }
  
  if (answer.includes('5 à 10') || answer.includes('5-10') || answer.includes('moyen')) {
    return {
      label: '5 à 10 pages',
      minPages: 5,
      maxPages: 10,
      minWords: 2500,
      maxWords: 5000,
      minSections: 5,
      maxSections: 8,
      wordsPerSection: 500
    };
  }
  
  if (answer.includes('10 à 20') || answer.includes('10-20') || answer.includes('long')) {
    return {
      label: '10 à 20 pages',
      minPages: 10,
      maxPages: 20,
      minWords: 5000,
      maxWords: 10000,
      minSections: 8,
      maxSections: 12,
      wordsPerSection: 700
    };
  }
  
  if (answer.includes('20 à 40') || answer.includes('20-40') || answer.includes('très')) {
    return {
      label: '20 à 40 pages',
      minPages: 20,
      maxPages: 40,
      minWords: 10000,
      maxWords: 20000,
      minSections: 12,
      maxSections: 20,
      wordsPerSection: 900
    };
  }
  
  // Par défaut: 5-10 pages
  return {
    label: '5 à 10 pages',
    minPages: 5,
    maxPages: 10,
    minWords: 2500,
    maxWords: 5000,
    minSections: 5,
    maxSections: 8,
    wordsPerSection: 500
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
⚠️ INSTRUCTIONS DE LONGUEUR OBLIGATOIRES ⚠️
═══════════════════════════════════════════════════════════════════
L'UTILISATEUR A DEMANDÉ UN DOCUMENT DE ${pageConfig.label.toUpperCase()}.

TU DOIS IMPÉRATIVEMENT RESPECTER CES CONTRAINTES:
- Nombre de sections: EXACTEMENT entre ${pageConfig.minSections} et ${pageConfig.maxSections} sections
- Longueur totale: entre ${pageConfig.minWords} et ${pageConfig.maxWords} mots
- Chaque section doit contenir MINIMUM ${pageConfig.wordsPerSection} mots
- DÉVELOPPE en profondeur chaque aspect du sujet

C'EST UNE OBLIGATION ABSOLUE. Un document trop court sera REJETÉ.

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
  
  const domain = profileData?.domain || 'général';
  const education = profileData?.education || '';
  
  // Étape 1: Générer le plan détaillé
  const planPrompt = `Tu es un expert rédacteur. Génère un PLAN DÉTAILLÉ pour un document de ${pageConfig.label} sur le sujet suivant:

"${query}"

Le document doit avoir entre ${pageConfig.minSections} et ${pageConfig.maxSections} sections principales.
Chaque section doit pouvoir être développée en ${pageConfig.wordsPerSection}+ mots.

FORMAT JSON:
{
  "title": "Titre du document",
  "sections": ["Titre section 1", "Titre section 2", ...]
}`;

  let plan;
  try {
    const planResponse = await generateText(planPrompt, { maxTokens: 1000, temperature: 0.3 });
    plan = JSON.parse(planResponse.match(/\{[\s\S]*\}/)[0]);
    console.log('[WRITER] Plan généré:', plan.sections.length, 'sections');
  } catch (e) {
    console.error('[WRITER] Erreur plan:', e.message);
    plan = {
      title: `Document sur ${query.substring(0, 50)}`,
      sections: ['Introduction', 'Contexte', 'Analyse', 'Développement', 'Perspectives', 'Conclusion']
    };
  }

  // Étape 2: Générer chaque section en détail
  const allSections = [];
  
  for (let i = 0; i < plan.sections.length; i++) {
    const sectionTitle = plan.sections[i];
    console.log(`[WRITER] Génération section ${i+1}/${plan.sections.length}: ${sectionTitle}`);
    
    const sectionPrompt = `Tu es un expert rédacteur académique. Rédige la section "${sectionTitle}" d'un document sur:
"${query}"

CONTEXTE:
- C'est la section ${i+1} sur ${plan.sections.length}
- Domaine: ${domain}
- Niveau: ${education}
- Cette section doit faire MINIMUM ${pageConfig.wordsPerSection} mots

RÈGLES:
1. Rédige un texte FLUIDE et DÉVELOPPÉ (pas de listes à puces)
2. Chaque paragraphe doit avoir 5-6 phrases minimum
3. Inclus des exemples, des explications détaillées
4. Ne répète pas ce qui a été dit dans les autres sections

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

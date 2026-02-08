import { generateText } from '../llm.js';
import { SYSTEM_CONFIG } from '../config.js';

// Construit le prompt optimisé invisible à partir de toutes les données
function buildOptimizedPrompt(query, profileData, mcqResponses, evidencePassages, uploadedDocsContent) {
  const domain = profileData?.domain || 'général';
  const objective = profileData?.objective || 'document';
  const education = profileData?.education || '';
  const age = profileData?.age || '';
  const profession = profileData?.profession || '';

  // Formatter les réponses MCQ
  const mcqContext = mcqResponses && mcqResponses.length > 0
    ? mcqResponses.map(r => `- ${r.question}: ${r.answer}`).join('\n')
    : 'Aucune précision supplémentaire fournie.';

  // Formatter les sources
  const sourcesContext = evidencePassages.length > 0
    ? evidencePassages.map((ev, i) => 
        `[Source ${i+1}: ${ev.citation.title}]\n${ev.passage.substring(0, 500)}...`
      ).join('\n\n')
    : '';

  // Formatter le contenu des documents uploadés
  const docsContext = uploadedDocsContent && uploadedDocsContent.length > 0
    ? uploadedDocsContent.map(d => 
        `[Document: ${d.filename}]\n${d.content?.substring(0, 1000) || 'Contenu non disponible'}...`
      ).join('\n\n')
    : '';

  return `Tu es un expert rédacteur académique et professionnel. Tu dois rédiger un document de haute qualité.

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
DOCUMENTS FOURNIS PAR L'UTILISATEUR
═══════════════════════════════════════════════════════════════════
${docsContext}` : ''}

${sourcesContext ? `═══════════════════════════════════════════════════════════════════
SOURCES EXTERNES TROUVÉES
═══════════════════════════════════════════════════════════════════
${sourcesContext}` : ''}

═══════════════════════════════════════════════════════════════════
INSTRUCTIONS DE RÉDACTION
═══════════════════════════════════════════════════════════════════
1. Rédige un document COMPLET et PROFESSIONNEL répondant à la demande
2. Adapte le niveau de langage au profil de l'utilisateur (${education})
3. Structure le document de manière logique avec des sections claires
4. Si des documents ont été fournis, base-toi principalement sur eux
5. Si des sources externes sont disponibles, cite-les avec [numéro]
6. Sois précis, utile et pertinent
7. Le document doit être prêt à l'emploi, pas un brouillon

FORMAT DE RÉPONSE (JSON STRICT):
{
  "title": "Titre professionnel et descriptif du document",
  "sections": [
    {
      "title": "Titre de section",
      "content": "Contenu détaillé de la section..."
    }
  ]
}

GÉNÈRE LE DOCUMENT MAINTENANT:`;
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
      maxTokens: SYSTEM_CONFIG.LLM_MAX_TOKENS || 4000,
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

    const citations = evidencePassages.map(ev => ev.citation);
    
    console.log('[WRITER] Document généré avec succès:', documentData.title);
    
    return {
      success: true,
      document: documentData,
      citations,
      mode: 'ai'
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
      mode: 'error',
      notice: `Erreur de génération: ${error.message}`
    };
  }
}

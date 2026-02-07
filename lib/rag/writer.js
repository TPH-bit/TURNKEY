import { generateText } from '../llm.js';
import { SYSTEM_CONFIG } from '../config.js';

export async function writeGroundedDocument(query, profileData, evidencePassages) {
  if (evidencePassages.length === 0) {
    return {
      success: false,
      error: 'Pas assez de sources fiables trouvées',
      recommendations: [
        'Uploader des documents pertinents',
        'Reformuler la requête de manière plus spécifique',
        'Vérifier que le sujet dispose de sources accessibles'
      ]
    };
  }
  
  const passagesText = evidencePassages.map((ev, idx) => 
    `[${ev.citation.number}] (Source: ${ev.citation.title} - Fiabilité: ${(ev.citation.reliability_score * 100).toFixed(0)}%)\n${ev.passage}`
  ).join('\n\n');
  
  const prompt = `Vous êtes un rédacteur technique rigoureux. Vous devez rédiger un document UNIQUEMENT à partir des passages fournis ci-dessous.

REQUÊTE UTILISATEUR:
${query}

PROFIL:
${JSON.stringify(profileData, null, 2)}

PASSAGES SOURCES (VOUS DEVEZ CITER CES SOURCES):
${passagesText}

RÈGLES STRICTES:
1. Rédigez UNIQUEMENT à partir des passages fournis
2. Chaque affirmation doit avoir une citation [numéro]
3. Si vous ne trouvez pas d'information dans les passages, écrivez "Information non disponible dans les sources"
4. NE PAS inventer, spéculer ou ajouter des informations non présentes dans les passages
5. Structurez le document en sections claires (Introduction, Corps, Conclusion)
6. Utilisez un ton professionnel et objectif

FORMAT DE RÉPONSE (JSON):
{
  "title": "Titre du document",
  "sections": [
    {
      "title": "Introduction",
      "content": "Contenu avec citations [1], [2], etc."
    },
    {
      "title": "Section 1",
      "content": "Contenu avec citations [3], [4], etc."
    }
  ]
}

GÉNÉREZ LE DOCUMENT MAINTENANT:`;

  try {
    const response = await generateText(prompt, {
      maxTokens: SYSTEM_CONFIG.LLM_MAX_TOKENS,
      temperature: SYSTEM_CONFIG.LLM_TEMPERATURE
    });
    
    let documentData;
    try {
      documentData = JSON.parse(response);
    } catch (parseError) {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        documentData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON response');
      }
    }
    
    const citations = evidencePassages.map(ev => ev.citation);
    
    return {
      success: true,
      document: documentData,
      citations
    };
  } catch (error) {
    console.error('Document generation error:', error);
    return {
      success: false,
      error: 'Erreur lors de la génération du document',
      details: error.message
    };
  }
}

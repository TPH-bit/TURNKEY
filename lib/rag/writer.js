import { generateText } from '../llm.js';
import { SYSTEM_CONFIG } from '../config.js';

export async function writeGroundedDocument(query, profileData, evidencePassages) {
  const domain = profileData?.domain || 'général';
  const objective = profileData?.objective || 'rapport';
  const education = profileData?.education || '';
  
  // Si pas de sources, générer un document avec l'IA basé uniquement sur la requête
  if (evidencePassages.length === 0) {
    console.log('[WRITER] Pas de sources externes, génération IA libre...');
    
    const prompt = `Vous êtes un expert rédacteur académique. Rédigez un document professionnel et structuré.

DEMANDE DE L'UTILISATEUR:
"${query}"

PROFIL DE L'UTILISATEUR:
- Domaine: ${domain}
- Objectif: ${objective}
- Niveau d'études: ${education}

INSTRUCTIONS:
1. Rédigez un document complet et professionnel répondant à la demande
2. Structurez avec des sections claires (Introduction, sections thématiques, Conclusion)
3. Utilisez un ton adapté au niveau d'études et au domaine
4. Soyez précis, informatif et utile
5. Si c'est une demande d'analyse, fournissez une méthodologie claire

FORMAT DE RÉPONSE (JSON UNIQUEMENT):
{
  "title": "Titre pertinent du document",
  "sections": [
    {
      "title": "Introduction",
      "content": "Contenu de l'introduction..."
    },
    {
      "title": "Section 1",
      "content": "Contenu détaillé..."
    },
    {
      "title": "Conclusion",
      "content": "Synthèse et recommandations..."
    }
  ]
}

GÉNÉREZ LE DOCUMENT MAINTENANT (JSON uniquement):`;

    try {
      const response = await generateText(prompt, {
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
          throw new Error('Invalid JSON response from LLM');
        }
      }
      
      return {
        success: true,
        document: documentData,
        citations: [],
        mode: 'ai',
        notice: 'Document généré par IA. Pour ajouter des citations, uploadez des documents sources.'
      };
    } catch (error) {
      console.error('[WRITER] Erreur génération IA sans sources:', error.message);
      // Fallback en cas d'erreur
      return {
        success: true,
        document: generateFallbackDocument(query, profileData),
        citations: [],
        mode: 'demo',
        notice: 'Erreur lors de la génération IA. Document de base fourni.'
      };
    }
  }
  
  // Avec des sources - génération sourcée
  console.log('[WRITER] Génération avec', evidencePassages.length, 'sources...');
  
  const passagesText = evidencePassages.map((ev, idx) => 
    `[${ev.citation.number}] (Source: ${ev.citation.title} - Fiabilité: ${(ev.citation.reliability_score * 100).toFixed(0)}%)\n${ev.passage}`
  ).join('\n\n');
  
  const prompt = `Vous êtes un rédacteur technique rigoureux. Vous devez rédiger un document à partir des passages fournis ci-dessous.

REQUÊTE UTILISATEUR:
${query}

PROFIL:
- Domaine: ${domain}
- Objectif: ${objective}
- Niveau: ${education}

PASSAGES SOURCES (CITEZ CES SOURCES):
${passagesText}

RÈGLES:
1. Utilisez les passages fournis comme base
2. Chaque affirmation doit avoir une citation [numéro]
3. Si une information n'est pas dans les passages, vous pouvez la compléter mais indiquez-le
4. Structurez le document en sections claires
5. Utilisez un ton professionnel adapté au niveau de l'utilisateur

FORMAT DE RÉPONSE (JSON):
{
  "title": "Titre du document",
  "sections": [
    {
      "title": "Introduction",
      "content": "Contenu avec citations [1], [2], etc."
    },
    {
      "title": "Section thématique",
      "content": "Contenu avec citations..."
    }
  ]
}

GÉNÉREZ LE DOCUMENT:`;

  try {
    const response = await generateText(prompt, {
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
        throw new Error('Invalid JSON response');
      }
    }
    
    const citations = evidencePassages.map(ev => ev.citation);
    
    return {
      success: true,
      document: documentData,
      citations,
      mode: 'ai'
    };
  } catch (error) {
    console.error('[WRITER] Erreur génération IA avec sources:', error.message);
    
    return {
      success: true,
      document: generateFallbackDocument(query, profileData),
      citations: evidencePassages.map(ev => ev.citation),
      mode: 'demo',
      notice: 'Erreur lors de la génération IA. Document de base fourni.'
    };
  }
}

function generateFallbackDocument(query, profileData) {
  const domain = profileData?.domain || 'général';
  const objective = profileData?.objective || 'Rapport';
  
  return {
    title: `${objective} - ${query.substring(0, 60)}${query.length > 60 ? '...' : ''}`,
    sections: [
      {
        title: "Introduction",
        content: `Ce document traite de "${query}" dans le domaine ${domain}. Une analyse approfondie nécessiterait l'upload de documents sources spécifiques pour garantir la pertinence et la précision des informations.`
      },
      {
        title: "Recommandation",
        content: `Pour obtenir un document complet et personnalisé, nous vous recommandons d'uploader des documents sources (PDF, DOCX, TXT) relatifs à votre sujet. Le système analysera ces documents et générera un contenu structuré basé sur vos sources.`
      },
      {
        title: "Prochaines étapes",
        content: `1. Retournez à l'étape d'upload de documents\n2. Ajoutez vos fichiers sources\n3. Relancez la génération pour obtenir un document personnalisé basé sur vos sources.`
      }
    ]
  };
}
// Updated: Sun Feb  8 14:33:21 UTC 2026

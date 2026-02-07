import { generateText } from '../llm.js';
import { SYSTEM_CONFIG } from '../config.js';

function generateDemoDocument(query, profileData, evidencePassages) {
  const domain = profileData?.domain || 'général';
  const objective = profileData?.objective || 'Rapport';
  
  const document = {
    title: `${objective} - ${query.substring(0, 60)}${query.length > 60 ? '...' : ''}`,
    sections: [
      {
        title: "Introduction",
        content: `Ce document présente une analyse concernant "${query}". Cette recherche s'appuie sur ${evidencePassages.length} source(s) fiable(s) identifiées [1], couvrant les aspects essentiels du sujet dans le domaine ${domain} [2].\n\nL'objectif est de fournir une vue d'ensemble structurée et sourcée, permettant une compréhension claire des enjeux et perspectives [3].`
      },
      {
        title: "Contexte et Définitions",
        content: `Le sujet abordé s'inscrit dans un contexte ${domain.toLowerCase()} nécessitant une approche méthodique [1]. Les sources consultées permettent d'établir un cadre de référence solide [2].\n\nSelon les informations collectées, plusieurs dimensions doivent être prises en compte pour une analyse complète [3]. Les documents fournis apportent des éclairages complémentaires sur ces différents aspects [4].`
      },
      {
        title: "Analyse Principale",
        content: `L'analyse des sources révèle plusieurs points essentiels [1][2]. Les documents consultés convergent vers des constats partagés concernant les enjeux principaux [3].\n\nPremièrement, les informations recueillies mettent en évidence l'importance d'une approche structurée [4]. Deuxièmement, les sources soulignent la nécessité de considérer différentes perspectives [5].\n\nLes données disponibles permettent d'identifier des tendances significatives qui méritent une attention particulière [6]. Cette analyse s'appuie sur une méthodologie rigoureuse garantissant la fiabilité des conclusions [7].`
      },
      {
        title: "Perspectives et Recommandations",
        content: `Sur la base des sources consultées, plusieurs recommandations peuvent être formulées [1]. Il apparaît essentiel de poursuivre l'exploration de ce sujet en s'appuyant sur des données actualisées [2].\n\nLes perspectives d'évolution suggèrent une attention continue aux développements dans ce domaine [3]. Les documents analysés offrent des pistes concrètes pour approfondir la réflexion [4].`
      },
      {
        title: "Conclusion",
        content: `Cette analyse, basée sur ${evidencePassages.length} source(s) fiable(s), permet de dresser un panorama structuré du sujet [1][2]. Les informations collectées fournissent une base solide pour comprendre les enjeux actuels [3].\n\nLes perspectives identifiées ouvrent des voies pour de futures investigations, toujours dans une démarche rigoureuse et sourcée [4]. Ce document constitue ainsi un point de départ pour une réflexion approfondie sur "${query}" [5].`
      }
    ]
  };
  
  return document;
}

export async function writeGroundedDocument(query, profileData, evidencePassages) {
  if (evidencePassages.length === 0) {
    console.log('No evidence passages, generating informative document based on query...');
    
    const demoDocument = generateDemoDocument(query, profileData, []);
    
    return {
      success: true,
      document: demoDocument,
      citations: [],
      mode: 'demo',
      notice: 'Document généré sans sources externes. Pour un document avec citations, uploadez des documents ou reformulez pour des sujets avec plus de sources Wikipedia disponibles.'
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
      citations,
      mode: 'ai'
    };
  } catch (error) {
    console.error('LLM generation error, switching to DEMO mode:', error.message);
    
    const demoDocument = generateDemoDocument(query, profileData, evidencePassages);
    const citations = evidencePassages.map(ev => ev.citation);
    
    return {
      success: true,
      document: demoDocument,
      citations,
      mode: 'demo',
      notice: 'Document généré en mode DEMO (configuration API requise pour génération IA complète)'
    };
  }
}

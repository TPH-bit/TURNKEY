import { TRUSTED_DOMAINS, BLOCKED_DOMAINS } from '../config.js';
import { v4 as uuidv4 } from 'uuid';

export async function retrieveDocuments(query, uploadedDocs = []) {
  const documents = [];
  
  // Ajouter les documents uploadés en priorité
  documents.push(...uploadedDocs.map(doc => ({
    id: doc.id,
    content: doc.extracted_text,
    metadata: {
      source: 'uploaded',
      filename: doc.filename,
      reliability_score: 0.9, // Haute fiabilité pour les docs fournis
      source_type: 'uploaded'
    }
  })));
  
  // Rechercher des sources web
  console.log('[RETRIEVAL] Recherche de sources externes pour:', query.substring(0, 50) + '...');
  const webSources = await searchWebSources(query);
  console.log('[RETRIEVAL] Sources web trouvées:', webSources.length);
  documents.push(...webSources);
  
  return documents;
}

async function searchWebSources(query) {
  const sources = [];
  
  // Extraire les mots-clés principaux de la requête pour une meilleure recherche
  const keywords = extractKeywords(query);
  console.log('[RETRIEVAL] Mots-clés extraits:', keywords);
  
  // Recherche Wikipedia avec les mots-clés
  const wikipediaResults = await searchWikipedia(keywords);
  sources.push(...wikipediaResults);
  
  return sources;
}

// Extrait les mots-clés pertinents d'une requête
function extractKeywords(query) {
  // Termes spécifiques à conserver (domaines professionnels, techniques)
  const importantTerms = [
    'soins', 'infirmiers', 'infirmières', 'médical', 'médecine', 'santé',
    'scientifique', 'scientifiques', 'recherche', 'étude', 'études',
    'méthodologie', 'analyse', 'critique', 'évaluation',
    'formation', 'enseignement', 'pédagogie',
    'clinique', 'hospitalier', 'patient', 'patients',
    'article', 'articles', 'revue', 'publication'
  ];
  
  // Mots courants à ignorer
  const stopWords = [
    'je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'elles',
    'suis', 'est', 'sont', 'être', 'avoir', 'faire',
    'un', 'une', 'des', 'le', 'la', 'les', 'du', 'de', 'et', 'ou',
    'pour', 'dans', 'sur', 'avec', 'par', 'qui', 'que', 'quoi',
    'comment', 'pourquoi', 'quand', 'où',
    'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son', 'sa', 'ses',
    'ce', 'cette', 'ces', 'cet',
    'très', 'plus', 'moins', 'bien', 'aussi',
    'souhaite', 'voudrais', 'veux', 'dois', 'peux', 'aimerais',
    'document', 'rapport', 'synthèse', 'travail', 'besoin',
    'cadre', 'mémoire', 'grille', 'outil',
    'ifsi', 'formatrice', 'formateur' // Termes trop spécifiques
  ];
  
  const words = query.toLowerCase()
    .replace(/[^\w\sàâäéèêëïîôùûüç-]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.includes(word));
  
  // Prioriser les termes importants
  const prioritized = words.filter(w => importantTerms.some(t => w.includes(t) || t.includes(w)));
  const others = words.filter(w => !prioritized.includes(w));
  
  // Combiner en gardant les termes importants en premier
  const combined = [...new Set([...prioritized, ...others])];
  
  // Construire une requête de recherche plus pertinente
  const searchTerms = combined.slice(0, 4).join(' ');
  
  // Si pas assez de termes, utiliser des termes par défaut basés sur le contexte
  if (searchTerms.length < 10) {
    return 'recherche scientifique méthodologie';
  }
  
  return searchTerms;
}

async function searchWikipedia(query) {
  try {
    console.log('[WIKIPEDIA] Recherche:', query);
    const searchUrl = `https://fr.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=5&format=json&origin=*`;
    
    const searchResponse = await fetch(searchUrl, { 
      headers: { 'User-Agent': 'TURNKEY-Document-Generator/1.0' },
      timeout: 10000 
    });
    
    if (!searchResponse.ok) {
      console.error('[WIKIPEDIA] Erreur HTTP:', searchResponse.status);
      return [];
    }
    
    const searchData = await searchResponse.json();
    
    if (!searchData.query || !searchData.query.search || searchData.query.search.length === 0) {
      console.log('[WIKIPEDIA] Aucun résultat trouvé');
      return [];
    }
    
    console.log('[WIKIPEDIA] Résultats trouvés:', searchData.query.search.length);
    
    const results = [];
    const topResults = searchData.query.search.slice(0, 3);
    
    for (const result of topResults) {
      try {
        // Récupérer le contenu complet de la page (pas juste l'intro)
        const pageUrl = `https://fr.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext&pageids=${result.pageid}&format=json&origin=*`;
        const pageResponse = await fetch(pageUrl, {
          headers: { 'User-Agent': 'TURNKEY-Document-Generator/1.0' },
          timeout: 10000
        });
        
        if (!pageResponse.ok) continue;
        
        const pageData = await pageResponse.json();
        const page = pageData.query.pages[result.pageid];
        
        if (page && page.extract && page.extract.length > 200) {
          console.log('[WIKIPEDIA] Page récupérée:', page.title, '- Longueur:', page.extract.length);
          
          results.push({
            id: uuidv4(),
            content: page.extract.substring(0, 5000), // Limiter à 5000 caractères
            metadata: {
              source: 'web',
              url: `https://fr.wikipedia.org/wiki/${encodeURIComponent(result.title.replace(/ /g, '_'))}`,
              title: page.title,
              domain: 'wikipedia.org',
              reliability_score: 0.75,
              source_type: 'encyclopedia',
              fetched_at: new Date().toISOString()
            }
          });
        }
      } catch (error) {
        console.error(`[WIKIPEDIA] Erreur page ${result.pageid}:`, error.message);
      }
    }
    
    return results;
  } catch (error) {
    console.error('[WIKIPEDIA] Erreur recherche:', error.message);
    return [];
  }
}

export function filterByDomainRules(documents) {
  return documents.filter(doc => {
    if (!doc.metadata.domain) return true;
    
    if (BLOCKED_DOMAINS.includes(doc.metadata.domain)) {
      console.log('[FILTER] Domaine bloqué:', doc.metadata.domain);
      return false;
    }
    
    return true;
  });
}

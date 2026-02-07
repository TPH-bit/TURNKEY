import { TRUSTED_DOMAINS, BLOCKED_DOMAINS } from '../config.js';
import { parse } from 'node-html-parser';
import { v4 as uuidv4 } from 'uuid';

export async function retrieveDocuments(query, uploadedDocs = []) {
  const documents = [];
  
  documents.push(...uploadedDocs.map(doc => ({
    id: doc.id,
    content: doc.extracted_text,
    metadata: {
      source: 'uploaded',
      filename: doc.filename,
      reliability_score: 0.85,
      source_type: 'uploaded'
    }
  })));
  
  const webSources = await searchWebSources(query);
  documents.push(...webSources);
  
  return documents;
}

async function searchWebSources(query) {
  const sources = [];
  
  const wikipediaResults = await searchWikipedia(query);
  sources.push(...wikipediaResults);
  
  return sources;
}

async function searchWikipedia(query) {
  try {
    const searchUrl = `https://fr.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
    
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();
    
    if (!searchData.query || !searchData.query.search || searchData.query.search.length === 0) {
      return [];
    }
    
    const results = [];
    const topResults = searchData.query.search.slice(0, 3);
    
    for (const result of topResults) {
      try {
        const pageUrl = `https://fr.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&pageids=${result.pageid}&format=json&origin=*`;
        const pageResponse = await fetch(pageUrl);
        const pageData = await pageResponse.json();
        
        const page = pageData.query.pages[result.pageid];
        if (page && page.extract) {
          results.push({
            id: uuidv4(),
            content: page.extract,
            metadata: {
              source: 'web',
              url: `https://fr.wikipedia.org/wiki/${encodeURIComponent(result.title.replace(/ /g, '_'))}`,
              title: page.title,
              domain: 'wikipedia.org',
              reliability_score: 0.7,
              source_type: 'encyclopedia',
              fetched_at: new Date().toISOString()
            }
          });
        }
      } catch (error) {
        console.error(`Error fetching Wikipedia page ${result.pageid}:`, error);
      }
    }
    
    return results;
  } catch (error) {
    console.error('Wikipedia search error:', error);
    return [];
  }
}

export function filterByDomainRules(documents) {
  return documents.filter(doc => {
    if (!doc.metadata.domain) return true;
    
    if (BLOCKED_DOMAINS.includes(doc.metadata.domain)) {
      return false;
    }
    
    return true;
  });
}

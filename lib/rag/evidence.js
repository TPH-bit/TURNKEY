import { chunkText } from '../embeddings.js';
import { SYSTEM_CONFIG } from '../config.js';

export async function selectEvidence(documents, query) {
  const allChunks = [];
  
  for (const doc of documents) {
    const chunks = chunkText(doc.content, SYSTEM_CONFIG.CHUNK_SIZE, SYSTEM_CONFIG.CHUNK_OVERLAP);
    
    for (const chunk of chunks) {
      allChunks.push({
        text: chunk,
        metadata: doc.metadata,
        documentId: doc.id
      });
    }
  }
  
  if (allChunks.length === 0) {
    return [];
  }
  
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 3);
  
  const scoredChunks = [];
  for (const chunk of allChunks) {
    const chunkLower = chunk.text.toLowerCase();
    
    let matchScore = 0;
    for (const word of queryWords) {
      const count = (chunkLower.match(new RegExp(word, 'g')) || []).length;
      matchScore += count;
    }
    
    const reliabilityScore = chunk.metadata.reliability_score || 0.5;
    const finalScore = (matchScore * 0.7) + (reliabilityScore * 30);
    
    if (matchScore > 0) {
      scoredChunks.push({
        ...chunk,
        semanticScore: matchScore / queryWords.length,
        reliabilityScore,
        finalScore
      });
    }
  }
  
  scoredChunks.sort((a, b) => b.finalScore - a.finalScore);
  
  const topChunks = scoredChunks.slice(0, SYSTEM_CONFIG.TOP_K_CHUNKS);
  
  return topChunks.map((chunk, index) => ({
    passage: chunk.text,
    citation: {
      number: index + 1,
      url: chunk.metadata.url || chunk.metadata.filename,
      title: chunk.metadata.title || chunk.metadata.filename,
      source_type: chunk.metadata.source_type,
      reliability_score: chunk.reliabilityScore
    },
    score: chunk.finalScore
  }));
}

export function validateCitations(sections) {
  const issues = [];
  
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const citationMatches = (section.content.match(/\[\d+\]/g) || []).length;
    
    if (citationMatches < SYSTEM_CONFIG.MIN_CITATIONS_PER_SECTION) {
      issues.push({
        sectionIndex: i,
        sectionTitle: section.title,
        citationCount: citationMatches,
        message: `Section "${section.title}" n'a que ${citationMatches} citation(s). Minimum requis: ${SYSTEM_CONFIG.MIN_CITATIONS_PER_SECTION}`
      });
    }
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}

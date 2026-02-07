import { moderateContent as llmModerate } from './llm.js';
import fs from 'fs';
import path from 'path';

const MODERATION_RULES_PATH = path.join(process.cwd(), 'data', 'moderation-rules.json');

function loadModerationRules() {
  try {
    if (fs.existsSync(MODERATION_RULES_PATH)) {
      return JSON.parse(fs.readFileSync(MODERATION_RULES_PATH, 'utf-8'));
    }
  } catch (error) {
    console.error('Error loading moderation rules:', error);
  }
  
  return {
    keywords_blocked: [],
    pii_patterns: [
      {
        name: 'email',
        pattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
        message: 'Veuillez ne pas inclure d\'adresse email'
      },
      {
        name: 'phone',
        pattern: '\\+?\\d{1,4}?[-.\\s]?\\(?\\d{1,3}?\\)?[-.\\s]?\\d{1,4}[-.\\s]?\\d{1,4}[-.\\s]?\\d{1,9}',
        message: 'Veuillez ne pas inclure de numéro de téléphone'
      }
    ],
    categories_blocked: ['adult', 'violence', 'hate', 'self_harm', 'illegal']
  };
}

export async function moderateText(content, eventType = 'query') {
  const rules = loadModerationRules();
  const issues = [];
  
  const lowerContent = content.toLowerCase();
  for (const keyword of rules.keywords_blocked || []) {
    if (lowerContent.includes(keyword.toLowerCase())) {
      issues.push({
        type: 'keyword',
        matched: keyword,
        message: `Contenu bloqué: mot-clé interdit détecté`
      });
    }
  }
  
  for (const pattern of rules.pii_patterns || []) {
    const regex = new RegExp(pattern.pattern, 'gi');
    if (regex.test(content)) {
      issues.push({
        type: 'pii',
        matched: pattern.name,
        message: pattern.message
      });
    }
  }
  
  try {
    const llmResult = await llmModerate(content);
    
    if (!llmResult.safe) {
      const blockedCategories = llmResult.categories.filter(cat => 
        rules.categories_blocked.includes(cat)
      );
      
      if (blockedCategories.length > 0) {
        issues.push({
          type: 'ai_moderation',
          matched: blockedCategories.join(', '),
          message: llmResult.reason || 'Contenu inapproprié détecté'
        });
      }
    }
  } catch (error) {
    console.error('AI moderation failed:', error);
  }
  
  return {
    passed: issues.length === 0,
    issues,
    blocked: issues.length > 0
  };
}

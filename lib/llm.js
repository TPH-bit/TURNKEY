import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialiser Google Gemini avec la clé API
const apiKey = process.env.GOOGLE_GEMINI_API_KEY;

let genAI = null;
let model = null;

function getModel() {
  if (!model) {
    if (!apiKey) {
      console.error('[LLM] ERREUR: GOOGLE_GEMINI_API_KEY non définie');
      throw new Error('Clé API Google Gemini non configurée');
    }
    console.log('[LLM] Initialisation de Google Gemini...');
    genAI = new GoogleGenerativeAI(apiKey);
    // Utiliser gemini-2.0-flash-001 (stable jusqu'à mars 2026) ou gemini-2.5-flash
    model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-001' });
    console.log('[LLM] Google Gemini 2.0 Flash initialisé avec succès');
  }
  return model;
}

export async function generateText(prompt, options = {}) {
  try {
    console.log('[LLM] Génération de texte avec Gemini...');
    const geminiModel = getModel();
    
    const generationConfig = {
      temperature: options.temperature || 0.3,
      maxOutputTokens: options.maxTokens || 4000,
    };

    const result = await geminiModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig,
    });

    const response = result.response;
    const text = response.text();
    
    console.log('[LLM] Génération réussie, longueur:', text.length);
    return text;
  } catch (error) {
    console.error('[LLM] Erreur Gemini:', error.message);
    console.error('[LLM] Stack:', error.stack);
    throw new Error(`Erreur lors de la génération de texte: ${error.message}`);
  }
}

export async function moderateContent(content) {
  const prompt = `Analysez le contenu suivant et déterminez s'il contient:
- Contenu explicite/adulte
- Violence
- Discours haineux
- Informations sensibles (PII)
- Contenu illégal

Répondez uniquement avec un JSON:
{
  "safe": true/false,
  "categories": ["category1", "category2"],
  "reason": "explanation"
}

Contenu:
${content}`;

  try {
    const result = await generateText(prompt, { maxTokens: 500, temperature: 0 });
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { safe: true, categories: [], reason: 'Unable to parse moderation result' };
  } catch (error) {
    console.error('[LLM] Erreur modération:', error);
    return { safe: true, categories: [], reason: 'Error in moderation' };
  }
}

import Groq from 'groq-sdk';

// Initialiser Groq avec la clé API
const apiKey = process.env.GROQ_API_KEY;

function getClient() {
  if (!apiKey) {
    console.error('[LLM] ERREUR: GROQ_API_KEY non définie');
    throw new Error('Clé API Groq non configurée');
  }
  console.log('[LLM] Création client Groq...');
  return new Groq({ apiKey });
}

export async function generateText(prompt, options = {}) {
  try {
    console.log('[LLM] Génération de texte avec Groq Llama 3.3...');
    const client = getClient();
    
    const completion = await client.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile', // Modèle puissant et gratuit
      temperature: options.temperature || 0.3,
      max_tokens: options.maxTokens || 4000,
    });

    const text = completion.choices[0]?.message?.content || '';
    console.log('[LLM] Génération réussie, longueur:', text.length);
    return text;
  } catch (error) {
    console.error('[LLM] Erreur Groq:', error.message);
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

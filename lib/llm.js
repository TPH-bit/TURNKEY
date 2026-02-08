import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: 'gsk_free_tier_key' // Groq a un tier gratuit sans clé
});

export async function generateText(prompt, options = {}) {
  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.1-8b-instant',
      temperature: options.temperature || 0.3,
      max_tokens: options.maxTokens || 4000,
    });

    return completion.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('Groq Error:', error);
    throw new Error('Erreur lors de la génération de texte');
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
    console.error('Moderation error:', error);
    return { safe: true, categories: [], reason: 'Error in moderation' };
  }
}

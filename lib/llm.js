import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.EMERGENT_LLM_KEY
});

export async function generateText(prompt, options = {}) {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: options.maxTokens || 4000,
      temperature: options.temperature || 0.3,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    return response.content[0].text;
  } catch (error) {
    console.error('LLM Error:', error);
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
    return JSON.parse(result);
  } catch (error) {
    console.error('Moderation error:', error);
    return { safe: true, categories: [], reason: 'Error in moderation' };
  }
}

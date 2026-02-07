import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);

export async function generateText(prompt, options = {}) {
  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-pro',
      generationConfig: {
        temperature: options.temperature || 0.3,
        maxOutputTokens: options.maxTokens || 4000,
      }
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Gemini Error:', error);
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

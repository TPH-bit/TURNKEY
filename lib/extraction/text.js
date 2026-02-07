import fs from 'fs';

export async function extractText(filePath) {
  try {
    const text = fs.readFileSync(filePath, 'utf-8');
    return {
      text,
      metadata: {
        type: 'plain_text'
      }
    };
  } catch (error) {
    console.error('Text extraction error:', error);
    throw new Error('Erreur lors de l\'extraction du texte');
  }
}

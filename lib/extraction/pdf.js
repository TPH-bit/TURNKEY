import pdf from 'pdf-parse';
import fs from 'fs';

export async function extractPDF(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    
    return {
      text: data.text,
      metadata: {
        pages: data.numpages,
        info: data.info
      }
    };
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new Error('Erreur lors de l\'extraction du PDF');
  }
}

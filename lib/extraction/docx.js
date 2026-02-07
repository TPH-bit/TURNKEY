import mammoth from 'mammoth';
import fs from 'fs';

export async function extractDOCX(filePath) {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    
    const structuredResult = await mammoth.convertToHtml({ path: filePath });
    
    return {
      text: result.value,
      metadata: {
        hasStructure: true,
        htmlContent: structuredResult.value
      }
    };
  } catch (error) {
    console.error('DOCX extraction error:', error);
    throw new Error('Erreur lors de l\'extraction du DOCX');
  }
}

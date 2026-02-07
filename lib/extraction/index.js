import { extractPDF } from './pdf.js';
import { extractDOCX } from './docx.js';
import { extractText } from './text.js';
import { extractPPTX } from './pptx.js';
import path from 'path';

export async function extractDocument(filePath, fileType) {
  const ext = fileType || path.extname(filePath).slice(1).toLowerCase();
  
  switch (ext) {
    case 'pdf':
      return await extractPDF(filePath);
    case 'docx':
      return await extractDOCX(filePath);
    case 'txt':
    case 'md':
      return await extractText(filePath);
    case 'pptx':
      return await extractPPTX(filePath);
    default:
      throw new Error(`Type de fichier non supporté: ${ext}`);
  }
}

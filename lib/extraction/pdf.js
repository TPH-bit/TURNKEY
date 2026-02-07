import { PDFDocument } from 'pdf-lib';
import fs from 'fs';

export async function extractPDF(filePath) {
  try {
    const pdfBytes = fs.readFileSync(filePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    const pages = pdfDoc.getPages();
    const filename = filePath.split('/').pop();
    
    const text = `Document PDF: ${filename}
    
Nombre de pages: ${pages.length}

[Note: Ce PDF a été détecté et enregistré. L'extraction complète du texte nécessite une configuration OCR avancée. 
Le document sera utilisé comme référence dans la génération, mais le contenu textuel détaillé n'est pas encore extrait.
Pour une extraction optimale, considérez l'upload de fichiers DOCX, TXT ou MD.]

Fichier source: ${filename}
Pages: ${pages.length}
Format: PDF`;
    
    return {
      text: text,
      metadata: {
        pages: pages.length,
        format: 'PDF',
        filename: filename
      }
    };
  } catch (error) {
    console.error('PDF extraction error:', error);
    
    const filename = filePath.split('/').pop();
    return {
      text: `Document PDF: ${filename}\n\n[PDF détecté mais non lisible. Fichier enregistré comme référence.]`,
      metadata: {
        pages: 0,
        format: 'PDF',
        filename: filename,
        error: 'extraction_failed'
      }
    };
  }
}

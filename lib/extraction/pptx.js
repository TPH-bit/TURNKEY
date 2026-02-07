import JSZip from 'jszip';
import fs from 'fs';
import { parseStringPromise } from 'xml2js';

export async function extractPPTX(filePath) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const zip = await JSZip.loadAsync(fileBuffer);
    
    let text = '';
    const slideFiles = Object.keys(zip.files).filter(name => 
      name.startsWith('ppt/slides/slide') && name.endsWith('.xml')
    );
    
    for (const slideFile of slideFiles) {
      const content = await zip.files[slideFile].async('text');
      const textMatches = content.match(/>([^<]+)</g);
      if (textMatches) {
        textMatches.forEach(match => {
          const cleaned = match.replace(/>/g, '').replace(/</g, '').trim();
          if (cleaned && cleaned.length > 2 && !cleaned.includes('<?xml') && !cleaned.includes('xmlns')) {
            text += cleaned + ' ';
          }
        });
      }
    }
    
    return {
      text: text || '[PPTX détecté - contenu limité]',
      metadata: {
        slides: slideFiles.length
      }
    };
  } catch (error) {
    console.error('PPTX extraction error:', error);
    throw new Error('Erreur lors de l\'extraction du PPTX');
  }
}

import pptxParser from 'pptx-parser';
import fs from 'fs';

export async function extractPPTX(filePath) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const result = await pptxParser.parse(fileBuffer);
    
    let text = '';
    if (result && result.slides) {
      result.slides.forEach(slide => {
        if (slide.text) {
          text += slide.text.join('\n') + '\n\n';
        }
      });
    }
    
    return {
      text,
      metadata: {
        slides: result.slides ? result.slides.length : 0
      }
    };
  } catch (error) {
    console.error('PPTX extraction error:', error);
    throw new Error('Erreur lors de l\'extraction du PPTX');
  }
}

import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, AlignmentType, BorderStyle, WidthType, convertInchesToTwip } from 'docx';
import fs from 'fs';
import path from 'path';

// Configuration du document : Calibri 11, noir, justifié, sans interligne
const FONT_CONFIG = {
  font: 'Calibri',
  size: 22, // 11pt = 22 half-points
  color: '000000' // Noir
};

export async function generateDOCX(documentData, citations, outputPath) {
  try {
    const children = [];
    
    // Titre du document (centré, gras, plus grand)
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: documentData.title || 'Document Généré',
            font: FONT_CONFIG.font,
            size: 32, // 16pt pour le titre
            bold: true,
            color: FONT_CONFIG.color
          })
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200, line: 240 } // line: 240 = interligne simple (1.0)
      })
    );
    
    // Date de génération
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Généré le ${new Date().toLocaleDateString('fr-FR')}`,
            font: FONT_CONFIG.font,
            size: FONT_CONFIG.size,
            color: FONT_CONFIG.color,
            italics: true
          })
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400, line: 240 }
      })
    );
    
    // Sections du document
    for (const section of documentData.sections || []) {
      // Titre de section (gras)
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: section.title,
              font: FONT_CONFIG.font,
              size: 26, // 13pt pour les titres de section
              bold: true,
              color: FONT_CONFIG.color
            })
          ],
          alignment: AlignmentType.LEFT,
          spacing: { before: 300, after: 150, line: 240 }
        })
      );
      
      // Contenu de la section (justifié)
      const paragraphs = section.content.split('\n\n');
      for (const para of paragraphs) {
        if (para.trim()) {
          children.push(
            new Paragraph({
              children: parseTextWithCitations(para.trim()),
              alignment: AlignmentType.JUSTIFIED,
              spacing: { after: 150, line: 240 } // Interligne simple
            })
          );
        }
      }
    }
    
    // Espace avant les sources
    children.push(
      new Paragraph({
        text: '',
        spacing: { before: 400 }
      })
    );
    
    // Section Sources & Références
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Sources et Références',
            font: FONT_CONFIG.font,
            size: 26,
            bold: true,
            color: FONT_CONFIG.color
          })
        ],
        alignment: AlignmentType.LEFT,
        spacing: { before: 300, after: 200, line: 240 }
      })
    );
    
    // Regrouper les citations par type
    const citationsByType = groupCitationsByType(citations);
    
    for (const [type, typeCitations] of Object.entries(citationsByType)) {
      if (typeCitations.length === 0) continue;
      
      // Sous-titre du type de source
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: type,
              font: FONT_CONFIG.font,
              size: FONT_CONFIG.size,
              bold: true,
              italics: true,
              color: FONT_CONFIG.color
            })
          ],
          spacing: { before: 150, after: 100, line: 240 }
        })
      );
      
      // Liste des citations de ce type
      for (const citation of typeCitations) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `[${citation.number}] `,
                font: FONT_CONFIG.font,
                size: FONT_CONFIG.size,
                bold: true,
                color: FONT_CONFIG.color
              }),
              new TextRun({
                text: citation.title,
                font: FONT_CONFIG.font,
                size: FONT_CONFIG.size,
                color: FONT_CONFIG.color
              }),
              new TextRun({
                text: citation.url ? ` — ${citation.url}` : '',
                font: FONT_CONFIG.font,
                size: 18, // Plus petit pour l'URL
                color: '444444'
              })
            ],
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 80, line: 240 }
          })
        );
      }
    }
    
    // Créer le document
    const doc = new Document({
      styles: {
        default: {
          document: {
            run: {
              font: FONT_CONFIG.font,
              size: FONT_CONFIG.size,
              color: FONT_CONFIG.color
            }
          }
        }
      },
      sections: [{
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1)
            }
          }
        },
        children: children
      }]
    });
    
    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(outputPath, buffer);
    
    return {
      success: true,
      path: outputPath
    };
  } catch (error) {
    console.error('DOCX generation error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Parse le texte pour mettre les citations en exposant (noir)
function parseTextWithCitations(text) {
  const children = [];
  const regex = /(\[\d+\])/g;
  let lastIndex = 0;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      children.push(
        new TextRun({
          text: text.substring(lastIndex, match.index),
          font: FONT_CONFIG.font,
          size: FONT_CONFIG.size,
          color: FONT_CONFIG.color
        })
      );
    }
    
    // Citation en exposant, noir
    children.push(
      new TextRun({
        text: match[1],
        font: FONT_CONFIG.font,
        size: 18, // Plus petit pour l'exposant
        superScript: true,
        color: FONT_CONFIG.color // Noir
      })
    );
    
    lastIndex = regex.lastIndex;
  }
  
  if (lastIndex < text.length) {
    children.push(
      new TextRun({
        text: text.substring(lastIndex),
        font: FONT_CONFIG.font,
        size: FONT_CONFIG.size,
        color: FONT_CONFIG.color
      })
    );
  }
  
  return children.length > 0 ? children : [
    new TextRun({
      text: text,
      font: FONT_CONFIG.font,
      size: FONT_CONFIG.size,
      color: FONT_CONFIG.color
    })
  ];
}

// Regroupe les citations par type de source
function groupCitationsByType(citations) {
  const groups = {
    'Documents fournis': [],
    'Encyclopédies': [],
    'Sources web': []
  };
  
  for (const citation of citations || []) {
    if (citation.source_type === 'uploaded') {
      groups['Documents fournis'].push(citation);
    } else if (citation.source_type === 'encyclopedia') {
      groups['Encyclopédies'].push(citation);
    } else {
      groups['Sources web'].push(citation);
    }
  }
  
  return groups;
}

function extractCitationNumbers(text) {
  const matches = text.match(/\[(\d+)\]/g);
  if (!matches) return [];
  
  return [...new Set(matches.map(m => parseInt(m.match(/\d+/)[0])))].sort((a, b) => a - b);
}

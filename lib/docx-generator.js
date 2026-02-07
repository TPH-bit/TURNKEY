import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, AlignmentType, BorderStyle } from 'docx';
import fs from 'fs';
import path from 'path';

export async function generateDOCX(documentData, citations, outputPath) {
  try {
    const sections = [];
    
    sections.push(
      new Paragraph({
        text: documentData.title || 'Document Généré',
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 }
      })
    );
    
    sections.push(
      new Paragraph({
        text: `Généré le ${new Date().toLocaleDateString('fr-FR')}`,
        alignment: AlignmentType.CENTER,
        spacing: { after: 600 }
      })
    );
    
    for (const section of documentData.sections || []) {
      sections.push(
        new Paragraph({
          text: section.title,
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 }
        })
      );
      
      const paragraphs = section.content.split('\n\n');
      for (const para of paragraphs) {
        if (para.trim()) {
          sections.push(
            new Paragraph({
              children: parseTextWithCitations(para),
              spacing: { after: 200 }
            })
          );
        }
      }
    }
    
    sections.push(
      new Paragraph({
        text: '',
        spacing: { before: 600 }
      })
    );
    
    sections.push(
      new Paragraph({
        text: 'Sources & Références',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 }
      })
    );
    
    citations.forEach((citation, index) => {
      sections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `[${citation.number}] `,
              bold: true
            }),
            new TextRun({
              text: citation.title,
              italics: true
            }),
            new TextRun({
              text: citation.url ? ` - ${citation.url}` : ''
            })
          ],
          spacing: { after: 100 }
        })
      );
    });
    
    sections.push(
      new Paragraph({
        text: '',
        spacing: { before: 400 }
      })
    );
    
    sections.push(
      new Paragraph({
        text: 'Table des Sources par Section',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 }
      })
    );
    
    const tableRows = [
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ text: 'Section', bold: true })],
            shading: { fill: 'CCCCCC' }
          }),
          new TableCell({
            children: [new Paragraph({ text: 'Sources', bold: true })],
            shading: { fill: 'CCCCCC' }
          })
        ]
      })
    ];
    
    for (const section of documentData.sections || []) {
      const citationNumbers = extractCitationNumbers(section.content);
      const sourcesText = citationNumbers.length > 0 
        ? citationNumbers.map(n => `[${n}]`).join(', ')
        : 'Aucune';
      
      tableRows.push(
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph(section.title)]
            }),
            new TableCell({
              children: [new Paragraph(sourcesText)]
            })
          ]
        })
      );
    }
    
    const table = new Table({
      rows: tableRows,
      width: { size: 100, type: 'pct' }
    });
    
    sections.push(table);
    
    const doc = new Document({
      sections: [{
        properties: {},
        children: sections
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

function parseTextWithCitations(text) {
  const children = [];
  const regex = /(\[\d+\])/g;
  let lastIndex = 0;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      children.push(new TextRun(text.substring(lastIndex, match.index)));
    }
    
    children.push(
      new TextRun({
        text: match[1],
        superScript: true,
        color: '0000FF'
      })
    );
    
    lastIndex = regex.lastIndex;
  }
  
  if (lastIndex < text.length) {
    children.push(new TextRun(text.substring(lastIndex)));
  }
  
  return children.length > 0 ? children : [new TextRun(text)];
}

function extractCitationNumbers(text) {
  const matches = text.match(/\[(\d+)\]/g);
  if (!matches) return [];
  
  return [...new Set(matches.map(m => parseInt(m.match(/\d+/)[0])))].sort((a, b) => a - b);
}

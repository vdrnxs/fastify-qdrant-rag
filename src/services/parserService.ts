import { extractText } from 'unpdf';
import { readFile } from 'fs/promises';
import path from 'path';
import { ParsedDocument } from '../types';

export class ParserService {
  /**
   * Parse a PDF file and extract text using unpdf
   */
  async parsePDF(filePath: string): Promise<ParsedDocument> {
    const buffer = await readFile(filePath);

    // Convert Buffer to Uint8Array for unpdf
    const uint8Array = new Uint8Array(buffer);

    // Extract text from PDF
    const { text, totalPages } = await extractText(uint8Array, { mergePages: true });

    // Clean and count words
    const cleanText = text.trim();
    const wordCount = cleanText ? cleanText.split(/\s+/).length : 0;

    return {
      text: cleanText,
      metadata: {
        filename: path.basename(filePath),
        fileType: 'pdf',
        pageCount: totalPages,
        wordCount
      }
    };
  }

  /**
   * Parse a file based on its type
   */
  async parseFile(filePath: string, fileType: string): Promise<ParsedDocument> {
    switch (fileType) {
      case 'pdf':
        return this.parsePDF(filePath);

      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }
  }
}

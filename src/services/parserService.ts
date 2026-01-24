import pdfParse from 'pdf-parse';
import { readFile } from 'fs/promises';
import path from 'path';
import { ParsedDocument } from '../types';

export class ParserService {
  /**
   * Parse a PDF file and extract text
   */
  async parsePDF(filePath: string): Promise<ParsedDocument> {
    const buffer = await readFile(filePath);
    const data = await pdfParse(buffer);

    return {
      text: data.text,
      metadata: {
        filename: path.basename(filePath),
        fileType: 'pdf',
        pageCount: data.numpages,
        wordCount: data.text.split(/\s+/).filter(word => word.length > 0).length
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

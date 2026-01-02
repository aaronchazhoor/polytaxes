/**
 * PDF Generator for IRS Form 8949
 * Handles both summary and detailed modes with correct pagination
 */
import type { TaxReport, PDFGenerationOptions } from './types.js';
/**
 * Generates Form 8949 PDF
 */
export declare function generateForm8949(report: TaxReport, options: PDFGenerationOptions): Promise<{
    files: Blob[];
    filenames: string[];
}>;
export declare function downloadPDFs(files: Blob[], filenames: string[]): void;

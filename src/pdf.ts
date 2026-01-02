/**
 * PDF Generator for IRS Form 8949
 * Handles both summary and detailed modes with correct pagination
 */

import type { TaxReport, PDFGenerationOptions, Form8949Entry } from './types.js';

// IRS Form 8949 holds 14 transactions per page
const TRANSACTIONS_PER_PAGE = 14;

/**
 * Generates Form 8949 PDF
 */
export async function generateForm8949(
  report: TaxReport,
  options: PDFGenerationOptions
): Promise<{ files: Blob[]; filenames: string[] }> {
  // @ts-ignore - pdf-lib is loaded via CDN
  const { PDFDocument, StandardFonts } = window.PDFLib;

  if (options.mode === 'summary') {
    return generateSummaryMode(report, options, PDFDocument, StandardFonts);
  } else {
    return generateDetailedMode(report, options, PDFDocument);
  }
}

/**
 * Summary mode: One line per part + attached statement
 */
async function generateSummaryMode(
  report: TaxReport,
  options: PDFGenerationOptions,
  PDFDocument: any,
  StandardFonts: any
): Promise<{ files: Blob[]; filenames: string[] }> {
  // Load IRS template
  const templateBytes = await loadTemplate();
  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm();

  // Fill Part I (short-term)
  if (report.shortTerm.length > 0) {
    const checkbox = form.getCheckBox('topmostSubform[0].Page1[0].c1_1[0]');
    checkbox.check();

    const desc = form.getTextField('topmostSubform[0].Page1[0].Table_Line1_Part1[0].Row1[0].f1_03[0]');
    desc.setText(`Prediction market contracts - ${report.shortTerm.length} transactions (see attached)`);

    const proceeds = form.getTextField('topmostSubform[0].Page1[0].Table_Line1_Part1[0].Row1[0].f1_06[0]');
    proceeds.setText(formatCurrency(report.shortTermSummary.totalProceeds));

    const cost = form.getTextField('topmostSubform[0].Page1[0].Table_Line1_Part1[0].Row1[0].f1_07[0]');
    cost.setText(formatCurrency(report.shortTermSummary.totalCostBasis));

    const gain = form.getTextField('topmostSubform[0].Page1[0].Table_Line1_Part1[0].Row1[0].f1_10[0]');
    gain.setText(formatCurrency(report.shortTermSummary.totalGainLoss));

    const totalProceeds = form.getTextField('topmostSubform[0].Page1[0].f1_91[0]');
    totalProceeds.setText(formatCurrency(report.shortTermSummary.totalProceeds));

    const totalCost = form.getTextField('topmostSubform[0].Page1[0].f1_92[0]');
    totalCost.setText(formatCurrency(report.shortTermSummary.totalCostBasis));

    const totalGain = form.getTextField('topmostSubform[0].Page1[0].f1_94[0]');
    totalGain.setText(formatCurrency(report.shortTermSummary.totalGainLoss));
  }

  // Fill Part II (long-term)
  if (report.longTerm.length > 0) {
    const checkbox = form.getCheckBox('topmostSubform[0].Page2[0].c2_1[0]');
    checkbox.check();

    const desc = form.getTextField('topmostSubform[0].Page2[0].Table_Line1_Part2[0].Row1[0].f2_03[0]');
    desc.setText(`Prediction market contracts - ${report.longTerm.length} transactions (see attached)`);

    const proceeds = form.getTextField('topmostSubform[0].Page2[0].Table_Line1_Part2[0].Row1[0].f2_06[0]');
    proceeds.setText(formatCurrency(report.longTermSummary.totalProceeds));

    const cost = form.getTextField('topmostSubform[0].Page2[0].Table_Line1_Part2[0].Row1[0].f2_07[0]');
    cost.setText(formatCurrency(report.longTermSummary.totalCostBasis));

    const gain = form.getTextField('topmostSubform[0].Page2[0].Table_Line1_Part2[0].Row1[0].f2_10[0]');
    gain.setText(formatCurrency(report.longTermSummary.totalGainLoss));

    const totalProceeds = form.getTextField('topmostSubform[0].Page2[0].f2_91[0]');
    totalProceeds.setText(formatCurrency(report.longTermSummary.totalProceeds));

    const totalCost = form.getTextField('topmostSubform[0].Page2[0].f2_92[0]');
    totalCost.setText(formatCurrency(report.longTermSummary.totalCostBasis));

    const totalGain = form.getTextField('topmostSubform[0].Page2[0].f2_94[0]');
    totalGain.setText(formatCurrency(report.longTermSummary.totalGainLoss));
  }

  form.flatten();
  const pdfBytes = await pdfDoc.save();
  const summaryPdf = new Blob([pdfBytes], { type: 'application/pdf' });

  // Generate detailed statement
  const statementPdf = await generateStatement(report, options, PDFDocument, StandardFonts);

  return {
    files: [summaryPdf, statementPdf],
    filenames: [
      `Form_8949_${options.taxYear}_Summary.pdf`,
      `Form_8949_${options.taxYear}_Statement.pdf`
    ]
  };
}

/**
 * Detailed mode: All transactions on Form 8949 pages
 */
async function generateDetailedMode(
  report: TaxReport,
  options: PDFGenerationOptions,
  PDFDocument: any
): Promise<{ files: Blob[]; filenames: string[] }> {
  const templateBytes = await loadTemplate();
  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm();

  // Part I - Short Term
  if (report.shortTerm.length > 0) {
    await fillDetailedPart(
      pdfDoc,
      form,
      report.shortTerm,
      report.shortTermSummary,
      'Part1',
      'f1',
      'c1_1'
    );
  }

  // Part II - Long Term
  if (report.longTerm.length > 0) {
    await fillDetailedPart(
      pdfDoc,
      form,
      report.longTerm,
      report.longTermSummary,
      'Part2',
      'f2',
      'c2_1'
    );
  }

  form.flatten();
  const pdfBytes = await pdfDoc.save();
  const pdf = new Blob([pdfBytes], { type: 'application/pdf' });

  return {
    files: [pdf],
    filenames: [`Form_8949_${options.taxYear}_Detailed.pdf`]
  };
}

async function fillDetailedPart(
  pdfDoc: any,
  form: any,
  entries: Form8949Entry[],
  summary: any,
  partName: string,
  fieldPrefix: string,
  checkboxName: string
): Promise<void> {
  const pageNum = partName === 'Part1' ? 0 : 1;
  const pages = Math.ceil(entries.length / TRANSACTIONS_PER_PAGE);

  for (let pageIdx = 0; pageIdx < pages; pageIdx++) {
    const start = pageIdx * TRANSACTIONS_PER_PAGE;
    const end = Math.min(start + TRANSACTIONS_PER_PAGE, entries.length);
    const pageEntries = entries.slice(start, end);

    // Check box on first page only
    if (pageIdx === 0) {
      const checkbox = form.getCheckBox(`topmostSubform[0].Page${pageNum + 1}[0].${checkboxName}[0]`);
      checkbox.check();
    }

    // Fill rows
    for (let i = 0; i < pageEntries.length; i++) {
      const entry = pageEntries[i];
      const row = i + 1;
      const baseIdx = (row - 1) * 8 + 3;

      try {
        // Description
        const desc = form.getTextField(`topmostSubform[0].Page${pageNum + 1}[0].Table_Line1_${partName}[0].Row${row}[0].${fieldPrefix}_${pad(baseIdx)}[0]`);
        desc.setText(truncate(entry.description, 100));

        // Date Acquired
        const dateAcq = form.getTextField(`topmostSubform[0].Page${pageNum + 1}[0].Table_Line1_${partName}[0].Row${row}[0].${fieldPrefix}_${pad(baseIdx + 1)}[0]`);
        dateAcq.setText(entry.dateAcquired);

        // Date Sold
        const dateSold = form.getTextField(`topmostSubform[0].Page${pageNum + 1}[0].Table_Line1_${partName}[0].Row${row}[0].${fieldPrefix}_${pad(baseIdx + 2)}[0]`);
        dateSold.setText(entry.dateSold);

        // Proceeds
        const proceeds = form.getTextField(`topmostSubform[0].Page${pageNum + 1}[0].Table_Line1_${partName}[0].Row${row}[0].${fieldPrefix}_${pad(baseIdx + 3)}[0]`);
        proceeds.setText(formatCurrency(entry.proceeds));

        // Cost Basis
        const cost = form.getTextField(`topmostSubform[0].Page${pageNum + 1}[0].Table_Line1_${partName}[0].Row${row}[0].${fieldPrefix}_${pad(baseIdx + 4)}[0]`);
        cost.setText(formatCurrency(entry.costBasis));

        // Gain/Loss
        const gain = form.getTextField(`topmostSubform[0].Page${pageNum + 1}[0].Table_Line1_${partName}[0].Row${row}[0].${fieldPrefix}_${pad(baseIdx + 7)}[0]`);
        gain.setText(formatCurrency(entry.gainLoss));
      } catch (error) {
        console.error(`Error filling row ${row}:`, error);
      }
    }

    // Fill totals on last page
    if (pageIdx === pages - 1) {
      const totalProceeds = form.getTextField(`topmostSubform[0].Page${pageNum + 1}[0].${fieldPrefix}_91[0]`);
      totalProceeds.setText(formatCurrency(summary.totalProceeds));

      const totalCost = form.getTextField(`topmostSubform[0].Page${pageNum + 1}[0].${fieldPrefix}_92[0]`);
      totalCost.setText(formatCurrency(summary.totalCostBasis));

      const totalGain = form.getTextField(`topmostSubform[0].Page${pageNum + 1}[0].${fieldPrefix}_94[0]`);
      totalGain.setText(formatCurrency(summary.totalGainLoss));
    }

    // Add blank page for next set of transactions
    if (pageIdx < pages - 1) {
      const [newPage] = await pdfDoc.copyPages(pdfDoc, [pageNum]);
      pdfDoc.addPage(newPage);
    }
  }
}

async function generateStatement(
  report: TaxReport,
  options: PDFGenerationOptions,
  PDFDocument: any,
  StandardFonts: any
): Promise<Blob> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  let page = pdfDoc.addPage();
  let y = 750;
  const margin = 50;

  // Title
  page.drawText('Polymarket Tax Statement', { x: margin, y, size: 16, font });
  y -= 30;
  page.drawText(`Tax Year: ${options.taxYear}`, { x: margin, y, size: 12, font });
  y -= 40;

  // Short-term
  if (report.shortTerm.length > 0) {
    page.drawText('Part I - Short-Term Capital Gains', { x: margin, y, size: 14, font });
    y -= 20;

    for (const entry of report.shortTerm) {
      if (y < 50) {
        page = pdfDoc.addPage();
        y = 750;
      }
      page.drawText(
        `${entry.description} | ${entry.dateAcquired} to ${entry.dateSold} | Gain/Loss: $${entry.gainLoss.toFixed(2)}`,
        { x: margin, y, size: 8, font }
      );
      y -= 15;
    }
    y -= 20;
  }

  // Long-term
  if (report.longTerm.length > 0) {
    if (y < 200) {
      page = pdfDoc.addPage();
      y = 750;
    }
    page.drawText('Part II - Long-Term Capital Gains', { x: margin, y, size: 14, font });
    y -= 20;

    for (const entry of report.longTerm) {
      if (y < 50) {
        page = pdfDoc.addPage();
        y = 750;
      }
      page.drawText(
        `${entry.description} | ${entry.dateAcquired} to ${entry.dateSold} | Gain/Loss: $${entry.gainLoss.toFixed(2)}`,
        { x: margin, y, size: 8, font }
      );
      y -= 15;
    }
  }

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

async function loadTemplate(): Promise<ArrayBuffer> {
  const response = await fetch('public/IRS_Form_8949.pdf');
  if (!response.ok) {
    throw new Error('IRS Form 8949 template not found. Please place IRS_Form_8949.pdf in the public/ directory.');
  }
  return await response.arrayBuffer();
}

function formatCurrency(value: number): string {
  return value.toFixed(2);
}

function pad(num: number): string {
  return num.toString().padStart(2, '0');
}

function truncate(str: string, maxLen: number): string {
  if (!str || str.length <= maxLen) return str;
  return str.substring(0, maxLen - 3) + '...';
}

export function downloadPDFs(files: Blob[], filenames: string[]): void {
  files.forEach((file, idx) => {
    setTimeout(() => {
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = filenames[idx];
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, idx * 1500);
  });
}

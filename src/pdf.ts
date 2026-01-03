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
    desc.setText(`Various prediction market tokens - ${report.shortTerm.length} transactions`);

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
    desc.setText(`Various prediction market tokens - ${report.longTerm.length} transactions`);

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

  // Generate detailed CSV statement
  const statementCsv = generateStatementCSV(report, options);

  return {
    files: [summaryPdf, statementCsv],
    filenames: [
      `Form_8949_${options.taxYear}_Summary.pdf`,
      `Form_8949_${options.taxYear}_Transactions.csv`
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

  // Create final merged PDF
  const mergedPdf = await PDFDocument.create();

  // Process short-term transactions (Part I)
  if (report.shortTerm.length > 0) {
    const shortTermPages = Math.ceil(report.shortTerm.length / TRANSACTIONS_PER_PAGE);

    for (let pageIdx = 0; pageIdx < shortTermPages; pageIdx++) {
      const start = pageIdx * TRANSACTIONS_PER_PAGE;
      const end = Math.min(start + TRANSACTIONS_PER_PAGE, report.shortTerm.length);
      const pageEntries = report.shortTerm.slice(start, end);

      // Load fresh template for each page
      const pagePdf = await PDFDocument.load(templateBytes);
      const form = pagePdf.getForm();

      // Fill Part I (page 0)
      fillPartIPage(form, pageEntries, report.shortTermSummary, pageIdx === shortTermPages - 1);

      form.flatten();

      // Copy Part I page to merged PDF
      const [copiedPage] = await mergedPdf.copyPages(pagePdf, [0]);
      mergedPdf.addPage(copiedPage);
    }
  }

  // Process long-term transactions (Part II)
  if (report.longTerm.length > 0) {
    const longTermPages = Math.ceil(report.longTerm.length / TRANSACTIONS_PER_PAGE);

    for (let pageIdx = 0; pageIdx < longTermPages; pageIdx++) {
      const start = pageIdx * TRANSACTIONS_PER_PAGE;
      const end = Math.min(start + TRANSACTIONS_PER_PAGE, report.longTerm.length);
      const pageEntries = report.longTerm.slice(start, end);

      // Load fresh template for each page
      const pagePdf = await PDFDocument.load(templateBytes);
      const form = pagePdf.getForm();

      // Fill Part II (page 1)
      fillPartIIPage(form, pageEntries, report.longTermSummary, pageIdx === longTermPages - 1);

      form.flatten();

      // Copy Part II page to merged PDF
      const [copiedPage] = await mergedPdf.copyPages(pagePdf, [1]);
      mergedPdf.addPage(copiedPage);
    }
  }

  const pdfBytes = await mergedPdf.save();
  const pdf = new Blob([pdfBytes], { type: 'application/pdf' });

  return {
    files: [pdf],
    filenames: [`Form_8949_${options.taxYear}_Detailed.pdf`]
  };
}

/**
 * Fill Part I (Short-Term) page with up to 14 transactions
 */
function fillPartIPage(
  form: any,
  entries: Form8949Entry[],
  summary: any,
  isLastPage: boolean
): void {
  // Check Box A
  const checkbox = form.getCheckBox('topmostSubform[0].Page1[0].c1_1[0]');
  checkbox.check();

  // Fill rows (up to 14)
  for (let i = 0; i < entries.length && i < TRANSACTIONS_PER_PAGE; i++) {
    const entry = entries[i];
    const row = i + 1;
    const baseIdx = (row - 1) * 8 + 3;

    try {
      // Description
      const desc = form.getTextField(`topmostSubform[0].Page1[0].Table_Line1_Part1[0].Row${row}[0].f1_${pad(baseIdx)}[0]`);
      desc.setText(truncate(entry.description, 100));

      // Date Acquired
      const dateAcq = form.getTextField(`topmostSubform[0].Page1[0].Table_Line1_Part1[0].Row${row}[0].f1_${pad(baseIdx + 1)}[0]`);
      dateAcq.setText(entry.dateAcquired);

      // Date Sold
      const dateSold = form.getTextField(`topmostSubform[0].Page1[0].Table_Line1_Part1[0].Row${row}[0].f1_${pad(baseIdx + 2)}[0]`);
      dateSold.setText(entry.dateSold);

      // Proceeds
      const proceeds = form.getTextField(`topmostSubform[0].Page1[0].Table_Line1_Part1[0].Row${row}[0].f1_${pad(baseIdx + 3)}[0]`);
      proceeds.setText(formatCurrency(entry.proceeds));

      // Cost Basis
      const cost = form.getTextField(`topmostSubform[0].Page1[0].Table_Line1_Part1[0].Row${row}[0].f1_${pad(baseIdx + 4)}[0]`);
      cost.setText(formatCurrency(entry.costBasis));

      // Gain/Loss
      const gain = form.getTextField(`topmostSubform[0].Page1[0].Table_Line1_Part1[0].Row${row}[0].f1_${pad(baseIdx + 7)}[0]`);
      gain.setText(formatCurrency(entry.gainLoss));
    } catch (error) {
      console.error(`Error filling Part I row ${row}:`, error);
    }
  }

  // Fill totals only on last page
  if (isLastPage) {
    const totalProceeds = form.getTextField('topmostSubform[0].Page1[0].f1_91[0]');
    totalProceeds.setText(formatCurrency(summary.totalProceeds));

    const totalCost = form.getTextField('topmostSubform[0].Page1[0].f1_92[0]');
    totalCost.setText(formatCurrency(summary.totalCostBasis));

    const totalGain = form.getTextField('topmostSubform[0].Page1[0].f1_94[0]');
    totalGain.setText(formatCurrency(summary.totalGainLoss));
  }
}

/**
 * Fill Part II (Long-Term) page with up to 14 transactions
 */
function fillPartIIPage(
  form: any,
  entries: Form8949Entry[],
  summary: any,
  isLastPage: boolean
): void {
  // Check Box D
  const checkbox = form.getCheckBox('topmostSubform[0].Page2[0].c2_1[0]');
  checkbox.check();

  // Fill rows (up to 14)
  for (let i = 0; i < entries.length && i < TRANSACTIONS_PER_PAGE; i++) {
    const entry = entries[i];
    const row = i + 1;
    const baseIdx = (row - 1) * 8 + 3;

    try {
      // Description
      const desc = form.getTextField(`topmostSubform[0].Page2[0].Table_Line1_Part2[0].Row${row}[0].f2_${pad(baseIdx)}[0]`);
      desc.setText(truncate(entry.description, 100));

      // Date Acquired
      const dateAcq = form.getTextField(`topmostSubform[0].Page2[0].Table_Line1_Part2[0].Row${row}[0].f2_${pad(baseIdx + 1)}[0]`);
      dateAcq.setText(entry.dateAcquired);

      // Date Sold
      const dateSold = form.getTextField(`topmostSubform[0].Page2[0].Table_Line1_Part2[0].Row${row}[0].f2_${pad(baseIdx + 2)}[0]`);
      dateSold.setText(entry.dateSold);

      // Proceeds
      const proceeds = form.getTextField(`topmostSubform[0].Page2[0].Table_Line1_Part2[0].Row${row}[0].f2_${pad(baseIdx + 3)}[0]`);
      proceeds.setText(formatCurrency(entry.proceeds));

      // Cost Basis
      const cost = form.getTextField(`topmostSubform[0].Page2[0].Table_Line1_Part2[0].Row${row}[0].f2_${pad(baseIdx + 4)}[0]`);
      cost.setText(formatCurrency(entry.costBasis));

      // Gain/Loss
      const gain = form.getTextField(`topmostSubform[0].Page2[0].Table_Line1_Part2[0].Row${row}[0].f2_${pad(baseIdx + 7)}[0]`);
      gain.setText(formatCurrency(entry.gainLoss));
    } catch (error) {
      console.error(`Error filling Part II row ${row}:`, error);
    }
  }

  // Fill totals only on last page
  if (isLastPage) {
    const totalProceeds = form.getTextField('topmostSubform[0].Page2[0].f2_91[0]');
    totalProceeds.setText(formatCurrency(summary.totalProceeds));

    const totalCost = form.getTextField('topmostSubform[0].Page2[0].f2_92[0]');
    totalCost.setText(formatCurrency(summary.totalCostBasis));

    const totalGain = form.getTextField('topmostSubform[0].Page2[0].f2_94[0]');
    totalGain.setText(formatCurrency(summary.totalGainLoss));
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

/**
 * Generate CSV statement with all transaction details
 */
function generateStatementCSV(
  report: TaxReport,
  options: PDFGenerationOptions
): Blob {
  // CSV Header
  const headers = [
    'Type',
    'Description',
    'Date Acquired',
    'Date Sold',
    'Proceeds',
    'Cost Basis',
    'Gain/Loss',
    'Holding Days',
    'Term'
  ];

  const rows: string[][] = [headers];

  // Add short-term transactions
  for (const entry of report.shortTerm) {
    rows.push([
      'Short-Term',
      escapeCsvField(entry.description),
      entry.dateAcquired,
      entry.dateSold,
      entry.proceeds.toFixed(2),
      entry.costBasis.toFixed(2),
      entry.gainLoss.toFixed(2),
      entry.holdingDays.toString(),
      entry.isLongTerm ? 'Long-Term' : 'Short-Term'
    ]);
  }

  // Add long-term transactions
  for (const entry of report.longTerm) {
    rows.push([
      'Long-Term',
      escapeCsvField(entry.description),
      entry.dateAcquired,
      entry.dateSold,
      entry.proceeds.toFixed(2),
      entry.costBasis.toFixed(2),
      entry.gainLoss.toFixed(2),
      entry.holdingDays.toString(),
      entry.isLongTerm ? 'Long-Term' : 'Short-Term'
    ]);
  }

  // Add summary rows
  rows.push([]);
  rows.push(['SUMMARY', '', '', '', '', '', '', '', '']);
  rows.push([]);
  rows.push([
    'Short-Term Total',
    `${report.shortTerm.length} transactions`,
    '',
    '',
    report.shortTermSummary.totalProceeds.toFixed(2),
    report.shortTermSummary.totalCostBasis.toFixed(2),
    report.shortTermSummary.totalGainLoss.toFixed(2),
    '',
    ''
  ]);
  rows.push([
    'Long-Term Total',
    `${report.longTerm.length} transactions`,
    '',
    '',
    report.longTermSummary.totalProceeds.toFixed(2),
    report.longTermSummary.totalCostBasis.toFixed(2),
    report.longTermSummary.totalGainLoss.toFixed(2),
    '',
    ''
  ]);
  rows.push([]);
  rows.push([
    'GRAND TOTAL',
    `${report.totalTransactions} transactions`,
    '',
    '',
    (report.shortTermSummary.totalProceeds + report.longTermSummary.totalProceeds).toFixed(2),
    (report.shortTermSummary.totalCostBasis + report.longTermSummary.totalCostBasis).toFixed(2),
    report.totalGainLoss.toFixed(2),
    '',
    ''
  ]);

  // Convert to CSV string
  const csvContent = rows.map(row => row.join(',')).join('\n');

  return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
}

/**
 * Escape CSV field if it contains special characters
 */
function escapeCsvField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
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
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  files.forEach((file, idx) => {
    setTimeout(() => {
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = filenames[idx];

      // For mobile: add target blank and rel attributes for better compatibility
      if (isMobile) {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      }

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Show mobile-specific instruction if PDF opens in viewer
      if (isMobile && idx === 0) {
        setTimeout(() => {
          showMobileDownloadTip();
        }, 500);
      }

      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, idx * 1500);
  });
}

function showMobileDownloadTip(): void {
  const existingTip = document.getElementById('mobile-download-tip');
  if (existingTip) return; // Don't show multiple times

  const snackbar = document.createElement('div');
  snackbar.id = 'mobile-download-tip';
  snackbar.className = 'fixed bottom-0 left-0 right-0 z-50 px-4 pb-safe';
  snackbar.style.animation = 'slideUp 0.3s ease-out';

  snackbar.innerHTML = `
    <style>
      @keyframes slideUp {
        from {
          transform: translateY(100%);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
      @keyframes slideDown {
        from {
          transform: translateY(0);
          opacity: 1;
        }
        to {
          transform: translateY(100%);
          opacity: 0;
        }
      }
    </style>
    <div class="mx-auto max-w-md mb-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-2xl shadow-2xl p-4 flex items-start gap-3">
      <svg class="w-6 h-6 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      <div class="flex-1">
        <p class="font-semibold text-sm mb-1">To save your PDF:</p>
        <p class="text-xs opacity-90">Tap the <strong>Share</strong> button, then select <strong>Save to Files</strong></p>
      </div>
      <button onclick="this.closest('#mobile-download-tip').remove()" class="text-white opacity-75 hover:opacity-100 flex-shrink-0 ml-2">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
  `;

  // Tap anywhere to dismiss
  snackbar.addEventListener('click', (e) => {
    if (e.target === snackbar) {
      dismissSnackbar();
    }
  });

  document.body.appendChild(snackbar);

  // Auto-dismiss after 6 seconds
  const dismissTimer = setTimeout(() => {
    dismissSnackbar();
  }, 6000);

  function dismissSnackbar() {
    clearTimeout(dismissTimer);
    snackbar.style.animation = 'slideDown 0.3s ease-in';
    setTimeout(() => snackbar.remove(), 300);
  }
}

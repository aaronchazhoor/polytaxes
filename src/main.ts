/**
 * Main application entry point
 * Coordinates UI interactions and workflow
 */

import { extractWalletAddress, fetchTradingHistory } from './api.js';
import { generateTaxReport } from './calculator.js';
import { generateForm8949, downloadPDFs } from './pdf.js';
import type { TaxReport } from './types.js';

let currentReport: TaxReport | null = null;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  console.log('Polymarket Tax Form Generator initialized');
  setupEventListeners();
});

function setupEventListeners(): void {
  const form = document.getElementById('tax-form') as HTMLFormElement;
  const downloadBtn = document.getElementById('download-btn') as HTMLButtonElement;

  form?.addEventListener('submit', handleSubmit);
  downloadBtn?.addEventListener('click', handleDownload);
}

async function handleSubmit(e: Event): Promise<void> {
  e.preventDefault();

  const walletInput = (document.getElementById('wallet-input') as HTMLInputElement).value;
  const taxYear = parseInt((document.getElementById('tax-year') as HTMLSelectElement).value);

  const wallet = extractWalletAddress(walletInput);
  if (!wallet) {
    showError('Invalid wallet address or Polymarket profile URL');
    return;
  }

  try {
    showLoading();
    updateStatus('Fetching trading history...');

    const trades = await fetchTradingHistory(wallet, taxYear, (msg) => updateStatus(msg));

    if (trades.length === 0) {
      showError(`No trades found for ${taxYear}`);
      return;
    }

    updateStatus('Calculating capital gains and losses...');
    currentReport = await generateTaxReport(trades, taxYear);

    displaySummary(currentReport);
    showSuccess('Tax calculations complete! Click "Download PDF" to generate your forms.');

  } catch (error: any) {
    showError(`Error: ${error.message}`);
    console.error(error);
  } finally {
    hideLoading();
  }
}

async function handleDownload(): Promise<void> {
  if (!currentReport) return;

  try {
    const mode = (document.querySelector('input[name="mode"]:checked') as HTMLInputElement)?.value as 'summary' | 'detailed' || 'summary';
    const taxYear = parseInt((document.getElementById('tax-year') as HTMLSelectElement).value);

    updateStatus('Generating files...');
    const { files, filenames } = await generateForm8949(currentReport, { taxYear, mode });

    downloadPDFs(files, filenames);

    // Show accurate success message based on mode
    const message = mode === 'summary'
      ? 'Generated PDF and CSV successfully! Check your downloads.'
      : 'Generated PDF successfully! Check your downloads.';
    showSuccess(message);

  } catch (error: any) {
    showError(`File generation failed: ${error.message}`);
    console.error(error);
  }
}

function displaySummary(report: TaxReport): void {
  const summary = document.getElementById('summary-section');
  if (!summary) return;

  (document.getElementById('total-trades') as HTMLElement).textContent = String(report.totalTransactions);
  (document.getElementById('short-term-count') as HTMLElement).textContent = String(report.shortTerm.length);
  (document.getElementById('long-term-count') as HTMLElement).textContent = String(report.longTerm.length);
  (document.getElementById('short-term-total') as HTMLElement).textContent = formatCurrency(report.shortTermSummary.totalGainLoss);
  (document.getElementById('long-term-total') as HTMLElement).textContent = formatCurrency(report.longTermSummary.totalGainLoss);
  (document.getElementById('total-gain-loss') as HTMLElement).textContent = formatCurrency(report.totalGainLoss);

  summary.classList.remove('hidden');
  summary.scrollIntoView({ behavior: 'smooth' });
}

// UI utilities
function showLoading(): void {
  document.getElementById('loading')?.classList.remove('hidden');
}

function hideLoading(): void {
  document.getElementById('loading')?.classList.add('hidden');
}

function updateStatus(message: string): void {
  const status = document.getElementById('status-message');
  if (status) status.textContent = message;
  console.log(message);
}

function showError(message: string): void {
  const error = document.getElementById('error-message');
  if (error) {
    error.textContent = message;
    error.classList.remove('hidden');
  }
  hideLoading();
}

function showSuccess(message: string): void {
  const success = document.getElementById('success-message');
  if (success) {
    success.textContent = message;
    success.classList.remove('hidden');
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

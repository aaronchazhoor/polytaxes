/**
 * Main application entry point
 * Coordinates UI interactions and workflow
 */
import { extractWalletAddress, fetchTradingHistory } from './api.js';
import { generateTaxReport } from './calculator.js';
import { generateForm8949, downloadPDFs } from './pdf.js';
let currentReport = null;
// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    console.log('Polymarket Tax Form Generator initialized');
    setupEventListeners();
});
function setupEventListeners() {
    const form = document.getElementById('tax-form');
    const downloadBtn = document.getElementById('download-btn');
    form?.addEventListener('submit', handleSubmit);
    downloadBtn?.addEventListener('click', handleDownload);
}
async function handleSubmit(e) {
    e.preventDefault();
    const walletInput = document.getElementById('wallet-input').value;
    const taxYear = parseInt(document.getElementById('tax-year').value);
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
    }
    catch (error) {
        showError(`Error: ${error.message}`);
        console.error(error);
    }
    finally {
        hideLoading();
    }
}
async function handleDownload() {
    if (!currentReport)
        return;
    try {
        const mode = document.querySelector('input[name="mode"]:checked')?.value || 'summary';
        const taxYear = parseInt(document.getElementById('tax-year').value);
        updateStatus('Generating files...');
        const { files, filenames } = await generateForm8949(currentReport, { taxYear, mode });
        downloadPDFs(files, filenames);
        // Track form generation event in Vercel Analytics
        trackFormGeneration(mode, taxYear, currentReport.totalTransactions);
        // Show accurate success message based on mode
        const message = mode === 'summary'
            ? 'Generated PDF and CSV successfully! Check your downloads.'
            : 'Generated PDF successfully! Check your downloads.';
        showSuccess(message);
    }
    catch (error) {
        showError(`File generation failed: ${error.message}`);
        console.error(error);
    }
}
function displaySummary(report) {
    const summary = document.getElementById('summary-section');
    if (!summary)
        return;
    document.getElementById('total-trades').textContent = String(report.totalTransactions);
    document.getElementById('short-term-count').textContent = String(report.shortTerm.length);
    document.getElementById('long-term-count').textContent = String(report.longTerm.length);
    document.getElementById('short-term-total').textContent = formatCurrency(report.shortTermSummary.totalGainLoss);
    document.getElementById('long-term-total').textContent = formatCurrency(report.longTermSummary.totalGainLoss);
    document.getElementById('total-gain-loss').textContent = formatCurrency(report.totalGainLoss);
    summary.classList.remove('hidden');
    summary.scrollIntoView({ behavior: 'smooth' });
}
// UI utilities
function showLoading() {
    document.getElementById('loading')?.classList.remove('hidden');
}
function hideLoading() {
    document.getElementById('loading')?.classList.add('hidden');
}
function updateStatus(message) {
    const status = document.getElementById('status-message');
    if (status)
        status.textContent = message;
    console.log(message);
}
function showError(message) {
    const error = document.getElementById('error-message');
    if (error) {
        error.textContent = message;
        error.classList.remove('hidden');
    }
    hideLoading();
}
function showSuccess(message) {
    const success = document.getElementById('success-message');
    if (success) {
        success.textContent = message;
        success.classList.remove('hidden');
    }
}
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}
// Track custom events in Vercel Analytics
function trackFormGeneration(mode, taxYear, transactionCount) {
    // @ts-ignore - va is injected by Vercel Analytics script
    if (typeof window.va !== 'undefined') {
        // @ts-ignore
        window.va('track', 'Form Generated', {
            mode,
            taxYear,
            transactionCount
        });
    }
}
//# sourceMappingURL=main.js.map
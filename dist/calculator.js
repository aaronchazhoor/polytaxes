/**
 * Tax Calculator - FIFO Cost Basis Implementation
 * Calculates capital gains/losses for prediction market trades
 */
import { fetchMarketsBatch } from './api.js';
const LONG_TERM_DAYS = 365;
/**
 * Generates complete tax report from trades
 */
export async function generateTaxReport(trades, taxYear) {
    const taxYearEnd = new Date(taxYear, 11, 31, 23, 59, 59).getTime() / 1000;
    const entries = [];
    const warnings = [];
    const inventory = new Map();
    // Normalize trades
    const normalized = trades.map(normalizeTrade).filter(Boolean);
    normalized.sort((a, b) => a.timestamp - b.timestamp);
    // Process trades using FIFO
    for (const trade of normalized) {
        const key = `${trade.conditionId}-${trade.outcome}`;
        if (trade.side === 'BUY') {
            addToInventory(inventory, key, trade);
        }
        else if (trade.side === 'SELL') {
            const { newEntries, warning } = matchSellToBuys(inventory, key, trade);
            entries.push(...newEntries);
            if (warning)
                warnings.push(warning);
        }
    }
    // Collect open positions
    const openPositions = collectOpenPositions(inventory);
    // Process worthless positions
    if (openPositions.length > 0) {
        const worthlessEntries = await processWorthlessPositions(openPositions, taxYearEnd);
        entries.push(...worthlessEntries);
    }
    // Separate short-term vs long-term
    const shortTerm = entries.filter(e => !e.isLongTerm);
    const longTerm = entries.filter(e => e.isLongTerm);
    return {
        shortTerm,
        longTerm,
        shortTermSummary: calculateSummary(shortTerm),
        longTermSummary: calculateSummary(longTerm),
        totalTransactions: entries.length,
        totalGainLoss: round(sumBy(entries, 'gainLoss')),
        warnings,
        openPositions
    };
}
function normalizeTrade(trade) {
    if (!trade.conditionId || !trade.outcome)
        return null;
    if (trade.type === 'REDEEM') {
        return {
            ...trade,
            side: 'SELL',
            usdcSize: trade.size * 1.0,
            price: 1.0
        };
    }
    return {
        ...trade,
        price: trade.price || trade.usdcSize / trade.size
    };
}
function addToInventory(inventory, key, trade) {
    if (!inventory.has(key)) {
        inventory.set(key, []);
    }
    inventory.get(key).push({
        acquisitionDate: trade.timestamp,
        quantity: trade.size,
        costBasisPerToken: trade.usdcSize / trade.size,
        totalCostBasis: trade.usdcSize,
        marketTitle: trade.title,
        transactionHash: trade.transactionHash,
        outcome: trade.outcome
    });
}
function matchSellToBuys(inventory, key, trade) {
    const queue = inventory.get(key) || [];
    const entries = [];
    let remaining = trade.size;
    const proceedsPerToken = trade.usdcSize / trade.size;
    while (remaining > 0.0001 && queue.length > 0) {
        const lot = queue[0];
        const qty = Math.min(remaining, lot.quantity);
        const proceeds = qty * proceedsPerToken;
        const costBasis = qty * lot.costBasisPerToken;
        const gainLoss = proceeds - costBasis;
        const holdingDays = Math.floor((trade.timestamp - lot.acquisitionDate) / 86400);
        entries.push({
            description: `Prediction market contract - ${trade.outcome} - ${truncate(trade.title, 50)}`,
            dateAcquired: formatDate(lot.acquisitionDate),
            dateSold: formatDate(trade.timestamp),
            proceeds: round(proceeds),
            costBasis: round(costBasis),
            gainLoss: round(gainLoss),
            isLongTerm: holdingDays >= LONG_TERM_DAYS,
            holdingDays
        });
        lot.quantity -= qty;
        remaining -= qty;
        if (lot.quantity < 0.0001) {
            queue.shift();
        }
    }
    // Handle overselling
    if (remaining > 0.0001) {
        const proceeds = remaining * proceedsPerToken;
        entries.push({
            description: `Prediction market contract - ${trade.outcome} - ${truncate(trade.title, 50)} [NO COST BASIS]`,
            dateAcquired: 'VARIOUS',
            dateSold: formatDate(trade.timestamp),
            proceeds: round(proceeds),
            costBasis: 0,
            gainLoss: round(proceeds),
            isLongTerm: false,
            holdingDays: 0
        });
        return {
            newEntries: entries,
            warning: `Sold ${remaining} more shares than owned for ${key}`
        };
    }
    return { newEntries: entries };
}
function collectOpenPositions(inventory) {
    const positions = [];
    for (const [key, lots] of inventory.entries()) {
        if (lots.length === 0)
            continue;
        const [conditionId, ...outcomeParts] = key.split('-');
        const outcome = outcomeParts.join('-');
        positions.push({
            positionKey: key,
            conditionId,
            outcome,
            quantity: sumBy(lots, 'quantity'),
            costBasis: sumBy(lots, 'totalCostBasis'),
            lots,
            title: lots[0].marketTitle
        });
    }
    return positions;
}
async function processWorthlessPositions(positions, taxYearEnd) {
    const conditionIds = positions.map(p => p.conditionId);
    const marketMap = await fetchMarketsBatch(conditionIds);
    const entries = [];
    for (const position of positions) {
        const market = marketMap.get(position.conditionId);
        if (!market?.closed)
            continue;
        const winner = market.tokens.find(t => t.winner);
        if (!winner)
            continue;
        const isWorthless = position.outcome.toUpperCase() !== winner.outcome.toUpperCase();
        if (isWorthless) {
            for (const lot of position.lots) {
                const holdingDays = Math.floor((taxYearEnd - lot.acquisitionDate) / 86400);
                entries.push({
                    description: `Prediction market contract - ${position.outcome} - ${truncate(position.title, 50)} [WORTHLESS]`,
                    dateAcquired: formatDate(lot.acquisitionDate),
                    dateSold: formatDate(taxYearEnd),
                    proceeds: 0,
                    costBasis: round(lot.quantity * lot.costBasisPerToken),
                    gainLoss: -round(lot.quantity * lot.costBasisPerToken),
                    isLongTerm: holdingDays >= LONG_TERM_DAYS,
                    holdingDays
                });
            }
        }
    }
    return entries;
}
function calculateSummary(entries) {
    return {
        count: entries.length,
        totalProceeds: round(sumBy(entries, 'proceeds')),
        totalCostBasis: round(sumBy(entries, 'costBasis')),
        totalGainLoss: round(sumBy(entries, 'gainLoss'))
    };
}
// Utilities
function formatDate(timestamp) {
    const date = new Date(timestamp * 1000);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
}
function truncate(str, maxLen) {
    if (!str || str.length <= maxLen)
        return str;
    return str.substring(0, maxLen - 3) + '...';
}
function round(num, decimals = 2) {
    return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
}
function sumBy(arr, key) {
    return arr.reduce((sum, item) => sum + (item[key] || 0), 0);
}
//# sourceMappingURL=calculator.js.map
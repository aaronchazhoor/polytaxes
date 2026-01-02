/**
 * Polymarket API integration
 * Fetches trading history and market data
 */
const POLYMARKET_DATA_API = 'https://data-api.polymarket.com';
const POLYMARKET_CLOB_API = 'https://clob.polymarket.com';
const CORS_PROXY = 'https://corsproxy.io/?';
/**
 * Fetches trading history for a wallet within a tax year
 */
export async function fetchTradingHistory(walletAddress, taxYear, onProgress) {
    const start = new Date(taxYear, 0, 1).getTime() / 1000;
    const end = new Date(taxYear, 11, 31, 23, 59, 59).getTime() / 1000;
    const allTrades = [];
    let offset = 0;
    const limit = 500;
    while (true) {
        onProgress?.(`Fetching trades (${allTrades.length} found)...`);
        const params = new URLSearchParams({
            user: walletAddress.toLowerCase(),
            limit: String(limit),
            offset: String(offset),
            start: String(Math.floor(start)),
            end: String(Math.floor(end)),
            sortBy: 'TIMESTAMP',
            sortDirection: 'ASC'
        });
        const apiUrl = `${POLYMARKET_DATA_API}/activity?${params}`;
        const proxiedUrl = `${CORS_PROXY}${encodeURIComponent(apiUrl)}`;
        const response = await fetch(proxiedUrl);
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        const data = await response.json();
        const batch = Array.isArray(data) ? data : data.activities || data.data || [];
        const trades = batch.filter((item) => item.type === 'TRADE' || item.type === 'REDEEM');
        allTrades.push(...trades);
        if (batch.length < limit)
            break;
        offset += limit;
        if (offset > 50000)
            break; // Safety limit
    }
    console.log(`Fetched ${allTrades.length} trades`);
    // Enrich REDEEM activities with winning outcomes
    return await enrichRedeemOutcomes(allTrades);
}
/**
 * Fetches market data by condition ID
 */
export async function fetchMarket(conditionId) {
    try {
        const url = `${POLYMARKET_CLOB_API}/markets/${conditionId}`;
        const response = await fetch(url);
        if (!response.ok)
            return null;
        const market = await response.json();
        return market;
    }
    catch (error) {
        console.error(`Error fetching market ${conditionId}:`, error);
        return null;
    }
}
/**
 * Fetches multiple markets in batches
 */
export async function fetchMarketsBatch(conditionIds) {
    const unique = [...new Set(conditionIds)];
    const marketMap = new Map();
    const batchSize = 5;
    for (let i = 0; i < unique.length; i += batchSize) {
        const batch = unique.slice(i, i + batchSize);
        const promises = batch.map(id => fetchMarket(id));
        const results = await Promise.all(promises);
        batch.forEach((id, idx) => {
            if (results[idx]) {
                marketMap.set(id, results[idx]);
            }
        });
        if (i + batchSize < unique.length) {
            await sleep(500);
        }
    }
    return marketMap;
}
/**
 * Enriches REDEEM activities with winning outcome
 * (REDEEM transactions have empty outcome field in API)
 */
async function enrichRedeemOutcomes(trades) {
    const redeems = trades.filter(t => t.type === 'REDEEM' && !t.outcome);
    if (redeems.length === 0)
        return trades;
    console.log(`Enriching ${redeems.length} REDEEM activities...`);
    const conditionIds = [...new Set(redeems.map(r => r.conditionId))];
    const marketMap = await fetchMarketsBatch(conditionIds);
    for (const trade of trades) {
        if (trade.type === 'REDEEM' && !trade.outcome) {
            const market = marketMap.get(trade.conditionId);
            if (market?.tokens) {
                const winner = market.tokens.find(t => t.winner);
                if (winner) {
                    trade.outcome = winner.outcome;
                }
            }
        }
    }
    console.log(`Enriched ${redeems.length} REDEEMs`);
    return trades;
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
export function isValidWalletAddress(address) {
    return /^0x[a-fA-F0-9]{40}$/.test(address.trim());
}
export function extractWalletAddress(input) {
    const trimmed = input.trim();
    if (isValidWalletAddress(trimmed)) {
        return trimmed.toLowerCase();
    }
    const match = trimmed.match(/polymarket\.com\/profile\/(0x[a-fA-F0-9]{40})/i);
    if (match && isValidWalletAddress(match[1])) {
        return match[1].toLowerCase();
    }
    return null;
}
//# sourceMappingURL=api.js.map
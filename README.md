# Polymarket Tax Form Generator

A privacy-focused, client-side tool for generating IRS Form 8949 from your Polymarket prediction market trades.

## Features

- **100% Client-Side Processing** - All calculations happen in your browser. No data is sent to any server.
- **FIFO Cost Basis** - Implements First-In-First-Out accounting method required by the IRS
- **Automatic Tax Year Handling** - Properly filters trades by tax year boundaries
- **Worthless Position Detection** - Automatically identifies and writes off positions that resolved against you
- **Two Reporting Modes**:
  - **Summary Mode** (Recommended) - Uses IRS Exception 2 for consolidated reporting with attached statement
  - **Detailed Mode** - Lists all transactions individually on Form 8949 (correct 14-per-page pagination)
- **REDEEM Transaction Enrichment** - Automatically fetches winning outcomes for redemption transactions
- **Long-term vs Short-term** - Automatically classifies gains/losses by holding period (365+ days = long-term)

## How It Works

### Tax Calculation Process

1. **Fetch Trading History** - Retrieves all trades from Polymarket's API for the specified wallet and tax year
2. **Normalize Transactions** - Converts REDEEM transactions to SELL transactions and enriches with outcome data
3. **FIFO Matching** - Matches sells to buys using First-In-First-Out method
4. **Worthless Position Detection** - Checks if any open positions resolved against you and creates $0 disposal entries
5. **Generate Form 8949** - Fills official IRS form with proper formatting and pagination

### API Integration

- **Data API** (via CORS proxy): `https://data-api.polymarket.com` - Trading history
- **CLOB API** (direct): `https://clob.polymarket.com` - Market resolution data

## Setup

### Prerequisites

- Node.js 16+ and npm
- Modern web browser
- Python 3 (for local development server)

### Installation

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Start development server
npm run dev
```

The app will be available at `http://localhost:8000`

## Usage

1. Open the app in your browser
2. Enter your Polymarket wallet address or profile URL
3. Select the tax year (2024, 2025, etc.)
4. Click "Generate Tax Report"
5. Review the summary showing:
   - Total transactions
   - Short-term vs long-term breakdown
   - Net gain/loss
6. Select reporting mode:
   - **Summary Mode** (recommended for many transactions)
   - **Detailed Mode** (all transactions on form)
7. Click "Download PDF" to generate your IRS Form 8949

### Example Wallet Addresses

You can input wallet addresses in either format:
- `0x1234567890abcdef...`
- `https://polymarket.com/profile/username`

## GitHub Pages Deployment

This app is designed to be hosted for free on GitHub Pages:

### Deployment Steps

1. **Prepare the repository**:
```bash
# Build the TypeScript
npm run build

# Commit everything
git add .
git commit -m "Initial commit"
```

2. **Push to GitHub**:
```bash
git remote add origin https://github.com/yourusername/polytaxes.git
git branch -M main
git push -u origin main
```

3. **Enable GitHub Pages**:
   - Go to your repository settings
   - Navigate to "Pages" section
   - Select source: "Deploy from a branch"
   - Branch: `main`, folder: `/` (root)
   - Click "Save"

4. **Update the base path** (if your repo is not at root):
   - Edit `public/index.html`
   - Update script/CSS paths if needed
   - Rebuild: `npm run build`
   - Commit and push

Your app will be live at: `https://yourusername.github.io/polytaxes`

### CORS Proxy Considerations

The app uses a CORS proxy (`https://corsproxy.io/`) for the Polymarket Data API. For production use, consider:
- Setting up your own CORS proxy
- Using a serverless function (Vercel, Netlify, etc.)
- Updating `src/api.ts` with your proxy URL

## Technical Details

### Project Structure

```
polytaxes/
├── src/                    # TypeScript source files
│   ├── types.ts           # Type definitions
│   ├── api.ts             # Polymarket API integration
│   ├── calculator.ts      # FIFO tax calculations
│   ├── pdf.ts             # PDF generation
│   └── main.ts            # Application entry point
├── public/                # Static files
│   ├── index.html         # Main HTML file
│   ├── styles.css         # Styles
│   └── IRS_Form_8949.pdf  # IRS form template
├── dist/                  # Compiled JavaScript (generated)
├── backup/                # Old JavaScript version (reference)
├── tsconfig.json          # TypeScript configuration
└── package.json           # Project dependencies
```

### IRS Form 8949 Specifications

- **14 transactions per page** (official IRS limit)
- **Part I**: Short-term capital gains/losses (held ≤365 days)
- **Part II**: Long-term capital gains/losses (held >365 days)
- **Box C checked**: "Exception 2 - Detailed statement attached" (summary mode)

### Transaction Descriptions

Transactions are described as:
```
Prediction market contract - [OUTCOME] - [MARKET TITLE]
```

Example:
```
Prediction market contract - Yes - Trump wins 2024 election
```

### Cost Basis Method

This tool implements **FIFO (First-In-First-Out)**:
- Sells are matched to the earliest purchases first
- Holding period is calculated from acquisition to sale date
- Cost basis is proportionally calculated for partial sales

## Privacy & Security

- **No server processing** - All calculations happen in your browser
- **No data storage** - Nothing is saved or transmitted to external servers
- **Open source** - Full transparency of all code
- **API calls only** - Only communicates with Polymarket's public APIs

## Disclaimer

This tool is for **informational purposes only** and should not be considered professional tax advice.

- Consult a qualified tax professional before filing
- The IRS may have specific requirements for your situation
- This tool assumes FIFO cost basis method
- Verify all calculations independently
- The author is not responsible for any tax filing errors

## Development

### Available Scripts

```bash
npm run build      # Compile TypeScript
npm run watch      # Watch mode (auto-compile on changes)
npm run dev        # Start development server
npm run clean      # Remove dist/ folder
```

### Building from Source

```bash
# Clone the repository
git clone https://github.com/yourusername/polytaxes.git
cd polytaxes

# Install dependencies
npm install

# Build
npm run build

# Test locally
npm run dev
```

## Troubleshooting

### "No trades found"
- Verify the wallet address is correct
- Check that the wallet has trades in the selected tax year
- Ensure the wallet is on Polygon (not Ethereum mainnet)

### PDF generation fails
- Ensure `IRS_Form_8949.pdf` is in the `public/` folder
- Check browser console for errors
- Try a different browser (Chrome, Firefox, Safari)

### CORS errors
- The app uses a CORS proxy for Polymarket Data API
- If the proxy is down, try deploying your own
- Alternative: use Polymarket's official API with proper CORS headers

## Resources

- [IRS Form 8949 Instructions](https://www.irs.gov/instructions/i8949)
- [IRS Publication 550 (Investment Income and Expenses)](https://www.irs.gov/publications/p550)
- [Polymarket Documentation](https://docs.polymarket.com)
- [pdf-lib Documentation](https://pdf-lib.js.org/)

## License

MIT License - See LICENSE file for details

## Support

For issues or questions:
- Open an issue on GitHub
- Review the IRS Form 8949 instructions
- Consult a tax professional for specific advice

---

**Built with privacy in mind. Your financial data stays on your device.**

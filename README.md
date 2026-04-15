# InvoiceChain Credit

Decentralized invoice financing protocol on Algorand.
SMEs lock invoices as NFT collateral to borrow ICC tokens instantly.

## Live Demo
[TestNet deployment link here]

## How It Works
1. Connect Pera Wallet
2. Verify business via GSTIN
3. Upload invoice PDF (SHA-256 hash stored on-chain)
4. Get Trust Score (0-100) based on payment history
5. Mint Invoice as ARC-3 NFT on Algorand
6. Lock NFT as collateral → receive ICC tokens atomically
7. Repay ICC → NFT returned. Default → liquidation.

## Tech Stack
- Smart Contract: PuyaPy (Algorand Python)
- Frontend: Next.js 14, TypeScript, TailwindCSS
- Wallet: Pera Wallet via @txnlab/use-wallet-react
- Token: ICC (custom ASA, 1M supply)
- NFT Standard: ARC-3
- Tools: AlgoKit, VibeKit MCP, Kapa MCP

## Key Features
- Atomic transaction collateral locking
- GSTIN business verification
- PDF SHA-256 document hash on-chain
- Trust Score engine
- Liquidation on default
- Multi-device state restore via Algorand indexer

## Submission Password
ALGOHackSeries3

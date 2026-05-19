# InvoiceChain Credit

> Decentralized invoice financing protocol on Algorand — 
> lock unpaid invoices as NFT collateral, borrow ICC tokens instantly.

[![Algorand](https://img.shields.io/badge/Algorand-TestNet-blue)](https://lora.algokit.io/testnet/application/758816530)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Vercel](https://img.shields.io/badge/deployed-Vercel-black)](https://invoice-chain-azure.vercel.app)

## Live Demo
- **Platform:** https://invoice-chain-azure.vercel.app
- **Smart Contract:** https://lora.algokit.io/testnet/application/758816530
- **ICC Token:** https://lora.algokit.io/testnet/asset/758816543
- **Invoice NFT:** https://lora.algokit.io/testnet/asset/762867667
- **Network:** Algorand TestNet

## The Problem

₹20 lakh crore is frozen in unpaid invoices across 
India's MSME sector. Small businesses complete work, 
raise invoices, and wait 60-90 days for payment. 
Banks demand collateral they don't have. 
Double invoice financing fraud costs ₹50,000 crore annually.

## The Solution

InvoiceChain Credit turns unpaid invoices into instant 
collateral on Algorand. Upload invoice → get Trust Score → 
mint as NFT → lock as collateral → receive ICC tokens instantly. 
No bank. No paperwork. Under 3 seconds.

## What's New in Round 3

- ICC custom protocol token (replaced ALGO lending)
- NFT atomic collateral locking via Algorand atomic transactions
- PDF buyer GSTIN extraction + document confidence score on-chain
- Real GSTIN verification with API integration
- Liquidation engine — contract keeps NFT on default
- Revolving credit — re-borrow after repayment
- Multi-device state restore via Algorand indexer
- Corporate-grade UI — IBM Plex Mono, Epilogue, gold accents

## How It Works

1. **Connect Pera Wallet** — wallet gated, no access without it
2. **GSTIN Verification** — business verified, stored in NFT metadata
3. **PDF Upload** — SHA-256 hash + buyer GSTIN extracted on-chain
4. **Trust Score** — 0-100 based on payment behavior, hardcoded borrow limit
5. **Mint Invoice NFT** — ARC-3 ASA on Algorand, all metadata permanent
6. **Borrow** — atomic group: NFT locks + ICC releases simultaneously
7. **Repay** — ICC returned, NFT unlocked atomically
8. **Default** — liquidation called, contract keeps NFT permanently

## Why Web3

- **Zero double financing** — NFT locked on-chain cannot be submitted elsewhere
- **Cryptographic document proof** — SHA-256 hash unalterable on Algorand
- **Trustless execution** — smart contract IS the bank, no human approval
- **Permanent credit history** — every repayment builds decentralized identity

## Contract Details

| Item | Value |
|------|-------|
| Network | Algorand TestNet |
| App ID | 758816530 |
| ICC Token ASA | 758816543 |
| Invoice NFT ASA | 762867667 |
| Contract Address | YJJFZOOJB65MN7XEWBNKCF4HMERB2FVRQ5NERB7VRQRMXF54V2TPLKLXUA |

## Business Model

- **Protocol fee:** 0.5% on every loan at repayment
- **Target:** Rs.10Cr monthly loan volume = Rs.5L/month revenue
- **Production model:** NBFC provides real INR liquidity, 
  blockchain handles collateral and liquidation automatically

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contract | PuyaPy (Algorand Python) → TEAL |
| Frontend | Next.js 14, TypeScript, TailwindCSS |
| Wallet | Pera Wallet via @txnlab/use-wallet-react |
| Protocol Token | ICC — custom ASA, 1M supply, 2 decimals |
| NFT Standard | ARC-3 |
| Node | AlgoNode public TestNet |
| Tools | AlgoKit, VibeKit MCP, Kapa MCP |
| Deployment | Vercel |

## Setup Guide

See [docs/SETUP.md](docs/SETUP.md) for full local setup instructions.

```bash
# Clone
git clone https://github.com/rkdev19/InvoiceChain
cd InvoiceChain

# Smart contract
cd smart_contracts
algokit project run build

# Frontend
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for full system diagram.

```
Pera Wallet → Next.js Frontend (Vercel)
↓
Algorand TestNet
↓
PuyaPy Smart Contract (App: 758816530)
↓              ↓
ICC Token (ASA)   Invoice NFT (ARC-3)
```

## Trust Score Formula

```
Reliability  = (paid_on_time / past_invoices) × 100 × 0.4
Frequency    = min(past_invoices / 10, 1) × 100 × 0.3
Consistency  = (1 - std_dev / avg_amount) × 100 × 0.3
Score        = floor(Reliability + Frequency + Consistency)
Borrow Limit = floor(Invoice Amount × Score / 100)
```

## Market

- **₹20 lakh crore** — MSME invoice financing gap in India
- **₹50,000 crore** — annual double financing fraud
- **340 million** — Indians with no credit score
- **TReDS** — Rs.1.5L Cr annual volume, 90% inaccessible to small MSMEs

---

*Built with AlgoKit · Deployed on Algorand TestNet · May 2026*

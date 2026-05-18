# Setup Guide

## Prerequisites
- Node.js 18+
- Python 3.12+
- AlgoKit CLI
- Pera Wallet (mobile or browser extension)
- Algorand TestNet account with ALGO

## Installation

### 1. Clone Repository
```bash
git clone [repo url]
cd InvoiceChain
```

### 2. Smart Contract Setup
```bash
cd projects/InvoiceChain-contracts
pip install algokit
algokit project run build
```

### 3. Frontend Setup
```bash
cd projects/InvoiceChain-frontend
npm install
cp .env.example .env.local
# Fill in your deployer address in .env.local
```

### 4. Run Locally
```bash
npm run dev
# Opens at http://localhost:5173
```

### 5. Get TestNet ALGO
Visit: https://bank.testnet.algorand.network
Enter your Pera wallet address and receive 10 TestNet ALGO.

### 6. Deploy Contract
Connect Pera wallet on the platform.
Navigate to the app — the contract deploys on first invoice mint.

## Deployed Contract
- **Network:** Algorand TestNet
- **App ID:** [ADD YOUR APP ID]
- **Explorer:** https://lora.algokit.io/testnet/application/[APP ID]

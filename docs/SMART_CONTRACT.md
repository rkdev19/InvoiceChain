# Smart Contract Documentation

## Overview
PuyaPy contract deployed on Algorand TestNet.
Handles ICC token creation, invoice NFT minting,
collateral locking, lending, and liquidation.

## Global State Keys
| Key | Type | Description |
|-----|------|-------------|
| amount | uint64 | Invoice amount in paise |
| due_date | uint64 | Unix timestamp of due date |
| trust_score | uint64 | Score 0-100 |
| risk_level | bytes | LOW / MEDIUM / HIGH |
| borrow_limit | uint64 | Max borrowable amount |
| is_borrowed | bool | Active loan flag |
| borrowed_amount | uint64 | Current loan amount |
| nft_asset_id | uint64 | Invoice NFT ASA ID |
| icc_asset_id | uint64 | ICC token ASA ID |
| collateral_locked | bool | NFT lock status |
| status | bytes | ACTIVE / REPAID / LIQUIDATED |

## Methods

### create_invoice(amount, due_date, trust_score)
- Validates trust score is in range 0–100
- Calculates `borrow_limit = amount × score / 100`
- Sets `risk_level`: LOW (≥80), MEDIUM (≥60), HIGH (<60)
- Mints ARC-3 NFT with full invoice metadata
- Stores all state in global storage
- Returns `nft_asset_id`

### borrow(borrow_amount)
- Verifies `gtxn[0]` is an NFT transfer to the contract
- Checks `borrow_amount <= borrow_limit`
- Checks contract ICC balance >= `borrow_amount`
- Sends ICC to borrower via inner transaction
- Sets `is_borrowed = True`, `collateral_locked = True`

### repay()
- Verifies `gtxn[0]` is an ICC transfer to the contract
- Checks transferred amount >= `borrowed_amount`
- Sends NFT back to borrower via inner transaction
- Sets `is_borrowed = False`, `collateral_locked = False`

### liquidate()
- Only callable by the contract creator
- Checks `Global.latest_timestamp > due_date`
- Checks `is_borrowed == True`
- Keeps NFT in contract permanently
- Sets `status = LIQUIDATED`

### get_invoice_info()
- Read-only method (no state change)
- Returns all global state as a tuple

## Atomic Transaction Flow — Borrow
```
Group:
  gtxn[0]: Asset Transfer
    from:   user wallet
    to:     contract address
    asset:  invoice NFT (1 of 1)
  gtxn[1]: Application Call — borrow()
    inner:  Asset Transfer
      from: contract
      to:   user wallet
      asset: ICC tokens
```
Both execute atomically or neither executes.

## Atomic Transaction Flow — Repay
```
Group:
  gtxn[0]: Asset Transfer
    from:   user wallet
    to:     contract address
    asset:  ICC tokens (borrowed amount)
  gtxn[1]: Application Call — repay()
    inner:  Asset Transfer
      from: contract
      to:   user wallet
      asset: invoice NFT
```
Both execute atomically or neither executes.

## NFT Metadata (note field)
Each mint transaction embeds a JSON note field stored immutably on-chain:

| Field | Type | Description |
|-------|------|-------------|
| `document_hash` | string | SHA-256 hash of the uploaded invoice PDF |
| `document_name` | string \| null | Original filename |
| `document_verified` | boolean | Whether a PDF was uploaded |
| `document_confidence` | number | PDF extraction confidence score (0–100) |
| `buyer_gstin` | string | Buyer GSTIN extracted from PDF, or `"not_detected"` |
| `seller_gstin_verified` | boolean | Whether seller GSTIN was found in the PDF |
| `amount_verified` | boolean | Whether extracted amount matches claimed amount (±20%) |
| `date_verified` | boolean | Whether invoice date is within last 90 days |

## Error Codes
| Error | Cause |
|-------|-------|
| `overspend` | Insufficient contract balance |
| `logic eval error` | Assertion failed in contract |
| `asset not opted in` | Wallet needs to opt in first |

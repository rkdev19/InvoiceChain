import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { InvoiceClient } from '../contracts/Invoice'

export interface ChainRestoreResult {
  appClient: InvoiceClient
  appId: bigint
  appAddress: string
  amount: number
  dueDate: string        // YYYY-MM-DD
  trustScore: number
  riskLevel: string
  borrowLimit: number
  isBorrowed: boolean
  borrowedAmount: bigint
  nftAssetId: bigint | null
  collateralLocked: boolean
  invoiceStatus: string
  iccAssetId: bigint | null
}

export async function restoreFromChain(
  activeAddress: string,
  algorand: AlgorandClient,
): Promise<ChainRestoreResult | null> {
  // ── 1. Find all apps created by this wallet ───────────────────
  // algosdk v3 indexer returns { applications: [...], 'current-round': n }
  type AppEntry = { id: bigint | number; deleted?: boolean }

  const searchResult = await (algorand.client.indexer as unknown as {
    searchForApplications(): { creator(a: string): { do(): Promise<{ applications?: AppEntry[] }> } }
  })
    .searchForApplications()
    .creator(activeAddress)
    .do()

  const apps: AppEntry[] = searchResult.applications ?? []
  if (apps.length === 0) return null

  // Most recent contract first (highest App ID)
  apps.sort((a, b) => Number(BigInt(b.id) - BigInt(a.id)))

  // ── 2. Try each app until one responds like our Invoice contract ─
  for (const app of apps) {
    if (app.deleted) continue
    const appId = BigInt(app.id)

    try {
      const appClient = new InvoiceClient({
        appId,
        defaultSender: activeAddress,
        algorand,
      })

      // get_invoice_info returns 11-tuple:
      // [amount, due_date, trust_score, risk_level, borrow_limit,
      //  is_borrowed, borrowed_amount, nft_asset_id, collateral_locked, status, icc_asset_id]
      const info = await appClient.getInvoiceInfo()
      const [
        rawAmount, rawDueDate, rawTrustScore, rawRiskLevel, rawBorrowLimit,
        rawIsBorrowed, rawBorrowedAmount, rawNftAssetId, rawCollateralLocked,
        rawStatus, rawIccAssetId,
      ] = info

      const appAddress = String(appClient.appClient.appAddress)

      // Convert unix timestamp → YYYY-MM-DD
      const dueDateTs = Number(rawDueDate)
      const dueDate = dueDateTs > 0 && dueDateTs < 2_000_000_000
        ? new Date(dueDateTs * 1000).toISOString().split('T')[0]
        : ''

      return {
        appClient,
        appId,
        appAddress,
        amount: Number(rawAmount),
        dueDate,
        trustScore: Number(rawTrustScore),
        riskLevel: String(rawRiskLevel),
        borrowLimit: Number(rawBorrowLimit),
        isBorrowed: Boolean(rawIsBorrowed),
        borrowedAmount: BigInt(rawBorrowedAmount as bigint),
        nftAssetId: rawNftAssetId && BigInt(rawNftAssetId as bigint) > 0n
          ? BigInt(rawNftAssetId as bigint)
          : null,
        collateralLocked: Boolean(rawCollateralLocked),
        invoiceStatus: String(rawStatus) || 'ACTIVE',
        iccAssetId: rawIccAssetId && BigInt(rawIccAssetId as bigint) > 0n
          ? BigInt(rawIccAssetId as bigint)
          : null,
      }
    } catch {
      // Not an Invoice contract or not yet initialised — try next
    }
  }

  return null
}

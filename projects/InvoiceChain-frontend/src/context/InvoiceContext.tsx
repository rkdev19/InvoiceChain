import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { InvoiceClient } from '../contracts/Invoice'
import type { GstData } from '../utils/verifyGstin'

export interface PastInvoice {
  nftAssetId: bigint
  amount: number
  dueDate: string
  trustScore: number
  riskLevel: string
  invoiceStatus: string
  mintTxnId: string | null
  documentHash: string | null
}

// ── Persistence helpers ───────────────────────────────────────────
// JSON doesn't support BigInt — store as { __bigint: "123" } objects.
const STORAGE_KEY = 'ic_state_v1'

function serialize(v: unknown): string {
  return JSON.stringify(v, (_, val) =>
    typeof val === 'bigint' ? { __bigint: val.toString() } : val
  )
}

function deserialize<T>(json: string): T {
  return JSON.parse(json, (_, val) =>
    val && typeof val === 'object' && '__bigint' in val ? BigInt(val.__bigint as string) : val
  ) as T
}

interface PersistedState {
  businessName: string
  amount: number
  dueDate: string
  trustScore: number
  riskLevel: string
  borrowLimit: number
  appId: bigint | null
  appAddress: string | null
  nftAssetId: bigint | null
  mintTxnId: string | null
  isBorrowed: boolean
  borrowedAmount: bigint
  iccAssetId: bigint | null
  collateralLocked: boolean
  invoiceStatus: string
  gstVerified: boolean
  gstData: GstData | null
  documentHash: string | null
  documentName: string | null
  pastInvoices: PastInvoice[]
}

function loadPersistedState(): Partial<PersistedState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return deserialize<Partial<PersistedState>>(raw)
  } catch {
    return {}
  }
}

// ── Context types ─────────────────────────────────────────────────
interface InvoiceState extends PersistedState {
  step: number
  setStep: (step: number) => void

  setBusinessName: (v: string) => void
  setAmount: (v: number) => void
  setDueDate: (v: string) => void

  setTrustScore: (v: number) => void
  setRiskLevel: (v: string) => void
  setBorrowLimit: (v: number) => void

  setAppId: (v: bigint | null) => void
  setAppAddress: (v: string | null) => void
  setNftAssetId: (v: bigint | null) => void
  setMintTxnId: (v: string | null) => void

  setIsBorrowed: (v: boolean) => void
  setBorrowedAmount: (v: bigint) => void
  poolBalance: bigint
  setPoolBalance: (v: bigint) => void

  setIccAssetId: (v: bigint | null) => void
  setCollateralLocked: (v: boolean) => void
  setInvoiceStatus: (v: string) => void

  setGstVerified: (v: boolean) => void
  setGstData: (v: GstData | null) => void

  setDocumentHash: (v: string | null) => void
  setDocumentName: (v: string | null) => void

  setPastInvoices: (v: PastInvoice[]) => void

  appClient: InvoiceClient | null
  setAppClient: (v: InvoiceClient | null) => void
}

const InvoiceContext = createContext<InvoiceState | null>(null)

export const InvoiceProvider = ({ children }: { children: ReactNode }) => {
  const saved = loadPersistedState()

  const [step, setStep]               = useState(0)
  const [businessName, setBusinessName] = useState(saved.businessName ?? '')
  const [amount, setAmount]           = useState(saved.amount ?? 0)
  const [dueDate, setDueDate]         = useState(saved.dueDate ?? '')
  const [trustScore, setTrustScore]   = useState(saved.trustScore ?? 0)
  const [riskLevel, setRiskLevel]     = useState(saved.riskLevel ?? '')
  const [borrowLimit, setBorrowLimit] = useState(saved.borrowLimit ?? 0)
  const [appId, setAppId]             = useState<bigint | null>(saved.appId ?? null)
  const [appAddress, setAppAddress]   = useState<string | null>(saved.appAddress ?? null)
  const [nftAssetId, setNftAssetId]   = useState<bigint | null>(saved.nftAssetId ?? null)
  const [mintTxnId, setMintTxnId]     = useState<string | null>(saved.mintTxnId ?? null)
  const [isBorrowed, setIsBorrowed]   = useState(saved.isBorrowed ?? false)
  const [borrowedAmount, setBorrowedAmount] = useState<bigint>(saved.borrowedAmount ?? 0n)
  const [poolBalance, setPoolBalance] = useState<bigint>(0n) // always fetch fresh
  const [iccAssetId, setIccAssetId]   = useState<bigint | null>(saved.iccAssetId ?? null)
  const [collateralLocked, setCollateralLocked] = useState(saved.collateralLocked ?? false)
  const [invoiceStatus, setInvoiceStatus] = useState(saved.invoiceStatus ?? 'ACTIVE')
  const [gstVerified, setGstVerified] = useState(saved.gstVerified ?? false)
  const [gstData, setGstData]         = useState<GstData | null>(saved.gstData ?? null)
  const [documentHash, setDocumentHash] = useState<string | null>(saved.documentHash ?? null)
  const [documentName, setDocumentName] = useState<string | null>(saved.documentName ?? null)
  const [pastInvoices, setPastInvoices] = useState<PastInvoice[]>(saved.pastInvoices ?? [])
  const [appClient, setAppClient]     = useState<InvoiceClient | null>(null) // reconstructed at runtime

  // Sync persisted fields to localStorage whenever they change
  useEffect(() => {
    const state: PersistedState = {
      businessName, amount, dueDate,
      trustScore, riskLevel, borrowLimit,
      appId, appAddress, nftAssetId, mintTxnId,
      isBorrowed, borrowedAmount,
      iccAssetId, collateralLocked, invoiceStatus,
      gstVerified, gstData,
      documentHash, documentName,
      pastInvoices,
    }
    try {
      localStorage.setItem(STORAGE_KEY, serialize(state))
    } catch { /* storage quota — ignore */ }
  }, [
    businessName, amount, dueDate,
    trustScore, riskLevel, borrowLimit,
    appId, appAddress, nftAssetId, mintTxnId,
    isBorrowed, borrowedAmount,
    iccAssetId, collateralLocked, invoiceStatus,
    gstVerified, gstData,
    documentHash, documentName,
    pastInvoices,
  ])

  return (
    <InvoiceContext.Provider
      value={{
        step, setStep,
        businessName, setBusinessName,
        amount, setAmount,
        dueDate, setDueDate,
        trustScore, setTrustScore,
        riskLevel, setRiskLevel,
        borrowLimit, setBorrowLimit,
        appId, setAppId,
        appAddress, setAppAddress,
        nftAssetId, setNftAssetId,
        mintTxnId, setMintTxnId,
        isBorrowed, setIsBorrowed,
        borrowedAmount, setBorrowedAmount,
        poolBalance, setPoolBalance,
        iccAssetId, setIccAssetId,
        collateralLocked, setCollateralLocked,
        invoiceStatus, setInvoiceStatus,
        gstVerified, setGstVerified,
        gstData, setGstData,
        documentHash, setDocumentHash,
        documentName, setDocumentName,
        pastInvoices, setPastInvoices,
        appClient, setAppClient,
      }}
    >
      {children}
    </InvoiceContext.Provider>
  )
}

export const useInvoice = (): InvoiceState => {
  const ctx = useContext(InvoiceContext)
  if (!ctx) throw new Error('useInvoice must be used within InvoiceProvider')
  return ctx
}

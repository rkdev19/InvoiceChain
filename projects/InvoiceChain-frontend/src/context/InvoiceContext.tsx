import React, { createContext, useContext, useState, ReactNode } from 'react'
import { InvoiceClient } from '../contracts/Invoice'

interface InvoiceState {
  step: number
  setStep: (step: number) => void

  businessName: string
  setBusinessName: (v: string) => void
  amount: number
  setAmount: (v: number) => void
  dueDate: string
  setDueDate: (v: string) => void

  trustScore: number
  setTrustScore: (v: number) => void
  riskLevel: string
  setRiskLevel: (v: string) => void
  borrowLimit: number
  setBorrowLimit: (v: number) => void

  appId: bigint | null
  setAppId: (v: bigint | null) => void
  appAddress: string | null
  setAppAddress: (v: string | null) => void
  nftAssetId: bigint | null
  setNftAssetId: (v: bigint | null) => void
  mintTxnId: string | null
  setMintTxnId: (v: string | null) => void

  isBorrowed: boolean
  setIsBorrowed: (v: boolean) => void
  borrowedAmount: bigint
  setBorrowedAmount: (v: bigint) => void
  poolBalance: bigint
  setPoolBalance: (v: bigint) => void

  // New fields — ICC token + collateral state
  iccAssetId: bigint | null
  setIccAssetId: (v: bigint | null) => void
  collateralLocked: boolean
  setCollateralLocked: (v: boolean) => void
  invoiceStatus: string
  setInvoiceStatus: (v: string) => void

  appClient: InvoiceClient | null
  setAppClient: (v: InvoiceClient | null) => void
}

const InvoiceContext = createContext<InvoiceState | null>(null)

export const InvoiceProvider = ({ children }: { children: ReactNode }) => {
  const [step, setStep] = useState(0)
  const [businessName, setBusinessName] = useState('')
  const [amount, setAmount] = useState(0)
  const [dueDate, setDueDate] = useState('')
  const [trustScore, setTrustScore] = useState(0)
  const [riskLevel, setRiskLevel] = useState('')
  const [borrowLimit, setBorrowLimit] = useState(0)
  const [appId, setAppId] = useState<bigint | null>(null)
  const [appAddress, setAppAddress] = useState<string | null>(null)
  const [nftAssetId, setNftAssetId] = useState<bigint | null>(null)
  const [mintTxnId, setMintTxnId] = useState<string | null>(null)
  const [isBorrowed, setIsBorrowed] = useState(false)
  const [borrowedAmount, setBorrowedAmount] = useState<bigint>(0n)
  const [poolBalance, setPoolBalance] = useState<bigint>(0n)
  const [iccAssetId, setIccAssetId] = useState<bigint | null>(null)
  const [collateralLocked, setCollateralLocked] = useState(false)
  const [invoiceStatus, setInvoiceStatus] = useState('ACTIVE')
  const [appClient, setAppClient] = useState<InvoiceClient | null>(null)

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

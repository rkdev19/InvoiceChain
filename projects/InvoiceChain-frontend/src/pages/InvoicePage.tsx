import { useWallet } from '@txnlab/use-wallet-react'
import React, { useState } from 'react'
import BorrowFunds from '../components/BorrowFunds'
import Dashboard from '../components/Dashboard'
import MintInvoice from '../components/MintInvoice'
import UploadInvoice from '../components/UploadInvoice'
import WalletConnect from '../components/WalletConnect'
import { useInvoice } from '../context/InvoiceContext'

const STEPS = [
  { label: 'Onboard', icon: '👤' },
  { label: 'Upload',  icon: '📄' },
  { label: 'Mint',    icon: '🪙' },
  { label: 'Borrow',  icon: '💰' },
  { label: 'Dashboard', icon: '📊' },
]

const InvoicePage: React.FC = () => {
  const ctx = useInvoice()
  const { activeAddress } = useWallet()
  const [walletModalOpen, setWalletModalOpen] = useState(false)

  const step = ctx.step
  const progress = Math.round((step / (STEPS.length - 1)) * 100)

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-base-200 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-teal-700">InvoiceChain</h1>
          <p className="text-sm text-base-content/60">DeFi invoice financing on Algorand</p>
        </div>

        {/* Step progress */}
        <div className="card bg-base-100 shadow-md border border-base-200">
          <div className="card-body py-4 space-y-3">
            {/* DaisyUI steps */}
            <ul className="steps steps-horizontal w-full">
              {STEPS.map((s, i) => (
                <li
                  key={s.label}
                  className={`step text-xs cursor-pointer ${i <= step ? 'step-primary' : ''}`}
                  onClick={() => {
                    // Only allow navigating to completed steps
                    if (i <= step) ctx.setStep(i)
                  }}
                >
                  {s.label}
                </li>
              ))}
            </ul>

            {/* Progress bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-base-content/50">
                <span>Progress</span>
                <span>{progress}%</span>
              </div>
              <progress className="progress progress-primary w-full" value={progress} max={100} />
            </div>
          </div>
        </div>

        {/* Step content */}
        <div>
          {step === 0 && (
            <div className="card bg-base-100 shadow-md border border-base-200">
              <div className="card-body items-center text-center space-y-5">
                <div className="text-6xl">🔗</div>
                <h2 className="card-title text-xl">Connect Your Wallet</h2>
                <p className="text-sm text-base-content/60 max-w-sm">
                  Connect your Algorand wallet to get started with on-chain invoice financing.
                  We support LocalNet KMD, Pera, and Defly.
                </p>

                {activeAddress ? (
                  <div className="space-y-3 w-full">
                    <div className="alert alert-success">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm font-mono truncate">{activeAddress}</span>
                    </div>
                    <button className="btn btn-primary w-full" onClick={() => ctx.setStep(1)}>
                      Continue to Upload →
                    </button>
                  </div>
                ) : (
                  <button className="btn btn-primary btn-lg w-full" onClick={() => setWalletModalOpen(true)}>
                    Connect Wallet
                  </button>
                )}

                <WalletConnect openModal={walletModalOpen} closeModal={() => setWalletModalOpen(false)} />
              </div>
            </div>
          )}

          {step === 1 && <UploadInvoice />}
          {step === 2 && <MintInvoice />}
          {step === 3 && <BorrowFunds />}
          {step === 4 && <Dashboard />}
        </div>

        {/* Bottom wallet bar */}
        <div className="flex items-center justify-between text-xs text-base-content/40 px-1">
          <span>{STEPS[step]?.icon} {STEPS[step]?.label}</span>
          {activeAddress ? (
            <button
              className="btn btn-xs btn-ghost"
              onClick={() => setWalletModalOpen(true)}
            >
              {activeAddress.slice(0, 6)}…{activeAddress.slice(-4)}
            </button>
          ) : (
            <button className="btn btn-xs btn-ghost" onClick={() => setWalletModalOpen(true)}>
              Connect wallet
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default InvoicePage

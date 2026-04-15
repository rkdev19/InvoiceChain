import { ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRequireWallet } from '../hooks/useRequireWallet'

interface WalletGateProps {
  children: ReactNode
}

export default function WalletGate({ children }: WalletGateProps) {
  const { showOverlay, isConnected, triggerConnect } = useRequireWallet()

  return (
    <>
      {/* Overlay — blocks all content when wallet not connected */}
      <AnimatePresence>
        {showOverlay && (
          <motion.div
            key="wallet-gate-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              background: 'rgba(8,8,8,0.95)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0,
            }}
          >
            {/* Logo — pulsing */}
            <motion.img
              src="/logo-480x480.png"
              alt="InvoiceChain Credit"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, ease: 'easeInOut', repeat: Infinity }}
              style={{
                width: 96,
                height: 96,
                borderRadius: 14,
                marginBottom: 20,
              }}
            />

            {/* Thin separator */}
            <div
              style={{
                width: 120,
                height: 1,
                background: 'var(--border-default)',
                marginBottom: 20,
              }}
            />

            {/* Primary message */}
            <div
              style={{
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontSize: 14,
                color: 'var(--text-secondary)',
                marginBottom: 8,
                letterSpacing: '0.01em',
              }}
            >
              Wallet connection required
            </div>

            {/* Sub message */}
            <div
              className="mono"
              style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                letterSpacing: '0.08em',
                marginBottom: 28,
              }}
            >
              Connect Pera Wallet to continue
            </div>

            {/* Network line */}
            <div
              className="mono"
              style={{
                fontSize: 10,
                color: 'var(--text-muted)',
                letterSpacing: '0.10em',
                marginBottom: 28,
                textTransform: 'uppercase',
                opacity: 0.6,
              }}
            >
              Algorand {import.meta.env.VITE_ALGOD_NETWORK ?? 'Testnet'} · Pera Wallet Required
            </div>

            {/* Retry button — shown after user dismisses modal */}
            <button
              onClick={triggerConnect}
              style={{
                background: 'transparent',
                border: '1px solid var(--accent-gold)',
                borderRadius: 2,
                padding: '8px 20px',
                color: 'var(--accent-gold)',
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontSize: 12,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'background 120ms',
              }}
              onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(201,168,76,0.08)')}
              onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
            >
              Connect Wallet
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page content — rendered but hidden while overlay is shown */}
      <div style={{ visibility: isConnected ? 'visible' : 'hidden' }}>
        {children}
      </div>
    </>
  )
}

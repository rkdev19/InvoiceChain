import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useWallet } from '@txnlab/use-wallet-react'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { getAlgodConfigFromViteEnvironment, getIndexerConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'

// ── Inline SVG icons (minimal, 1.5px stroke) ────────────────────
const Icons = {
  dashboard: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  upload:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12M8 8l4-4 4 4"/></svg>,
  borrow:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M9 10.5C9 9.1 10.3 8 12 8s3 1.1 3 2.5-1.3 2.5-3 2.5-3 1.1-3 2.5 1.3 2.5 3 2.5 3-1.1 3-2.5"/></svg>,
  repay:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 12a9 9 0 109-9M3 12V7M3 12H8"/></svg>,
  pool:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 20h18M5 20V10M9 20V4M13 20V10M17 20V4M21 20H3"/></svg>,
}

const NAV_ITEMS = [
  { to: '/app',        label: 'Dashboard',      icon: Icons.dashboard, end: true  },
  { to: '/app/upload', label: 'Upload Invoice',  icon: Icons.upload,    end: false },
  { to: '/app/borrow', label: 'Borrow',          icon: Icons.borrow,    end: false },
  { to: '/app/repay',  label: 'Repay',           icon: Icons.repay,     end: false },
  { to: '/app/pool',   label: 'Pool Info',        icon: Icons.pool,      end: false },
]

function ellipse(addr: string) {
  return addr.length > 12 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr
}

function networkInfo() {
  const net = import.meta.env.VITE_ALGOD_NETWORK ?? 'localnet'
  if (net === 'mainnet') return { label: 'MAINNET',  color: 'var(--ic-positive)' }
  if (net === 'testnet') return { label: 'TESTNET',  color: 'var(--ic-warning)' }
  return                        { label: 'LOCALNET', color: 'var(--ic-data-1)' }
}

function pageName(pathname: string) {
  if (pathname === '/app' || pathname === '/app/') return 'Dashboard'
  if (pathname.includes('/upload')) return 'Upload Invoice'
  if (pathname.includes('/borrow')) return 'Borrow'
  if (pathname.includes('/repay'))  return 'Repay'
  if (pathname.includes('/pool'))   return 'Pool Info'
  return 'InvoiceChain'
}

// ── Sidebar ───────────────────────────────────────────────────────
function Sidebar() {
  const { activeAddress, wallets } = useWallet()
  const navigate = useNavigate()
  const [balance, setBalance] = useState<string | null>(null)

  useEffect(() => {
    if (!activeAddress) { setBalance(null); return }
    const algodConfig = getAlgodConfigFromViteEnvironment()
    const indexerConfig = getIndexerConfigFromViteEnvironment()
    AlgorandClient.fromConfig({ algodConfig, indexerConfig })
      .account.getInformation(activeAddress)
      .then(info => setBalance((Number(info.amount) / 1e6).toFixed(3)))
      .catch(() => setBalance(null))
  }, [activeAddress])

  const handleDisconnect = async () => {
    for (const w of wallets ?? []) {
      if (w.isConnected) await w.disconnect()
    }
    navigate('/')
  }

  const net = networkInfo()

  return (
    <aside
      style={{
        width: 240,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--ic-surface)',
        borderRight: '1px solid var(--ic-border)',
        height: '100vh',
        position: 'sticky',
        top: 0,
        overflow: 'hidden',
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: '18px 20px',
          borderBottom: '1px solid var(--ic-border)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div style={{ width: 6, height: 6, background: 'var(--ic-accent)', flexShrink: 0 }} />
        <span
          className="num"
          style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', color: 'var(--ic-text)' }}
        >
          INVOICECHAIN
        </span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
        <div className="label-caps" style={{ padding: '8px 20px 4px', marginBottom: 4 }}>Navigation</div>
        {NAV_ITEMS.map(({ to, label, icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 20px',
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: '0.02em',
              color: isActive ? 'var(--ic-text)' : 'var(--ic-text-secondary)',
              background: isActive ? 'var(--ic-surface-raised)' : 'transparent',
              borderLeft: isActive ? '2px solid var(--ic-accent)' : '2px solid transparent',
              textDecoration: 'none',
              transition: 'color 100ms, background 100ms',
            })}
          >
            <span style={{ opacity: 0.7 }}>{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Wallet widget */}
      <div style={{ borderTop: '1px solid var(--ic-border)', padding: 16 }}>
        {activeAddress ? (
          <div>
            <div className="label-caps" style={{ marginBottom: 8 }}>Connected Wallet</div>
            <div
              className="num"
              style={{
                fontSize: 11,
                color: 'var(--ic-text-secondary)',
                marginBottom: 6,
                letterSpacing: '0.04em',
              }}
            >
              {ellipse(activeAddress)}
            </div>
            {balance !== null && (
              <div
                className="num"
                style={{
                  fontSize: 13,
                  color: 'var(--ic-text)',
                  marginBottom: 10,
                  letterSpacing: '0.02em',
                }}
              >
                {balance} <span style={{ color: 'var(--ic-text-muted)', fontSize: 11 }}>ALGO</span>
              </div>
            )}
            <button
              onClick={handleDisconnect}
              style={{
                background: 'none',
                border: '1px solid var(--ic-border)',
                borderRadius: 2,
                padding: '5px 10px',
                fontSize: 10,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--ic-text-muted)',
                cursor: 'pointer',
                fontFamily: "'IBM Plex Sans', sans-serif",
                transition: 'border-color 100ms, color 100ms',
              }}
              onMouseEnter={e => {
                ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--ic-danger)'
                ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--ic-danger)'
              }}
              onMouseLeave={e => {
                ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--ic-border)'
                ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--ic-text-muted)'
              }}
            >
              Disconnect
            </button>
          </div>
        ) : (
          <div>
            <div className="label-caps" style={{ marginBottom: 8 }}>Wallet</div>
            <p style={{ fontSize: 12, color: 'var(--ic-text-muted)', marginBottom: 8 }}>
              No wallet connected
            </p>
            <button
              onClick={() => wallets?.[0]?.connect()}
              className="btn-ghost"
              style={{ padding: '6px 14px', fontSize: 11, width: '100%', justifyContent: 'center' }}
            >
              Connect
            </button>
          </div>
        )}

        {/* Network badge */}
        <div
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTop: '1px solid var(--ic-border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: net.color, display: 'inline-block' }} />
          <span className="num" style={{ fontSize: 10, color: 'var(--ic-text-muted)', letterSpacing: '0.1em' }}>
            {net.label}
          </span>
        </div>
      </div>
    </aside>
  )
}

// ── Main Layout ───────────────────────────────────────────────────
export default function AppLayout() {
  const { pathname } = useLocation()

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--ic-bg)' }}>
      <Sidebar />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        {/* Header */}
        <header
          style={{
            height: 48,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 32px',
            borderBottom: '1px solid var(--ic-border)',
            background: 'var(--ic-surface)',
          }}
        >
          <h1
            className="serif"
            style={{ fontSize: 16, fontWeight: 400, color: 'var(--ic-text)', letterSpacing: '-0.01em' }}
          >
            {pageName(pathname)}
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              className="num"
              style={{
                fontSize: 10,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--ic-text-muted)',
                padding: '3px 8px',
                border: '1px solid var(--ic-border)',
                borderRadius: 2,
              }}
            >
              {import.meta.env.VITE_ALGOD_NETWORK ?? 'localnet'}
            </div>
          </div>
        </header>

        {/* Content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: 32 }}>
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  )
}

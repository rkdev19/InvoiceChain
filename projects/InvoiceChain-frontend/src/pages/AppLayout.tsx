import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useWallet } from '@txnlab/use-wallet-react'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { getAlgodConfigFromViteEnvironment, getIndexerConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { useInvoice } from '../context/InvoiceContext'
import WalletGate from '../components/WalletGate'
import { InvoiceClient } from '../contracts/Invoice'

// ── Minimal 14×14 SVG icons ──────────────────────────────────────
const Icons = {
  dashboard: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  upload:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12M8 8l4-4 4 4"/></svg>,
  borrow:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M9 10.5C9 9.1 10.3 8 12 8s3 1.1 3 2.5-1.3 2.5-3 2.5-3 1.1-3 2.5 1.3 2.5 3 2.5 3-1.1 3-2.5"/></svg>,
  repay:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 12a9 9 0 109-9M3 12V7M3 12H8"/></svg>,
  pool:      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 20h18M5 20V10M9 20V4M13 20V10M17 20V4"/></svg>,
}

const LENDING_ITEMS = [
  { to: '/app',        label: 'Dashboard',     icon: Icons.dashboard, end: true  },
  { to: '/app/upload', label: 'Upload Invoice', icon: Icons.upload,   end: false },
  { to: '/app/borrow', label: 'Borrow',         icon: Icons.borrow,   end: false },
  { to: '/app/repay',  label: 'Repay',          icon: Icons.repay,    end: false },
]
const SYSTEM_ITEMS = [
  { to: '/app/pool',   label: 'Pool Info',      icon: Icons.pool,     end: false },
]

function ellipse(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function networkInfo() {
  const net = import.meta.env.VITE_ALGOD_NETWORK ?? 'localnet'
  if (net === 'mainnet') return { label: 'MAINNET',  color: 'var(--status-low)' }
  if (net === 'testnet') return { label: 'TESTNET',  color: 'var(--status-medium)' }
  return                        { label: 'LOCALNET', color: '#60A5FA' }
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
  const ctx = useInvoice()
  const [balance, setBalance] = useState<string | null>(null)
  const [iccBalance, setIccBalance] = useState<string | null>(null)

  useEffect(() => {
    if (!activeAddress) { setBalance(null); setIccBalance(null); return }
    const algodConfig = getAlgodConfigFromViteEnvironment()
    const indexerConfig = getIndexerConfigFromViteEnvironment()
    const algorand = AlgorandClient.fromConfig({ algodConfig, indexerConfig })

    algorand.account.getInformation(activeAddress)
      .then(rawInfo => {
        // Cast to any — AccountInformation shape varies between algokit-utils versions
        type AssetEntry = { assetId?: number | bigint; 'asset-id'?: number | bigint; amount: number | bigint }
        const info = rawInfo as unknown as { amount: number | bigint; assets?: AssetEntry[] }
        setBalance((Number(info.amount) / 1e6).toFixed(3))
        // Check ICC balance if we know the asset ID
        if (ctx.iccAssetId) {
          const iccEntry = info.assets?.find(a => {
            const id = a.assetId ?? a['asset-id']
            return id !== undefined && BigInt(id) === ctx.iccAssetId
          })
          if (iccEntry) {
            setIccBalance((Number(iccEntry.amount) / 100).toFixed(2))
          } else {
            setIccBalance(null)
          }
        }
      })
      .catch(() => setBalance(null))
  }, [activeAddress, ctx.iccAssetId])

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
        width: 220,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-default)',
        height: '100vh',
        position: 'sticky',
        top: 0,
        overflow: 'hidden',
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-default)',
          display: 'flex',
          alignItems: 'center',
          gap: 9,
        }}
      >
        <div style={{ width: 5, height: 5, background: 'var(--accent-gold)', flexShrink: 0 }} />
        <span
          className="mono"
          style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', color: 'var(--text-primary)' }}
        >
          INVOICECHAIN
        </span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
        {/* LENDING section */}
        <div className="label-caps" style={{ padding: '6px 16px 4px', marginBottom: 2 }}>Lending</div>
        {LENDING_ITEMS.map(({ to, label, icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              padding: '7px 16px',
              fontSize: 12,
              fontWeight: 400,
              letterSpacing: '0.01em',
              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              background: isActive ? 'var(--bg-elevated)' : 'transparent',
              borderLeft: isActive ? '2px solid var(--accent-gold)' : '2px solid transparent',
              textDecoration: 'none',
              transition: 'color 100ms, background 100ms',
            })}
          >
            <span style={{ opacity: 0.65 }}>{icon}</span>
            {label}
          </NavLink>
        ))}

        {/* SYSTEM section */}
        <div className="label-caps" style={{ padding: '14px 16px 4px', marginBottom: 2 }}>System</div>
        {SYSTEM_ITEMS.map(({ to, label, icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              padding: '7px 16px',
              fontSize: 12,
              fontWeight: 400,
              letterSpacing: '0.01em',
              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              background: isActive ? 'var(--bg-elevated)' : 'transparent',
              borderLeft: isActive ? '2px solid var(--accent-gold)' : '2px solid transparent',
              textDecoration: 'none',
              transition: 'color 100ms, background 100ms',
            })}
          >
            <span style={{ opacity: 0.65 }}>{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Wallet widget */}
      <div style={{ borderTop: '1px solid var(--border-default)', padding: '14px 16px' }}>
        {activeAddress ? (
          <>
            <div className="label-caps" style={{ marginBottom: 8 }}>Account</div>
            <div
              className="mono"
              style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, letterSpacing: '0.04em' }}
            >
              {ellipse(activeAddress)}
            </div>

            {/* ALGO balance */}
            {balance !== null && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <span className="mono" style={{ fontSize: 13, color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
                  {balance}
                </span>
                <span className="mono" style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                  ALGO
                </span>
              </div>
            )}

            {/* ICC balance (if opted in) */}
            {iccBalance !== null && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                <span className="mono" style={{ fontSize: 12, color: 'var(--accent-gold)', letterSpacing: '0.02em' }}>
                  {iccBalance}
                </span>
                <span className="mono" style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                  ICC
                </span>
              </div>
            )}
            {iccBalance === null && <div style={{ marginBottom: 6 }} />}

            {/* GST verification status */}
            {ctx.gstVerified && ctx.gstData ? (
              <div
                className="mono"
                style={{ fontSize: 10, color: 'var(--status-low)', letterSpacing: '0.06em', marginBottom: 10 }}
              >
                GST ✓ {ctx.gstData.state.split(' ')[0]}
              </div>
            ) : (
              <div
                className="mono"
                style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: 10 }}
              >
                GST Unverified
              </div>
            )}

            <button
              onClick={handleDisconnect}
              style={{
                background: 'none',
                border: '1px solid var(--border-default)',
                borderRadius: 2,
                padding: '4px 10px',
                fontSize: 10,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontFamily: "'IBM Plex Sans', sans-serif",
                transition: 'border-color 100ms, color 100ms',
                width: '100%',
              }}
              onMouseEnter={e => {
                ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--status-high)'
                ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--status-high)'
              }}
              onMouseLeave={e => {
                ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-default)'
                ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'
              }}
            >
              Disconnect
            </button>
          </>
        ) : (
          <>
            <div className="label-caps" style={{ marginBottom: 8 }}>Account</div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.5 }}>
              No wallet connected
            </p>
            <button
              onClick={() => wallets?.[0]?.connect()}
              className="btn-secondary"
              style={{ padding: '5px 14px', fontSize: 10, width: '100%', justifyContent: 'center' }}
            >
              Connect
            </button>
          </>
        )}

        {/* Network badge */}
        <div
          style={{
            marginTop: 12,
            paddingTop: 10,
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: net.color, display: 'inline-block', flexShrink: 0 }} />
          <span className="mono" style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.10em' }}>
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
  const { activeAddress, transactionSigner } = useWallet()
  const ctx = useInvoice()

  // Keep signer in a ref so the effect below doesn't re-run on every sign
  const signerRef = useRef(transactionSigner)
  signerRef.current = transactionSigner

  // Reconstruct appClient from persisted appId after a page refresh
  useEffect(() => {
    if (!ctx.appId || ctx.appClient || !activeAddress) return
    const algodConfig = getAlgodConfigFromViteEnvironment()
    const indexerConfig = getIndexerConfigFromViteEnvironment()
    const algorand = AlgorandClient.fromConfig({ algodConfig, indexerConfig })
    algorand.setDefaultSigner(signerRef.current)
    ctx.setAppClient(
      new InvoiceClient({ appId: ctx.appId, defaultSender: activeAddress, algorand })
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.appId, ctx.appClient, activeAddress])

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-base)' }}>
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
            padding: '0 28px',
            borderBottom: '1px solid var(--border-default)',
            background: 'var(--bg-surface)',
          }}
        >
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="mono" style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
              APP
            </span>
            <span style={{ fontSize: 10, color: 'var(--border-default)' }}>/</span>
            <span
              className="display"
              style={{ fontSize: 14, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}
            >
              {pageName(pathname)}
            </span>
          </div>

          <div
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: '0.10em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              padding: '3px 8px',
              border: '1px solid var(--border-default)',
              borderRadius: 2,
            }}
          >
            {import.meta.env.VITE_ALGOD_NETWORK ?? 'localnet'}
          </div>
        </header>

        {/* Content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
          <WalletGate>
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              <Outlet />
            </motion.div>
          </WalletGate>
        </main>
      </div>
    </div>
  )
}

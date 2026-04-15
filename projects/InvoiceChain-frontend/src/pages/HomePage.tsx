import { useRef } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'

// ── Ticker ───────────────────────────────────────────────────────
const TICKER_ITEMS = [
  'Total Financed: ₹4,20,00,000',
  'Active Loans: 47',
  'Avg Trust Score: 78',
  'Settlement Time: < 3s',
  'On-chain Verified: 100%',
  'Double Financing Fraud: ₹0',
]
const TICKER = TICKER_ITEMS.join('  ·  ') + '  ·  '

function Ticker() {
  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        borderTop: '1px solid var(--border-default)',
        borderBottom: '1px solid var(--border-default)',
        overflow: 'hidden',
        padding: '10px 0',
      }}
    >
      <div className="ticker-track" style={{ display: 'inline-flex', whiteSpace: 'nowrap' }}>
        <span className="mono" style={{ color: 'var(--text-muted)', fontSize: 11, paddingRight: 40 }}>
          {TICKER}{TICKER}
        </span>
      </div>
    </div>
  )
}

// ── Feature number ────────────────────────────────────────────────
function FeatureNumber({ value, label, description }: { value: string; label: string; description: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
      style={{ borderTop: '1px solid var(--border-default)', paddingTop: 28 }}
    >
      <div
        className="display"
        style={{ fontSize: 52, lineHeight: 1, color: 'var(--accent-gold)', letterSpacing: '-0.02em' }}
      >
        {value}
      </div>
      <div className="label-caps" style={{ marginTop: 12, marginBottom: 8 }}>
        {label}
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 280 }}>
        {description}
      </p>
    </motion.div>
  )
}

// ── Step row ─────────────────────────────────────────────────────
function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3 }}
      style={{ display: 'flex', gap: 20, paddingBottom: 28, borderBottom: '1px solid var(--border-subtle)' }}
    >
      <div
        className="mono"
        style={{ fontSize: 11, color: 'var(--accent-gold)', minWidth: 28, paddingTop: 2, letterSpacing: '0.06em' }}
      >
        {n}
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 5 }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{body}</div>
      </div>
    </motion.div>
  )
}

// ── Main ─────────────────────────────────────────────────────────
export default function HomePage() {
  const navigate = useNavigate()
  const featureRef = useRef<HTMLElement>(null)

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh', color: 'var(--text-primary)' }}>
      {/* ── NAV ── */}
      <nav
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 40px',
          height: 52,
          borderBottom: '1px solid var(--border-default)',
          background: 'var(--bg-surface)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <img src="/logo-32x32.png" alt="IC" style={{ width: 22, height: 22 }} />
          <span className="mono" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', color: 'var(--text-primary)' }}>
            INVOICECHAIN
          </span>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button
            onClick={() => featureRef.current?.scrollIntoView({ behavior: 'smooth' })}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 12,
              color: 'var(--text-secondary)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              fontFamily: "'IBM Plex Sans', sans-serif",
              transition: 'color 120ms',
            }}
            onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)')}
            onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)')}
          >
            How it works
          </button>
          <button className="btn-primary" onClick={() => navigate('/app')}>
            Start Financing
          </button>
        </div>
      </nav>

      {/* ── GOLD RULE ── */}
      <div style={{ height: 3, background: 'var(--accent-gold)' }} />

      {/* ── HERO ── */}
      <section style={{ padding: '100px 40px 80px', maxWidth: 860, margin: '0 auto' }}>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          {/* Eyebrow */}
          <div
            className="mono"
            style={{
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--accent-gold)',
              marginBottom: 32,
            }}
          >
            Algorand Blockchain · Invoice Finance Protocol
          </div>

          {/* Main heading — Epilogue */}
          <h1
            className="display"
            style={{
              fontSize: 'clamp(48px, 6.5vw, 76px)',
              color: 'var(--text-primary)',
              marginBottom: 28,
            }}
          >
            Invoice Financing,<br />
            Reimagined.
          </h1>

          {/* Subtext */}
          <p
            style={{
              fontSize: 16,
              lineHeight: 1.65,
              color: 'var(--text-secondary)',
              maxWidth: 460,
              marginBottom: 40,
              fontWeight: 300,
            }}
          >
            Upload your invoice. Receive an on-chain trust score. Mint a verified NFT.
            Borrow ICC against it in seconds — no banks, no intermediaries.
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="btn-primary" style={{ fontSize: 13, padding: '10px 24px' }} onClick={() => navigate('/app')}>
              Start Financing →
            </button>
            <button
              className="btn-secondary"
              style={{ fontSize: 12 }}
              onClick={() => featureRef.current?.scrollIntoView({ behavior: 'smooth' })}
            >
              Learn more
            </button>
          </div>
        </motion.div>
      </section>

      {/* ── TICKER ── */}
      <Ticker />

      {/* ── FEATURE NUMBERS ── */}
      <section
        ref={featureRef}
        style={{ maxWidth: 860, margin: '0 auto', padding: '80px 40px' }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 48,
          }}
        >
          <FeatureNumber
            value="0"
            label="Double Financing Fraud"
            description="Every invoice is cryptographically hashed and stored on Algorand. Duplicate submissions are mathematically impossible."
          />
          <FeatureNumber
            value="< 3s"
            label="Settlement Time"
            description="Smart contract execution on Algorand settles in under 3 seconds. ICC lands in your wallet the moment you sign."
          />
          <FeatureNumber
            value="100%"
            label="On-chain Verified"
            description="Trust scores, loan terms, and repayment history are permanently recorded — auditable by any counterparty."
          />
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section
        style={{
          maxWidth: 860,
          margin: '0 auto',
          padding: '0 40px 80px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 64,
          alignItems: 'start',
        }}
      >
        {/* Left: heading */}
        <div style={{ position: 'sticky', top: 72 }}>
          <div className="label-caps" style={{ marginBottom: 16 }}>Protocol Overview</div>
          <h2
            className="display"
            style={{ fontSize: 36, color: 'var(--text-primary)', marginBottom: 16 }}
          >
            Four steps to<br />instant credit.
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            The entire flow — from invoice upload to ICC in your wallet — runs on-chain.
            No approval queues. No KYC bottlenecks. Just a smart contract and your signature.
          </p>
          <div style={{ marginTop: 28 }}>
            <button className="btn-primary" onClick={() => navigate('/app')}>
              Open App →
            </button>
          </div>
        </div>

        {/* Right: steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {[
            { n: '01', title: 'Upload Invoice', body: 'Enter your invoice details — amount, due date, client name. Your data stays on your device.' },
            { n: '02', title: 'Receive Trust Score', body: 'An algorithm analyses your repayment history and issues a 0–100 trust score with a risk classification.' },
            { n: '03', title: 'Mint Invoice NFT', body: 'Your invoice is tokenised as an ARC-3 NFT on Algorand. The NFT is held in the contract as collateral — immutable and verifiable.' },
            { n: '04', title: 'Borrow ICC Instantly', body: 'Draw InvoiceChain Credit (ICC) up to your borrow limit. Tokens are released by the smart contract directly to your wallet.' },
          ].map(s => (
            <Step key={s.n} {...s} />
          ))}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer
        style={{
          borderTop: '1px solid var(--border-default)',
          background: 'var(--bg-surface)',
          padding: '20px 40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <img src="/logo-32x32.png" alt="IC" style={{ width: 18, height: 18 }} />
          <span className="mono" style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.10em' }}>
            INVOICECHAIN CREDIT
          </span>
        </div>

        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Built on{' '}
          <a
            href="https://algorand.org"
            target="_blank" rel="noreferrer"
            style={{ color: 'var(--accent-gold)', textDecoration: 'none' }}
          >
            Algorand
          </a>
        </span>
      </footer>
    </div>
  )
}

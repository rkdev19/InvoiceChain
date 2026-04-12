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
        background: 'var(--ic-surface)',
        borderTop: '1px solid var(--ic-border)',
        borderBottom: '1px solid var(--ic-border)',
        overflow: 'hidden',
        padding: '10px 0',
      }}
    >
      <div className="ic-ticker-track" style={{ display: 'inline-flex', whiteSpace: 'nowrap' }}>
        <span className="num" style={{ color: 'var(--ic-text-muted)', fontSize: 12, paddingRight: 40 }}>
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
      style={{ borderTop: '1px solid var(--ic-border)', paddingTop: 28 }}
    >
      <div
        className="serif"
        style={{ fontSize: 48, lineHeight: 1, color: 'var(--ic-accent)', letterSpacing: '-0.02em' }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--ic-text-muted)',
          marginTop: 10,
          marginBottom: 8,
          fontFamily: "'IBM Plex Sans', sans-serif",
        }}
      >
        {label}
      </div>
      <p style={{ fontSize: 13, color: 'var(--ic-text-secondary)', lineHeight: 1.6, maxWidth: 280 }}>
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
      transition={{ duration: 0.35 }}
      style={{ display: 'flex', gap: 20, paddingBottom: 28, borderBottom: '1px solid var(--ic-border-subtle)' }}
    >
      <div
        className="num"
        style={{ fontSize: 12, color: 'var(--ic-accent)', minWidth: 28, paddingTop: 2, letterSpacing: '0.05em' }}
      >
        {n}
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ic-text)', marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--ic-text-secondary)', lineHeight: 1.55 }}>{body}</div>
      </div>
    </motion.div>
  )
}

// ── Main ─────────────────────────────────────────────────────────
export default function HomePage() {
  const navigate = useNavigate()
  const featureRef = useRef<HTMLElement>(null)

  return (
    <div style={{ background: 'var(--ic-bg)', minHeight: '100vh', color: 'var(--ic-text)' }}>
      {/* ── NAV ── */}
      <nav
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 40px',
          height: 56,
          borderBottom: '1px solid var(--ic-border)',
          background: 'var(--ic-surface)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 7,
              height: 7,
              background: 'var(--ic-accent)',
              borderRadius: 1,
            }}
          />
          <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.04em', color: 'var(--ic-text)' }}>
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
              color: 'var(--ic-text-secondary)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              fontFamily: "'IBM Plex Sans', sans-serif",
            }}
          >
            How it works
          </button>
          <button className="btn-primary" onClick={() => navigate('/app')}>
            Start Financing
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section
        style={{
          padding: '96px 40px 80px',
          maxWidth: 900,
          margin: '0 auto',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Eyebrow */}
          <div
            className="num"
            style={{
              fontSize: 11,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: 'var(--ic-accent)',
              marginBottom: 28,
            }}
          >
            Algorand Blockchain · Invoice Finance Protocol
          </div>

          {/* Main heading */}
          <h1
            className="serif"
            style={{
              fontSize: 'clamp(44px, 6vw, 72px)',
              lineHeight: 1.08,
              letterSpacing: '-0.02em',
              color: 'var(--ic-text)',
              marginBottom: 28,
              fontWeight: 400,
            }}
          >
            Invoice Financing,<br />
            <span style={{ color: 'var(--ic-accent)', fontStyle: 'italic' }}>Reimagined.</span>
          </h1>

          {/* Subtext */}
          <p
            style={{
              fontSize: 16,
              lineHeight: 1.65,
              color: 'var(--ic-text-secondary)',
              maxWidth: 480,
              marginBottom: 40,
              fontWeight: 300,
            }}
          >
            Upload your invoice. Receive an on-chain trust score. Mint a verified NFT. Borrow against it in seconds —
            no banks, no intermediaries, no waiting.
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button className="btn-primary" style={{ fontSize: 13 }} onClick={() => navigate('/app')}>
              Start Financing →
            </button>
            <button
              className="btn-ghost"
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
        style={{ maxWidth: 900, margin: '0 auto', padding: '80px 40px' }}
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
            description="Smart contract execution on Algorand settles in under 3 seconds. Funds arrive in your wallet the moment you sign."
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
          maxWidth: 900,
          margin: '0 auto',
          padding: '0 40px 80px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 64,
          alignItems: 'start',
        }}
      >
        {/* Left: heading */}
        <div style={{ position: 'sticky', top: 80 }}>
          <div className="label-caps" style={{ marginBottom: 16 }}>Protocol Overview</div>
          <h2
            className="serif"
            style={{ fontSize: 36, lineHeight: 1.15, color: 'var(--ic-text)', fontWeight: 400, marginBottom: 16 }}
          >
            Four steps to<br />instant credit.
          </h2>
          <p style={{ fontSize: 13, color: 'var(--ic-text-secondary)', lineHeight: 1.6 }}>
            The entire flow — from invoice upload to ALGO in your wallet — runs on-chain. No approval queues.
            No KYC bottlenecks. Just a smart contract and your signature.
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
            { n: '03', title: 'Mint Invoice NFT', body: 'Your invoice is tokenised as an ARC-3 NFT on Algorand. The NFT serves as collateral — immutable, transferable, verifiable.' },
            { n: '04', title: 'Borrow Instantly', body: 'Draw ALGO up to your borrow limit. Funds are released by the smart contract directly to your wallet.' },
          ].map(s => (
            <Step key={s.n} {...s} />
          ))}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer
        style={{
          borderTop: '1px solid var(--ic-border)',
          background: 'var(--ic-surface)',
          padding: '24px 40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 6, height: 6, background: 'var(--ic-accent)', borderRadius: 1 }} />
          <span className="num" style={{ fontSize: 11, color: 'var(--ic-text-muted)', letterSpacing: '0.1em' }}>
            INVOICECHAIN CREDIT
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <span style={{ fontSize: 12, color: 'var(--ic-text-muted)' }}>
            Built on{' '}
            <a
              href="https://algorand.org"
              target="_blank" rel="noreferrer"
              style={{ color: 'var(--ic-accent)', textDecoration: 'none' }}
            >
              Algorand
            </a>
          </span>
          <div className="num" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--ic-text-muted)' }}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--ic-positive)',
                display: 'inline-block',
              }}
            />
            LOCALNET
          </div>
        </div>
      </footer>
    </div>
  )
}

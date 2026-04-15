import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useWallet } from '@txnlab/use-wallet-react'
import { AlgorandClient, microAlgos } from '@algorandfoundation/algokit-utils'
import { useSnackbar } from 'notistack'
import { useNavigate } from 'react-router-dom'
import { useInvoice } from '../context/InvoiceContext'
import { calculateTrustScore, getBorrowLimit, getMockSMEData, getRiskColor, getRiskLevel } from '../lib/trustScore'
import { getAlgodConfigFromViteEnvironment, getIndexerConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { InvoiceFactory } from '../contracts/Invoice'
import { loraBase } from '../utils/lora'
import { verifyGstin } from '../utils/verifyGstin'
import type { GstData } from '../utils/verifyGstin'
import { parseError } from '../utils/parseError'

// ── Arc gauge ────────────────────────────────────────────────────
const R = 48
const CIRC = 2 * Math.PI * R

function ScoreArc({ score, color }: { score: number; color: string }) {
  const offset = CIRC * (1 - score / 100)
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={R} fill="none" stroke="var(--border-default)" strokeWidth="2" />
        <motion.circle
          cx="60" cy="60" r={R}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="square"
          strokeDasharray={`${CIRC} ${CIRC}`}
          strokeDashoffset={CIRC}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.1 }}
          transform="rotate(-90 60 60)"
        />
      </svg>
      <div style={{ position: 'absolute', textAlign: 'center' }}>
        <motion.div
          className="display"
          style={{ fontSize: 30, color, lineHeight: 1 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          {score}
        </motion.div>
        <div className="mono" style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.10em', marginTop: 3 }}>/ 100</div>
      </div>
    </div>
  )
}

const LABEL: React.CSSProperties = {
  display: 'block',
  fontSize: 10,
  fontWeight: 500,
  letterSpacing: '0.10em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  fontFamily: "'IBM Plex Sans', sans-serif",
  marginBottom: 6,
}

// ── Spinning arc loader ───────────────────────────────────────────
function SpinArc() {
  return (
    <motion.svg
      width="16" height="16" viewBox="0 0 16 16"
      animate={{ rotate: 360 }}
      transition={{ duration: 1, ease: 'linear', repeat: Infinity }}
      style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 6 }}
    >
      <circle cx="8" cy="8" r="6" fill="none" stroke="var(--border-default)" strokeWidth="2" />
      <circle
        cx="8" cy="8" r="6"
        fill="none"
        stroke="var(--accent-gold)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="12 26"
        strokeDashoffset="0"
      />
    </motion.svg>
  )
}

// ── GST verified pill ─────────────────────────────────────────────
function GstPill({ ok }: { ok: boolean }) {
  const color = ok ? 'var(--status-low)' : 'var(--status-high)'
  const label = ok ? 'GST VERIFIED' : 'INVALID GSTIN'
  return (
    <span
      className="mono"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 11,
        color,
        border: `1px solid ${color}`,
        padding: '2px 8px',
        borderRadius: 2,
        letterSpacing: '0.06em',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />
      {label}
    </span>
  )
}

// ── GST section ───────────────────────────────────────────────────
function GstSection({
  onVerified,
  initialData,
}: {
  onVerified: (data: GstData) => void
  initialData: GstData | null
}) {
  const [gstin, setGstin] = useState(initialData?.gstin ?? '')
  const [state, setState] = useState<'idle' | 'verifying' | 'success' | 'error'>(
    initialData ? 'success' : 'idle'
  )
  const [result, setResult] = useState<GstData | null>(initialData)
  const [errorMsg, setErrorMsg] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // GSTIN format: 15 chars, regex
  const REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
  const upper = gstin.trim().toUpperCase()
  const len = upper.length
  const isFormatValid = REGEX.test(upper)
  const hasInvalidChars = len > 0 && len < 15 && !/^[0-9A-Z]*$/.test(upper)

  const borderColor =
    state === 'success' ? 'var(--status-low)' :
    state === 'error' || hasInvalidChars ? 'var(--status-high)' :
    isFormatValid ? 'var(--accent-gold)' :
    'var(--border-default)'

  const runVerify = async (value: string) => {
    setState('verifying')
    try {
      const res = await verifyGstin(value)
      if (res.valid) {
        setState('success')
        setResult(res)
        setErrorMsg('')
        onVerified(res)
      } else {
        setState('error')
        setErrorMsg(res.error)
        setGstin('')
        setTimeout(() => inputRef.current?.focus(), 50)
      }
    } catch {
      setState('error')
      setErrorMsg('Verification failed. Try again.')
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '')
    if (raw.length > 15) return
    setGstin(raw)
    if (state === 'error') setState('idle')

    // Auto-trigger at exactly 15 valid chars
    if (raw.length === 15 && REGEX.test(raw)) {
      runVerify(raw)
    }
  }

  return (
    <div style={{ marginBottom: 28 }}>
      {/* Section header */}
      <div
        className="mono"
        style={{
          fontSize: 11,
          color: 'var(--text-muted)',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          marginBottom: 16,
          paddingBottom: 10,
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        Business Verification
      </div>

      {/* GSTIN input */}
      <div style={{ marginBottom: 4 }}>
        <label style={LABEL}>GST Identification Number</label>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            ref={inputRef}
            type="text"
            placeholder="27AAAAA0000A1Z5"
            value={gstin}
            onChange={handleChange}
            disabled={state === 'verifying' || state === 'success'}
            maxLength={15}
            style={{
              background: 'var(--bg-surface)',
              border: `1px solid ${borderColor}`,
              borderRadius: 2,
              color: 'var(--text-primary)',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 13,
              padding: '8px 12px',
              width: '100%',
              outline: 'none',
              transition: 'border-color 120ms',
              letterSpacing: '0.06em',
            }}
          />
          {/* State indicator alongside input */}
          <div style={{ flexShrink: 0, minWidth: 120, display: 'flex', alignItems: 'center' }}>
            {state === 'verifying' && (
              <span
                style={{
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                <SpinArc />
                Verifying…
              </span>
            )}
            {state === 'success' && <GstPill ok={true} />}
            {state === 'error' && <GstPill ok={false} />}
            {(state === 'idle') && len > 0 && len < 15 && (
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
                {len}/15
              </span>
            )}
          </div>
        </div>

        {/* Hint / error line */}
        <div style={{ marginTop: 4 }}>
          {state === 'error' ? (
            <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: 'var(--text-muted)' }}>
              {errorMsg} · Check format and try again
            </span>
          ) : (
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
              Format: 2 digits + 10 char PAN + 3 alphanumeric · 15 chars total
            </span>
          )}
        </div>
      </div>

      {/* Business details card — slides in on success */}
      <AnimatePresence>
        {state === 'success' && result && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            style={{ overflow: 'hidden', marginTop: 12 }}
          >
            <div
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                borderLeft: '3px solid var(--status-low)',
                borderRadius: 3,
                padding: '16px 20px',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '10px 24px',
                }}
              >
                {[
                  { label: 'Business Name', value: result.business_name },
                  { label: 'State', value: result.state },
                  { label: 'Registered', value: `Since ${result.registration_date.slice(-4)}` },
                  { label: 'Taxpayer Type', value: result.taxpayer_type },
                  { label: 'Turnover', value: result.annual_turnover },
                  { label: 'Status', value: result.status, accent: 'var(--status-low)' },
                ].map(({ label, value, accent }) => (
                  <div key={label}>
                    <div
                      style={{
                        fontFamily: "'IBM Plex Sans', sans-serif",
                        fontSize: 10,
                        textTransform: 'uppercase',
                        letterSpacing: '0.10em',
                        color: 'var(--text-muted)',
                        marginBottom: 3,
                      }}
                    >
                      {label}
                    </div>
                    <div
                      className="mono"
                      style={{ fontSize: 13, color: accent ?? 'var(--text-primary)', letterSpacing: '0.02em' }}
                    >
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── PDF helpers ───────────────────────────────────────────────────
async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ── PDF drop zone ─────────────────────────────────────────────────
function PdfSection({
  onHashed,
  onRemoved,
  initialHash,
  initialName,
}: {
  onHashed: (hash: string, name: string) => void
  onRemoved: () => void
  initialHash: string | null
  initialName: string | null
}) {
  const [pdfFile, setPdfFile]     = useState<File | null>(null)
  const [localHash, setLocalHash] = useState<string | null>(null)
  const [hashState, setHashState] = useState<'idle' | 'hashing' | 'done'>(
    initialHash ? 'done' : 'idle'
  )
  const [isDragging, setIsDragging]   = useState(false)
  const [isHovering, setIsHovering]   = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const currentHash = localHash ?? initialHash
  const displayName = pdfFile?.name ?? initialName
  const showCard    = !!pdfFile || !!initialHash

  const processFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') return
    setPdfFile(file)
    setHashState('hashing')
    setLocalHash(null)
    try {
      const hash = await hashFile(file)
      setLocalHash(hash)
      setHashState('done')
      onHashed(hash, file.name)
    } catch {
      setHashState('idle')
      setPdfFile(null)
    }
  }

  const handleRemove = () => {
    setPdfFile(null)
    setLocalHash(null)
    setHashState('idle')
    if (fileInputRef.current) fileInputRef.current.value = ''
    onRemoved()
  }

  const zoneActive = isDragging || isHovering

  return (
    <div style={{ marginBottom: 28 }}>
      {/* Section header */}
      <div
        className="mono"
        style={{
          fontSize: 11,
          color: 'var(--text-muted)',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          marginBottom: 16,
          paddingBottom: 10,
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        Invoice Document
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        style={{ display: 'none' }}
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) void processFile(file)
        }}
      />

      {!showCard ? (
        /* ── Drop zone ── */
        <div
          onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
          onDragEnter={e => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={e => { e.preventDefault(); setIsDragging(false) }}
          onDrop={e => {
            e.preventDefault()
            setIsDragging(false)
            const file = e.dataTransfer.files[0]
            if (file) void processFile(file)
          }}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `1px dashed ${zoneActive ? 'var(--accent-gold)' : 'var(--border-default)'}`,
            borderRadius: 3,
            padding: 32,
            textAlign: 'center',
            background: zoneActive ? 'rgba(212,175,55,0.06)' : 'var(--bg-surface)',
            cursor: 'pointer',
            transition: 'border-color 150ms, background 150ms',
          }}
        >
          <svg
            width="24" height="24" viewBox="0 0 24 24" fill="none"
            stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ marginBottom: 10, display: 'block', margin: '0 auto 10px' }}
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <line x1="10" y1="9" x2="8" y2="9" />
          </svg>
          <div
            style={{
              fontFamily: "'IBM Plex Sans', sans-serif",
              fontSize: 14,
              color: 'var(--text-secondary)',
              marginBottom: 6,
            }}
          >
            Upload Invoice PDF
          </div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
            Drag and drop or click to browse
          </div>
        </div>
      ) : (
        /* ── File card ── */
        <div
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderLeft: '3px solid var(--accent-gold)',
            borderRadius: 2,
            padding: '12px 16px',
          }}
        >
          {/* Top row: icon · filename · remove */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="var(--accent-gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ flexShrink: 0 }}
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                className="mono"
                style={{
                  fontSize: 13,
                  color: 'var(--text-primary)',
                  letterSpacing: '0.02em',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {displayName ?? 'invoice.pdf'}
              </div>
              {pdfFile && (
                <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, letterSpacing: '0.04em' }}>
                  {formatSize(pdfFile.size)}
                </div>
              )}
            </div>
            <button
              onClick={handleRemove}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                fontSize: 20,
                lineHeight: 1,
                padding: '0 4px',
                flexShrink: 0,
                fontFamily: 'sans-serif',
              }}
              title="Remove file"
            >
              ×
            </button>
          </div>

          {/* Hash status row */}
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
            {hashState === 'hashing' && (
              <span
                className="mono"
                style={{ fontSize: 11, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center' }}
              >
                <SpinArc />
                Computing document hash…
              </span>
            )}
            {hashState === 'done' && currentHash && (
              <div>
                <span
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: 'var(--accent-gold)',
                    border: '1px solid var(--accent-gold)',
                    padding: '2px 8px',
                    borderRadius: 2,
                    letterSpacing: '0.06em',
                  }}
                >
                  DOCUMENT HASH COMPUTED
                </span>
                <div
                  className="mono"
                  style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, letterSpacing: '0.04em' }}
                >
                  {currentHash.slice(0, 16)}…{currentHash.slice(-8)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────
export default function UploadPage() {
  const ctx = useInvoice()
  const { transactionSigner, activeAddress } = useWallet()
  const { enqueueSnackbar } = useSnackbar()
  const navigate = useNavigate()
  const lora = loraBase()

  const [invoiceNo, setInvoiceNo] = useState('')
  const [client, setClient] = useState(ctx.businessName)
  const [amount, setAmount] = useState(ctx.amount ? String(ctx.amount) : '')
  const [dueDate, setDueDate] = useState(ctx.dueDate)

  const [scored, setScored] = useState(ctx.trustScore > 0)
  const [score, setScore] = useState<number | null>(ctx.trustScore > 0 ? ctx.trustScore : null)
  const [riskLevel, setRiskLevel] = useState(ctx.riskLevel)
  const [borrowLimit, setBorrowLimit] = useState(ctx.borrowLimit)
  const [minting, setMinting] = useState(false)
  const scoreRef = useRef<HTMLDivElement>(null)

  const riskColor = score !== null ? getRiskColor(riskLevel || 'HIGH') : 'var(--text-muted)'

  // PDF hash handlers
  const handlePdfHashed = (hash: string, name: string) => {
    ctx.setDocumentHash(hash)
    ctx.setDocumentName(name)
  }
  const handlePdfRemoved = () => {
    ctx.setDocumentHash(null)
    ctx.setDocumentName(null)
  }

  // Auto-fill client name when GST verifies
  const handleGstVerified = (data: GstData) => {
    ctx.setGstVerified(true)
    ctx.setGstData(data)
    // Auto-fill client/business name from verified data
    if (!client) {
      setClient(data.business_name)
    }
  }

  // Keep client field in sync if it was auto-filled but user hasn't touched it
  useEffect(() => {
    if (ctx.gstData && !client) {
      setClient(ctx.gstData.business_name)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.gstData])

  const handleScore = (e: React.FormEvent) => {
    e.preventDefault()
    const amt = Number(amount)
    if (!client || !amt || !dueDate) {
      enqueueSnackbar('Fill in all fields first', { variant: 'warning' })
      return
    }
    const sme = getMockSMEData()
    const computed = calculateTrustScore(sme)
    const risk = getRiskLevel(computed)
    const limit = getBorrowLimit(amt, computed)

    setScore(computed)
    setRiskLevel(risk)
    setBorrowLimit(limit)
    setScored(true)

    ctx.setBusinessName(client)
    ctx.setAmount(amt)
    ctx.setDueDate(dueDate)
    ctx.setTrustScore(computed)
    ctx.setRiskLevel(risk)
    ctx.setBorrowLimit(limit)

    setTimeout(() => scoreRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100)
  }

  const handleMint = async () => {
    if (!activeAddress) {
      enqueueSnackbar('Connect your wallet first', { variant: 'warning' })
      return
    }
    setMinting(true)
    try {
      const algodConfig = getAlgodConfigFromViteEnvironment()
      const indexerConfig = getIndexerConfigFromViteEnvironment()
      const algorand = AlgorandClient.fromConfig({ algodConfig, indexerConfig })
      algorand.setDefaultSigner(transactionSigner)

      // ── Signature 1: Deploy contract ──────────────────────────────
      const factory = new InvoiceFactory({ defaultSender: activeAddress, algorand })
      const { appClient, result: deployResult } = await factory.deploy({ onSchemaBreak: 'append', onUpdate: 'append' })
      const appAddress = String(appClient.appClient.appAddress)
      const isNewContract = deployResult.operationPerformed === 'create'

      const dueDateUnix = dueDate
        ? BigInt(Math.floor(new Date(dueDate).getTime() / 1000))
        : 2_000_000_000n

      // Embed document hash in payment note (stored immutably on-chain)
      const txnNote = new TextEncoder().encode(JSON.stringify({
        document_hash: ctx.documentHash ?? 'not_provided',
        document_name: ctx.documentName ?? null,
        document_verified: ctx.documentHash !== null,
      }))

      let iccAssetId: bigint
      let assetId: bigint
      let txnId: string

      if (isNewContract) {
        // ── Signature 2a: Fresh contract — Fund + setup_icc + create_invoice ──
        // 0.4 ALGO covers MBR for base account + ICC ASA + NFT ASA.
        // extraFee on each app call pays for the inner transaction fee.
        const groupResult = await algorand
          .newGroup()
          .addPayment({
            sender: activeAddress,
            receiver: appAddress,
            amount: microAlgos(400_000),
            note: txnNote,
          })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .addAppCallMethodCall(await appClient.params.setupIcc({ args: [], extraFee: microAlgos(1000) }) as any)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .addAppCallMethodCall(await appClient.params.createInvoice({
            args: {
              amount: BigInt(ctx.amount),
              dueDate: dueDateUnix,
              trustScore: BigInt(ctx.trustScore),
            },
            extraFee: microAlgos(1000),
          }) as any)
          .execute()

        iccAssetId = groupResult.returns?.[0]?.returnValue as bigint
        assetId    = groupResult.returns?.[1]?.returnValue as bigint
        txnId      = groupResult.txIds[groupResult.txIds.length - 1]
      } else {
        // ── Signature 2b: Existing contract — ICC already set up, only create_invoice ──
        // 0.2 ALGO covers MBR for the new NFT ASA + inner tx fee buffer.
        const groupResult = await algorand
          .newGroup()
          .addPayment({
            sender: activeAddress,
            receiver: appAddress,
            amount: microAlgos(200_000),
            note: txnNote,
          })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .addAppCallMethodCall(await appClient.params.createInvoice({
            args: {
              amount: BigInt(ctx.amount),
              dueDate: dueDateUnix,
              trustScore: BigInt(ctx.trustScore),
            },
            extraFee: microAlgos(1000),
          }) as any)
          .execute()

        assetId = groupResult.returns?.[0]?.returnValue as bigint
        txnId   = groupResult.txIds[groupResult.txIds.length - 1]

        // Read existing ICC asset ID from contract state
        const info = await appClient.getInvoiceInfo()
        iccAssetId = info[10] as bigint // 11-tuple index 10 = icc_asset_id
      }

      ctx.setAppId(BigInt(appClient.appClient.appId))
      ctx.setAppAddress(appAddress)
      ctx.setNftAssetId(assetId)
      ctx.setMintTxnId(txnId)
      ctx.setIccAssetId(iccAssetId)
      ctx.setInvoiceStatus('ACTIVE')
      ctx.setCollateralLocked(false)
      ctx.setAppClient(appClient)

      enqueueSnackbar(`NFT minted. Asset ID: ${assetId}`, { variant: 'success' })
    } catch (err: unknown) {
      const msg = parseError(err)
      if (msg) enqueueSnackbar(msg, { variant: 'error', autoHideDuration: 5000 })
    } finally {
      setMinting(false)
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      {/* Gold accent rule */}
      <div style={{ height: 3, background: 'var(--accent-gold)', marginBottom: 28 }} />

      {/* ── PDF document upload ── */}
      <PdfSection
        onHashed={handlePdfHashed}
        onRemoved={handlePdfRemoved}
        initialHash={ctx.documentHash}
        initialName={ctx.documentName}
      />

      {/* ── GSTIN verification ── */}
      <GstSection
        onVerified={handleGstVerified}
        initialData={ctx.gstData}
      />

      {/* ── Invoice form ── */}
      <form onSubmit={handleScore} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={LABEL}>Invoice Number</label>
            <input
              type="text"
              placeholder="INV-2024-001"
              value={invoiceNo}
              onChange={e => setInvoiceNo(e.target.value)}
              className="ic-input"
            />
          </div>
          <div>
            <label style={LABEL}>Client / Business Name</label>
            <input
              type="text"
              required
              placeholder="Sharma Traders Pvt Ltd"
              value={client}
              onChange={e => setClient(e.target.value)}
              className="ic-input-text"
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={LABEL}>Invoice Amount (₹)</label>
            <input
              type="number"
              min={1}
              required
              placeholder="50000"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="ic-input"
            />
          </div>
          <div>
            <label style={LABEL}>Due Date</label>
            <input
              type="date"
              required
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: 2,
                color: 'var(--text-primary)',
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 13,
                padding: '8px 12px',
                width: '100%',
                outline: 'none',
                colorScheme: 'dark',
                transition: 'border-color 120ms',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--border-focus)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-default)')}
            />
          </div>
        </div>

        <button type="submit" className="btn-primary" style={{ alignSelf: 'flex-start' }}>
          Calculate Trust Score →
        </button>
      </form>

      {/* ── Score reveal ── */}
      <AnimatePresence>
        {scored && score !== null && (
          <motion.div
            ref={scoreRef}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: 'hidden' }}
          >
            <div
              style={{
                marginTop: 28,
                border: '1px solid var(--border-default)',
                background: 'var(--bg-surface)',
                padding: 28,
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <span className="label-caps">Trust Score Analysis</span>
                <span
                  className="pill"
                  style={{ color: riskColor, borderColor: riskColor }}
                >
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: riskColor, display: 'inline-block', marginRight: 5 }} />
                  {riskLevel} RISK
                </span>
              </div>

              {/* Arc + stats */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
                <ScoreArc score={score} color={riskColor} />

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 14 }}>
                    <div className="label-caps" style={{ marginBottom: 6 }}>Maximum Borrow Limit</div>
                    <div
                      className="display"
                      style={{ fontSize: 34, color: 'var(--accent-gold)', lineHeight: 1 }}
                    >
                      ₹{borrowLimit.toLocaleString('en-IN')}
                    </div>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                      = ₹{Number(amount).toLocaleString('en-IN')} × {score}%
                    </div>
                  </div>

                  <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    Based on SME repayment history: 6/7 invoices paid on time.
                    Reliability 40% + Frequency 30% + Consistency 30%.
                  </div>
                </div>
              </div>

              {/* GST badge — shown if verified */}
              {ctx.gstVerified && ctx.gstData && (
                <div
                  className="mono"
                  style={{
                    marginTop: 16,
                    paddingTop: 12,
                    borderTop: '1px solid var(--border-subtle)',
                    fontSize: 11,
                    color: 'var(--status-low)',
                    letterSpacing: '0.06em',
                  }}
                >
                  GST VERIFIED · {ctx.gstData.state} · {ctx.gstData.taxpayer_type} Taxpayer · Since {ctx.gstData.registration_date.slice(-4)}
                </div>
              )}

              {/* Document hash badge — shown if PDF was uploaded */}
              {ctx.documentHash && (
                <div
                  style={{
                    marginTop: ctx.gstVerified ? 8 : 16,
                    paddingTop: ctx.gstVerified ? 0 : 12,
                    borderTop: ctx.gstVerified ? 'none' : '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--status-low)', display: 'inline-block', flexShrink: 0 }} />
                  <span className="mono" style={{ fontSize: 11, color: 'var(--status-low)', letterSpacing: '0.06em' }}>
                    DOCUMENT · PDF Verified · SHA-256
                  </span>
                </div>
              )}

              {/* Mint section */}
              <div style={{ marginTop: 24, borderTop: '1px solid var(--border-default)', paddingTop: 20 }}>
                {ctx.nftAssetId !== null ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                    <div>
                      <div className="label-caps" style={{ marginBottom: 4 }}>Invoice NFT Minted</div>
                      <a
                        href={`${lora}/asset/${ctx.nftAssetId}`}
                        target="_blank" rel="noreferrer"
                        className="mono"
                        style={{ fontSize: 11, color: 'var(--accent-gold)', textDecoration: 'none', letterSpacing: '0.04em' }}
                      >
                        Asset {String(ctx.nftAssetId)} ↗
                      </a>
                      {ctx.iccAssetId !== null && (
                        <div className="mono" style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, letterSpacing: '0.04em' }}>
                          ICC: {String(ctx.iccAssetId)}
                        </div>
                      )}
                    </div>
                    <button className="btn-primary" onClick={() => navigate('/app/borrow')}>
                      Borrow ICC →
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 260 }}>
                      Mint your invoice as an ARC-3 NFT. This also creates the ICC token and seeds the lending pool.
                    </div>
                    <button
                      onClick={handleMint}
                      disabled={minting || !activeAddress}
                      className="btn-primary"
                      style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                    >
                      {minting ? (
                        <>
                          <span className="loading-bar" style={{ width: 40, display: 'inline-block', verticalAlign: 'middle', marginRight: 6 }} />
                          Deploying…
                        </>
                      ) : (
                        'Mint Invoice NFT →'
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Invoice preview table */}
      {(client || amount || dueDate) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          style={{ marginTop: 28 }}
        >
          <div className="label-caps" style={{ marginBottom: 8 }}>Invoice Preview</div>
          <div style={{ border: '1px solid var(--border-default)', overflow: 'hidden' }}>
            <table className="ic-table">
              <thead>
                <tr>
                  {['Invoice No.', 'Client', 'Amount (₹)', 'Due Date'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><span className="mono" style={{ fontSize: 11 }}>{invoiceNo || '—'}</span></td>
                  <td><span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{client || '—'}</span></td>
                  <td>
                    <span className="mono" style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                      {amount ? Number(amount).toLocaleString('en-IN') : '—'}
                    </span>
                  </td>
                  <td><span className="mono" style={{ fontSize: 11 }}>{dueDate || '—'}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  )
}

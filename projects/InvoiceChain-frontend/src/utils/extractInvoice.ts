// PDF Invoice Extraction Utility
// Extracts GSTINs, amount, date, and invoice number from uploaded PDF.
// Uses pdfjs-dist for browser-native text extraction.

import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).href

const GSTIN_PATTERN = /[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}/g
const GSTIN_VALID   = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/

export interface ExtractionResult {
  seller_gstin_match: boolean
  buyer_gstin: string | null
  buyer_gstin_valid_format: boolean
  extracted_amount: number | null
  amount_match: boolean
  invoice_date: string | null
  date_valid: boolean
  invoice_number: string | null
  confidence_score: number
  raw_preview: string
}

async function extractText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const uint8 = new Uint8Array(buffer)
  const pdf = await pdfjsLib.getDocument({ data: uint8 }).promise
  let text = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    text += content.items
      .map(item => ('str' in item ? (item as { str: string }).str : ''))
      .join(' ')
    text += '\n'
  }
  return text
}

function findGstins(text: string): string[] {
  return [...text.matchAll(GSTIN_PATTERN)].map(m => m[0])
}

function findAmount(text: string): number | null {
  const patterns = [
    /₹\s*([\d,]+\.?\d*)/g,
    /Rs\.?\s*([\d,]+\.?\d*)/g,
    /INR\s*([\d,]+\.?\d*)/g,
    /Total[:\s]+([\d,]+\.?\d*)/gi,
    /Amount Due[:\s]+([\d,]+\.?\d*)/gi,
  ]
  const amounts: number[] = []
  for (const pattern of patterns) {
    for (const m of text.matchAll(pattern)) {
      const num = parseFloat(m[1].replace(/,/g, ''))
      if (!isNaN(num) && num > 0) amounts.push(num)
    }
  }
  return amounts.length > 0 ? Math.max(...amounts) : null
}

function findDate(text: string): string | null {
  const patterns = [
    /\d{2}[\/\-]\d{2}[\/\-]\d{4}/g,
    /\d{4}[\/\-]\d{2}[\/\-]\d{2}/g,
    /\d{2}\s+\w+\s+\d{4}/g,
  ]
  for (const pattern of patterns) {
    const m = text.match(pattern)
    if (m) return m[0]
  }
  return null
}

function isWithin90Days(dateStr: string): boolean {
  try {
    const parsed = new Date(dateStr)
    if (isNaN(parsed.getTime())) return false
    const diff = Date.now() - parsed.getTime()
    return diff >= 0 && diff <= 90 * 24 * 60 * 60 * 1000
  } catch {
    return false
  }
}

function findInvoiceNumber(text: string): string | null {
  const patterns = [
    /INV[-\/\s]?[\w\d-]+/gi,
    /Invoice\s*No[\.:\s]+[\w\d-]+/gi,
    /Invoice\s*#\s*[\w\d-]+/gi,
  ]
  for (const pattern of patterns) {
    const m = text.match(pattern)
    if (m) return m[0]
  }
  return null
}

export async function extractInvoice(
  file: File,
  sellerGstin: string | null,
  claimedAmount: number
): Promise<ExtractionResult> {
  const text = await extractText(file)

  const gstins = findGstins(text)
  const sellerNorm = sellerGstin?.trim().toUpperCase() ?? null
  const sellerMatch = sellerNorm ? gstins.includes(sellerNorm) : false
  const others = sellerNorm ? gstins.filter(g => g !== sellerNorm) : gstins
  const buyerGstin = others.length > 0 ? others[0] : null
  const buyerValid = buyerGstin ? GSTIN_VALID.test(buyerGstin) : false

  const extractedAmount = findAmount(text)
  const amountMatch = (() => {
    if (extractedAmount === null || claimedAmount <= 0) return false
    const directMatch = Math.abs(extractedAmount - claimedAmount) / claimedAmount < 0.25
    const gstExclusiveMatch = Math.abs((extractedAmount / 1.18) - claimedAmount) / claimedAmount < 0.15
    return directMatch || gstExclusiveMatch
  })()

  const invoiceDate = findDate(text)
  const dateValid = invoiceDate ? isWithin90Days(invoiceDate) : false

  const invoiceNumber = findInvoiceNumber(text)

  let confidence = 0
  if (sellerMatch) confidence += 25
  if (buyerGstin !== null) confidence += 25
  if (amountMatch) confidence += 25
  if (dateValid) confidence += 15
  if (invoiceNumber !== null) confidence += 10

  return {
    seller_gstin_match: sellerMatch,
    buyer_gstin: buyerGstin,
    buyer_gstin_valid_format: buyerValid,
    extracted_amount: extractedAmount,
    amount_match: amountMatch,
    invoice_date: invoiceDate,
    date_valid: dateValid,
    invoice_number: invoiceNumber,
    confidence_score: confidence,
    raw_preview: text.slice(0, 300),
  }
}

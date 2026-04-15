// ── GSTIN Verification Utility ────────────────────────────────────
// Deterministic mock — same GSTIN always returns same business data.
// 800ms artificial delay simulates a real API call.

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/

const STATE_CODES: Record<string, string> = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman & Nicobar',
  '36': 'Telangana',
  '37': 'Andhra Pradesh (New)',
}

export interface GstData {
  valid: true
  gstin: string
  business_name: string
  state: string
  state_code: string
  registration_date: string
  taxpayer_type: string
  annual_turnover: string
  filing_status: string
  status: string
  last_return_filed: string
  verified_at: string
  verification_method: string
}

export interface GstError {
  valid: false
  error: string
}

export type GstResult = GstData | GstError

export async function verifyGstin(gstin: string): Promise<GstResult> {
  // Artificial 800ms delay
  await new Promise(r => setTimeout(r, 800))

  if (!GSTIN_REGEX.test(gstin.trim().toUpperCase())) {
    return { valid: false, error: 'Invalid GSTIN format' }
  }

  const normalized = gstin.trim().toUpperCase()
  const stateCode = normalized.slice(0, 2)
  const panPortion = normalized.slice(2, 12)

  // Deterministic charSum — same GSTIN always produces same data
  const charSum = panPortion.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)

  const registrationYear = 2015 + (charSum % 8)

  const taxpayerType = charSum % 3 === 2 ? 'Composition' : 'Regular'

  const turnoverBracket =
    charSum % 3 === 0 ? '₹40L – ₹1.5Cr' :
    charSum % 3 === 1 ? '₹1.5Cr – ₹5Cr' :
    '₹5Cr+'

  const SUFFIXES = ['ENTERPRISES', 'TRADERS', 'SOLUTIONS', 'INDUSTRIES']
  const businessSuffix = SUFFIXES[charSum % 4]
  const businessName = panPortion.slice(0, 3).toUpperCase() + ' ' + businessSuffix

  const state = STATE_CODES[stateCode] ?? 'Unknown'

  return {
    valid: true,
    gstin: normalized,
    business_name: businessName,
    state,
    state_code: stateCode,
    registration_date: `01/04/${registrationYear}`,
    taxpayer_type: taxpayerType,
    annual_turnover: turnoverBracket,
    filing_status: 'Regular filer',
    status: 'ACTIVE',
    last_return_filed: 'March 2026',
    verified_at: new Date().toISOString(),
    verification_method: 'GSTIN_CHECKSUM_VERIFIED',
  }
}

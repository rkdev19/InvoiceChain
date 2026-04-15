/**
 * Maps raw Algorand/SDK error messages to user-friendly strings.
 * Returns empty string for user-dismissed modal (caller should skip toast).
 */
export function parseError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  const msg = raw.toLowerCase()

  // User dismissed Pera / WalletConnect modal — silent fail
  if (
    msg.includes('cancelled') ||
    msg.includes('canceled') ||
    msg.includes('user rejected') ||
    msg.includes('user denied') ||
    msg.includes('popup closed')
  ) return ''

  // Network / connectivity
  if (
    msg.includes('timeout') ||
    msg.includes('econnrefused') ||
    msg.includes('request failed') ||
    msg.includes('network error') ||
    msg.includes('failed to fetch')
  ) return 'Network request timed out. Check AlgoNode status and retry.'

  // ALGO balance
  if (msg.includes('overspend') || msg.includes('insufficient balance'))
    return 'Insufficient ALGO balance. Add funds via TestNet dispenser.'

  // ASA opt-in
  if (
    msg.includes('asset not opted in') ||
    msg.includes('has not opted in') ||
    msg.includes('must optin')
  ) return 'Please opt-in to the ICC token first.'

  // Minimum balance
  if (
    msg.includes('below min balance') ||
    msg.includes('minimum balance') ||
    msg.includes('min balance')
  ) return 'Contract needs more ALGO. Contact pool admin.'

  // Smart contract logic rejection
  if (
    msg.includes('logic eval error') ||
    msg.includes('opcodes=') ||
    msg.includes('assert failed') ||
    msg.includes('err opcode') ||
    msg.includes('icc already created') ||
    msg.includes('already borrowed') ||
    msg.includes('not borrowed') ||
    msg.includes('not overdue')
  ) return 'Transaction rejected by smart contract. Check borrow limit and try again.'

  // Return raw message as fallback (truncated)
  return raw.length > 120 ? raw.slice(0, 120) + '…' : raw
}

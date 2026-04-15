import { useState, useEffect, useCallback } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'

export function useRequireWallet() {
  const { activeAddress, wallets, isReady } = useWallet()
  const [showOverlay, setShowOverlay] = useState(false)
  const [connectAttempted, setConnectAttempted] = useState(false)

  const triggerConnect = useCallback(() => {
    if (wallets.length > 0) {
      // Call connect on the first available wallet (Pera on testnet)
      wallets[0].connect().catch(() => {/* user dismissed modal — overlay stays, retry button shown */})
    }
  }, [wallets])

  useEffect(() => {
    if (!activeAddress) {
      setShowOverlay(true)
      // Auto-trigger once when wallets are ready — opens Pera modal immediately
      if (isReady && !connectAttempted && wallets.length > 0) {
        setConnectAttempted(true)
        wallets[0].connect().catch(() => {/* user dismissed — retry button shown */})
      }
    } else {
      setShowOverlay(false)
      setConnectAttempted(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAddress, isReady])

  return {
    showOverlay,
    isConnected: !!activeAddress,
    triggerConnect,
  }
}

/** Returns the Lora explorer base URL for the current network. */
export function loraBase(): string {
  const network = import.meta.env.VITE_ALGOD_NETWORK ?? 'localnet'
  return `https://lora.algokit.io/${network}`
}

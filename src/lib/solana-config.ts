// Mainnet Solana Configuration
export const SOLANA_CONFIG = {
  // Your QuickNode Mainnet RPC
  RPC_URL: 'https://broken-purple-breeze.solana-mainnet.quiknode.pro/b087363c02a61ba4c37f9acd5c3c4dcc7b20420f',
  
  // Your Treasury Wallet (where platform fees go)
  TREASURY_WALLET: '42SoggCv1oXBhNWicmAJir3arYiS2NCMveWpUkixYXzj',
  
  // Network settings
  NETWORK: 'mainnet-beta' as const,
  COMMITMENT: 'confirmed' as const,
  
  // Game settings
  PLATFORM_FEE_PERCENTAGE: 0.10, // 10% platform fee
  WINNER_PERCENTAGE: 0.90, // 90% to winner
  
  // Minimum game amounts (in SOL)
  MIN_GAME_AMOUNT: 0.001,
  MAX_GAME_AMOUNT: 10.0,
  
  // Timer settings
  GAME_TIMER_MINUTES: 10,
  
  // Auto-refresh interval (milliseconds)
  REFRESH_INTERVAL: 5000
};

export const MAINNET_TOKENS = {
  SOL: {
    symbol: 'SOL',
    decimals: 9,
    name: 'Solana'
  }
};
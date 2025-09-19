interface Window {
  solana?: {
    isPhantom?: boolean;
    connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: any }>;
    disconnect: () => Promise<void>;
    isConnected: boolean;
    publicKey: any;
  };
  
  solflare?: {
    isSolflare?: boolean;
    connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: any }>;
    disconnect: () => Promise<void>;
    isConnected: boolean;
    publicKey: any;
  };
  
  backpack?: {
    isBackpack?: boolean;
    connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: any }>;
    disconnect: () => Promise<void>;
    isConnected: boolean;
    publicKey: any;
  };
  
  glow?: {
    connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: any }>;
    disconnect: () => Promise<void>;
    isConnected: boolean;
    publicKey: any;
  };
  
  coinbaseSolana?: {
    connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: any }>;
    disconnect: () => Promise<void>;
    isConnected: boolean;
    publicKey: any;
  };
  
  trustwallet?: {
    connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: any }>;
    disconnect: () => Promise<void>;
    isConnected: boolean;
    publicKey: any;
  };
  
  Slope?: {
    connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: any }>;
    disconnect: () => Promise<void>;
    isConnected: boolean;
    publicKey: any;
  };
  
  torus?: {
    connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: any }>;
    disconnect: () => Promise<void>;
    isConnected: boolean;
    publicKey: any;
  };
}
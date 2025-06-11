import * as anchor from "@coral-xyz/anchor";
import { Connection, clusterApiUrl } from "@solana/web3.js";

// Test environment configuration
export const TEST_CONFIG = {
  // Network configuration
  network: process.env.ANCHOR_PROVIDER_URL || "http://localhost:8899",
  commitment: "confirmed" as anchor.web3.Commitment,
  
  // Test timeouts
  defaultTimeout: 60000, // 60 seconds
  transactionTimeout: 30000, // 30 seconds
  
  // Test amounts
  defaultFundingAmount: 10, // SOL
  testTokenAmount: "1000000", // Base units
  
  // Fee configuration for testing
  testSwapFeeBasisPoints: 30, // 0.3%
  testCreateTokenFeeBasisPoints: 100, // 1%
  testCreatePoolFeeLamports: "1000000", // 0.001 SOL
  
  // Retry configuration
  maxRetries: 3,
  retryDelay: 1000, // 1 second
};

// Environment-specific configurations
export const ENVIRONMENTS = {
  local: {
    endpoint: "http://localhost:8899",
    programId: "HbJP9MaXcEC4ja3zoSKo4qCQmgE6ZVeQMRVHueNipvGc",
  },
  devnet: {
    endpoint: clusterApiUrl("devnet"),
    programId: "HbJP9MaXcEC4ja3zoSKo4qCQmgE6ZVeQMRVHueNipvGc",
  },
  testnet: {
    endpoint: clusterApiUrl("testnet"),
    programId: "HbJP9MaXcEC4ja3zoSKo4qCQmgE6ZVeQMRVHueNipvGc",
  },
};

// Get current environment
export function getCurrentEnvironment() {
  const network = process.env.ANCHOR_PROVIDER_URL || "http://localhost:8899";
  
  if (network.includes("localhost") || network.includes("127.0.0.1")) {
    return ENVIRONMENTS.local;
  } else if (network.includes("devnet")) {
    return ENVIRONMENTS.devnet;
  } else if (network.includes("testnet")) {
    return ENVIRONMENTS.testnet;
  } else {
    return ENVIRONMENTS.local; // Default to local
  }
}

// Test utilities
export function getTestConnection(): Connection {
  const env = getCurrentEnvironment();
  return new Connection(env.endpoint, TEST_CONFIG.commitment);
}

export function isLocalEnvironment(): boolean {
  const env = getCurrentEnvironment();
  return env === ENVIRONMENTS.local;
}

// Test data generators
export const TEST_DATA = {
  tokens: {
    aiw3: {
      name: "Test AIW3 Token",
      symbol: "TAIW3",
      uri: "https://example.com/test-aiw3.json",
      decimals: 9,
    },
    aiAgent: {
      name: "Test AI Agent Token",
      symbol: "TAIA",
      uri: "https://example.com/test-aia.json",
      decimals: 9,
    },
  },
  
  pools: {
    default: {
      initialLiquidityA: "100000000000000", // 100k tokens with 9 decimals
      initialLiquidityB: "100000000000000", // 100k tokens with 9 decimals
    },
  },
  
  swaps: {
    small: "1000000000", // 1 token with 9 decimals
    medium: "10000000000", // 10 tokens with 9 decimals
    large: "100000000000", // 100 tokens with 9 decimals
  },
};

// Error handling utilities
export class TestError extends Error {
  constructor(message: string, public readonly cause?: any) {
    super(message);
    this.name = "TestError";
  }
}

export function wrapTestError(fn: Function): Function {
  return async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof TestError) {
        throw error;
      }
      throw new TestError(`Test failed: ${error.message}`, error);
    }
  };
}

// Test performance utilities
export class TestTimer {
  private startTime: number = 0;
  
  start(): void {
    this.startTime = Date.now();
  }
  
  end(): number {
    return Date.now() - this.startTime;
  }
  
  async measure<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
    this.start();
    const result = await fn();
    const duration = this.end();
    return { result, duration };
  }
}

// Logging utilities for tests
export const TestLogger = {
  info: (message: string) => {
    if (process.env.TEST_VERBOSE === "true") {
      console.log(`[INFO] ${message}`);
    }
  },
  
  warn: (message: string) => {
    console.warn(`[WARN] ${message}`);
  },
  
  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${message}`, error || "");
  },
  
  success: (message: string) => {
    if (process.env.TEST_VERBOSE === "true") {
      console.log(`[SUCCESS] ✓ ${message}`);
    }
  },
  
  step: (step: number, message: string) => {
    if (process.env.TEST_VERBOSE === "true") {
      console.log(`[STEP ${step}] ${message}`);
    }
  },
}; 
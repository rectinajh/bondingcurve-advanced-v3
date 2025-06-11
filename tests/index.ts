// Main test entry point
import "mocha";
import { expect } from "chai";
import { TEST_CONFIG, TestLogger, isLocalEnvironment } from "./test-config";

// Extend global namespace for test utilities
declare global {
  var testTimeout: number;
  var transactionTimeout: number;
}

// Set global test configuration
beforeEach(function() {
  this.timeout(TEST_CONFIG.defaultTimeout);
});

describe("Bonding Curve Test Suite", function() {
  this.timeout(TEST_CONFIG.defaultTimeout);
  
  before(async function() {
    TestLogger.info("Starting test suite...");
    TestLogger.info(`Environment: ${isLocalEnvironment() ? "Local" : "Network"}`);
    TestLogger.info(`Network: ${TEST_CONFIG.network}`);
    
    // Check if local validator is running for local tests
    if (isLocalEnvironment()) {
      try {
        const { Connection } = require("@solana/web3.js");
        const connection = new Connection(TEST_CONFIG.network, TEST_CONFIG.commitment);
        await connection.getVersion();
        TestLogger.success("Connected to local Solana validator");
      } catch (error) {
        TestLogger.error("Failed to connect to local Solana validator");
        TestLogger.error("Please ensure 'solana-test-validator' is running");
        throw new Error("Local validator not available");
      }
    }
  });

  after(function() {
    TestLogger.info("Test suite completed");
  });

  // Import all test files - these will register their tests
  require("./unit/initialize.test");
  require("./unit/create-token.test");
  require("./unit/swap.test");
  require("./integration/full-workflow.test");
});

// Export test utilities for global use
export { TEST_CONFIG, TestLogger };

// Set global test utilities
global.testTimeout = TEST_CONFIG.defaultTimeout;
global.transactionTimeout = TEST_CONFIG.transactionTimeout; 
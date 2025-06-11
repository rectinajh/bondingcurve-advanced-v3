# Bonding Curve Test Suite

This directory contains comprehensive test cases for the Bonding Curve smart contract program.

## 📁 Test Structure

```
tests/
├── unit/                     # Unit tests for individual components
│   ├── initialize.test.ts    # Configuration initialization tests
│   ├── create-token.test.ts  # Token creation tests
│   └── swap.test.ts         # Swap functionality tests
├── integration/             # Integration tests for full workflows
│   └── full-workflow.test.ts # End-to-end testing
├── utils/                   # Test utilities and helpers
│   └── test-setup.ts       # Common test setup and utilities
├── test-config.ts          # Test configuration and constants
├── package.json            # Test dependencies
├── tsconfig.json           # TypeScript configuration
├── mocha.opts             # Mocha test runner options
└── run-tests.sh           # Simple test runner script
```

## 🧪 Test Categories

### Unit Tests

#### 1. Initialization Tests (`initialize.test.ts`)
- **Success Cases**:
  - Valid configuration initialization
  - Maximum fee basis points (10000)
  - Zero fee basis points
- **Error Cases**:
  - Duplicate initialization attempts
  - Invalid fee basis points (> 10000)
  - Invalid admin address (zero address)

#### 2. Token Creation Tests (`create-token.test.ts`)
- **Success Cases**:
  - AIW3 token creation with valid parameters
  - AI Agent token creation with valid parameters
- **Error Cases**:
  - Invalid token name (too long)
  - Invalid decimals (> 255)
  - Zero initial supply
  - Invalid transfer fee basis points (> 10000)
- **Edge Cases**:
  - Maximum supply token creation
  - Zero transfer fee configuration

#### 3. Swap Tests (`swap.test.ts`)
- **Success Cases**:
  - Token A to Token B swaps
  - Token B to Token A swaps
- **Error Cases**:
  - Insufficient balance
  - Slippage protection exceeded
  - Zero swap amount
  - Paused system operations
- **Fee Testing**:
  - Swap fee calculation and collection
- **Edge Cases**:
  - Very small swap amounts (1 wei)

### Integration Tests

#### 1. Full Workflow Test (`full-workflow.test.ts`)
- **Complete Flow**:
  1. System configuration initialization
  2. Token A (AIW3) creation
  3. Token B (AI Agent) creation
  4. Swap pool creation with initial liquidity
  5. Token swap execution
  6. Reverse swap execution
  7. Final pool state validation

- **Multi-User Scenarios**:
  - Concurrent user operations
  - Multiple swap executions
  - Fee distribution verification

## 🛠 Test Utilities

### TestSetup Class (`test-setup.ts`)
- **Environment Setup**: Local cluster configuration, keypair generation
- **Account Management**: Funding accounts, creating token accounts
- **Token Operations**: Creating tokens, minting tokens
- **Assertions**: Custom BigNumber comparisons
- **Utilities**: Balance checking, account info retrieval

### Test Configuration (`test-config.ts`)
- **Environment Settings**: Network endpoints, timeouts
- **Test Data**: Predefined token and pool configurations
- **Error Handling**: Custom error classes and wrappers
- **Performance**: Test timing utilities
- **Logging**: Verbose test output control

## 🚀 Running Tests

### Prerequisites

1. **Solana Development Environment**:
   ```bash
   # Install Solana CLI
   sh -c "$(curl -sSfL https://release.solana.com/v1.17.0/install)"
   
   # Install Anchor
   cargo install --git https://github.com/coral-xyz/anchor anchor-cli --locked
   ```

2. **Node.js Dependencies** (in tests directory):
   ```bash
   cd tests
   npm install
   ```

### Local Testing with Validator

1. **Start Local Validator**:
   ```bash
   # In one terminal
   solana-test-validator
   ```

2. **Run Tests**:
   ```bash
   # Quick test simulation (no actual blockchain calls)
   ./tests/run-tests.sh
   
   # Full test suite (when dependencies are installed)
   cd tests
   npm run test
   
   # Individual test categories
   npm run test:unit
   npm run test:integration
   
   # Verbose output
   npm run test:verbose
   ```

### Network Testing

Set the network endpoint and run tests:

```bash
export ANCHOR_PROVIDER_URL="https://api.devnet.solana.com"
cd tests
npm run test
```

## 📊 Test Coverage

The test suite covers:

- ✅ **Initialization**: Configuration setup and validation
- ✅ **Token Creation**: AIW3 and AI Agent token creation with various parameters
- ✅ **Pool Management**: Swap pool creation and liquidity management
- ✅ **Swap Operations**: Token swapping with fee calculations and slippage protection
- ✅ **Error Handling**: Invalid inputs, insufficient balances, and system errors
- ✅ **Edge Cases**: Boundary conditions and extreme values
- ✅ **Integration**: End-to-end workflows and multi-user scenarios

## 🔧 Test Configuration

### Environment Variables

- `ANCHOR_PROVIDER_URL`: Solana RPC endpoint (default: localhost:8899)
- `TEST_VERBOSE`: Enable verbose logging (true/false)
- `NODE_ENV`: Set to 'test' for test environment

### Test Constants

```typescript
// Test amounts
testTokenAmount: "1000000"           // Base units
defaultFundingAmount: 10             // SOL

// Fee configuration
testSwapFeeBasisPoints: 30           // 0.3%
testCreateTokenFeeBasisPoints: 100   // 1%
testCreatePoolFeeLamports: "1000000" // 0.001 SOL

// Timeouts
defaultTimeout: 60000                // 60 seconds
transactionTimeout: 30000            // 30 seconds
```

## 🐛 Debugging

### Common Issues

1. **Local Validator Not Running**:
   ```
   Error: Local validator not available
   ```
   Solution: Start `solana-test-validator` in a separate terminal

2. **Insufficient SOL Balance**:
   ```
   Error: InsufficientBalance
   ```
   Solution: Ensure test accounts are properly funded

3. **Transaction Timeout**:
   ```
   Error: Transaction timeout
   ```
   Solution: Check network connection and increase timeout values

### Debug Logging

Enable verbose logging to see detailed test execution:

```bash
export TEST_VERBOSE=true
npm run test
```

## 📋 Test Checklist

Before running tests, ensure:

- [ ] Solana CLI is installed and configured
- [ ] Anchor framework is installed
- [ ] Local validator is running (for local tests)
- [ ] Test dependencies are installed (`npm install`)
- [ ] Environment variables are set correctly

## 🤝 Contributing to Tests

### Adding New Tests

1. **Unit Tests**: Add to appropriate file in `tests/unit/`
2. **Integration Tests**: Add to `tests/integration/`
3. **Test Utilities**: Add helper functions to `tests/utils/`

### Test Standards

- Use descriptive test names
- Include both success and error cases
- Test edge cases and boundary conditions
- Add comments for complex test logic
- Ensure tests are isolated and repeatable

### Running Before Commit

```bash
# Run full test suite
npm run test

# Check for any failures or issues
npm run test:verbose
```

## 📝 Notes

- Tests are designed to work with both local and network environments
- The test suite includes mock data and realistic scenarios
- Performance testing is included for critical operations
- All tests include proper cleanup and state management 
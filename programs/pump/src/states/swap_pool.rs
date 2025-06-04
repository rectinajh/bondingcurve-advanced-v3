use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct SwapPool {
    pub creator: Pubkey,
    pub aiw3_token_mint: Pubkey,      // AIW3 Token (platform token)
    pub ai_agent_token_mint: Pubkey,  // AI Agent Token (project token)
    
    // Pool reserves
    pub aiw3_reserves: u64,           // AIW3 Token reserves
    pub ai_agent_reserves: u64,       // AI Agent Token reserves
    
    // Pool configuration
    pub swap_fee_basis_points: u16,   // Swap fee in basis points
    pub aiw3_transfer_fee_basis_points: u16,  // AIW3 transfer fee
    pub ai_agent_transfer_fee_basis_points: u16, // AI Agent transfer fee
    
    // Pool state
    pub is_active: bool,
    pub is_locked: bool,              // Reentrancy protection
    pub pool_type: PoolType,          // Internal or External pool
    pub created_timestamp: i64,       // Pool creation time
    pub last_update_timestamp: i64,   // Last price update
    pub bump: u8,
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize, InitSpace)]
pub enum PoolType {
    Internal,  // Internal DEX pool (A1)
    External,  // External DEX pool (A2) 
}

impl SwapPool {
    pub const DISCRIMINATOR_SIZE: usize = 8;
    pub const SIZE: usize = Self::DISCRIMINATOR_SIZE + Self::INIT_SPACE;
    
    /// Calculate swap output based on reserves and fees
    pub fn calculate_swap_output(
        &self,
        amount_in: u64,
        input_is_aiw3: bool,
        aw3_price: i64,
    ) -> Result<u64, crate::PumpError> {
        if !self.is_active {
            return Err(crate::PumpError::SwapPoolNotActive);
        }

        // Additional validation: check for zero reserves
        if self.aiw3_reserves == 0 || self.ai_agent_reserves == 0 {
            return Err(crate::PumpError::InsufficientLiquidity);
        }

        let (reserve_in, reserve_out) = if input_is_aiw3 {
            (self.aiw3_reserves, self.ai_agent_reserves)
        } else {
            (self.ai_agent_reserves, self.aiw3_reserves)
        };

        // Apply swap fee with overflow protection
        let fee_multiplier = 10000u128.saturating_sub(self.swap_fee_basis_points as u128);
        let amount_in_with_fee = (amount_in as u128)
            .checked_mul(fee_multiplier)
            .ok_or(crate::PumpError::MathOverflow)?
            .checked_div(10000)
            .ok_or(crate::PumpError::MathOverflow)?;

        // Validate amount_in_with_fee is not zero
        if amount_in_with_fee == 0 {
            return Err(crate::PumpError::AmountTooSmall);
        }

        // Price-based calculation using AW3 oracle price
        let amount_out = if input_is_aiw3 {
            // AIW3 -> AI Agent Token: use oracle price
            self.calculate_aiw3_to_agent(amount_in_with_fee as u64, aw3_price)?
        } else {
            // AI Agent Token -> AIW3: use oracle price  
            self.calculate_agent_to_aiw3(amount_in_with_fee as u64, aw3_price)?
        };

        // Ensure we don't exceed available reserves
        if amount_out > reserve_out {
            return Err(crate::PumpError::InsufficientLiquidity);
        }

        // Ensure amount_out is not zero
        if amount_out == 0 {
            return Err(crate::PumpError::AmountTooSmall);
        }

        Ok(amount_out)
    }

    fn calculate_aiw3_to_agent(&self, aiw3_amount: u64, aw3_price: i64) -> Result<u64, crate::PumpError> {
        if aw3_price <= 0 {
            return Err(crate::PumpError::InvalidPriceOracle);
        }

        // Prevent overflow by checking input bounds
        if aiw3_amount > u64::MAX / (aw3_price as u64) {
            return Err(crate::PumpError::MathOverflow);
        }

        // Convert AIW3 to USD value, then to AI Agent tokens
        let usd_value = (aiw3_amount as u128)
            .checked_mul(aw3_price as u128)
            .ok_or(crate::PumpError::MathOverflow)?
            .checked_div(10_i128.pow(8) as u128) // Pyth price has 8 decimals
            .ok_or(crate::PumpError::MathOverflow)?;

        // Additional bounds check
        if usd_value > u64::MAX as u128 {
            return Err(crate::PumpError::MathOverflow);
        }

        Ok(usd_value as u64)
    }

    fn calculate_agent_to_aiw3(&self, agent_amount: u64, aw3_price: i64) -> Result<u64, crate::PumpError> {
        if aw3_price <= 0 {
            return Err(crate::PumpError::InvalidPriceOracle);
        }

        let usd_value = agent_amount as u128; // Assume 1:1 USD for simplicity
        
        // Prevent division by zero and overflow
        let price_with_decimals = 10_i128.pow(8) as u128;
        
        let aiw3_amount = usd_value
            .checked_mul(price_with_decimals)
            .ok_or(crate::PumpError::MathOverflow)?
            .checked_div(aw3_price as u128)
            .ok_or(crate::PumpError::MathOverflow)?;

        // Additional bounds check
        if aiw3_amount > u64::MAX as u128 {
            return Err(crate::PumpError::MathOverflow);
        }

        Ok(aiw3_amount as u64)
    }
} 
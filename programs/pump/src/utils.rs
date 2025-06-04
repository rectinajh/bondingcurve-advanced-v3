use anchor_lang::prelude::*;
use pyth_solana_receiver_sdk::price_update::PriceUpdateV2;
use solana_program::program::invoke_signed;
use spl_token_2022::{
    extension::{
        transfer_fee::{instruction::transfer_checked_with_fee, TransferFeeConfig},
        StateWithExtensions,
    },
    state::Mint,
};

/// Transfer tokens with fee using Token 2022
pub fn invoke_transfer_checked_with_fee<'a>(
    token_program_id: &Pubkey,
    source_info: AccountInfo<'a>,
    mint_info: AccountInfo<'a>,
    destination_info: AccountInfo<'a>,
    authority_info: AccountInfo<'a>,
    amount: u64,
    decimals: u8,
    fee: u64,
    seeds: &[&[&[u8]]],
) -> Result<()> {
    let cpi_instruction = transfer_checked_with_fee(
        token_program_id,
        source_info.key,
        mint_info.key,
        destination_info.key,
        authority_info.key,
        &[],
        amount,
        decimals,
        fee,
    )?;

    let cpi_account_infos = vec![
        source_info,
        mint_info,
        destination_info,
        authority_info,
    ];

    invoke_signed(&cpi_instruction, &cpi_account_infos, seeds)?;

    Ok(())
}

/// Get transfer fee configuration from Token 2022 mint
pub fn get_transfer_fee_config(mint_info: &AccountInfo) -> Result<Option<TransferFeeConfig>> {
    let mint_data = mint_info.try_borrow_data()?;
    let mint = StateWithExtensions::<Mint>::unpack(&mint_data)?;
    
    Ok(mint.get_extension::<TransferFeeConfig>().ok().map(|config| *config))
}

/// Calculate transfer fee for a given amount
pub fn calculate_transfer_fee(
    mint_info: &AccountInfo,
    amount: u64,
) -> Result<u64> {
    if let Some(config) = get_transfer_fee_config(mint_info)? {
        let fee = (amount as u128)
            .checked_mul(config.transfer_fee_basis_points as u128)
            .unwrap()
            .checked_div(10000)
            .unwrap()
            .min(config.maximum_fee as u128) as u64;
        Ok(fee)
    } else {
        Ok(0)
    }
}

/// Validate and extract price from Pyth price feed
pub fn get_validated_price(
    price_oracle: &Account<PriceUpdateV2>,
    feed_id: &str,
    max_age: u64,
) -> Result<i64> {
    let feed_id_bytes = feed_id.parse::<[u8; 32]>()
        .map_err(|_| error!(crate::PumpError::InvalidPriceOracle))?;
    
    let price_feed = price_oracle.get_price_no_older_than(
        &Clock::get()?,
        max_age,
        &feed_id_bytes,
    ).map_err(|_| error!(crate::PumpError::PriceTooOld))?;

    Ok(price_feed.price)
}

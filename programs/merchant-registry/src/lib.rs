// ═══════════════════════════════════════════════════════════
// Merchant Registry — Solana On-Chain Program (Anchor)
// ═══════════════════════════════════════════════════════════
//
// Stores merchant profiles on-chain with:
// - wallet authority
// - hashed location (privacy)
// - category classification
// - anti-spam staking

use anchor_lang::prelude::*;

declare_id!("3GyfAzucGoL1FFpkhpCm3sRjTCjLxPyeFLp4vayw35GH");

#[program]
pub mod merchant_registry {
    use super::*;

    /// Register a new merchant on-chain.
    /// Requires staking SOL as anti-spam measure.
    pub fn register_merchant(
        ctx: Context<RegisterMerchant>,
        name: String,
        category: u8,
        location_hash: [u8; 32],
        stake_amount: u64,
    ) -> Result<()> {
        require!(name.len() <= 64, ErrorCode::NameTooLong);
        require!(stake_amount >= 100_000_000, ErrorCode::InsufficientStake); // 0.1 SOL min

        let authority_key = ctx.accounts.authority.key();
        let merchant_key = ctx.accounts.merchant.key();
        let registered_at = Clock::get()?.unix_timestamp;

        {
            let merchant = &mut ctx.accounts.merchant;
            merchant.authority = authority_key;
            merchant.name = name;
            merchant.category = category;
            merchant.location_hash = location_hash;
            merchant.stake_amount = stake_amount;
            merchant.is_active = true;
            merchant.total_quests = 0;
            merchant.total_transactions = 0;
            merchant.registered_at = registered_at;
            merchant.bump = ctx.bumps.merchant;
        }

        // Transfer stake
        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &authority_key,
            &merchant_key,
            stake_amount,
        );
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.authority.to_account_info(),
                ctx.accounts.merchant.to_account_info(),
            ],
        )?;

        let merchant_name = ctx.accounts.merchant.name.clone();
        emit!(MerchantRegistered {
            merchant: merchant_key,
            authority: authority_key,
            name: merchant_name,
            category,
            timestamp: registered_at,
        });

        Ok(())
    }

    /// Update merchant profile (authority only).
    pub fn update_merchant(
        ctx: Context<UpdateMerchant>,
        name: Option<String>,
        is_active: Option<bool>,
    ) -> Result<()> {
        let merchant = &mut ctx.accounts.merchant;

        if let Some(new_name) = name {
            require!(new_name.len() <= 64, ErrorCode::NameTooLong);
            merchant.name = new_name;
        }

        if let Some(active) = is_active {
            merchant.is_active = active;
        }

        Ok(())
    }

    /// Deregister merchant and return stake.
    pub fn deregister_merchant(ctx: Context<DeregisterMerchant>) -> Result<()> {
        emit!(MerchantDeregistered {
            merchant: ctx.accounts.merchant.key(),
            authority: ctx.accounts.authority.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });

        // Stake is returned automatically when account is closed
        Ok(())
    }
}

// ──── Accounts ────

#[derive(Accounts)]
#[instruction(name: String)]
pub struct RegisterMerchant<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + MerchantAccount::INIT_SPACE,
        seeds = [b"merchant", authority.key().as_ref()],
        bump,
    )]
    pub merchant: Account<'info, MerchantAccount>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateMerchant<'info> {
    #[account(
        mut,
        has_one = authority,
        seeds = [b"merchant", authority.key().as_ref()],
        bump = merchant.bump,
    )]
    pub merchant: Account<'info, MerchantAccount>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct DeregisterMerchant<'info> {
    #[account(
        mut,
        has_one = authority,
        close = authority,
        seeds = [b"merchant", authority.key().as_ref()],
        bump = merchant.bump,
    )]
    pub merchant: Account<'info, MerchantAccount>,
    #[account(mut)]
    pub authority: Signer<'info>,
}

// ──── State ────

#[account]
#[derive(InitSpace)]
pub struct MerchantAccount {
    pub authority: Pubkey,
    #[max_len(64)]
    pub name: String,
    pub category: u8,
    pub location_hash: [u8; 32],
    pub stake_amount: u64,
    pub is_active: bool,
    pub total_quests: u32,
    pub total_transactions: u64,
    pub registered_at: i64,
    pub bump: u8,
}

// ──── Events ────

#[event]
pub struct MerchantRegistered {
    pub merchant: Pubkey,
    pub authority: Pubkey,
    pub name: String,
    pub category: u8,
    pub timestamp: i64,
}

#[event]
pub struct MerchantDeregistered {
    pub merchant: Pubkey,
    pub authority: Pubkey,
    pub timestamp: i64,
}

// ──── Errors ────

#[error_code]
pub enum ErrorCode {
    #[msg("Merchant name too long (max 64 chars)")]
    NameTooLong,
    #[msg("Insufficient stake (minimum 0.1 SOL)")]
    InsufficientStake,
}

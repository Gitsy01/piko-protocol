// ═══════════════════════════════════════════════════════════
// Quest Program — Solana On-Chain Program (Anchor)
// ═══════════════════════════════════════════════════════════
//
// Each quest is an on-chain PDA object with:
// - merchant reference
// - reward amount and token
// - claim tracking
// - expiry

use anchor_lang::prelude::*;

declare_id!("21qTx6xMKjy4v23BbfGvM1mSKvkk3bNVHvgSnXZEMcpC");

#[program]
pub mod quest_program {
    use super::*;

    /// Create a new quest bound to a merchant authority and payout wallet.
    pub fn create_quest(
        ctx: Context<CreateQuest>,
        merchant_wallet: Pubkey,
        reward_amount: u64,
        reward_mint: Pubkey,
        max_claims: u32,
        min_spend_lamports: u64,
        expiry: i64,
        quest_type: u8,
        _quest_id: u64,
    ) -> Result<()> {
        require!(reward_amount > 0, QuestError::InvalidRewardAmount);
        require!(max_claims > 0, QuestError::InvalidMaxClaims);
        require!(expiry > Clock::get()?.unix_timestamp, QuestError::AlreadyExpired);

        let quest_key = ctx.accounts.quest.key();
        let merchant_key = ctx.accounts.merchant.key();
        let authority_key = ctx.accounts.authority.key();
        let created_at = Clock::get()?.unix_timestamp;

        {
            let quest = &mut ctx.accounts.quest;
            quest.merchant = merchant_key;
            quest.merchant_wallet = merchant_wallet;
            quest.authority = authority_key;
            quest.reward_amount = reward_amount;
            quest.reward_mint = reward_mint;
            quest.max_claims = max_claims;
            quest.claimed_count = 0;
            quest.min_spend_lamports = min_spend_lamports;
            quest.quest_type = quest_type;
            quest.expiry = expiry;
            quest.is_active = true;
            quest.created_at = created_at;
            quest.bump = ctx.bumps.quest;
        }

        emit!(QuestCreated {
            quest: quest_key,
            merchant: merchant_key,
            reward_amount,
            max_claims,
            expiry,
            timestamp: created_at,
        });

        Ok(())
    }

    /// Claim a quest (user submits proof of payment).
    pub fn claim_quest(
        ctx: Context<ClaimQuest>,
        payment_tx: [u8; 64],
        merchant_wallet: Pubkey,
        payment_amount_lamports: u64,
    ) -> Result<()> {
        let quest = &ctx.accounts.quest;

        require!(quest.is_active, QuestError::QuestInactive);
        require!(
            quest.claimed_count < quest.max_claims,
            QuestError::MaxClaimsReached
        );
        require!(
            Clock::get()?.unix_timestamp < quest.expiry,
            QuestError::QuestExpired
        );
        require!(
            merchant_wallet == quest.merchant_wallet,
            QuestError::MerchantWalletMismatch
        );
        require!(
            payment_amount_lamports >= quest.min_spend_lamports,
            QuestError::InsufficientPayment
        );

        let quest_key = ctx.accounts.quest.key();
        let user_key = ctx.accounts.user.key();
        let claim_key = ctx.accounts.claim.key();
        let claimed_at = Clock::get()?.unix_timestamp;

        {
            let claim = &mut ctx.accounts.claim;
            claim.quest = quest_key;
            claim.user = user_key;
            claim.payment_tx = payment_tx;
            claim.reward_tx = None;
            claim.status = 0; // pending
            claim.claimed_at = claimed_at;
            claim.bump = ctx.bumps.claim;
        }

        let quest = &mut ctx.accounts.quest;
        quest.claimed_count = quest
            .claimed_count
            .checked_add(1)
            .ok_or(QuestError::MathOverflow)?;

        emit!(QuestClaimed {
            quest: quest_key,
            user: user_key,
            claim: claim_key,
            timestamp: claimed_at,
        });

        Ok(())
    }

    /// Close a quest (merchant authority only).
    pub fn close_quest(ctx: Context<CloseQuest>) -> Result<()> {
        emit!(QuestClosed {
            quest: ctx.accounts.quest.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });
        Ok(())
    }
}

// ──── Accounts ────

#[derive(Accounts)]
#[instruction(merchant_wallet: Pubkey, reward_amount: u64, reward_mint: Pubkey, max_claims: u32, min_spend_lamports: u64, expiry: i64, quest_type: u8, quest_id: u64)]
pub struct CreateQuest<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + QuestAccount::INIT_SPACE,
        seeds = [b"quest", merchant.key().as_ref(), &quest_id.to_le_bytes()],
        bump,
    )]
    pub quest: Account<'info, QuestAccount>,
    /// CHECK: Merchant PDA verified by seeds
    pub merchant: UncheckedAccount<'info>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimQuest<'info> {
    #[account(mut)]
    pub quest: Account<'info, QuestAccount>,
    #[account(
        init,
        payer = user,
        space = 8 + QuestClaimAccount::INIT_SPACE,
        seeds = [b"claim", quest.key().as_ref(), user.key().as_ref()],
        bump,
    )]
    pub claim: Account<'info, QuestClaimAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CloseQuest<'info> {
    #[account(
        mut,
        has_one = authority,
        close = authority,
    )]
    pub quest: Account<'info, QuestAccount>,
    #[account(mut)]
    pub authority: Signer<'info>,
}

// ──── State ────

#[account]
#[derive(InitSpace)]
pub struct QuestAccount {
    pub merchant: Pubkey,
    pub merchant_wallet: Pubkey,
    pub authority: Pubkey,
    pub reward_amount: u64,
    pub reward_mint: Pubkey,
    pub max_claims: u32,
    pub claimed_count: u32,
    pub min_spend_lamports: u64,
    pub quest_type: u8,
    pub expiry: i64,
    pub is_active: bool,
    pub created_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct QuestClaimAccount {
    pub quest: Pubkey,
    pub user: Pubkey,
    pub payment_tx: [u8; 64],
    pub reward_tx: Option<[u8; 64]>,
    pub status: u8,           // 0=pending, 1=verified, 2=rewarded, 3=rejected
    pub claimed_at: i64,
    pub bump: u8,
}

// ──── Events ────

#[event]
pub struct QuestCreated {
    pub quest: Pubkey,
    pub merchant: Pubkey,
    pub reward_amount: u64,
    pub max_claims: u32,
    pub expiry: i64,
    pub timestamp: i64,
}

#[event]
pub struct QuestClaimed {
    pub quest: Pubkey,
    pub user: Pubkey,
    pub claim: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct QuestClosed {
    pub quest: Pubkey,
    pub timestamp: i64,
}

// ──── Errors ────

#[error_code]
pub enum QuestError {
    #[msg("Invalid reward amount")]
    InvalidRewardAmount,
    #[msg("Invalid max claims")]
    InvalidMaxClaims,
    #[msg("Quest already expired")]
    AlreadyExpired,
    #[msg("Quest is inactive")]
    QuestInactive,
    #[msg("Max claims reached")]
    MaxClaimsReached,
    #[msg("Quest has expired")]
    QuestExpired,
    #[msg("Merchant wallet does not match quest")]
    MerchantWalletMismatch,
    #[msg("Payment amount is below minimum spend")]
    InsufficientPayment,
    #[msg("Math overflow")]
    MathOverflow,
}

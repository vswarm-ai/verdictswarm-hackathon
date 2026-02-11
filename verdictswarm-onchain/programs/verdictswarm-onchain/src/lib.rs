use anchor_lang::prelude::*;

declare_id!("3i6GVUgshmbymqrsvxWQMX98yKzqLxNRUHEhtwRBZ35p");

#[program]
pub mod verdictswarm_onchain {
    use super::*;

    pub fn store_verdict(
        ctx: Context<StoreVerdict>,
        token_address: String,
        chain: String,
        score: u16,
        grade: String,
        agent_count: u8,
        tier: String,
        scan_hash: [u8; 32],
    ) -> Result<()> {
        require!(token_address.len() <= 64, VerdictError::TokenAddressTooLong);
        require!(chain.len() <= 16, VerdictError::ChainTooLong);
        require!(score <= 1000, VerdictError::ScoreOutOfRange);
        require!(grade.len() <= 4, VerdictError::GradeTooLong);
        require!(tier.len() <= 16, VerdictError::TierTooLong);

        let verdict = &mut ctx.accounts.verdict;
        let clock = Clock::get()?;

        verdict.authority = ctx.accounts.authority.key();
        verdict.token_address = token_address;
        verdict.chain = chain;
        verdict.score = score;
        verdict.grade = grade;
        verdict.agent_count = agent_count;
        verdict.tier = tier;
        verdict.timestamp = clock.unix_timestamp;
        verdict.scan_hash = scan_hash;
        verdict.bump = ctx.bumps.verdict;

        msg!(
            "VerdictSwarm: Stored verdict for {} on {} — score {}/1000, grade {}",
            verdict.token_address,
            verdict.chain,
            verdict.score,
            verdict.grade,
        );

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(token_address: String, chain: String, score: u16, grade: String, agent_count: u8, tier: String, scan_hash: [u8; 32])]
pub struct StoreVerdict<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = Verdict::space(&token_address, &chain, &grade, &tier),
        seeds = [
            b"verdict",
            token_address.as_bytes(),
            chain.as_bytes(),
            &scan_hash,
        ],
        bump,
    )]
    pub verdict: Account<'info, Verdict>,

    pub system_program: Program<'info, System>,
}

#[account]
pub struct Verdict {
    pub authority: Pubkey,       // 32
    pub token_address: String,   // 4 + len
    pub chain: String,           // 4 + len
    pub score: u16,              // 2
    pub grade: String,           // 4 + len
    pub agent_count: u8,         // 1
    pub tier: String,            // 4 + len
    pub timestamp: i64,          // 8
    pub scan_hash: [u8; 32],     // 32
    pub bump: u8,                // 1
}

impl Verdict {
    pub fn space(token_address: &str, chain: &str, grade: &str, tier: &str) -> usize {
        8  // discriminator
        + 32 // authority
        + 4 + token_address.len() // token_address
        + 4 + chain.len() // chain
        + 2  // score
        + 4 + grade.len() // grade
        + 1  // agent_count
        + 4 + tier.len() // tier
        + 8  // timestamp
        + 32 // scan_hash
        + 1  // bump
    }
}

#[error_code]
pub enum VerdictError {
    #[msg("Token address exceeds 64 characters")]
    TokenAddressTooLong,
    #[msg("Chain name exceeds 16 characters")]
    ChainTooLong,
    #[msg("Score must be 0-1000")]
    ScoreOutOfRange,
    #[msg("Grade exceeds 4 characters")]
    GradeTooLong,
    #[msg("Tier exceeds 16 characters")]
    TierTooLong,
}

use pinocchio::{
    account_info::AccountInfo,
    entrypoint,
    msg,
    program_error::ProgramError,
    pubkey::find_program_address,
    sysvars::{rent::Rent, Sysvar},
    ProgramResult,
};

entrypoint!(process_instruction);

const VERDICT_LEN: usize = 73;

fn process_instruction(
    program_id: &[u8; 32],
    accounts: &[AccountInfo],
    data: &[u8],
) -> ProgramResult {
    if data.len() < 40 || accounts.len() < 3 {
        return Err(ProgramError::InvalidInstructionData);
    }

    let authority = &accounts[0];
    let verdict = &accounts[1];

    if !authority.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let scan_hash = &data[0..32];

    let (pda, bump) = find_program_address(&[b"v", scan_hash], program_id);
    if pda != *verdict.key() {
        return Err(ProgramError::InvalidAccountData);
    }

    let rent = Rent::get()?;
    let lamports = rent.minimum_balance(VERDICT_LEN);
    let bump_slice = [bump];

    pinocchio_system::instructions::CreateAccount {
        from: authority,
        to: verdict,
        lamports,
        space: VERDICT_LEN as u64,
        owner: program_id,
    }
    .invoke_signed(&[pinocchio::instruction::Signer::from(&[
        pinocchio::instruction::Seed::from(b"v".as_ref()),
        pinocchio::instruction::Seed::from(scan_hash),
        pinocchio::instruction::Seed::from(bump_slice.as_ref()),
    ])])?;

    let mut d = verdict.try_borrow_mut_data()?;
    d[0] = bump;
    d[1..33].copy_from_slice(scan_hash);
    d[33..40].copy_from_slice(&data[32..39]);
    d[40] = data[39];
    d[41..73].copy_from_slice(authority.key());

    msg!("verdict stored");
    Ok(())
}

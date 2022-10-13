/**
 * Contains all the staking-related methods to be called in the individual main functions.
 */

import {
  Connection,
  LAMPORTS_PER_SOL,
  StakeProgram,
  Authorized,
  Lockup,
  sendAndConfirmTransaction,
  PublicKey,
  Keypair,
} from "@solana/web3.js";
import {
  establishConnection,
  createWallet,
  requestAirdrop,
  getBalance,
  getStakeAccountStatus,
} from "./utils.js";

/**
 * Withdraw all the SOL from the stake account.
 * @param {Connection} connection Established RPC JSON connection.
 * @returns An object containing the wallet, stake account and the chosen validator's public key.
 */
const getValidators = async (connection) => {
  if (!connection) {
    connection = establishConnection();
  }

  // Current: Active, Delinquent: Inactive
  const { current, delinquent } = await connection.getVoteAccounts();
  const totalValidators = current.length + delinquent.length;
  console.log("# of validators: " + totalValidators);
  console.log("# of current validators: " + current.length);
};

/**
 * @typedef {Object} Keys
 * @property {Keypair} wallet - The wallet
 * @property {Keypair} stakeAccount - The stake account
 */

/**
 * Creates a stake account.
 * @param {Connection} connection Established RPC JSON connection.
 * @returns {Promise<Keys>} An object containing both the wallet and the stake account.
 */
const createStakeAccount = async (connection) => {
  if (!connection) {
    connection = establishConnection();
  }

  // Create a new wallet
  const wallet = createWallet();
  const { publicKey: walletPublicKey } = wallet;

  // Airdrop some SOL into the wallet
  const airdropSignature = await requestAirdrop(connection, walletPublicKey, 1);
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();
  await connection.confirmTransaction({
    blockhash,
    lastValidBlockHeight,
    signature: airdropSignature,
  });

  // Create a new stake account
  const stakeAccount = createWallet();
  const { publicKey: stakeAccountPublicKey } = stakeAccount;
  const minimumRent = await connection.getMinimumBalanceForRentExemption(
    StakeProgram.space
  );
  const amountUserWantsToStake = 0.5 * LAMPORTS_PER_SOL;
  const amountToStake = minimumRent + amountUserWantsToStake;

  // Create the actual stake account
  const createStakeAccountTx = StakeProgram.createAccount({
    authorized: new Authorized(walletPublicKey, walletPublicKey),
    fromPubkey: walletPublicKey,
    lamports: amountToStake,
    lockup: new Lockup(0, 0, walletPublicKey),
    stakePubkey: stakeAccountPublicKey,
  });
  const createStakeAccountTxId = await sendAndConfirmTransaction(
    connection,
    createStakeAccountTx,
    [wallet, stakeAccount]
  );
  console.log(`Stake account created. Tx Id: ${createStakeAccountTxId}`);
  await getBalance(connection, stakeAccountPublicKey);

  // Check the stake account status. Expected: inactive
  await getStakeAccountStatus(connection, stakeAccountPublicKey);

  return { wallet, stakeAccount };
};

/**
 * @typedef {Object} KeysWithValidatorKey
 * @property {Keypair} wallet - The wallet
 * @property {Keypair} stakeAccount - The stake account
 * @property {PublicKey} selectedValidatorPublicKey - The public key of the validator
 */

/**
 * Delegate SOL to the stake account.
 * @param {Connection} connection Established RPC JSON connection.
 * @returns {Promise<KeysWithValidatorKey>} An object containing the wallet, stake account and the chosen validator's public key.
 */
const delegateStake = async (connection) => {
  if (!connection) {
    connection = establishConnection();
  }

  // Create Stake Account
  const createStakeAccountResult = await createStakeAccount(connection);
  const { wallet, stakeAccount } = createStakeAccountResult;
  const { publicKey: walletPublicKey } = wallet;
  const { publicKey: stakeAccountPublicKey } = stakeAccount;

  // Retrieve the listsof validators
  const validators = await connection.getVoteAccounts();

  // Get the first validator (randomly)
  const selectedValidator = validators.current[0];
  const selectedValidatorPublicKey = new PublicKey(
    selectedValidator.votePubkey
  );

  // Delegate to the chosen validator
  const delegateTx = StakeProgram.delegate({
    stakePubkey: stakeAccountPublicKey,
    authorizedPubkey: walletPublicKey,
    votePubkey: selectedValidatorPublicKey,
  });

  // Send and confirm the delegation transaction
  const delegateTxId = await sendAndConfirmTransaction(connection, delegateTx, [
    wallet,
  ]);

  console.log(
    `Stake account delegated to: ${selectedValidatorPublicKey}. Tx Id:${delegateTxId}`
  );
  getStakeAccountStatus(connection, stakeAccountPublicKey);
  return { ...createStakeAccountResult, selectedValidatorPublicKey };
};

/**
 * Deactivate the stake.
 * @param {Connection} connection Established RPC JSON connection.
 * @returns {Promise<KeysWithValidatorKey>} An object containing the wallet, stake account and the chosen validator's public key.
 */
const deactivateStake = async (connection) => {
  if (!connection) {
    connection = establishConnection();
  }

  // Delegate to stake account
  const delegateStakeResult = await delegateStake(connection);
  const { wallet, stakeAccount } = delegateStakeResult;
  const { publicKey: walletPublicKey } = wallet;
  const { publicKey: stakeAccountPublicKey } = stakeAccount;

  // Create the deactivation transaction
  const deactivateTx = StakeProgram.deactivate({
    stakePubkey: stakeAccountPublicKey,
    authorizedPubkey: walletPublicKey,
  });

  // Send and confirm the deactivation transaction
  const deactivateTxId = await sendAndConfirmTransaction(
    connection,
    deactivateTx,
    [wallet]
  );

  console.log(`Stake account deactivated. Tx Id:${deactivateTxId}`);
  await getStakeAccountStatus(connection, stakeAccountPublicKey);
  return delegateStakeResult;
};

/**
 * Withdraw all the SOL from the stake account.
 * @param {Connection} connection Established RPC JSON connection.
 * @returns {Promise<KeysWithValidatorKey>} An object containing the wallet, stake account and the chosen validator's public key.
 */
const withdrawStake = async (connection) => {
  if (!connection) {
    connection = establishConnection();
  }

  // Deactivate the stake
  const deactivateStakeResult = await deactivateStake(connection);
  const { wallet, stakeAccount } = deactivateStakeResult;
  const { publicKey: walletPublicKey } = wallet;
  const { publicKey: stakeAccountPublicKey } = stakeAccount;

  // Retrieve the current balance in the stake account
  const stakeBalance = await connection.getBalance(stakeAccountPublicKey);

  // Create the withdraw transaction. Withdraw everything from the stake account.
  const withdrawTx = StakeProgram.withdraw({
    stakePubkey: stakeAccountPublicKey,
    authorizedPubkey: walletPublicKey,
    toPubkey: walletPublicKey,
    lamports: stakeBalance,
  });

  // Send and confirm the withdrawal transaction
  const withdrawTxId = await sendAndConfirmTransaction(connection, withdrawTx, [
    wallet,
  ]);

  console.log(`Stake account balance withdrawn. Tx Id: ${withdrawTxId}`);
  await getBalance(connection, stakeAccountPublicKey);
  return deactivateStakeResult;
};

/**
 * Retrieves the information of the delegators by validator and log the first delegator.
 * @param {Connection} connection Established RPC JSON connection.
 * @param {string} validatorPublicKey Public Key of the validator.
 */
const getDelegatorsByValidator = async (connection, validatorPublicKey) => {
  if (!connection) {
    connection = establishConnection();
  }

  // Ref: https://docs.solana.com/developing/runtime-facilities/programs
  const STAKE_PROGRAM_ID = new PublicKey(
    "Stake11111111111111111111111111111111111111"
  );

  const VOTE_PUB_KEY = new PublicKey(validatorPublicKey);

  const accounts = await connection.getProgramAccounts(STAKE_PROGRAM_ID, {
    filters: [
      { dataSize: 200 },
      {
        memcmp: {
          offset: 124,
          bytes: VOTE_PUB_KEY,
        },
      },
    ],
  });

  console.log(
    `Total number of delegators found for ${VOTE_PUB_KEY} is ${accounts.length}`
  );

  if (accounts.length) {
    console.log(`Sample delegator: ${JSON.stringify(accounts[0], null, 2)}`);
  }
};

export {
  getValidators,
  createStakeAccount,
  delegateStake,
  deactivateStake,
  withdrawStake,
  getDelegatorsByValidator,
};

/**
 * Contains all the helper methods to be called in both main and core functions.
 */

import Cluster from "@solana/web3.js";
import Commitment from "@solana/web3.js";
import {
  Connection,
  clusterApiUrl,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
} from "@solana/web3.js";

/**
 * Establish a RPC connection.
 * @param {Cluster} cluster The cluster to connect to. Default to "devnet"
 * @param {Commitment} commitment The commitment level. Default to "processed"
 * @returns {Connection} A JSON RPC connection.
 */
const establishConnection = (cluster = "devnet", commitment = "processed") => {
  // Processed: retrieve the latest block that was confirmed by the node that we're connected to.
  const connection = new Connection(clusterApiUrl(cluster), commitment);
  return connection;
};

/**
 * Creates a new wallet.
 * @returns {Keypair} A new wallet.
 */
const createWallet = () => {
  const wallet = Keypair.generate();
  return wallet;
};

/**
 * Airdrop SOL to a wallet.
 * @param {Connection} connection Established JSON RPC Connection.
 * @param {PublicKey} walletPublicKey Public Key of the wallet to airdrop to.
 * @param {number} amount Amount to airdrop into the wallet in Solana.
 * @returns {string} The signature of the airdrop.
 */
const requestAirdrop = async (connection, walletPublicKey, amount = 1) => {
  const airdropSignature = await connection.requestAirdrop(
    walletPublicKey,
    amount * LAMPORTS_PER_SOL
  );
  return airdropSignature;
};

/**
 * Retrieve and log the balance of the wallet's balance.
 * @param {Connection} connection Established JSON RPC Connection.
 * @param {PublicKey} publicKey Public Key of the account to check the balance.
 */
const getBalance = async (connection, publicKey) => {
  const stakeBalance = await connection.getBalance(publicKey);
  console.log(`Account balance: ${stakeBalance / LAMPORTS_PER_SOL} SOL`);
};

/**
 * Retrieve and log out the stake account's status.
 * @param {Connection} connection Established JSON RPC Connection.
 * @param {PublicKey} stakeAccountPublicKey Public Key of the Stake Account to check on.
 */
const getStakeAccountStatus = async (connection, stakeAccountPublicKey) => {
  const stakeStatus = await connection.getStakeActivation(
    stakeAccountPublicKey
  );
  console.log(`Stake account status: ${stakeStatus.state}.`);
};

export {
  establishConnection,
  createWallet,
  requestAirdrop,
  getBalance,
  getStakeAccountStatus,
};

import {
  getValidators,
  withdrawStake,
  getDelegatorsByValidator,
} from "./functions/core.js";
import { establishConnection } from "./functions/utils.js";

const main = async () => {
  const connection = establishConnection();
  await getValidators(connection);
  const { selectedValidatorPublicKey } = await withdrawStake(connection);
  await getDelegatorsByValidator(connection, selectedValidatorPublicKey);
};

const runMain = async () => {
  try {
    await main();
  } catch (err) {
    console.error("Error Encountered: ", err);
  }
};

runMain();

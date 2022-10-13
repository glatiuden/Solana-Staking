import { getDelegatorsByValidator } from "../functions/core.js";
import { establishConnection } from "../functions/utils.js";

const main = async () => {
  const connection = establishConnection();
  await getDelegatorsByValidator(connection);
};

const runMain = async () => {
  try {
    await main();
  } catch (err) {
    console.error(err);
  }
};

runMain();

import { type TestLogger } from "@paperback/types";

import { Raw1001 } from "../Raw1001/main.js";
import sourceInfo from "../Raw1001/pbconfig.js";
import { TestSuite, registerDefaultTests } from "./suite.js";

export async function runTests(logger: TestLogger) {
  const suite = new TestSuite("Raw1001 tests", logger);
  registerDefaultTests(suite, Raw1001, sourceInfo);

  await suite.run();
}

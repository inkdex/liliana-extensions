import { type TestLogger } from "@paperback/types";

import { MangaKoma } from "../MangaKoma/main.js";
import sourceInfo from "../MangaKoma/pbconfig.js";
import { TestSuite, registerDefaultTests } from "./suite.js";

export async function runTests(logger: TestLogger) {
  const suite = new TestSuite("MangaKoma tests", logger);
  registerDefaultTests(suite, MangaKoma, sourceInfo);

  await suite.run();
}

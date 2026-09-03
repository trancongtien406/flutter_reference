import * as path from "node:path";
import Mocha from "mocha";
import { glob } from "glob";

export async function run(): Promise<void> {
  const mocha = new Mocha({ ui: "bdd", color: true, timeout: 120_000 });
  const root = path.resolve(__dirname);
  const files = await glob("**/*.test.js", { cwd: root });
  for (const file of files) mocha.addFile(path.resolve(root, file));
  await new Promise<void>((resolve, reject) => {
    mocha.run((failures) => (failures > 0 ? reject(new Error(`${failures} integration tests failed.`)) : resolve()));
  });
}

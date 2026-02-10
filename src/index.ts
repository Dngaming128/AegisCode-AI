import { Engine } from "./core/Engine";
import { loadConfig } from "./core/Config";

function main(): void {
  const config = loadConfig(process.argv.slice(2));
  const engine = new Engine(config);

  if (config.mode === "scan") {
    engine.runOnce().catch((err) => {
      console.error(err);
      process.exitCode = 1;
    });
    return;
  }

  if (config.mode === "ui") {
    engine.startUi().catch((err) => {
      console.error(err);
      process.exitCode = 1;
    });
    return;
  }

  console.error("Unknown mode.");
  process.exitCode = 1;
}

main();

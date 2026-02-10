"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Engine_1 = require("./core/Engine");
const Config_1 = require("./core/Config");
function main() {
    const config = (0, Config_1.loadConfig)(process.argv.slice(2));
    const engine = new Engine_1.Engine(config);
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

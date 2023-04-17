const { fork } = require("child_process");
fork("ultraviolet.js", [], { "detached": true, "stdio": "ignore" }).unref();
process.exit(0);
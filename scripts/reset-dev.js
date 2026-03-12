const { __internal } = require("../server.js");

__internal.resetRuntimeState();

console.log(JSON.stringify({
  reset: true,
  environment: process.env.APP_ENV || "development",
  port: Number(process.env.PORT || 4173),
  data_dir: process.env.DATA_DIR || "./data"
}, null, 2));

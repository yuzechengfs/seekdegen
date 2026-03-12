const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { handleRequest } = require("./server.js");
const deepseekApiKey = defineSecret("DEEPSEEK_API_KEY");

exports.web = onRequest(
  {
    region: "asia-southeast1",
    memory: "1GiB",
    timeoutSeconds: 60,
    cors: true,
    secrets: [deepseekApiKey]
  },
  (req, res) => {
    const host = req.get("host") || "localhost";
    const protocol = req.get("x-forwarded-proto") || "https";
    handleRequest(req, res, `${protocol}://${host}`);
  }
);

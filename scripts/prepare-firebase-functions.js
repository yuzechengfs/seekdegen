const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const TARGET = path.join(ROOT, "firebase-functions");
const MOCK_SOURCE = path.join(ROOT, "mock");
const MOCK_TARGET = path.join(TARGET, "mock");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeFile(relativePath, content) {
  const filePath = path.join(TARGET, relativePath);
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content);
}

ensureDir(TARGET);

fs.copyFileSync(path.join(ROOT, "server.js"), path.join(TARGET, "server.js"));
fs.rmSync(MOCK_TARGET, { recursive: true, force: true });
fs.cpSync(MOCK_SOURCE, MOCK_TARGET, { recursive: true });

writeFile("index.js", `
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
    handleRequest(req, res, \`\${protocol}://\${host}\`);
  }
);
`.trimStart());

writeFile("package.json", JSON.stringify({
  name: "heart-signal-functions",
  private: true,
  main: "index.js",
  engines: {
    node: "22"
  },
  dependencies: {
    "firebase-functions": "^6.0.1"
  }
}, null, 2) + "\n");

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { DatabaseSync } = require("node:sqlite");

const ROOT = __dirname;
loadEnvFiles(ROOT);

const APP_ENV = process.env.APP_ENV || "development";
const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || "0.0.0.0";
const IS_SERVERLESS = Boolean(
  process.env.FUNCTION_TARGET
  || process.env.K_SERVICE
  || process.env.FIREBASE_CONFIG
);
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(ROOT, process.env.DATA_DIR)
  : IS_SERVERLESS
    ? path.join("/tmp", "heartsignal-data")
    : path.join(ROOT, "data");
const STATE_FILE = path.join(DATA_DIR, "runtime-state.json");
const STATE_DB_FILE = process.env.STATE_DB_FILE
  ? path.resolve(ROOT, process.env.STATE_DB_FILE)
  : path.join(DATA_DIR, "runtime-state.db");
const STATE_ROW_KEY = "runtime";
const DEMO_USER_ID = process.env.DEMO_USER_ID || "u_demo_kai";
const DEEPSEEK_API_URL = process.env.DEEPSEEK_API_URL || "https://api.deepseek.com/chat/completions";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";
const ADMIN_USER_IDS = new Set(
  String(process.env.ADMIN_USER_IDS || DEMO_USER_ID)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
);
const DEFAULT_BOUNDARY_SETTINGS = {
  accept_same_city_only: false,
  allow_proactive_responses: true,
  show_city: true
};
const DEFAULT_USER_DATA = {
  user_id: DEMO_USER_ID,
  status: "has_chat",
  verification_status: "verified",
  onboarding_status: "eligible",
  profile: {
    nickname: "Kai",
    age: 24,
    city: "Manila",
    gender: "male",
    match_preference: "stable_relationship",
    avatar_url: "https://example.com/avatar/kai.png"
  }
};
const DEFAULT_CANDIDATE_STATS = {
  impression_count: 0,
  skip_count: 0,
  favorited: false,
  skipped: false,
  first_seen_at: null,
  last_seen_at: null,
  last_action: null,
  timeline: []
};
const DEFAULT_RELATION = {
  candidate_user_id: "",
  nickname: "",
  avatar_url: "",
  response_id: null,
  relation_id: null,
  story_room_id: null,
  thread_id: null,
  status: "responded_pending",
  answered_rounds: 0,
  total_questions: 0,
  current_question_index: 0,
  expires_at: null,
  question: null,
  messages: [],
  last_insight: null,
  incoming: false,
  response_message: "",
  response_created_at: null
};
const MODERATION_RULES = [
  {
    reason_code: "unsafe_contact",
    message: "内容触发了高风险导流词，当前无法发送。",
    keywords: ["wechat", "vx", "vx", "telegram", "tg", "line", "加我", "私聊", "外部聊"]
  },
  {
    reason_code: "sexual_content",
    message: "内容触发了高风险成人词，当前无法发送。",
    keywords: ["约炮", "裸聊", "成人视频", "开房", "包夜"]
  },
  {
    reason_code: "fraud_risk",
    message: "内容触发了转账或投资风险词，当前无法发送。",
    keywords: ["转账", "借钱", "投资", "博彩", "返利", "刷单"]
  }
];
const REPORT_REASON_OPTIONS = [
  { reason_code: "suspicious_behavior", label: "可疑行为" },
  { reason_code: "chat_abuse", label: "聊天骚扰" },
  { reason_code: "unsafe_contact", label: "导流风险" },
  { reason_code: "sexual_content", label: "成人内容" },
  { reason_code: "fraud_risk", label: "诈骗风险" },
  { reason_code: "other", label: "其他" }
];
const WALLET_CHALLENGE_TTL_MS = 10 * 60 * 1000;
const SOLANA_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
const AI_MATCH_TIMEOUT_MS = Number(process.env.AI_MATCH_TIMEOUT_MS || 15000);
const INTEREST_SIGNAL_OPTIONS = [
  {
    id: "layer1",
    label: "Layer 1 / Public Chains (Ethereum, Solana)",
    family: "infrastructure",
    family_label: "Infrastructure",
    tag: "Layer 1 watcher",
    aliases: ["公链币（Layer1）", "公链币", "Layer1", "Layer 1", "Ethereum", "Solana"]
  },
  {
    id: "exchange",
    label: "Exchange Tokens",
    family: "finance",
    family_label: "Market structure",
    tag: "Exchange flow",
    aliases: ["平台币 / 交易所币", "平台币", "交易所币"]
  },
  {
    id: "defi",
    label: "DeFi",
    family: "finance",
    family_label: "Market structure",
    tag: "DeFi strategist",
    aliases: ["DeFi 概念币", "DeFi"]
  },
  {
    id: "ai",
    label: "AI",
    family: "applications",
    family_label: "Onchain apps",
    tag: "AI narrative",
    aliases: ["AI 概念币", "AI"]
  },
  {
    id: "gamefi",
    label: "GameFi",
    family: "applications",
    family_label: "Onchain apps",
    tag: "GameFi explorer",
    aliases: ["GameFi / 链游币", "GameFi", "链游币"]
  },
  {
    id: "meme",
    label: "Meme",
    family: "culture",
    family_label: "Onchain culture",
    tag: "Meme radar",
    aliases: ["Meme 币（梗币）", "Meme 币", "梗币", "Meme"]
  },
  {
    id: "rwa",
    label: "RWA",
    family: "finance",
    family_label: "Market structure",
    tag: "RWA tracker",
    aliases: ["RWA 概念币（现实资产上链）", "RWA 概念币", "RWA"]
  },
  {
    id: "depin",
    label: "DePIN",
    family: "infrastructure",
    family_label: "Infrastructure",
    tag: "DePIN builder",
    aliases: ["Depin 概念币（去中心化基础设施）", "Depin 概念币", "DePIN", "Depin"]
  },
  {
    id: "layer2",
    label: "Layer 2",
    family: "infrastructure",
    family_label: "Infrastructure",
    tag: "Layer 2 scout",
    aliases: ["Layer2 概念币", "Layer2", "Layer 2"]
  },
  {
    id: "payments",
    label: "Payments / Finance",
    family: "finance",
    family_label: "Market structure",
    tag: "Payments watcher",
    aliases: ["支付 / 金融币", "支付币", "金融币"]
  },
  {
    id: "privacy",
    label: "Privacy",
    family: "privacy",
    family_label: "Privacy systems",
    tag: "Privacy focus",
    aliases: ["隐私币", "Privacy"]
  },
  {
    id: "storage",
    label: "Storage / Compute",
    family: "infrastructure",
    family_label: "Infrastructure",
    tag: "Storage & compute",
    aliases: ["存储 / 算力币", "存储币", "算力币"]
  },
  {
    id: "stablecoins",
    label: "Stablecoins",
    family: "finance",
    family_label: "Market structure",
    tag: "Stablecoin flow",
    aliases: ["稳定币", "Stablecoin", "Stablecoins"]
  },
  {
    id: "nft",
    label: "NFT",
    family: "culture",
    family_label: "Onchain culture",
    tag: "NFT collector",
    aliases: ["NFT 概念币", "NFT"]
  },
  {
    id: "socialfi",
    label: "SocialFi",
    family: "applications",
    family_label: "Onchain apps",
    tag: "SocialFi native",
    aliases: ["SocialFi / 社交币", "SocialFi", "社交币"]
  }
];

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".sql": "text/plain; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function loadEnvFiles(rootDir) {
  [".env", ".env.local"].forEach((filename) => {
    const filePath = path.join(rootDir, filename);
    if (!fs.existsSync(filePath)) {
      return;
    }

    const content = fs.readFileSync(filePath, "utf8");
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        return;
      }

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex <= 0) {
        return;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const rawValue = trimmed.slice(separatorIndex + 1).trim();
      const value = rawValue.replace(/^['"]|['"]$/g, "");
      if (!process.env[key]) {
        process.env[key] = value;
      }
    });
  });
}

function send(res, statusCode, body, contentType) {
  res.writeHead(statusCode, { "Content-Type": contentType });
  res.end(body);
}

function sendJson(res, statusCode, payload) {
  send(res, statusCode, JSON.stringify(payload, null, 2), "application/json; charset=utf-8");
}

function sendApiError(res, statusCode, message, data = {}, code = 1) {
  sendJson(res, statusCode, {
    code,
    message,
    data
  });
}

function readAccessToken(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) {
    return null;
  }
  return header.slice("Bearer ".length).trim() || null;
}

function getSessionByAccessToken(accessToken) {
  if (!accessToken) {
    return null;
  }
  const database = getStateDatabase();
  const row = database.prepare(`
    SELECT access_token, refresh_token, user_id, expires_at, last_seen_at
    FROM auth_sessions
    WHERE access_token = ?
  `).get(accessToken);

  if (!row) {
    return null;
  }

  if (new Date(row.expires_at).getTime() <= Date.now()) {
    database.prepare("DELETE FROM auth_sessions WHERE access_token = ?").run(accessToken);
    return null;
  }

  database.prepare(`
    UPDATE auth_sessions
    SET last_seen_at = ?
    WHERE access_token = ?
  `).run(new Date().toISOString(), accessToken);

  return row;
}

function getSessionByRefreshToken(refreshToken) {
  if (!refreshToken) {
    return null;
  }
  const database = getStateDatabase();
  const row = database.prepare(`
    SELECT access_token, refresh_token, user_id, expires_at, last_seen_at
    FROM auth_sessions
    WHERE refresh_token = ?
  `).get(refreshToken);

  if (!row) {
    return null;
  }

  if (new Date(row.expires_at).getTime() <= Date.now()) {
    database.prepare("DELETE FROM auth_sessions WHERE refresh_token = ?").run(refreshToken);
    return null;
  }

  return row;
}

function requireAuth(req, res) {
  const accessToken = readAccessToken(req);
  const session = getSessionByAccessToken(accessToken);
  if (!session) {
    sendApiError(res, 401, "unauthorized", {
      reason: "missing_or_invalid_session"
    });
    return null;
  }
  return session;
}

function requireAdmin(req, res) {
  const session = requireAuth(req, res);
  if (!session) {
    return null;
  }
  if (!ADMIN_USER_IDS.has(session.user_id)) {
    sendApiError(res, 403, "forbidden", {
      reason: "admin_required"
    });
    return null;
  }
  return session;
}

function buildSessionPayload(session) {
  if (!session) {
    return null;
  }
  const database = getStateDatabase();
  const walletAccount = database.prepare(`
    SELECT wallet_address, chain
    FROM wallet_accounts
    WHERE user_id = ?
    ORDER BY last_login_at DESC
    LIMIT 1
  `).get(session.user_id);
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    user_id: session.user_id,
    expires_at: session.expires_at,
    onboarding_status: getCurrentUser(session.user_id).onboarding_status,
    is_admin: ADMIN_USER_IDS.has(session.user_id),
    auth_method: walletAccount ? "wallet" : "seeker",
    wallet_address: walletAccount?.wallet_address || null,
    wallet_chain: walletAccount?.chain || null
  };
}

function normalizeWalletAddress(walletAddress) {
  return String(walletAddress || "").trim();
}

function normalizeGender(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["male", "man", "m", "boy"].includes(normalized)) {
    return "male";
  }
  if (["female", "woman", "f", "girl"].includes(normalized)) {
    return "female";
  }
  return "unknown";
}

function validateSolanaWalletAddress(walletAddress) {
  const normalized = normalizeWalletAddress(walletAddress);
  const publicKeyBytes = decodeBase58(normalized);
  if (publicKeyBytes.length !== 32) {
    throw new Error("invalid_solana_public_key_length");
  }
  return {
    wallet_address: normalized,
    public_key_bytes: publicKeyBytes
  };
}

function deriveWalletUserId(walletAddress) {
  return `u_wallet_${crypto.createHash("sha256").update(walletAddress).digest("hex").slice(0, 16)}`;
}

function buildWalletUserSeed(walletAddress) {
  const shortAddress = `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`;
  return {
    user_id: deriveWalletUserId(walletAddress),
    status: "new",
    verification_status: "wallet_verified",
    onboarding_status: "eligible",
    profile: {
      nickname: `Wallet ${shortAddress}`,
      age: 24,
      city: "Manila",
      gender: "unknown",
      match_preference: "stable_relationship",
      avatar_url: "https://example.com/avatar/wallet-user.png"
    }
  };
}

function createWalletAuthChallenge(walletAddress) {
  const database = getStateDatabase();
  const normalized = validateSolanaWalletAddress(walletAddress).wallet_address;
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + WALLET_CHALLENGE_TTL_MS).toISOString();
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const messageText = [
    "seekdegen Wallet Login",
    `Chain: solana`,
    `Wallet: ${normalized}`,
    `Nonce: ${nonce}`,
    `Issued At: ${createdAt}`,
    `Expires At: ${expiresAt}`
  ].join("\n");

  database.prepare(`
    INSERT INTO wallet_auth_challenges (
      wallet_address,
      chain,
      nonce,
      message_text,
      expires_at,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(wallet_address) DO UPDATE SET
      chain = excluded.chain,
      nonce = excluded.nonce,
      message_text = excluded.message_text,
      expires_at = excluded.expires_at,
      created_at = excluded.created_at
  `).run(
    normalized,
    "solana",
    nonce,
    messageText,
    expiresAt,
    createdAt
  );

  return {
    chain: "solana",
    wallet_address: normalized,
    nonce,
    message: messageText,
    expires_at: expiresAt
  };
}

function verifyWalletLogin({ walletAddress, signedMessage, signatureBase64 }) {
  const database = getStateDatabase();
  const { wallet_address: normalizedWalletAddress, public_key_bytes: publicKeyBytes } = validateSolanaWalletAddress(walletAddress);
  const challenge = database.prepare(`
    SELECT wallet_address, chain, nonce, message_text, expires_at, created_at
    FROM wallet_auth_challenges
    WHERE wallet_address = ?
  `).get(normalizedWalletAddress);

  if (!challenge) {
    return { error: "wallet_challenge_not_found" };
  }
  if (new Date(challenge.expires_at).getTime() <= Date.now()) {
    database.prepare("DELETE FROM wallet_auth_challenges WHERE wallet_address = ?").run(normalizedWalletAddress);
    return { error: "wallet_challenge_expired" };
  }
  if (String(signedMessage || "") !== challenge.message_text) {
    return { error: "wallet_message_mismatch" };
  }

  let signature = null;
  try {
    signature = Buffer.from(String(signatureBase64 || ""), "base64");
  } catch (_error) {
    return { error: "wallet_signature_invalid" };
  }
  if (!signature || signature.length === 0) {
    return { error: "wallet_signature_invalid" };
  }

  const verified = crypto.verify(
    null,
    Buffer.from(challenge.message_text, "utf8"),
    {
      key: Buffer.concat([SOLANA_SPKI_PREFIX, publicKeyBytes]),
      format: "der",
      type: "spki"
    },
    signature
  );

  if (!verified) {
    return { error: "wallet_signature_invalid" };
  }

  const walletAccount = database.prepare(`
    SELECT wallet_address, chain, user_id
    FROM wallet_accounts
    WHERE wallet_address = ?
  `).get(normalizedWalletAddress);

  const walletUser = walletAccount || {
    wallet_address: normalizedWalletAddress,
    chain: "solana",
    user_id: deriveWalletUserId(normalizedWalletAddress)
  };
  ensureCurrentUser(buildWalletUserSeed(normalizedWalletAddress), walletUser.user_id);

  const timestamp = new Date().toISOString();
  database.prepare(`
    INSERT INTO wallet_accounts (
      wallet_address,
      chain,
      user_id,
      created_at,
      last_login_at
    )
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(wallet_address) DO UPDATE SET
      chain = excluded.chain,
      user_id = excluded.user_id,
      last_login_at = excluded.last_login_at
  `).run(
    normalizedWalletAddress,
    "solana",
    walletUser.user_id,
    walletAccount?.created_at || timestamp,
    timestamp
  );

  database.prepare("DELETE FROM wallet_auth_challenges WHERE wallet_address = ?").run(normalizedWalletAddress);
  logAuditEvent("wallet_login_verified", {
    actorUserId: walletUser.user_id,
    entityType: "wallet_account",
    entityId: normalizedWalletAddress,
    payload: {
      chain: "solana"
    },
    createdAt: timestamp
  });

  return {
    session: createAuthSession(walletUser.user_id),
    wallet_address: normalizedWalletAddress,
    chain: "solana"
  };
}

function resolveRequestPath(urlPath) {
  if (urlPath === "/") {
    return path.join(ROOT, "app", "index.html");
  }

  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const normalized = path.normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  return path.join(ROOT, normalized);
}

function loadJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
}

function extractFirstJsonObject(value) {
  const text = String(value || "").trim();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (_error) {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      return null;
    }
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch (_nestedError) {
      return null;
    }
  }
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    if (typeof req.body === "string") {
      resolve(req.body);
      return;
    }

    if (req.body && typeof req.body === "object") {
      resolve(JSON.stringify(req.body));
      return;
    }

    if (req.rawBody) {
      resolve(Buffer.from(req.rawBody).toString("utf8"));
      return;
    }

    if (req.readableEnded) {
      resolve("");
      return;
    }

    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function decodeBase58(value) {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const base = BigInt(58);
  let bytes = [0];

  for (const character of String(value || "").trim()) {
    const index = alphabet.indexOf(character);
    if (index === -1) {
      throw new Error("invalid_base58_character");
    }

    let carry = BigInt(index);
    for (let i = 0; i < bytes.length; i += 1) {
      const next = BigInt(bytes[i]) * base + carry;
      bytes[i] = Number(next & BigInt(0xff));
      carry = next >> BigInt(8);
    }
    while (carry > 0) {
      bytes.push(Number(carry & BigInt(0xff)));
      carry >>= BigInt(8);
    }
  }

  let leadingZeroes = 0;
  for (const character of String(value || "")) {
    if (character !== "1") {
      break;
    }
    leadingZeroes += 1;
  }

  const result = Buffer.from(bytes.reverse());
  if (leadingZeroes === 0) {
    return result;
  }
  return Buffer.concat([Buffer.alloc(leadingZeroes), result]);
}

const baseData = {
  login: loadJson("mock/auth-seeker-login-kai.json"),
  me: loadJson("mock/me-kai.json"),
  personaQuestions: loadJson("mock/persona-questions.json"),
  personaResult: loadJson("mock/persona-answers-result.json"),
  signalTodayPending: loadJson("mock/signals-today-pending.json")
};

const STORY_QUESTION = {
  story_question_id: "sq_008",
  question_type: "single_choice",
  content: "面对一件小误会，你更偏向：",
  options: [
    { option_id: "A", option_text: "当下解释清楚" },
    { option_id: "B", option_text: "等情绪下去再说" },
    { option_id: "C", option_text: "看情况，不一定讲" }
  ]
};

const DYNAMIC_STORY_QUESTIONS = [
  {
    story_question_id: "sq_dyn_001",
    question_type: "single_choice",
    content: "刚认识时，你更喜欢哪种聊天节奏？",
    options: [
      { option_id: "A", option_text: "每天都聊一点" },
      { option_id: "B", option_text: "有内容的时候再聊" },
      { option_id: "C", option_text: "留一点距离感" }
    ]
  },
  {
    story_question_id: "sq_dyn_002",
    question_type: "single_choice",
    content: "第一次见面，你更在意什么？",
    options: [
      { option_id: "A", option_text: "对方是否守时" },
      { option_id: "B", option_text: "聊天是否自然" },
      { option_id: "C", option_text: "氛围是否放松" }
    ]
  },
  {
    story_question_id: "sq_dyn_003",
    question_type: "single_choice",
    content: "如果关系推进得有点快，你更可能？",
    options: [
      { option_id: "A", option_text: "直接表达节奏感" },
      { option_id: "B", option_text: "先观察再决定" },
      { option_id: "C", option_text: "顺其自然看看" }
    ]
  }
];

const DEFAULT_RUNTIME_STATE = {
  signalSubmitted: false,
  signalAnswerText: "",
  boundarySettings: { ...DEFAULT_BOUNDARY_SETTINGS },
  candidateStats: {},
  relations: {},
  counters: {
    response: 1,
    relation: 1,
    storyRoom: 1,
    thread: 1,
    message: 1
  }
};

function cloneDefaultState() {
  return JSON.parse(JSON.stringify(DEFAULT_RUNTIME_STATE));
}

function buildRuntimeState(persisted = {}) {
  return {
    ...cloneDefaultState(),
    ...persisted,
    relations: persisted.relations || {},
    counters: {
      ...cloneDefaultState().counters,
      ...(persisted.counters || {})
    }
  };
}

let stateDatabase = null;

function closeStateDatabase() {
  if (!stateDatabase) {
    return;
  }
  stateDatabase.close();
  stateDatabase = null;
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getStateDatabase() {
  if (stateDatabase) {
    return stateDatabase;
  }

  ensureDataDir();
  stateDatabase = new DatabaseSync(STATE_DB_FILE);
  stateDatabase.exec("PRAGMA journal_mode = WAL");
  stateDatabase.exec("PRAGMA busy_timeout = 5000");
  stateDatabase.exec(`
    CREATE TABLE IF NOT EXISTS reports (
      report_id TEXT PRIMARY KEY,
      reporter_user_id TEXT NOT NULL,
      target_user_id TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_id TEXT,
      reason_code TEXT NOT NULL,
      detail TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
  stateDatabase.exec(`
    CREATE TABLE IF NOT EXISTS audit_events (
      event_id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      actor_user_id TEXT NOT NULL,
      target_user_id TEXT,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    )
  `);
  stateDatabase.exec(`
    CREATE TABLE IF NOT EXISTS blocks (
      block_id TEXT PRIMARY KEY,
      blocker_user_id TEXT NOT NULL,
      target_user_id TEXT NOT NULL,
      reason_code TEXT,
      created_at TEXT NOT NULL
    )
  `);
  stateDatabase.exec(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      access_token TEXT PRIMARY KEY,
      refresh_token TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    )
  `);
  stateDatabase.exec(`
    CREATE TABLE IF NOT EXISTS wallet_accounts (
      wallet_address TEXT PRIMARY KEY,
      chain TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_login_at TEXT NOT NULL
    )
  `);
  stateDatabase.exec(`
    CREATE TABLE IF NOT EXISTS wallet_auth_challenges (
      wallet_address TEXT PRIMARY KEY,
      chain TEXT NOT NULL,
      nonce TEXT NOT NULL,
      message_text TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
  stateDatabase.exec(`
    CREATE TABLE IF NOT EXISTS ai_match_scores (
      pair_key TEXT PRIMARY KEY,
      input_hash TEXT NOT NULL,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      score INTEGER NOT NULL,
      label TEXT,
      reason TEXT,
      raw_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  stateDatabase.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      notification_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      actor_user_id TEXT,
      relation_id TEXT,
      response_id TEXT,
      story_room_id TEXT,
      thread_id TEXT,
      read_at TEXT,
      created_at TEXT NOT NULL
    )
  `);
  stateDatabase.exec(`
    CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      verification_status TEXT NOT NULL,
      onboarding_status TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  stateDatabase.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      user_id TEXT PRIMARY KEY,
      nickname TEXT NOT NULL,
      age INTEGER NOT NULL,
      city TEXT NOT NULL,
      gender TEXT NOT NULL,
      match_preference TEXT NOT NULL,
      avatar_url TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  stateDatabase.exec(`
    CREATE TABLE IF NOT EXISTS runtime_state (
      state_key TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  stateDatabase.exec(`
    CREATE TABLE IF NOT EXISTS boundary_settings (
      user_id TEXT PRIMARY KEY,
      accept_same_city_only INTEGER NOT NULL DEFAULT 0,
      allow_proactive_responses INTEGER NOT NULL DEFAULT 1,
      show_city INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    )
  `);
  stateDatabase.exec(`
    CREATE TABLE IF NOT EXISTS candidate_stats (
      candidate_user_id TEXT PRIMARY KEY,
      impression_count INTEGER NOT NULL DEFAULT 0,
      skip_count INTEGER NOT NULL DEFAULT 0,
      favorited INTEGER NOT NULL DEFAULT 0,
      skipped INTEGER NOT NULL DEFAULT 0,
      first_seen_at TEXT,
      last_seen_at TEXT,
      last_action TEXT,
      timeline_json TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL
    )
  `);
  stateDatabase.exec(`
    CREATE TABLE IF NOT EXISTS relations (
      candidate_user_id TEXT PRIMARY KEY,
      nickname TEXT NOT NULL,
      avatar_url TEXT NOT NULL,
      response_id TEXT,
      relation_id TEXT,
      story_room_id TEXT,
      thread_id TEXT,
      status TEXT NOT NULL,
      answered_rounds INTEGER NOT NULL DEFAULT 0,
      total_questions INTEGER NOT NULL DEFAULT 0,
      current_question_index INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT,
      question_json TEXT,
      last_insight_json TEXT,
      incoming INTEGER NOT NULL DEFAULT 0,
      response_message TEXT,
      response_created_at TEXT,
      updated_at TEXT NOT NULL
    )
  `);
  stateDatabase.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      message_id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL,
      relation_id TEXT,
      sender_user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
  return stateDatabase;
}

process.once("exit", closeStateDatabase);

function loadLegacyRuntimeState() {
  if (!fs.existsSync(STATE_FILE)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch (_error) {
    return null;
  }
}

function getScopedStorageKey(userId, key) {
  return `${userId}::${key}`;
}

function parseScopedStorageKey(userId, scopedKey) {
  const prefix = `${userId}::`;
  if (!String(scopedKey || "").startsWith(prefix)) {
    return null;
  }
  return String(scopedKey).slice(prefix.length);
}

function getRuntimeRowKey(userId = DEMO_USER_ID) {
  return getScopedStorageKey(userId, STATE_ROW_KEY);
}

function deleteScopedRows(tableName, keyColumn, userId) {
  const database = getStateDatabase();
  const rows = database.prepare(`SELECT ${keyColumn} FROM ${tableName}`).all();
  const statement = database.prepare(`DELETE FROM ${tableName} WHERE ${keyColumn} = ?`);
  rows.forEach((row) => {
    if (parseScopedStorageKey(userId, row[keyColumn])) {
      statement.run(row[keyColumn]);
    }
  });
}

function writeRuntimeState(state, userId = DEMO_USER_ID) {
  const database = getStateDatabase();
  const payload = {
    ...state
  };
  delete payload.boundarySettings;
  delete payload.candidateStats;
  delete payload.relations;
  database.prepare(`
    INSERT INTO runtime_state (state_key, payload, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(state_key) DO UPDATE SET
      payload = excluded.payload,
      updated_at = excluded.updated_at
  `).run(getRuntimeRowKey(userId), JSON.stringify(payload), new Date().toISOString());
}

function normalizeBoundarySettings(settings = {}) {
  return {
    ...DEFAULT_BOUNDARY_SETTINGS,
    ...settings,
    accept_same_city_only: Boolean(settings.accept_same_city_only),
    allow_proactive_responses:
      settings.allow_proactive_responses === undefined
        ? DEFAULT_BOUNDARY_SETTINGS.allow_proactive_responses
        : Boolean(settings.allow_proactive_responses),
    show_city:
      settings.show_city === undefined
        ? DEFAULT_BOUNDARY_SETTINGS.show_city
        : Boolean(settings.show_city)
  };
}

function normalizeUserData(user = {}) {
  const profile = user.profile || {};
  return {
    user_id: user.user_id || DEFAULT_USER_DATA.user_id,
    status: user.status || DEFAULT_USER_DATA.status,
    verification_status: user.verification_status || DEFAULT_USER_DATA.verification_status,
    onboarding_status: user.onboarding_status || DEFAULT_USER_DATA.onboarding_status,
    profile: {
      nickname: profile.nickname || DEFAULT_USER_DATA.profile.nickname,
      age: Number(profile.age || DEFAULT_USER_DATA.profile.age),
      city: profile.city || DEFAULT_USER_DATA.profile.city,
      gender: normalizeGender(profile.gender || DEFAULT_USER_DATA.profile.gender),
      match_preference: profile.match_preference || DEFAULT_USER_DATA.profile.match_preference,
      avatar_url: profile.avatar_url || DEFAULT_USER_DATA.profile.avatar_url
    }
  };
}

function readCurrentUser(userId = DEMO_USER_ID) {
  const database = getStateDatabase();
  const userRow = database.prepare(`
    SELECT user_id, status, verification_status, onboarding_status
    FROM users
    WHERE user_id = ?
  `).get(userId);
  const profileRow = database.prepare(`
    SELECT nickname, age, city, gender, match_preference, avatar_url
    FROM profiles
    WHERE user_id = ?
  `).get(userId);

  if (!userRow || !profileRow) {
    return null;
  }

  return normalizeUserData({
    user_id: userRow.user_id,
    status: userRow.status,
    verification_status: userRow.verification_status,
    onboarding_status: userRow.onboarding_status,
    profile: {
      nickname: profileRow.nickname,
      age: profileRow.age,
      city: profileRow.city,
      gender: profileRow.gender,
      match_preference: profileRow.match_preference,
      avatar_url: profileRow.avatar_url
    }
  });
}

function readAllUsers() {
  const database = getStateDatabase();
  const rows = database.prepare(`
    SELECT
      u.user_id,
      u.status,
      u.verification_status,
      u.onboarding_status,
      p.nickname,
      p.age,
      p.city,
      p.gender,
      p.match_preference,
      p.avatar_url
    FROM users u
    INNER JOIN profiles p ON p.user_id = u.user_id
    ORDER BY p.updated_at DESC, u.updated_at DESC
  `).all();

  return rows.map((row) => normalizeUserData({
    user_id: row.user_id,
    status: row.status,
    verification_status: row.verification_status,
    onboarding_status: row.onboarding_status,
    profile: {
      nickname: row.nickname,
      age: row.age,
      city: row.city,
      gender: row.gender,
      match_preference: row.match_preference,
      avatar_url: row.avatar_url
    }
  }));
}

function writeCurrentUser(user, userId = user?.user_id || DEMO_USER_ID) {
  const database = getStateDatabase();
  const normalized = normalizeUserData({
    ...user,
    user_id: userId
  });
  const timestamp = new Date().toISOString();

  database.prepare(`
    INSERT INTO users (
      user_id,
      status,
      verification_status,
      onboarding_status,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      status = excluded.status,
      verification_status = excluded.verification_status,
      onboarding_status = excluded.onboarding_status,
      updated_at = excluded.updated_at
  `).run(
    normalized.user_id,
    normalized.status,
    normalized.verification_status,
    normalized.onboarding_status,
    timestamp
  );

  database.prepare(`
    INSERT INTO profiles (
      user_id,
      nickname,
      age,
      city,
      gender,
      match_preference,
      avatar_url,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      nickname = excluded.nickname,
      age = excluded.age,
      city = excluded.city,
      gender = excluded.gender,
      match_preference = excluded.match_preference,
      avatar_url = excluded.avatar_url,
      updated_at = excluded.updated_at
  `).run(
    normalized.user_id,
    normalized.profile.nickname,
    normalized.profile.age,
    normalized.profile.city,
    normalized.profile.gender,
    normalized.profile.match_preference,
    normalized.profile.avatar_url,
    timestamp
  );

  return normalized;
}

function ensureCurrentUser(initialUser = baseData.me.data, userId = initialUser?.user_id || DEMO_USER_ID) {
  const existing = readCurrentUser(userId);
  if (existing) {
    return existing;
  }
  return writeCurrentUser(initialUser, userId);
}

function updateCurrentProfile(patch, userId = DEMO_USER_ID) {
  const currentUser = getCurrentUser(userId);
  const updated = writeCurrentUser({
    ...currentUser,
    profile: {
      ...currentUser.profile,
      ...patch,
      gender: patch.gender === undefined ? currentUser.profile.gender : normalizeGender(patch.gender)
    }
  }, userId);
  logAuditEvent("profile_updated", {
    actorUserId: userId,
    entityType: "profile",
    entityId: updated.user_id,
    payload: {
      nickname: updated.profile.nickname,
      city: updated.profile.city,
      gender: updated.profile.gender
    }
  });
  return updated;
}

function logAuditEvent(eventType, {
  actorUserId = DEMO_USER_ID,
  targetUserId = null,
  entityType = "system",
  entityId = null,
  payload = {},
  createdAt = new Date().toISOString()
} = {}) {
  const database = getStateDatabase();
  database.prepare(`
    INSERT INTO audit_events (
      event_id,
      event_type,
      actor_user_id,
      target_user_id,
      entity_type,
      entity_id,
      payload_json,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    `evt_${crypto.randomUUID()}`,
    eventType,
    actorUserId,
    targetUserId,
    entityType,
    entityId,
    JSON.stringify(payload || {}),
    createdAt
  );
}

function moderateTextContent(text) {
  const normalized = String(text || "").trim().toLowerCase();
  if (!normalized) {
    return {
      approved: true,
      moderation_status: "approved",
      reason_code: null,
      message: null
    };
  }

  const matchedRule = MODERATION_RULES.find((rule) => rule.keywords.some((keyword) => normalized.includes(keyword)));
  if (!matchedRule) {
    return {
      approved: true,
      moderation_status: "approved",
      reason_code: null,
      message: null
    };
  }

  return {
    approved: false,
    moderation_status: "rejected",
    reason_code: matchedRule.reason_code,
    message: matchedRule.message
  };
}

function getBlockedTargetIds(userId = DEMO_USER_ID) {
  return new Set();
}

function isBlockedTarget(targetUserId, userId = DEMO_USER_ID) {
  return getBlockedTargetIds(userId).has(targetUserId);
}

function isBlockedByTarget(targetUserId, userId = DEMO_USER_ID) {
  return getBlockedTargetIds(targetUserId).has(userId);
}

function getReportedTargetIds(userId = DEMO_USER_ID) {
  const database = getStateDatabase();
  const rows = database.prepare(`
    SELECT target_user_id
    FROM reports
    WHERE reporter_user_id = ? AND status IN ('pending', 'confirmed')
  `).all(userId);
  return new Set(rows.map((row) => row.target_user_id));
}

function isSuppressedTarget(targetUserId, userId = DEMO_USER_ID) {
  return getBlockedTargetIds(userId).has(targetUserId) || getReportedTargetIds(userId).has(targetUserId);
}

function isRelationSuppressedEitherDirection(targetUserId, userId = DEMO_USER_ID) {
  return isSuppressedTarget(targetUserId, userId) || isBlockedByTarget(targetUserId, userId);
}

function createReport({ targetUserId, sourceType = "candidate", sourceId = null, reasonCode = "other", detail = "" }, userId = DEMO_USER_ID) {
  const database = getStateDatabase();
  const reportId = `rpt_${crypto.randomUUID()}`;
  const createdAt = new Date().toISOString();

  database.prepare(`
    INSERT INTO reports (
      report_id,
      reporter_user_id,
      target_user_id,
      source_type,
      source_id,
      reason_code,
      detail,
      status,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    reportId,
    userId,
    targetUserId,
    sourceType,
    sourceId,
    reasonCode,
    detail,
    "pending",
    createdAt
  );

  const relation = getRelation(targetUserId, userId);
  if (relation) {
    relation.incoming = false;
  }
  logCandidateEvent(
    targetUserId,
    "report_submitted",
    "你提交了一次举报",
    "系统会暂时隐藏这位用户，并等待审核处理。",
    createdAt,
    userId
  );
  logAuditEvent("report_submitted", {
    actorUserId: userId,
    targetUserId,
    entityType: "report",
    entityId: reportId,
    payload: {
      source_type: sourceType,
      source_id: sourceId,
      reason_code: reasonCode
    },
    createdAt
  });
  persistRuntime(userId);

  return {
    report_id: reportId,
    target_user_id: targetUserId,
    status: "pending",
    reason_code: reasonCode
  };
}

function inferRelationStatusAfterSuppression(relation) {
  if (relation.thread_id) {
    return "chat_unlocked";
  }
  if (relation.story_room_id) {
    return "story_room_active";
  }
  if (relation.response_id) {
    return "responded_pending";
  }
  return "available";
}

function blockUser({ targetUserId, reasonCode = "boundary", sourceId = null }, userId = DEMO_USER_ID) {
  return {
    target_user_id: targetUserId,
    blocked: false,
    block_disabled: true
  };
}

function unblockUser(targetUserId, userId = DEMO_USER_ID) {
  return {
    target_user_id: targetUserId,
    blocked: false,
    block_disabled: true
  };
}

function getReportReasons() {
  return {
    items: REPORT_REASON_OPTIONS
  };
}

function getMyReports(userId = DEMO_USER_ID) {
  const database = getStateDatabase();
  const rows = database.prepare(`
    SELECT
      report_id,
      target_user_id,
      source_type,
      source_id,
      reason_code,
      detail,
      status,
      created_at
    FROM reports
    WHERE reporter_user_id = ?
    ORDER BY created_at DESC
  `).all(userId);

  return {
    items: rows.map((row) => ({
      ...row,
      target_nickname: getUserDisplayName(row.target_user_id)
        || getRelation(row.target_user_id, userId)?.nickname
        || row.target_user_id
    }))
  };
}

function getBlockedUsers(userId = DEMO_USER_ID) {
  return {
    items: []
  };
}

function getModerationQueue() {
  const database = getStateDatabase();
  const rows = database.prepare(`
    SELECT
      report_id,
      target_user_id,
      source_type,
      source_id,
      reason_code,
      detail,
      status,
      created_at
    FROM reports
    WHERE status = 'pending'
    ORDER BY created_at DESC
  `).all();

  return {
    items: rows.map((row) => ({
      ...row,
      target_nickname: getUserDisplayName(row.target_user_id)
        || getRelation(row.target_user_id)?.nickname
        || row.target_user_id
    }))
  };
}

function resolveReport(reportId, action = "dismiss", userId = DEMO_USER_ID) {
  const database = getStateDatabase();
  const report = database.prepare(`
    SELECT report_id, target_user_id, status
    FROM reports
    WHERE report_id = ?
  `).get(reportId);

  if (!report) {
    return null;
  }

  const nextStatus = action === "confirm" ? "confirmed" : "dismissed";
  database.prepare(`
    UPDATE reports
    SET status = ?
    WHERE report_id = ?
  `).run(nextStatus, reportId);

  const relation = getRelation(report.target_user_id, userId);
  if (action === "dismiss") {
    if (relation && !isBlockedTarget(report.target_user_id, userId)) {
      relation.status = inferRelationStatusAfterSuppression(relation);
      relation.incoming = relation.status === "responded_pending";
    }
  } else if (relation) {
    relation.incoming = false;
  }

  persistRuntime(userId);
  logAuditEvent("report_resolved", {
    actorUserId: userId,
    targetUserId: report.target_user_id,
    entityType: "report",
    entityId: reportId,
    payload: {
      action,
      status: nextStatus
    }
  });
  return {
    report_id: reportId,
    status: nextStatus,
    target_user_id: report.target_user_id
  };
}

function getAdminStats(userId = DEMO_USER_ID) {
  const database = getStateDatabase();
  const pendingReports = database.prepare("SELECT COUNT(*) AS count FROM reports WHERE status = 'pending'").get().count;
  const sessionCount = database.prepare("SELECT COUNT(*) AS count FROM auth_sessions").get().count;
  const storyRoomCount = Object.values(getRuntimeState(userId).relations).filter(
    (relation) => relation.status === "story_room_active" && isVisibleRelation(relation, userId)
  ).length;
  const unlockedChatCount = Object.values(getRuntimeState(userId).relations).filter(
    (relation) => relation.status === "chat_unlocked" && isVisibleRelation(relation, userId)
  ).length;
  const recommendationPool = getRecommendationsData("recommended", userId).items.length;

  return {
    pending_reports: pendingReports,
    blocked_users: 0,
    active_sessions: sessionCount,
    active_story_rooms: storyRoomCount,
    unlocked_chats: unlockedChatCount,
    visible_recommendations: recommendationPool
  };
}

function getAuditEvents(limit = 12) {
  const database = getStateDatabase();
  const rows = database.prepare(`
    SELECT
      event_id,
      event_type,
      actor_user_id,
      target_user_id,
      entity_type,
      entity_id,
      payload_json,
      created_at
    FROM audit_events
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit);

  return {
    items: rows.map((row) => ({
      ...row,
      payload: JSON.parse(row.payload_json || "{}")
    }))
  };
}

function createAuthSession(userId = DEMO_USER_ID) {
  const database = getStateDatabase();
  const accessToken = `jwt_${crypto.randomUUID()}`;
  const refreshToken = `refresh_${crypto.randomUUID()}`;
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  database.prepare(`
    INSERT INTO auth_sessions (
      access_token,
      refresh_token,
      user_id,
      created_at,
      expires_at,
      last_seen_at
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    accessToken,
    refreshToken,
    userId,
    createdAt,
    expiresAt,
    createdAt
  );
  logAuditEvent("login_created", {
    actorUserId: userId,
    entityType: "auth_session",
    entityId: accessToken,
    payload: {
      expires_at: expiresAt
    },
    createdAt
  });

  return buildSessionPayload({
    access_token: accessToken,
    refresh_token: refreshToken,
    user_id: userId,
    expires_at: expiresAt
  });
}

function refreshAuthSession(refreshToken) {
  const database = getStateDatabase();
  const existing = getSessionByRefreshToken(refreshToken);
  if (!existing) {
    return null;
  }

  const nextAccessToken = `jwt_${crypto.randomUUID()}`;
  const nextRefreshToken = `refresh_${crypto.randomUUID()}`;
  const nextExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const seenAt = new Date().toISOString();

  database.prepare(`
    UPDATE auth_sessions
    SET access_token = ?,
        refresh_token = ?,
        expires_at = ?,
        last_seen_at = ?
    WHERE access_token = ?
  `).run(
    nextAccessToken,
    nextRefreshToken,
    nextExpiresAt,
    seenAt,
    existing.access_token
  );

  logAuditEvent("session_refreshed", {
    actorUserId: existing.user_id,
    entityType: "auth_session",
    entityId: nextAccessToken,
    payload: {
      previous_access_token: existing.access_token,
      previous_refresh_token: existing.refresh_token,
      expires_at: nextExpiresAt
    },
    createdAt: seenAt
  });

  return buildSessionPayload({
    access_token: nextAccessToken,
    refresh_token: nextRefreshToken,
    user_id: existing.user_id,
    expires_at: nextExpiresAt
  });
}

function logoutAuthSession(session) {
  const accessToken = session?.access_token || null;
  if (!accessToken) {
    return { logged_out: false };
  }
  const database = getStateDatabase();
  database.prepare("DELETE FROM auth_sessions WHERE access_token = ?").run(accessToken);
  logAuditEvent("logout", {
    actorUserId: session?.user_id || DEMO_USER_ID,
    entityType: "auth_session",
    entityId: accessToken
  });
  return { logged_out: true };
}

function readBoundarySettings(userId = DEMO_USER_ID) {
  const database = getStateDatabase();
  const row = database.prepare(`
    SELECT
      accept_same_city_only,
      allow_proactive_responses,
      show_city
    FROM boundary_settings
    WHERE user_id = ?
  `).get(userId);
  if (!row) {
    return null;
  }
  return normalizeBoundarySettings({
    accept_same_city_only: row.accept_same_city_only,
    allow_proactive_responses: row.allow_proactive_responses,
    show_city: row.show_city
  });
}

function writeBoundarySettings(settings, userId = DEMO_USER_ID) {
  const database = getStateDatabase();
  const normalized = normalizeBoundarySettings(settings);
  database.prepare(`
    INSERT INTO boundary_settings (
      user_id,
      accept_same_city_only,
      allow_proactive_responses,
      show_city,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      accept_same_city_only = excluded.accept_same_city_only,
      allow_proactive_responses = excluded.allow_proactive_responses,
      show_city = excluded.show_city,
      updated_at = excluded.updated_at
  `).run(
    userId,
    normalized.accept_same_city_only ? 1 : 0,
    normalized.allow_proactive_responses ? 1 : 0,
    normalized.show_city ? 1 : 0,
    new Date().toISOString()
  );
  return normalized;
}

function ensureBoundarySettings(initialSettings = DEFAULT_BOUNDARY_SETTINGS, userId = DEMO_USER_ID) {
  const existing = readBoundarySettings(userId);
  if (existing) {
    return existing;
  }
  return writeBoundarySettings(initialSettings, userId);
}

function normalizeCandidateStats(stats = {}) {
  return {
    ...DEFAULT_CANDIDATE_STATS,
    ...stats,
    impression_count: Number(stats.impression_count || 0),
    skip_count: Number(stats.skip_count || 0),
    favorited: Boolean(stats.favorited),
    skipped: Boolean(stats.skipped),
    first_seen_at: stats.first_seen_at || null,
    last_seen_at: stats.last_seen_at || null,
    last_action: stats.last_action || null,
    timeline: Array.isArray(stats.timeline) ? stats.timeline.slice(0, 8) : []
  };
}

function readCandidateStatsSnapshot(userId = DEMO_USER_ID) {
  const database = getStateDatabase();
  const rows = database.prepare(`
    SELECT
      candidate_user_id,
      impression_count,
      skip_count,
      favorited,
      skipped,
      first_seen_at,
      last_seen_at,
      last_action,
      timeline_json
    FROM candidate_stats
  `).all();

  return rows.reduce((accumulator, row) => {
    const candidateId = parseScopedStorageKey(userId, row.candidate_user_id);
    if (!candidateId) {
      return accumulator;
    }
    accumulator[candidateId] = normalizeCandidateStats({
      impression_count: row.impression_count,
      skip_count: row.skip_count,
      favorited: row.favorited,
      skipped: row.skipped,
      first_seen_at: row.first_seen_at,
      last_seen_at: row.last_seen_at,
      last_action: row.last_action,
      timeline: JSON.parse(row.timeline_json || "[]")
    });
    return accumulator;
  }, {});
}

function writeCandidateStatsSnapshot(statsMap = {}, userId = DEMO_USER_ID) {
  const database = getStateDatabase();
  const entries = Object.entries(statsMap);
  const timestamp = new Date().toISOString();

  database.exec("BEGIN IMMEDIATE");
  try {
    deleteScopedRows("candidate_stats", "candidate_user_id", userId);
    const statement = database.prepare(`
      INSERT INTO candidate_stats (
        candidate_user_id,
        impression_count,
        skip_count,
        favorited,
        skipped,
        first_seen_at,
        last_seen_at,
        last_action,
        timeline_json,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    entries.forEach(([candidateId, stats]) => {
      const normalized = normalizeCandidateStats(stats);
      statement.run(
        getScopedStorageKey(userId, candidateId),
        normalized.impression_count,
        normalized.skip_count,
        normalized.favorited ? 1 : 0,
        normalized.skipped ? 1 : 0,
        normalized.first_seen_at,
        normalized.last_seen_at,
        normalized.last_action,
        JSON.stringify(normalized.timeline),
        timestamp
      );
    });
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }

  return entries.reduce((accumulator, [candidateId, stats]) => {
    accumulator[candidateId] = normalizeCandidateStats(stats);
    return accumulator;
  }, {});
}

function ensureCandidateStatsSnapshot(initialStats = {}, userId = DEMO_USER_ID) {
  const existing = readCandidateStatsSnapshot(userId);
  if (Object.keys(existing).length > 0) {
    return existing;
  }
  return writeCandidateStatsSnapshot(initialStats, userId);
}

function normalizeRelation(relation = {}) {
  return {
    ...DEFAULT_RELATION,
    ...relation,
    candidate_user_id: relation.candidate_user_id || "",
    nickname: relation.nickname || "",
    avatar_url: relation.avatar_url || "",
    response_id: relation.response_id || null,
    relation_id: relation.relation_id || null,
    story_room_id: relation.story_room_id || null,
    thread_id: relation.thread_id || null,
    status: relation.status || DEFAULT_RELATION.status,
    answered_rounds: Number(relation.answered_rounds || 0),
    total_questions: Number(relation.total_questions || 0),
    current_question_index: Number(relation.current_question_index || 0),
    expires_at: relation.expires_at || null,
    question: relation.question || null,
    messages: Array.isArray(relation.messages) ? relation.messages : [],
    last_insight: relation.last_insight || null,
    incoming: Boolean(relation.incoming),
    response_message: relation.response_message || "",
    response_created_at: relation.response_created_at || null
  };
}

function readRelationsSnapshot(userId = DEMO_USER_ID) {
  const database = getStateDatabase();
  const rows = database.prepare(`
    SELECT
      candidate_user_id,
      nickname,
      avatar_url,
      response_id,
      relation_id,
      story_room_id,
      thread_id,
      status,
      answered_rounds,
      total_questions,
      current_question_index,
      expires_at,
      question_json,
      last_insight_json,
      incoming,
      response_message,
      response_created_at
    FROM relations
  `).all();

  return rows.reduce((accumulator, row) => {
    const candidateId = parseScopedStorageKey(userId, row.candidate_user_id);
    if (!candidateId) {
      return accumulator;
    }
    accumulator[candidateId] = normalizeRelation({
      candidate_user_id: candidateId,
      nickname: row.nickname,
      avatar_url: row.avatar_url,
      response_id: row.response_id,
      relation_id: row.relation_id,
      story_room_id: row.story_room_id,
      thread_id: row.thread_id,
      status: row.status,
      answered_rounds: row.answered_rounds,
      total_questions: row.total_questions,
      current_question_index: row.current_question_index,
      expires_at: row.expires_at,
      question: row.question_json ? JSON.parse(row.question_json) : null,
      messages: [],
      last_insight: row.last_insight_json ? JSON.parse(row.last_insight_json) : null,
      incoming: row.incoming,
      response_message: row.response_message,
      response_created_at: row.response_created_at
    });
    return accumulator;
  }, {});
}

function writeRelationsSnapshot(relationsMap = {}, userId = DEMO_USER_ID) {
  const database = getStateDatabase();
  const entries = Object.entries(relationsMap);
  const timestamp = new Date().toISOString();

  database.exec("BEGIN IMMEDIATE");
  try {
    deleteScopedRows("relations", "candidate_user_id", userId);
    const statement = database.prepare(`
      INSERT INTO relations (
        candidate_user_id,
        nickname,
        avatar_url,
        response_id,
        relation_id,
        story_room_id,
        thread_id,
        status,
        answered_rounds,
        total_questions,
        current_question_index,
        expires_at,
        question_json,
        last_insight_json,
        incoming,
        response_message,
        response_created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    entries.forEach(([candidateId, relation]) => {
      const normalized = normalizeRelation(relation);
      statement.run(
        getScopedStorageKey(userId, candidateId),
        normalized.nickname,
        normalized.avatar_url,
        normalized.response_id,
        normalized.relation_id,
        normalized.story_room_id,
        normalized.thread_id,
        normalized.status,
        normalized.answered_rounds,
        normalized.total_questions,
        normalized.current_question_index,
        normalized.expires_at,
        normalized.question ? JSON.stringify(normalized.question) : null,
        normalized.last_insight ? JSON.stringify(normalized.last_insight) : null,
        normalized.incoming ? 1 : 0,
        normalized.response_message,
        normalized.response_created_at,
        timestamp
      );
    });
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }

  return entries.reduce((accumulator, [candidateId, relation]) => {
    accumulator[candidateId] = normalizeRelation(relation);
    return accumulator;
  }, {});
}

function ensureRelationsSnapshot(initialRelations = {}, userId = DEMO_USER_ID) {
  const existing = readRelationsSnapshot(userId);
  if (Object.keys(existing).length > 0) {
    return existing;
  }
  return writeRelationsSnapshot(initialRelations, userId);
}

function readMessagesSnapshot(userId = DEMO_USER_ID) {
  const database = getStateDatabase();
  const rows = database.prepare(`
    SELECT
      message_id,
      thread_id,
      relation_id,
      sender_user_id,
      content,
      created_at
    FROM messages
    ORDER BY created_at ASC
  `).all();

  return rows.reduce((accumulator, row) => {
    const threadId = parseScopedStorageKey(userId, row.thread_id);
    const messageId = parseScopedStorageKey(userId, row.message_id);
    if (!threadId || !messageId) {
      return accumulator;
    }
    if (!accumulator[threadId]) {
      accumulator[threadId] = [];
    }
    accumulator[threadId].push({
      message_id: messageId,
      thread_id: threadId,
      relation_id: row.relation_id,
      sender_user_id: row.sender_user_id,
      content: row.content,
      created_at: row.created_at
    });
    return accumulator;
  }, {});
}

function writeMessagesSnapshot(relationsMap = {}, userId = DEMO_USER_ID) {
  const database = getStateDatabase();
  const messages = Object.values(relationsMap).flatMap((relation) => {
    const normalized = normalizeRelation(relation);
    return normalized.messages.map((message) => ({
      message_id: getScopedStorageKey(userId, message.message_id),
      thread_id: getScopedStorageKey(userId, normalized.thread_id),
      relation_id: normalized.relation_id,
      sender_user_id: message.sender_user_id,
      content: message.content,
      created_at: message.created_at
    }));
  });

  database.exec("BEGIN IMMEDIATE");
  try {
    deleteScopedRows("messages", "message_id", userId);
    const statement = database.prepare(`
      INSERT INTO messages (
        message_id,
        thread_id,
        relation_id,
        sender_user_id,
        content,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    messages.forEach((message) => {
      statement.run(
        message.message_id,
        message.thread_id,
        message.relation_id,
        message.sender_user_id,
        message.content,
        message.created_at
      );
    });
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function loadRuntimeState(userId = DEMO_USER_ID) {
  try {
    const database = getStateDatabase();
    const row = database.prepare("SELECT payload FROM runtime_state WHERE state_key = ?").get(getRuntimeRowKey(userId));
    const legacyState = loadLegacyRuntimeState();
    ensureCurrentUser(baseData.me.data, userId);

    if (row?.payload) {
      const nextState = buildRuntimeState(JSON.parse(row.payload));
      nextState.boundarySettings = ensureBoundarySettings(
        legacyState?.boundarySettings || nextState.boundarySettings,
        userId
      );
      nextState.candidateStats = ensureCandidateStatsSnapshot(
        legacyState?.candidateStats || nextState.candidateStats,
        userId
      );
      nextState.relations = ensureRelationsSnapshot(
        legacyState?.relations || nextState.relations,
        userId
      );
      const messagesByThread = readMessagesSnapshot(userId);
      Object.values(nextState.relations).forEach((relation) => {
        relation.messages = relation.thread_id ? (messagesByThread[relation.thread_id] || []) : [];
      });
      return nextState;
    }

    const nextState = buildRuntimeState(legacyState || {});
    nextState.boundarySettings = ensureBoundarySettings(nextState.boundarySettings, userId);
    nextState.candidateStats = ensureCandidateStatsSnapshot(nextState.candidateStats, userId);
    nextState.relations = ensureRelationsSnapshot(nextState.relations, userId);
    writeMessagesSnapshot(nextState.relations, userId);
    writeRuntimeState(nextState, userId);
    return nextState;
  } catch (_error) {
    const fallback = cloneDefaultState();
    ensureCurrentUser(baseData.me.data, userId);
    fallback.boundarySettings = ensureBoundarySettings(fallback.boundarySettings, userId);
    fallback.candidateStats = ensureCandidateStatsSnapshot(fallback.candidateStats, userId);
    fallback.relations = ensureRelationsSnapshot(fallback.relations, userId);
    writeMessagesSnapshot(fallback.relations, userId);
    writeRuntimeState(fallback, userId);
    return fallback;
  }
}

const runtimeCache = new Map();

function getRuntimeState(userId = DEMO_USER_ID) {
  if (!runtimeCache.has(userId)) {
    runtimeCache.set(userId, loadRuntimeState(userId));
  }
  return runtimeCache.get(userId);
}

function persistRuntime(userId = DEMO_USER_ID) {
  const runtime = getRuntimeState(userId);
  writeRuntimeState(runtime, userId);
  writeCandidateStatsSnapshot(runtime.candidateStats, userId);
  writeRelationsSnapshot(runtime.relations, userId);
  writeMessagesSnapshot(runtime.relations, userId);
}

const runtime = getRuntimeState();

function getCurrentUser(userId = DEMO_USER_ID) {
  return readCurrentUser(userId) || ensureCurrentUser(baseData.me.data, userId);
}

function wrap(data) {
  return {
    code: 0,
    message: "ok",
    data
  };
}

function findInterestSignalOption(answer) {
  const normalized = String(answer || "").trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return INTEREST_SIGNAL_OPTIONS.find((option) => [option.label, ...(option.aliases || [])].some(
    (alias) => String(alias || "").trim().toLowerCase() === normalized
  )) || null;
}

function normalizeInterestSignalAnswer(answer) {
  return findInterestSignalOption(answer)?.label || "";
}

function derivePersonaTagsForUser(userId = DEMO_USER_ID) {
  const runtime = getRuntimeState(userId);
  const option = findInterestSignalOption(runtime.signalAnswerText);
  if (!option) {
    return ["Market explorer"];
  }

  return [...new Set([option.tag, option.family_label])].slice(0, 2);
}

function getUserPersonaTags(userId = DEMO_USER_ID) {
  return new Set(derivePersonaTagsForUser(userId));
}

function hasCompletedSignal(userId = DEMO_USER_ID) {
  const runtime = getRuntimeState(userId);
  return Boolean(runtime.signalSubmitted && String(runtime.signalAnswerText || "").trim());
}

function getStableCandidateBaseScore(candidateUserId) {
  const hash = crypto.createHash("sha1").update(String(candidateUserId || "")).digest("hex");
  return Number((0.86 + ((parseInt(hash.slice(0, 2), 16) % 10) * 0.01)).toFixed(2));
}

function buildCandidateFromUser(candidateUser, userId = DEMO_USER_ID) {
  const candidateRuntime = getRuntimeState(candidateUser.user_id);
  const signalPreview = String(candidateRuntime.signalAnswerText || "").trim();
  return {
    candidate_user_id: candidateUser.user_id,
    nickname: candidateUser.profile.nickname,
    age: candidateUser.profile.age,
    city: candidateUser.profile.city,
    avatar_url: candidateUser.profile.avatar_url,
    bio: signalPreview || "Wallet-verified member looking for people with similar crypto interests.",
    persona_tags: derivePersonaTagsForUser(candidateUser.user_id),
    recent_signal_preview: signalPreview || "Recently active on seekdegen.",
    base_score: getStableCandidateBaseScore(candidateUser.user_id),
    gender: normalizeGender(candidateUser.profile.gender),
    verification_status: candidateUser.verification_status,
    is_real_user: candidateUser.verification_status === "wallet_verified",
    same_viewer_city: candidateUser.profile.city === getCurrentUser(userId).profile.city
  };
}

function isCandidateProfileEligible(candidateUser, userId = DEMO_USER_ID) {
  if (!candidateUser || candidateUser.user_id === userId) {
    return false;
  }
  if (candidateUser.verification_status !== "wallet_verified") {
    return false;
  }

  const candidateGender = normalizeGender(candidateUser.profile.gender);
  if (candidateGender === "unknown") {
    return false;
  }
  if (!hasCompletedSignal(candidateUser.user_id)) {
    return false;
  }
  return true;
}

function getCandidatePool(userId = DEMO_USER_ID, { includeIneligible = false } = {}) {
  return readAllUsers()
    .filter((candidateUser) => {
      if (!candidateUser || candidateUser.user_id === userId) {
        return false;
      }
      if (candidateUser.verification_status !== "wallet_verified") {
        return false;
      }
      return includeIneligible ? true : isCandidateProfileEligible(candidateUser, userId);
    })
    .map((candidateUser) => buildCandidateFromUser(candidateUser, userId));
}

function getCandidate(candidateId, userId = DEMO_USER_ID, { includeIneligible = false } = {}) {
  return getCandidatePool(userId, { includeIneligible })
    .find((candidate) => candidate.candidate_user_id === candidateId) || null;
}

function getUserDisplayName(targetUserId) {
  return readCurrentUser(targetUserId)?.profile?.nickname || targetUserId;
}

function createNotification({
  userId,
  type,
  title,
  body,
  actorUserId = null,
  relationId = null,
  responseId = null,
  storyRoomId = null,
  threadId = null,
  createdAt = new Date().toISOString()
}) {
  const database = getStateDatabase();
  const notification = {
    notification_id: `ntf_${crypto.randomUUID()}`,
    user_id: userId,
    type,
    title,
    body,
    actor_user_id: actorUserId,
    relation_id: relationId,
    response_id: responseId,
    story_room_id: storyRoomId,
    thread_id: threadId,
    read_at: null,
    created_at: createdAt
  };

  database.prepare(`
    INSERT INTO notifications (
      notification_id,
      user_id,
      type,
      title,
      body,
      actor_user_id,
      relation_id,
      response_id,
      story_room_id,
      thread_id,
      read_at,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    notification.notification_id,
    notification.user_id,
    notification.type,
    notification.title,
    notification.body,
    notification.actor_user_id,
    notification.relation_id,
    notification.response_id,
    notification.story_room_id,
    notification.thread_id,
    notification.read_at,
    notification.created_at
  );

  return notification;
}

function getNotifications(userId = DEMO_USER_ID, limit = 20) {
  const database = getStateDatabase();
  const rows = database.prepare(`
    SELECT
      notification_id,
      user_id,
      type,
      title,
      body,
      actor_user_id,
      relation_id,
      response_id,
      story_room_id,
      thread_id,
      read_at,
      created_at
    FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(userId, limit);

  const unreadCount = database.prepare(`
    SELECT COUNT(*) AS count
    FROM notifications
    WHERE user_id = ? AND read_at IS NULL
  `).get(userId).count;

  return {
    unread_count: unreadCount,
    items: rows
  };
}

function markNotificationsRead(userId = DEMO_USER_ID, notificationIds = []) {
  const database = getStateDatabase();
  const ids = Array.isArray(notificationIds) ? notificationIds.filter(Boolean) : [];
  const readAt = new Date().toISOString();

  if (ids.length === 0) {
    database.prepare(`
      UPDATE notifications
      SET read_at = COALESCE(read_at, ?)
      WHERE user_id = ? AND read_at IS NULL
    `).run(readAt, userId);
  } else {
    const statement = database.prepare(`
      UPDATE notifications
      SET read_at = COALESCE(read_at, ?)
      WHERE user_id = ? AND notification_id = ?
    `);
    ids.forEach((id) => statement.run(readAt, userId, id));
  }

  return getNotifications(userId);
}

function buildAiPairKey(userId, candidateUserId) {
  return [String(userId || ""), String(candidateUserId || "")].sort().join("::");
}

function buildAiInputHash(userId, candidateUserId, viewerAnswer, candidateAnswer) {
  const [firstId, secondId] = [String(userId || ""), String(candidateUserId || "")].sort();
  const orderedAnswers = firstId === String(userId || "")
    ? [String(viewerAnswer || ""), String(candidateAnswer || "")]
    : [String(candidateAnswer || ""), String(viewerAnswer || "")];
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({
      pair_key: buildAiPairKey(userId, candidateUserId),
      answers: orderedAnswers
    }))
    .digest("hex");
}

function readCachedAiMatchInsight(userId, candidateUserId, viewerAnswer, candidateAnswer) {
  const database = getStateDatabase();
  const pairKey = buildAiPairKey(userId, candidateUserId);
  const inputHash = buildAiInputHash(userId, candidateUserId, viewerAnswer, candidateAnswer);
  const row = database.prepare(`
    SELECT pair_key, input_hash, provider, model, score, label, reason, raw_json, created_at, updated_at
    FROM ai_match_scores
    WHERE pair_key = ? AND input_hash = ?
  `).get(pairKey, inputHash);

  if (!row) {
    return null;
  }

  return {
    pair_key: row.pair_key,
    input_hash: row.input_hash,
    provider: row.provider,
    model: row.model,
    score: Number(row.score),
    label: row.label || null,
    reason: row.reason || null,
    raw: JSON.parse(row.raw_json || "{}"),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function writeCachedAiMatchInsight(userId, candidateUserId, viewerAnswer, candidateAnswer, insight) {
  const database = getStateDatabase();
  const timestamp = new Date().toISOString();
  const payload = {
    pair_key: buildAiPairKey(userId, candidateUserId),
    input_hash: buildAiInputHash(userId, candidateUserId, viewerAnswer, candidateAnswer),
    provider: insight.provider || "deepseek",
    model: insight.model || DEEPSEEK_MODEL,
    score: Math.max(0, Math.min(100, Math.round(Number(insight.score || 0)))),
    label: insight.label || null,
    reason: insight.reason || null,
    raw_json: JSON.stringify(insight.raw || {}),
    created_at: insight.created_at || timestamp,
    updated_at: timestamp
  };

  database.prepare(`
    INSERT INTO ai_match_scores (
      pair_key,
      input_hash,
      provider,
      model,
      score,
      label,
      reason,
      raw_json,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(pair_key) DO UPDATE SET
      input_hash = excluded.input_hash,
      provider = excluded.provider,
      model = excluded.model,
      score = excluded.score,
      label = excluded.label,
      reason = excluded.reason,
      raw_json = excluded.raw_json,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at
  `).run(
    payload.pair_key,
    payload.input_hash,
    payload.provider,
    payload.model,
    payload.score,
    payload.label,
    payload.reason,
    payload.raw_json,
    payload.created_at,
    payload.updated_at
  );

  return readCachedAiMatchInsight(userId, candidateUserId, viewerAnswer, candidateAnswer);
}

function buildFallbackAiMatchInsight(viewerAnswer, candidateAnswer) {
  const viewerOption = findInterestSignalOption(viewerAnswer);
  const candidateOption = findInterestSignalOption(candidateAnswer);

  if (!viewerOption || !candidateOption) {
    return {
      provider: "fallback",
      model: "local_heuristic",
      score: 60,
      label: "Broad fit",
      reason: "Different sectors can still lead to useful conversations.",
      raw: {
        exact_match: false,
        shared_family: false
      }
    };
  }

  const exactMatch = viewerOption.id === candidateOption.id;
  const sharedFamily = viewerOption.family === candidateOption.family;
  const score = exactMatch ? 92 : sharedFamily ? 78 : 62;
  return {
    provider: "fallback",
    model: "local_heuristic",
    score,
    label: exactMatch ? "Same sector" : sharedFamily ? "Adjacent sectors" : "Different sectors",
    reason: exactMatch
      ? "You are both focused on the same crypto sector right now."
      : sharedFamily
        ? "You track adjacent sectors, so the conversation should still flow."
        : "Different sectors can still create a useful exchange of views.",
    raw: {
      exact_match: exactMatch,
      shared_family: sharedFamily
    }
  };
}

async function requestDeepSeekLoveMatch(viewerAnswer, candidateAnswer) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_MATCH_TIMEOUT_MS);
  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          {
            role: "system",
            content: "You score crypto-interest compatibility. Evaluate only how aligned two users are based on the crypto sector each selected. Return strict JSON with keys: score (integer 0-100), label (short English label), reason (one short English sentence under 20 words)."
          },
          {
            role: "user",
            content: `Person A answer: ${viewerAnswer}\nPerson B answer: ${candidateAnswer}`
          }
        ],
        temperature: 0.2,
        max_tokens: 120
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`deepseek_http_${response.status}`);
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content || "";
    const parsed = extractFirstJsonObject(content);
    if (!parsed || Number.isNaN(Number(parsed.score))) {
      throw new Error("deepseek_invalid_payload");
    }

    return {
      provider: "deepseek",
      model: payload?.model || DEEPSEEK_MODEL,
      score: Math.max(0, Math.min(100, Math.round(Number(parsed.score)))),
      label: String(parsed.label || "AI Match").slice(0, 32),
      reason: String(parsed.reason || "").slice(0, 240),
      raw: parsed
    };
  } finally {
    clearTimeout(timer);
  }
}

async function getAiLoveMatchInsight(candidate, userId = DEMO_USER_ID) {
  const viewerAnswer = String(getRuntimeState(userId).signalAnswerText || "").trim();
  const candidateAnswer = String(candidate?.recent_signal_preview || "").trim();
  if (!viewerAnswer || !candidateAnswer) {
    return null;
  }

  const cached = readCachedAiMatchInsight(userId, candidate.candidate_user_id, viewerAnswer, candidateAnswer);
  if (cached) {
    return cached;
  }

  try {
    const remoteInsight = await requestDeepSeekLoveMatch(viewerAnswer, candidateAnswer);
    if (remoteInsight) {
      return writeCachedAiMatchInsight(userId, candidate.candidate_user_id, viewerAnswer, candidateAnswer, remoteInsight);
    }
  } catch (_error) {
    // Fall back to local heuristics when the remote provider is unavailable.
  }

  return writeCachedAiMatchInsight(
    userId,
    candidate.candidate_user_id,
    viewerAnswer,
    candidateAnswer,
    buildFallbackAiMatchInsight(viewerAnswer, candidateAnswer)
  );
}

function applyAiInsightToRecommendation(item, aiInsight) {
  if (!aiInsight) {
    return item;
  }

  const aiAdjustment = Number((((aiInsight.score - 50) / 100) * 0.16).toFixed(4));
  const nextScore = Number((item.score + aiAdjustment).toFixed(4));
  return {
    ...item,
    score: nextScore,
    ai_match: {
      score: aiInsight.score,
      label: aiInsight.label || "AI Match",
      reason: aiInsight.reason || "These sector choices suggest a strong overlap.",
      provider: aiInsight.provider,
      model: aiInsight.model
    },
    recommend_reason: aiInsight.reason || item.recommend_reason,
    score_breakdown: {
      ...item.score_breakdown,
      ai_score: aiInsight.score,
      ai_adjustment: aiAdjustment
    },
    match_label: item.interaction_state === "available"
      ? getMatchLabel(nextScore, item.interaction_state)
      : item.match_label
  };
}

async function getAiEnrichedRecommendationsData(tab = "recommended", userId = DEMO_USER_ID) {
  const data = getRecommendationsData(tab, userId);
  const enrichedItems = await Promise.all(
    data.items.map(async (item) => {
      const candidate = getCandidate(item.candidate_user_id, userId, { includeIneligible: true });
      if (!candidate) {
        return item;
      }
      const aiInsight = await getAiLoveMatchInsight(candidate, userId);
      return applyAiInsightToRecommendation(item, aiInsight);
    })
  );

  enrichedItems.sort((a, b) => {
    if (tab === "new") {
      return (a.timeline_count || 0) - (b.timeline_count || 0) || b.score - a.score;
    }
    if (tab === "review") {
      const aWeight = (a.favorited ? 3 : 0) + (a.timeline_count || 0);
      const bWeight = (b.favorited ? 3 : 0) + (b.timeline_count || 0);
      return bWeight - aWeight || b.score - a.score;
    }
    return b.score - a.score;
  });

  return {
    ...data,
    items: enrichedItems
  };
}

function getRelation(candidateId, userId = DEMO_USER_ID) {
  return getRuntimeState(userId).relations[candidateId] || null;
}

function isVisibleRelation(relation, userId = DEMO_USER_ID) {
  if (!relation) {
    return false;
  }
  if (relation.status === "blocked" || relation.status === "reported_pending") {
    return false;
  }
  if (isRelationSuppressedEitherDirection(relation.candidate_user_id, userId)) {
    return false;
  }
  return true;
}

function getCandidateStats(candidateId, userId = DEMO_USER_ID) {
  const runtime = getRuntimeState(userId);
  if (!runtime.candidateStats[candidateId]) {
    runtime.candidateStats[candidateId] = normalizeCandidateStats();
  }
  return runtime.candidateStats[candidateId];
}

function logCandidateEvent(candidateId, type, title, description, createdAt = new Date().toISOString(), userId = DEMO_USER_ID) {
  const stats = getCandidateStats(candidateId, userId);
  const duplicate = stats.timeline.find(
    (item) => item.type === type
      && item.title === title
      && item.description === description
  );
  if (duplicate) {
    duplicate.created_at = createdAt;
    return;
  }

  stats.timeline.unshift({
    type,
    title,
    description,
    created_at: createdAt
  });
  stats.timeline = stats.timeline.slice(0, 8);
}

function getBoundarySettings(userId = DEMO_USER_ID) {
  const runtime = getRuntimeState(userId);
  const boundarySettings = readBoundarySettings(userId) || ensureBoundarySettings(runtime.boundarySettings, userId);
  runtime.boundarySettings = boundarySettings;
  return boundarySettings;
}

function setBoundarySettings(patch, userId = DEMO_USER_ID) {
  const runtime = getRuntimeState(userId);
  runtime.boundarySettings = writeBoundarySettings({
    ...getBoundarySettings(userId),
    ...patch
  }, userId);
  logAuditEvent("boundary_updated", {
    actorUserId: userId,
    entityType: "boundary_settings",
    entityId: userId,
    payload: runtime.boundarySettings
  });
  return runtime.boundarySettings;
}

function getCandidateInteractionState(candidateId, userId = DEMO_USER_ID) {
  if (isSuppressedTarget(candidateId, userId)) {
    return "blocked";
  }
  const relation = getRelation(candidateId, userId);
  if (relation) {
    return relation.status;
  }

  const stats = getCandidateStats(candidateId, userId);
  if (stats.skipped) {
    return "skipped";
  }

  return "available";
}

function nextCounter(name, prefix, userId = DEMO_USER_ID) {
  const runtime = getRuntimeState(userId);
  const value = runtime.counters[name];
  runtime.counters[name] += 1;
  return `${prefix}_${String(value).padStart(3, "0")}`;
}

function getSharedTags(candidate, userId = DEMO_USER_ID) {
  const userTags = getUserPersonaTags(userId);
  return candidate.persona_tags.filter((tag) => userTags.has(tag));
}

function inferThemesFromText(text) {
  const option = findInterestSignalOption(text);
  if (!option) {
    return [];
  }

  return [
    { id: option.id, label: option.label },
    { id: option.family, label: option.family_label }
  ];
}

function getCandidateThemes(candidate) {
  const signalThemes = inferThemesFromText(candidate.recent_signal_preview);
  return signalThemes.filter(
    (theme, index, list) => list.findIndex((item) => item.id === theme.id) === index
  );
}

function getSignalDepthMultiplier(userId = DEMO_USER_ID) {
  const answer = (getRuntimeState(userId).signalAnswerText || "").trim();
  return findInterestSignalOption(answer) ? 1.1 : 1;
}

function isCandidateEligible(candidate, userId = DEMO_USER_ID) {
  if (!candidate?.is_real_user) {
    return false;
  }
  if (isRelationSuppressedEitherDirection(candidate.candidate_user_id, userId)) {
    return false;
  }
  if (candidate.gender === "unknown") {
    return false;
  }
  const boundary = getBoundarySettings(userId);
  if (boundary.accept_same_city_only) {
    const myCity = getCurrentUser(userId).profile.city;
    if (candidate.city !== myCity) {
      return false;
    }
  }
  if (!String(candidate.recent_signal_preview || "").trim()) {
    return false;
  }
  return true;
}

function getRelationStageAdjustment(relation) {
  if (!relation) {
    return 0;
  }

  switch (relation.status) {
    case "responded_pending":
      return -0.06;
    case "story_room_active":
      return 0.08;
    case "chat_unlocked":
      return 0.12;
    default:
      return 0;
  }
}

function buildRecommendationReason({ relation, sharedTags, sharedThemes }) {
  if (relation?.status === "chat_unlocked") {
    return "You already unlocked chat. Pick this conversation back up before browsing further.";
  }
  if (relation?.status === "story_room_active") {
    return "This match is already in Story Room. Finish it before opening more conversations.";
  }
  if (relation?.status === "responded_pending") {
    return "You already sent a response. Let them review it before pushing the same match again.";
  }
  if (sharedTags.length > 0 && sharedThemes.length > 0) {
    return `You both track ${sharedThemes.map((theme) => theme.label).join(", ")} and show a similar market style through ${sharedTags.join(", ")}.`;
  }
  if (sharedTags.length >= 2) {
    return `Your market style overlaps through ${sharedTags.join(", ")}.`;
  }
  if (sharedTags.length === 1) {
    return `You both show a similar style around ${sharedTags[0]}.`;
  }
  if (sharedThemes.length > 0) {
    return `You are both focused on ${sharedThemes.map((theme) => theme.label).join(", ")} right now.`;
  }
  return "Different sectors, but still worth exploring for a fresh point of view.";
}

function getMatchLabel(score, relationStatus) {
  if (relationStatus === "chat_unlocked") {
    return "已解锁";
  }
  if (relationStatus === "story_room_active") {
    return "进行中";
  }
  if (relationStatus === "responded_pending") {
    return "待回应";
  }
  if (relationStatus === "response_rejected") {
    return "已拒绝";
  }
  if (score >= 1.03) {
    return "高共振";
  }
  if (score >= 0.94) {
    return "稳定匹配";
  }
  return "可探索";
}

function getInteractionPriority(status) {
  switch (status) {
    case "chat_unlocked":
      return 4;
    case "story_room_active":
      return 3;
    case "responded_pending":
      return 2;
    case "response_rejected":
      return 1;
    case "available":
      return 1;
    case "skipped":
      return 0;
    default:
      return 0;
  }
}

function getNextActionAdvice(relationStatus) {
  switch (relationStatus) {
    case "chat_unlocked":
      return {
        title: "Continue the conversation",
        description: "You already unlocked chat. This is the best place to go deeper on shared interests."
      };
    case "story_room_active":
      return {
        title: "Finish Story Room first",
        description: "You are already in an active exchange. Finish it before opening more people."
      };
    case "responded_pending":
      return {
        title: "Wait for their reply",
        description: "Your response is already out. Give them space before revisiting this match."
      };
    case "response_rejected":
      return {
        title: "Try another match",
        description: "This response was not accepted. Refresh to find new real members with overlapping interests."
      };
    case "skipped":
      return {
        title: "Lower priority for now",
        description: "You already skipped this person once, so they will stay lower until something changes."
      };
    default:
      return {
        title: "Send a response",
        description: "If the sector overlap feels strong, now is the natural moment to start the conversation."
      };
  }
}

function buildCandidateDetailData(candidate, userId = DEMO_USER_ID) {
  const context = buildRecommendationContext(candidate, userId);
  const boundary = getBoundarySettings(userId);
  const detail = buildRecommendationItem(candidate, userId);
  const sameCity = candidate.city === getCurrentUser(userId).profile.city;
  const sharedThemeLabels = context.sharedThemes.map((theme) => theme.label);
  const explanationBullets = [
    context.sharedTags.length > 0
      ? `Interest style: ${context.sharedTags.join(", ")}`
      : "Interest style: still learning from profile and activity",
    sharedThemeLabels.length > 0
      ? `Sector overlap: ${sharedThemeLabels.join(", ")}`
      : "Sector overlap: no strong overlap yet",
    sameCity
      ? "Local context: same city, easier to meet or join events"
      : "Local context: different cities, so topical overlap matters more"
  ];

  if (context.stats.skip_count > 0) {
    explanationBullets.push(`History: you skipped this person ${context.stats.skip_count} time(s), so exposure is reduced.`);
  } else if (context.stats.impression_count > 1) {
    explanationBullets.push(`History: already shown ${context.stats.impression_count} time(s), so ranking is gradually reduced.`);
  }

  return {
    candidate_user_id: candidate.candidate_user_id,
    nickname: candidate.nickname,
    age: candidate.age,
    city: boundary.show_city ? candidate.city : "已隐藏",
    avatar_url: candidate.avatar_url,
    bio: candidate.bio,
    persona_tags: candidate.persona_tags.map((tagName, index) => ({
      tag_code: `tag_${index + 1}`,
      tag_name: tagName
    })),
    recent_signal_preview: candidate.recent_signal_preview,
    recent_signals: [
      {
        signal_answer_id: `sig_${candidate.candidate_user_id}`,
        title: "Current sector",
        answer_preview: candidate.recent_signal_preview
      }
    ],
    interaction_state: detail.interaction_state,
    match_label: detail.match_label,
    favorited: detail.favorited,
    recommend_reason: detail.recommend_reason,
    score_breakdown: detail.score_breakdown,
    shared_persona_tags: context.sharedTags,
    shared_signal_themes: sharedThemeLabels,
    recommendation_factors: explanationBullets,
    relationship_timeline: context.stats.timeline,
    next_action_advice: getNextActionAdvice(detail.interaction_state),
    boundary_summary: {
      same_city: sameCity,
      same_city_required: boundary.accept_same_city_only,
      accepts_proactive: boundary.allow_proactive_responses,
      city_visible: boundary.show_city
    },
    story_room_id: detail.story_room_id,
    thread_id: detail.thread_id,
    response_id: detail.response_id
  };
}

async function buildCandidateDetailDataAsync(candidate, userId = DEMO_USER_ID) {
  const detail = buildCandidateDetailData(candidate, userId);
  const aiInsight = await getAiLoveMatchInsight(candidate, userId);
  if (!aiInsight) {
    return detail;
  }

  return {
    ...detail,
    ai_match: {
      score: aiInsight.score,
      label: aiInsight.label || "AI Match",
      reason: aiInsight.reason || "These sector choices suggest a strong overlap.",
      provider: aiInsight.provider,
      model: aiInsight.model
    },
    recommend_reason: aiInsight.reason || detail.recommend_reason,
    recommendation_factors: [
      `Interest match: ${aiInsight.score}/100`,
      aiInsight.reason || "These sector choices suggest a strong overlap.",
      ...detail.recommendation_factors
    ],
    score_breakdown: {
      ...detail.score_breakdown,
      ai_score: aiInsight.score,
      ai_adjustment: Number((((aiInsight.score - 50) / 100) * 0.16).toFixed(4))
    }
  };
}

function buildRecommendationContext(candidate, userId = DEMO_USER_ID) {
  const sharedTags = getSharedTags(candidate, userId);
  const candidateThemes = getCandidateThemes(candidate);
  const userThemes = inferThemesFromText(getRuntimeState(userId).signalAnswerText);
  const sharedThemes = candidateThemes.filter((theme) => userThemes.some((item) => item.id === theme.id));
  const relation = getRelation(candidate.candidate_user_id, userId);
  const relationStatus = getCandidateInteractionState(candidate.candidate_user_id, userId);
  const stats = getCandidateStats(candidate.candidate_user_id, userId);
  const depthMultiplier = getSignalDepthMultiplier(userId);
  const tagScore = sharedTags.length * 0.025;
  const themeScore = sharedThemes.length * 0.018 * depthMultiplier;
  const stageScore = getRelationStageAdjustment(relation);
  const exposurePenalty = Math.min(stats.impression_count * 0.012, 0.06);
  const skipPenalty = Math.min(stats.skip_count * 0.05, 0.15);
  const score = Number((candidate.base_score + tagScore + themeScore + stageScore - exposurePenalty - skipPenalty).toFixed(4));
  return {
    sharedTags,
    sharedThemes,
    relation,
    relationStatus,
    stats,
    score,
    tagScore,
    themeScore,
    stageScore,
    exposurePenalty,
    skipPenalty
  };
}

function buildRecommendationItem(candidate, userId = DEMO_USER_ID) {
  const {
    sharedTags,
    sharedThemes,
    relation,
    relationStatus,
    stats,
    score,
    tagScore,
    themeScore,
    stageScore,
    exposurePenalty,
    skipPenalty
  } = buildRecommendationContext(candidate, userId);
  return {
    candidate_user_id: candidate.candidate_user_id,
    nickname: candidate.nickname,
    age: candidate.age,
    city: getBoundarySettings(userId).show_city ? candidate.city : "已隐藏",
    avatar_url: candidate.avatar_url,
    is_real_user: candidate.is_real_user,
    persona_tags: candidate.persona_tags,
    recent_signal_preview: candidate.recent_signal_preview,
    recommend_reason: buildRecommendationReason({
      relation,
      sharedTags,
      sharedThemes
    }),
    interaction_state: relationStatus,
    match_label: getMatchLabel(score, relationStatus),
    favorited: stats.favorited,
    last_action: stats.last_action,
    last_event_at: stats.timeline[0]?.created_at || stats.last_seen_at || stats.first_seen_at || null,
    interaction_priority: getInteractionPriority(relationStatus),
    timeline_count: stats.timeline.length,
    score_breakdown: {
      base_score: candidate.base_score,
      tag_score: Number(tagScore.toFixed(4)),
      signal_score: Number(themeScore.toFixed(4)),
      stage_score: Number(stageScore.toFixed(4)),
      exposure_penalty: Number((-exposurePenalty).toFixed(4)),
      skip_penalty: Number((-skipPenalty).toFixed(4))
    },
    story_room_id: relation?.story_room_id || null,
    thread_id: relation?.thread_id || null,
    response_id: relation?.response_id || null,
    score
  };
}

function getRecommendationsData(tab = "recommended", userId = DEMO_USER_ID) {
  const runtime = getRuntimeState(userId);
  if (!runtime.signalSubmitted) {
    return { tab, page: 1, page_size: 10, total: 0, items: [] };
  }

  const currentUser = getCurrentUser(userId);
  const items = getCandidatePool(userId)
    .filter((candidate) => isCandidateEligible(candidate, userId))
    .map((candidate) => ({
      candidate,
      context: buildRecommendationContext(candidate, userId)
    }))
    .filter(({ context }) => !context.relation || isVisibleRelation(context.relation, userId))
    .filter(({ candidate, context }) => {
      switch (tab) {
        case "same_signal":
          return context.sharedThemes.length > 0 || context.sharedTags.length > 0;
        case "same_city":
          return candidate.city === currentUser.profile.city;
        case "new":
          return !context.relation && context.stats.impression_count <= 1;
        case "review":
          return context.stats.favorited || context.stats.timeline.length > 0 || context.stats.skipped;
        default:
          return true;
      }
    })
    .sort((a, b) => {
      if (tab === "new") {
        return a.context.stats.impression_count - b.context.stats.impression_count || b.context.score - a.context.score;
      }
      if (tab === "same_city") {
        return b.context.score - a.context.score;
      }
      if (tab === "same_signal") {
        return b.context.sharedThemes.length - a.context.sharedThemes.length || b.context.score - a.context.score;
      }
      if (tab === "review") {
        const aWeight = (a.context.stats.favorited ? 3 : 0) + a.context.stats.timeline.length;
        const bWeight = (b.context.stats.favorited ? 3 : 0) + b.context.stats.timeline.length;
        return bWeight - aWeight || b.context.score - a.context.score;
      }
      return b.context.score - a.context.score;
    })
    .map(({ candidate }) => buildRecommendationItem(candidate, userId));

  return {
    tab,
    page: 1,
    page_size: 10,
    total: items.length,
    items
  };
}

function getPreviewUsers(userId = DEMO_USER_ID) {
  return getRecommendationsData("recommended", userId).items.slice(0, 2).map((item) => ({
    candidate_user_id: item.candidate_user_id,
    nickname: item.nickname,
    persona_tags: item.persona_tags,
    recommend_reason: item.recommend_reason
  }));
}

function getActiveStoryRelation(userId = DEMO_USER_ID) {
  return Object.values(getRuntimeState(userId).relations).find(
    (relation) => relation.status === "story_room_active" && isVisibleRelation(relation, userId)
  ) || null;
}

function getCompletedStoryRelations(userId = DEMO_USER_ID) {
  return Object.values(getRuntimeState(userId).relations).filter(
    (relation) => relation.status === "chat_unlocked" && isVisibleRelation(relation, userId)
  );
}

function pickStoryQuestion(seed) {
  return DYNAMIC_STORY_QUESTIONS[seed % DYNAMIC_STORY_QUESTIONS.length];
}

function buildStoryActivation(relation, userId = DEMO_USER_ID) {
  const runtime = getRuntimeState(userId);
  const questionSeed = runtime.counters.storyRoom - 1;
  relation.story_room_id = nextCounter("storyRoom", "sr_live", userId);
  relation.status = "story_room_active";
  relation.answered_rounds = 1;
  relation.total_questions = 3;
  relation.current_question_index = 2;
  relation.expires_at = "2026-03-12T18:00:00Z";
  relation.question = pickStoryQuestion(questionSeed);
  relation.incoming = false;
  return relation;
}

function getMirroredRelation(ownerUserId, candidateUserId) {
  return getRuntimeState(candidateUserId).relations[ownerUserId] || null;
}

function syncMirroredStoryActivation(relation, userId = DEMO_USER_ID) {
  const mirroredRelation = getMirroredRelation(userId, relation.candidate_user_id);
  if (!mirroredRelation) {
    return null;
  }

  mirroredRelation.status = relation.status;
  mirroredRelation.story_room_id = relation.story_room_id;
  mirroredRelation.answered_rounds = relation.answered_rounds;
  mirroredRelation.total_questions = relation.total_questions;
  mirroredRelation.current_question_index = relation.current_question_index;
  mirroredRelation.expires_at = relation.expires_at;
  mirroredRelation.question = relation.question;
  mirroredRelation.incoming = false;
  mirroredRelation.response_message = relation.response_message;
  mirroredRelation.response_created_at = relation.response_created_at;
  persistRuntime(relation.candidate_user_id);
  return mirroredRelation;
}

function syncMirroredChatUnlock(relation, userId = DEMO_USER_ID) {
  const mirroredRelation = getMirroredRelation(userId, relation.candidate_user_id);
  if (!mirroredRelation) {
    return null;
  }

  mirroredRelation.thread_id = relation.thread_id;
  mirroredRelation.status = relation.status;
  mirroredRelation.answered_rounds = relation.answered_rounds;
  mirroredRelation.current_question_index = relation.current_question_index;
  mirroredRelation.last_insight = relation.last_insight;
  mirroredRelation.messages = relation.messages.map((message) => ({ ...message }));
  persistRuntime(relation.candidate_user_id);
  return mirroredRelation;
}

function createMessageId() {
  return `cm_${crypto.randomUUID()}`;
}

function resetRuntimeState(userId = null) {
  if (userId) {
    const nextState = cloneDefaultState();
    const database = getStateDatabase();
    database.prepare("DELETE FROM reports WHERE reporter_user_id = ?").run(userId);
    database.prepare("DELETE FROM blocks WHERE blocker_user_id = ?").run(userId);
    database.prepare("DELETE FROM auth_sessions WHERE user_id = ?").run(userId);
    database.prepare("DELETE FROM wallet_accounts WHERE user_id = ?").run(userId);
    database.prepare("DELETE FROM runtime_state WHERE state_key = ?").run(getRuntimeRowKey(userId));
    database.prepare("DELETE FROM boundary_settings WHERE user_id = ?").run(userId);
    database.prepare("DELETE FROM wallet_auth_challenges").run();
    deleteScopedRows("candidate_stats", "candidate_user_id", userId);
    deleteScopedRows("relations", "candidate_user_id", userId);
    deleteScopedRows("messages", "message_id", userId);
    const targetRuntime = userId === DEMO_USER_ID ? runtime : nextState;
    if (userId === DEMO_USER_ID) {
      Object.keys(targetRuntime).forEach((key) => delete targetRuntime[key]);
      Object.assign(targetRuntime, nextState);
    }
    runtimeCache.set(userId, targetRuntime);
    nextState.boundarySettings = writeBoundarySettings(nextState.boundarySettings, userId);
    persistRuntime(userId);
    return targetRuntime;
  }
  const nextState = cloneDefaultState();
  const database = getStateDatabase();
  database.prepare("DELETE FROM reports").run();
  database.prepare("DELETE FROM blocks").run();
  database.prepare("DELETE FROM auth_sessions").run();
  database.prepare("DELETE FROM wallet_accounts").run();
  database.prepare("DELETE FROM wallet_auth_challenges").run();
  database.prepare("DELETE FROM audit_events").run();
  database.prepare("DELETE FROM runtime_state").run();
  database.prepare("DELETE FROM boundary_settings").run();
  database.prepare("DELETE FROM candidate_stats").run();
  database.prepare("DELETE FROM relations").run();
  database.prepare("DELETE FROM messages").run();
  runtimeCache.clear();
  Object.keys(runtime).forEach((key) => delete runtime[key]);
  Object.assign(runtime, nextState);
  runtimeCache.set(DEMO_USER_ID, runtime);
  runtime.boundarySettings = writeBoundarySettings(nextState.boundarySettings, DEMO_USER_ID);
  persistRuntime(DEMO_USER_ID);
  return runtime;
}

function createRelation(candidate, message, userId = DEMO_USER_ID) {
  const runtime = getRuntimeState(userId);
  const existing = getRelation(candidate.candidate_user_id, userId);
  if (existing) {
    return existing;
  }
  const stats = getCandidateStats(candidate.candidate_user_id, userId);
  const createdAt = new Date().toISOString();
  const currentUser = getCurrentUser(userId);

  const relation = {
    candidate_user_id: candidate.candidate_user_id,
    nickname: candidate.nickname,
    avatar_url: candidate.avatar_url,
    response_id: nextCounter("response", "resp_live", userId),
    relation_id: nextCounter("relation", "rel_live", userId),
    story_room_id: null,
    thread_id: null,
    status: "responded_pending",
    answered_rounds: 0,
    total_questions: 0,
    current_question_index: 0,
    expires_at: null,
    question: null,
    messages: [],
    last_insight: null,
    incoming: false,
    response_message: message || "We seem to follow similar sectors. Want to compare notes?",
    response_created_at: createdAt
  };

  runtime.relations[candidate.candidate_user_id] = relation;
  const candidateRuntime = getRuntimeState(candidate.candidate_user_id);
  if (!candidateRuntime.relations[userId]) {
    candidateRuntime.relations[userId] = normalizeRelation({
      candidate_user_id: userId,
      nickname: currentUser.profile.nickname,
      avatar_url: currentUser.profile.avatar_url,
      response_id: relation.response_id,
      relation_id: relation.relation_id,
      status: "responded_pending",
      incoming: true,
      response_message: relation.response_message,
      response_created_at: createdAt
    });
  }
  createNotification({
    userId: candidate.candidate_user_id,
    type: "response_received",
    title: `${currentUser.profile.nickname} sent you a response`,
    body: relation.response_message,
    actorUserId: userId,
    relationId: relation.relation_id,
    responseId: relation.response_id,
    createdAt
  });
  stats.skipped = false;
  stats.last_action = "responded";
  logCandidateEvent(
    candidate.candidate_user_id,
    "response_sent",
    "你发出了一次回应",
    relation.response_message,
    createdAt,
    userId
  );
  logAuditEvent("response_created", {
    actorUserId: userId,
    targetUserId: candidate.candidate_user_id,
    entityType: "relation",
    entityId: relation.relation_id,
    payload: {
      status: relation.status,
      response_id: relation.response_id
    },
    createdAt
  });
  persistRuntime(userId);
  persistRuntime(candidate.candidate_user_id);
  return relation;
}

function activatePendingRelation(relation, userId = DEMO_USER_ID) {
  if (!relation || relation.status !== "responded_pending") {
    return relation;
  }

  buildStoryActivation(relation, userId);
  logCandidateEvent(
    relation.candidate_user_id,
    "story_room_active",
    "对方接受了你的回应",
    "这段关系已经进入剧情房，可以开始双人互动。",
    new Date().toISOString(),
    userId
  );
  logAuditEvent("story_room_activated", {
    actorUserId: userId,
    targetUserId: relation.candidate_user_id,
    entityType: "story_room",
    entityId: relation.story_room_id,
    payload: {
      relation_id: relation.relation_id
    }
  });
  persistRuntime(userId);
  syncMirroredStoryActivation(relation, userId);
  createNotification({
    userId: relation.candidate_user_id,
    type: "response_accepted",
    title: `${relation.nickname} accepted your response`,
    body: "You can now continue in the Story Room.",
    actorUserId: userId,
    relationId: relation.relation_id,
    responseId: relation.response_id,
    storyRoomId: relation.story_room_id
  });
  return relation;
}

function rejectPendingRelation(relation, userId = DEMO_USER_ID) {
  if (!relation || relation.status !== "responded_pending") {
    return relation;
  }

  relation.status = "response_rejected";
  relation.incoming = false;
  logCandidateEvent(
    relation.candidate_user_id,
    "response_rejected",
    "You declined this response",
    "This response is closed and will no longer wait in your inbox.",
    new Date().toISOString(),
    userId
  );
  persistRuntime(userId);

  const mirroredRelation = getMirroredRelation(userId, relation.candidate_user_id);
  if (mirroredRelation) {
    mirroredRelation.status = "response_rejected";
    mirroredRelation.incoming = false;
    persistRuntime(relation.candidate_user_id);
  }

  createNotification({
    userId: relation.candidate_user_id,
    type: "response_rejected",
    title: `${relation.nickname} declined your response`,
    body: "This connection was not accepted.",
    actorUserId: userId,
    relationId: relation.relation_id,
    responseId: relation.response_id
  });

  return relation;
}

function ensureChatUnlocked(relation, userId = DEMO_USER_ID) {
  if (relation.thread_id) {
    return relation;
  }

  relation.thread_id = nextCounter("thread", "ct_live", userId);
  relation.status = "chat_unlocked";
  relation.answered_rounds = 3;
  relation.current_question_index = 3;
  relation.last_insight = {
    question_index: 3,
    total_questions: 3,
    room_status: "completed",
    insight: "你们都更偏向沟通，只是时机感不同。",
    chat_unlocked: true,
    chat_thread_id: relation.thread_id
  };
  relation.messages = [
    {
      message_id: createMessageId(),
      sender_user_id: relation.candidate_user_id,
      content: "你在剧情房里选“等情绪下去再说”，这点我其实能理解。",
      created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString()
    },
    {
      message_id: createMessageId(),
      sender_user_id: userId,
      content: "我不是想逃避，只是更想在情绪稳定时把话说清楚。",
      created_at: new Date(Date.now() - 8 * 60 * 1000).toISOString()
    }
  ];
  logCandidateEvent(
    relation.candidate_user_id,
    "chat_unlocked",
    "聊天已解锁",
    "你们已经完成剧情房，接下来可以进入真实聊天。",
    new Date().toISOString(),
    userId
  );
  logAuditEvent("chat_unlocked", {
    actorUserId: userId,
    targetUserId: relation.candidate_user_id,
    entityType: "chat_thread",
    entityId: relation.thread_id,
    payload: {
      relation_id: relation.relation_id
    }
  });
  persistRuntime(userId);
  syncMirroredChatUnlock(relation, userId);
  createNotification({
    userId: relation.candidate_user_id,
    type: "story_room_completed",
    title: `${relation.nickname} completed the Story Room`,
    body: "Your chat is now unlocked. Open Messages to continue together.",
    actorUserId: userId,
    relationId: relation.relation_id,
    storyRoomId: relation.story_room_id,
    threadId: relation.thread_id
  });
  return relation;
}

function appendChatMessage(relation, content, senderUserId = DEMO_USER_ID, userId = DEMO_USER_ID) {
  if (!relation?.thread_id) {
    return null;
  }

  const message = {
    message_id: createMessageId(),
    thread_id: relation.thread_id,
    relation_id: relation.relation_id,
    sender_user_id: senderUserId,
    content: content || "",
    created_at: new Date().toISOString()
  };
  relation.messages.push(message);
  const mirroredRelation = getMirroredRelation(userId, relation.candidate_user_id);
  if (mirroredRelation?.thread_id === relation.thread_id) {
    mirroredRelation.messages.push({ ...message });
  }
  createNotification({
    userId: relation.candidate_user_id,
    type: "chat_message_received",
    title: `${getUserDisplayName(senderUserId)} sent a new message`,
    body: content || "Open Messages to reply.",
    actorUserId: senderUserId,
    relationId: relation.relation_id,
    threadId: relation.thread_id
  });
  logAuditEvent("chat_message_sent", {
    actorUserId: senderUserId,
    targetUserId: relation.candidate_user_id,
    entityType: "message",
    entityId: message.message_id,
    payload: {
      thread_id: relation.thread_id
    },
    createdAt: message.created_at
  });
  persistRuntime(userId);
  if (mirroredRelation?.thread_id === relation.thread_id) {
    persistRuntime(relation.candidate_user_id);
  }
  return message;
}

function registerRecommendationExposure(items, userId = DEMO_USER_ID) {
  items.forEach((item) => {
    const stats = getCandidateStats(item.candidate_user_id, userId);
    const now = new Date().toISOString();
    if (!stats.first_seen_at) {
      stats.first_seen_at = now;
      logCandidateEvent(
        item.candidate_user_id,
        "first_seen",
        "第一次进入你的候选池",
        "系统首次把这位候选人展示给你。",
        now,
        userId
      );
    }
    stats.last_seen_at = now;
    stats.impression_count += 1;
    if (!stats.last_action) {
      stats.last_action = "impression";
    }
  });
  persistRuntime(userId);
}

function skipCandidate(candidateId, userId = DEMO_USER_ID) {
  const candidate = getCandidate(candidateId, userId);
  if (!candidate) {
    return null;
  }

  const stats = getCandidateStats(candidateId, userId);
  stats.skip_count += 1;
  stats.skipped = true;
  stats.last_action = "skipped";
  logCandidateEvent(
    candidateId,
    "skipped",
    "你跳过了这位候选人",
    `已累计跳过 ${stats.skip_count} 次，系统会降低后续曝光。`,
    new Date().toISOString(),
    userId
  );
  persistRuntime(userId);
  return {
    candidate_user_id: candidateId,
    interaction_state: "skipped",
    skip_count: stats.skip_count
  };
}

function favoriteCandidate(candidateId, userId = DEMO_USER_ID) {
  const candidate = getCandidate(candidateId, userId);
  if (!candidate) {
    return null;
  }

  const stats = getCandidateStats(candidateId, userId);
  stats.favorited = true;
  stats.last_action = "favorited";
  logCandidateEvent(
    candidateId,
    "favorited",
    "你收藏了这位候选人",
    "系统会保留这段兴趣记录，方便你之后回看。",
    new Date().toISOString(),
    userId
  );
  persistRuntime(userId);
  return {
    candidate_user_id: candidateId,
    favorited: true
  };
}

function unfavoriteCandidate(candidateId, userId = DEMO_USER_ID) {
  const candidate = getCandidate(candidateId, userId);
  if (!candidate) {
    return null;
  }

  const stats = getCandidateStats(candidateId, userId);
  stats.favorited = false;
  stats.last_action = "unfavorited";
  logCandidateEvent(
    candidateId,
    "unfavorited",
    "你取消了收藏",
    "这位候选人仍会保留互动记录，但不再被视作重点回看对象。",
    new Date().toISOString(),
    userId
  );
  persistRuntime(userId);
  return {
    candidate_user_id: candidateId,
    favorited: false
  };
}

function restoreCandidate(candidateId, userId = DEMO_USER_ID) {
  const candidate = getCandidate(candidateId, userId, { includeIneligible: true });
  if (!candidate) {
    return null;
  }

  const stats = getCandidateStats(candidateId, userId);
  stats.skipped = false;
  stats.skip_count = 0;
  stats.last_action = "restored";
  logCandidateEvent(
    candidateId,
    "restored",
    "你把这位候选人放回推荐",
    "这位候选人已经重新回到推荐流，可以再次考虑是否推进。",
    new Date().toISOString(),
    userId
  );
  persistRuntime(userId);
  return {
    candidate_user_id: candidateId,
    interaction_state: getCandidateInteractionState(candidateId, userId),
    restored: true
  };
}

function getSignalsToday(userId = DEMO_USER_ID) {
  const runtime = getRuntimeState(userId);
  if (!runtime.signalSubmitted) {
    return {
      submitted: false,
      main_task: {
        signal_task_id: "st_007",
        signal_type: "interest",
        title: "Which crypto sector are you into most right now?",
        prompt_text: "Choose the crypto sector you follow most closely right now.",
        answer_text: ""
      }
    };
  }

  return {
    submitted: true,
    submitted_at: new Date().toISOString(),
    main_task: {
      signal_task_id: "st_007",
      signal_type: "interest",
      title: "Which crypto sector are you into most right now?",
      prompt_text: "Choose the crypto sector you follow most closely right now.",
      answer_text: runtime.signalAnswerText
    }
  };
}

function getHome(userId = DEMO_USER_ID) {
  const runtime = getRuntimeState(userId);
  const recommendations = getRecommendationsData("recommended", userId);
  const activeStory = getActiveStoryRelation(userId);
  const unlockedChats = getCompletedStoryRelations(userId);
  const incomingResponses = getIncomingResponses(userId);
  return {
    today_signal: {
      submitted: runtime.signalSubmitted,
      title: "Which crypto sector are you into most right now?",
      answer_preview: runtime.signalSubmitted ? runtime.signalAnswerText : ""
    },
    recommendation_summary: {
      unlocked: runtime.signalSubmitted,
      count: recommendations.total,
      preview_users: runtime.signalSubmitted ? getPreviewUsers(userId) : []
    },
    story_room_summary: activeStory
      ? {
          count: 1,
          items: [
            {
              story_room_id: activeStory.story_room_id,
              nickname: activeStory.nickname,
              progress_text: `${activeStory.answered_rounds} / ${activeStory.total_questions}`,
              expires_in_hours: 32
            }
          ]
        }
      : { count: 0, items: [] },
    incoming_response_count: incomingResponses.items.length,
    unread_message_count: unlockedChats.length
  };
}

function getStoryRooms(userId = DEMO_USER_ID) {
  const activeRelations = Object.values(getRuntimeState(userId).relations).filter(
    (relation) => relation.status === "story_room_active" && isVisibleRelation(relation, userId)
  );
  const completedRelations = Object.values(getRuntimeState(userId).relations).filter(
    (relation) => relation.status === "chat_unlocked" && isVisibleRelation(relation, userId)
  );
  return {
    active_rooms: activeRelations.map((relation) => ({
      story_room_id: relation.story_room_id,
      relation_id: relation.relation_id,
      nickname: relation.nickname,
      avatar_url: relation.avatar_url,
      room_status: "active",
      answered_rounds: relation.answered_rounds,
      total_questions: relation.total_questions,
      expires_at: relation.expires_at
    })),
    completed_rooms: completedRelations.map((relation) => ({
      story_room_id: relation.story_room_id,
      relation_id: relation.relation_id,
      nickname: relation.nickname,
      room_status: "completed",
      chat_unlocked: true
    }))
  };
}

function getStoryRoomDetail(storyRoomId, userId = DEMO_USER_ID) {
  const relation = Object.values(getRuntimeState(userId).relations).find(
    (item) => item.story_room_id === storyRoomId && isVisibleRelation(item, userId)
  )
    || getActiveStoryRelation(userId)
    || getCompletedStoryRelations(userId)[0]
    || null;

  if (!relation) {
    return null;
  }

  if (relation.status === "chat_unlocked") {
    return {
      story_room_id: relation.story_room_id,
      relation_id: relation.relation_id,
      room_status: "completed",
      answered_rounds: 3,
      total_questions: 3,
      current_question_index: 3,
      expires_at: relation.expires_at,
      peer: {
        user_id: relation.candidate_user_id,
        nickname: relation.nickname,
        avatar_url: relation.avatar_url
      },
      current_question: null,
      my_answer_submitted: true,
      peer_answer_submitted: true
    };
  }

  return {
    story_room_id: relation.story_room_id,
    relation_id: relation.relation_id,
    room_status: "active",
    answered_rounds: relation.answered_rounds,
    total_questions: 3,
    current_question_index: relation.current_question_index,
    expires_at: relation.expires_at,
    peer: {
      user_id: relation.candidate_user_id,
      nickname: relation.nickname,
      avatar_url: relation.avatar_url
    },
    current_question: relation.question || STORY_QUESTION,
    my_answer_submitted: false,
    peer_answer_submitted: true
  };
}

function getChats(userId = DEMO_USER_ID) {
  return {
    items: getCompletedStoryRelations(userId).map((relation) => {
      const lastMessage = relation.messages[relation.messages.length - 1];
      return {
        thread_id: relation.thread_id,
        relation_id: relation.relation_id,
        peer: {
          user_id: relation.candidate_user_id,
          nickname: relation.nickname,
          avatar_url: relation.avatar_url
        },
        last_message: lastMessage || {
          content: "聊天已解锁，可以开始第一句真实对话。",
          created_at: new Date().toISOString(),
          sender_user_id: relation.candidate_user_id
        },
        unread_count: 1
      };
    })
  };
}

function getChatThread(threadId, userId = DEMO_USER_ID) {
  const relation = Object.values(getRuntimeState(userId).relations).find(
    (item) => item.thread_id === threadId && isVisibleRelation(item, userId)
  ) || null;
  if (!relation) {
    return null;
  }
  return {
    thread_id: relation.thread_id,
    relation_id: relation.relation_id,
    peer: {
      user_id: relation.candidate_user_id,
      nickname: relation.nickname,
      avatar_url: relation.avatar_url
    },
    messages: relation.messages
  };
}

function getIncomingResponses(userId = DEMO_USER_ID) {
  const boundary = getBoundarySettings(userId);
  if (!boundary.allow_proactive_responses) {
    return { items: [] };
  }

  return {
    items: Object.values(getRuntimeState(userId).relations)
      .filter((relation) => relation.incoming && isVisibleRelation(relation, userId))
      .map((relation) => ({
        response_id: relation.response_id,
        relation_id: relation.relation_id,
        from_user_id: relation.candidate_user_id,
        nickname: relation.nickname,
        avatar_url: relation.avatar_url,
        message: relation.response_message,
        source_signal_preview: getCandidate(relation.candidate_user_id, userId, { includeIneligible: true })?.recent_signal_preview || "",
        created_at: relation.response_created_at
      }))
  };
}

function handleApi(req, res, url) {
  const pathname = url.pathname;
  const method = req.method || "GET";

  if (method === "POST" && pathname === "/api/v1/auth/seeker-login") {
    sendApiError(res, 410, "seeker_login_disabled", {
      reason: "wallet_only_auth"
    });
    return true;
  }
  if (method === "POST" && pathname === "/api/v1/auth/wallet/challenge") {
    readRequestBody(req).then((bodyText) => {
      const body = bodyText ? JSON.parse(bodyText) : {};
      if (!body.wallet_address) {
        sendApiError(res, 400, "missing_wallet_address");
        return;
      }
      try {
        sendJson(res, 200, wrap(createWalletAuthChallenge(body.wallet_address)));
      } catch (error) {
        sendApiError(res, 400, "invalid_wallet_address", { detail: error.message });
      }
    }).catch((error) => {
      sendApiError(res, 500, "wallet_challenge_failed", { detail: error.message });
    });
    return true;
  }
  if (method === "POST" && pathname === "/api/v1/auth/wallet/verify") {
    readRequestBody(req).then((bodyText) => {
      const body = bodyText ? JSON.parse(bodyText) : {};
      if (!body.wallet_address || !body.signed_message || !body.signature_base64) {
        sendApiError(res, 400, "missing_wallet_signature_payload");
        return;
      }
      let result = null;
      try {
        result = verifyWalletLogin({
          walletAddress: body.wallet_address,
          signedMessage: body.signed_message,
          signatureBase64: body.signature_base64
        });
      } catch (error) {
        sendApiError(res, 400, "wallet_verify_failed", { detail: error.message });
        return;
      }
      if (result?.error) {
        sendApiError(res, 401, result.error);
        return;
      }
      sendJson(res, 200, wrap({
        ...result.session,
        wallet_address: result.wallet_address,
        wallet_chain: result.chain
      }));
    }).catch((error) => {
      sendApiError(res, 500, "wallet_verify_failed", { detail: error.message });
    });
    return true;
  }
  if (method === "POST" && pathname === "/api/v1/auth/refresh") {
    readRequestBody(req).then((bodyText) => {
      const body = bodyText ? JSON.parse(bodyText) : {};
      const session = refreshAuthSession(body.refresh_token);
      if (!session) {
        sendApiError(res, 401, "invalid_refresh_token", {
          reason: "refresh_token_expired_or_missing"
        });
        return;
      }
      sendJson(res, 200, wrap(session));
    }).catch((error) => {
      sendApiError(res, 500, "refresh_failed", { detail: error.message });
    });
    return true;
  }
  if (method === "POST" && pathname === "/api/v1/dev/reset") {
    resetRuntimeState();
    sendJson(res, 200, wrap({
      reset: true,
      state_store: path.relative(ROOT, STATE_DB_FILE),
      legacy_state_file: fs.existsSync(STATE_FILE) ? path.relative(ROOT, STATE_FILE) : null
    }));
    return true;
  }
  if (method === "POST" && pathname === "/api/v1/auth/logout") {
    const session = requireAuth(req, res);
    if (!session) {
      return true;
    }
    sendJson(res, 200, wrap(logoutAuthSession(session)));
    return true;
  }

  const session = pathname.startsWith("/api/v1/admin/")
    ? requireAdmin(req, res)
    : requireAuth(req, res);
  if (!session) {
    return true;
  }
  const userId = session.user_id;

  if (method === "GET" && pathname === "/api/v1/me") {
    sendJson(res, 200, wrap(getCurrentUser(userId)));
    return true;
  }
  if (method === "GET" && pathname === "/api/v1/auth/session") {
    sendJson(res, 200, wrap(buildSessionPayload(session)));
    return true;
  }
  if (method === "GET" && pathname === "/api/v1/admin/stats") {
    sendJson(res, 200, wrap(getAdminStats(userId)));
    return true;
  }
  if (method === "GET" && pathname === "/api/v1/admin/audit-events") {
    sendJson(res, 200, wrap(getAuditEvents(Number(url.searchParams.get("limit") || 12))));
    return true;
  }
  if (method === "GET" && pathname === "/api/v1/meta/report-reasons") {
    sendJson(res, 200, wrap(getReportReasons()));
    return true;
  }
  if (method === "PUT" && pathname === "/api/v1/me/profile") {
    readRequestBody(req).then((bodyText) => {
      const body = bodyText ? JSON.parse(bodyText) : {};
      sendJson(res, 200, wrap(updateCurrentProfile(body, userId)));
    }).catch((error) => {
      sendApiError(res, 500, "profile_update_failed", { detail: error.message });
    });
    return true;
  }
  if (method === "GET" && pathname === "/api/v1/me/boundary-settings") {
    sendJson(res, 200, wrap(getBoundarySettings(userId)));
    return true;
  }
  if (method === "GET" && pathname === "/api/v1/me/reports") {
    sendJson(res, 200, wrap(getMyReports(userId)));
    return true;
  }
  if (method === "GET" && pathname === "/api/v1/notifications") {
    sendJson(res, 200, wrap(getNotifications(userId, Number(url.searchParams.get("limit") || 20))));
    return true;
  }
  if (method === "POST" && pathname === "/api/v1/notifications/read") {
    readRequestBody(req).then((bodyText) => {
      const body = bodyText ? JSON.parse(bodyText) : {};
      sendJson(res, 200, wrap(markNotificationsRead(userId, body.notification_ids || [])));
    }).catch((error) => {
      sendApiError(res, 500, "notification_read_failed", { detail: error.message });
    });
    return true;
  }
  if (method === "GET" && pathname === "/api/v1/me/blocks") {
    sendJson(res, 200, wrap(getBlockedUsers(userId)));
    return true;
  }
  if (method === "PUT" && pathname === "/api/v1/me/boundary-settings") {
    readRequestBody(req).then((bodyText) => {
      const body = bodyText ? JSON.parse(bodyText) : {};
      setBoundarySettings(body, userId);
      sendJson(res, 200, wrap(getBoundarySettings(userId)));
    }).catch((error) => {
      sendApiError(res, 500, "boundary_update_failed", { detail: error.message });
    });
    return true;
  }
  if (method === "GET" && pathname === "/api/v1/persona/questions") {
    sendJson(res, 200, baseData.personaQuestions);
    return true;
  }
  if (method === "POST" && pathname === "/api/v1/persona/answers") {
    sendJson(res, 200, baseData.personaResult);
    return true;
  }
  if (method === "GET" && pathname === "/api/v1/persona/result") {
    sendJson(res, 200, baseData.personaResult);
    return true;
  }
  if (method === "GET" && pathname === "/api/v1/signals/today") {
    sendJson(res, 200, wrap(getSignalsToday(userId)));
    return true;
  }
  if (method === "POST" && pathname === "/api/v1/signals/answers") {
    readRequestBody(req).then((bodyText) => {
      const runtime = getRuntimeState(userId);
      const body = bodyText ? JSON.parse(bodyText) : {};
      const canonicalAnswer = normalizeInterestSignalAnswer(body.answer_text);
      if (!canonicalAnswer) {
        sendJson(res, 400, {
          code: 1,
          message: "Choose one supported crypto sector.",
          data: {
            reason_code: "invalid_interest_selection"
          }
        });
        return;
      }
      runtime.signalSubmitted = true;
      runtime.signalAnswerText = canonicalAnswer;
      persistRuntime(userId);
      sendJson(res, 200, wrap({
        signal_answer_id: "usa_live_001",
        moderation_status: "approved",
        recommendations_unlocked: true
      }));
    }).catch((error) => {
      sendApiError(res, 500, "signal_submit_failed", { detail: error.message });
    });
    return true;
  }
  if (method === "GET" && pathname === "/api/v1/home") {
    sendJson(res, 200, wrap(getHome(userId)));
    return true;
  }
  if (method === "GET" && pathname === "/api/v1/recommendations") {
    const tab = url.searchParams.get("tab") || "recommended";
    const data = getRecommendationsData(tab, userId);
    registerRecommendationExposure(data.items, userId);
    getAiEnrichedRecommendationsData(tab, userId).then((payload) => {
      sendJson(res, 200, wrap(payload));
    }).catch((error) => {
      sendApiError(res, 500, "recommendation_enrichment_failed", { detail: error.message });
    });
    return true;
  }
  if (method === "GET" && pathname.startsWith("/api/v1/candidates/")) {
    const candidateId = pathname.split("/").pop();
    const candidate = getCandidate(candidateId, userId);
    if (!candidate || isSuppressedTarget(candidateId, userId)) {
      sendApiError(res, 404, "candidate_not_found", { candidate_user_id: candidateId });
      return true;
    }
    buildCandidateDetailDataAsync(candidate, userId).then((payload) => {
      sendJson(res, 200, wrap(payload));
    }).catch((error) => {
      sendApiError(res, 500, "candidate_detail_failed", { detail: error.message });
    });
    return true;
  }
  if (method === "POST" && pathname.startsWith("/api/v1/candidates/") && pathname.endsWith("/skip")) {
    const candidateId = pathname.split("/")[4];
    const skipped = skipCandidate(candidateId, userId);
    if (!skipped) {
      sendApiError(res, 404, "candidate_not_found", { candidate_user_id: candidateId });
      return true;
    }
    sendJson(res, 200, wrap(skipped));
    return true;
  }
  if (method === "POST" && pathname.startsWith("/api/v1/candidates/") && pathname.endsWith("/favorite")) {
    const candidateId = pathname.split("/")[4];
    const favorited = favoriteCandidate(candidateId, userId);
    if (!favorited) {
      sendApiError(res, 404, "candidate_not_found", { candidate_user_id: candidateId });
      return true;
    }
    sendJson(res, 200, wrap(favorited));
    return true;
  }
  if (method === "POST" && pathname.startsWith("/api/v1/candidates/") && pathname.endsWith("/unfavorite")) {
    const candidateId = pathname.split("/")[4];
    const unfavorited = unfavoriteCandidate(candidateId, userId);
    if (!unfavorited) {
      sendApiError(res, 404, "candidate_not_found", { candidate_user_id: candidateId });
      return true;
    }
    sendJson(res, 200, wrap(unfavorited));
    return true;
  }
  if (method === "POST" && pathname.startsWith("/api/v1/candidates/") && pathname.endsWith("/restore")) {
    const candidateId = pathname.split("/")[4];
    const restored = restoreCandidate(candidateId, userId);
    if (!restored) {
      sendApiError(res, 404, "candidate_not_found", { candidate_user_id: candidateId });
      return true;
    }
    sendJson(res, 200, wrap(restored));
    return true;
  }
  if (method === "POST" && pathname === "/api/v1/reports") {
    readRequestBody(req).then((bodyText) => {
      const body = bodyText ? JSON.parse(bodyText) : {};
      if (!body.target_user_id) {
        sendApiError(res, 400, "missing_target_user_id");
        return;
      }
      sendJson(res, 200, wrap(createReport({
        targetUserId: body.target_user_id,
        sourceType: body.source_type || "candidate",
        sourceId: body.source_id || null,
        reasonCode: body.reason_code || "other",
        detail: body.detail || ""
      }, userId)));
    }).catch((error) => {
      sendApiError(res, 500, "report_create_failed", { detail: error.message });
    });
    return true;
  }
  if (method === "POST" && pathname === "/api/v1/blocks") {
    sendApiError(res, 410, "block_disabled", { message: "Blocking is disabled." });
    return true;
  }
  if (method === "POST" && pathname.startsWith("/api/v1/blocks/") && pathname.endsWith("/unblock")) {
    sendApiError(res, 410, "block_disabled", { message: "Blocking is disabled." });
    return true;
  }
  if (method === "GET" && pathname === "/api/v1/admin/moderation/queue") {
    sendJson(res, 200, wrap(getModerationQueue()));
    return true;
  }
  if (method === "POST" && pathname.startsWith("/api/v1/admin/reports/") && pathname.endsWith("/resolve")) {
    readRequestBody(req).then((bodyText) => {
      const body = bodyText ? JSON.parse(bodyText) : {};
      const reportId = pathname.split("/")[4];
      const resolved = resolveReport(reportId, body.action || "dismiss", userId);
      if (!resolved) {
        sendApiError(res, 404, "report_not_found", { report_id: reportId });
        return;
      }
      sendJson(res, 200, wrap(resolved));
    }).catch((error) => {
      sendApiError(res, 500, "report_resolve_failed", { detail: error.message });
    });
    return true;
  }
  if (method === "POST" && pathname === "/api/v1/responses") {
    readRequestBody(req).then((bodyText) => {
      const body = bodyText ? JSON.parse(bodyText) : {};
      const candidate = getCandidate(body.target_user_id, userId);
      if (!candidate || isRelationSuppressedEitherDirection(body.target_user_id, userId)) {
        sendApiError(res, 404, "candidate_not_found", { candidate_user_id: body.target_user_id });
        return;
      }
      const moderation = moderateTextContent(body.message);
      if (!moderation.approved) {
        sendJson(res, 400, {
          code: 1,
          message: moderation.message,
          data: {
            moderation_status: moderation.moderation_status,
            reason_code: moderation.reason_code
          }
        });
        return;
      }
      const relation = createRelation(candidate, body.message, userId);
      sendJson(res, 200, wrap({
        response_id: relation.response_id,
        relation_id: relation.relation_id,
        relation_status: relation.status,
        story_room_created: relation.status === "story_room_active",
        story_room_id: relation.story_room_id
      }));
    }).catch((error) => {
      sendApiError(res, 500, "response_create_failed", { detail: error.message });
    });
    return true;
  }
  if (method === "GET" && pathname === "/api/v1/responses/incoming") {
    sendJson(res, 200, wrap(getIncomingResponses(userId)));
    return true;
  }
  if (method === "POST" && pathname.startsWith("/api/v1/responses/") && pathname.endsWith("/accept")) {
    const responseId = pathname.split("/")[4];
    const relation = Object.values(getRuntimeState(userId).relations).find(
      (item) => item.response_id === responseId && isVisibleRelation(item, userId)
    ) || null;
    if (!relation) {
      sendApiError(res, 404, "response_not_found", { response_id: responseId });
      return true;
    }
    activatePendingRelation(relation, userId);
    sendJson(res, 200, wrap({
      response_id: relation.response_id,
      relation_id: relation.relation_id,
      relation_status: relation.status,
      story_room_created: true,
      story_room_id: relation.story_room_id
    }));
    return true;
  }
  if (method === "POST" && pathname.startsWith("/api/v1/responses/") && pathname.endsWith("/reject")) {
    const responseId = pathname.split("/")[4];
    const relation = Object.values(getRuntimeState(userId).relations).find(
      (item) => item.response_id === responseId && isVisibleRelation(item, userId)
    ) || null;
    if (!relation) {
      sendApiError(res, 404, "response_not_found", { response_id: responseId });
      return true;
    }
    rejectPendingRelation(relation, userId);
    sendJson(res, 200, wrap({
      response_id: relation.response_id,
      relation_id: relation.relation_id,
      relation_status: relation.status,
      rejected: true
    }));
    return true;
  }
  if (method === "GET" && pathname === "/api/v1/story-rooms") {
    sendJson(res, 200, wrap(getStoryRooms(userId)));
    return true;
  }
  if (method === "GET" && pathname.startsWith("/api/v1/story-rooms/")) {
    const storyRoomId = pathname.split("/").pop();
    const detail = getStoryRoomDetail(storyRoomId, userId);
    if (!detail) {
      sendApiError(res, 404, "story_room_not_found", { story_room_id: storyRoomId });
      return true;
    }
    sendJson(res, 200, wrap(detail));
    return true;
  }
  if (method === "POST" && pathname.endsWith("/answers") && pathname.startsWith("/api/v1/story-rooms/")) {
    readRequestBody(req).then((bodyText) => {
      JSON.parse(bodyText || "{}");
      const storyRoomId = pathname.split("/")[4];
      const relation = Object.values(getRuntimeState(userId).relations).find(
        (item) => item.story_room_id === storyRoomId && isVisibleRelation(item, userId)
      );
      if (!relation) {
        sendApiError(res, 404, "story_room_not_found", { story_room_id: storyRoomId });
        return;
      }
      ensureChatUnlocked(relation, userId);
      sendJson(res, 200, wrap(relation.last_insight));
    }).catch((error) => {
      sendApiError(res, 500, "story_answer_failed", { detail: error.message });
    });
    return true;
  }
  if (method === "GET" && pathname === "/api/v1/chats") {
    sendJson(res, 200, wrap(getChats(userId)));
    return true;
  }
  if (method === "GET" && pathname.startsWith("/api/v1/chats/")) {
    const threadId = pathname.split("/").pop();
    const thread = getChatThread(threadId, userId);
    if (!thread) {
      sendApiError(res, 404, "chat_thread_not_found", { thread_id: threadId });
      return true;
    }
    sendJson(res, 200, wrap(thread));
    return true;
  }
  if (method === "POST" && pathname.endsWith("/messages") && pathname.startsWith("/api/v1/chats/")) {
    readRequestBody(req).then((bodyText) => {
      const body = bodyText ? JSON.parse(bodyText) : {};
      const threadId = pathname.split("/")[4];
      const relation = Object.values(getRuntimeState(userId).relations).find(
        (item) => item.thread_id === threadId && isVisibleRelation(item, userId)
      );
      if (!relation) {
        sendApiError(res, 404, "chat_thread_not_found", { thread_id: threadId });
        return;
      }
      if (isRelationSuppressedEitherDirection(relation.candidate_user_id, userId)) {
        sendApiError(res, 403, "chat_blocked", {
          thread_id: threadId,
          target_user_id: relation.candidate_user_id
        });
        return;
      }
      const moderation = moderateTextContent(body.content);
      if (!moderation.approved) {
        sendJson(res, 400, {
          code: 1,
          message: moderation.message,
          data: {
            moderation_status: moderation.moderation_status,
            reason_code: moderation.reason_code
          }
        });
        return;
      }
      const message = appendChatMessage(relation, body.content || "", userId, userId);
      sendJson(res, 200, wrap({
        ...message,
        moderation_status: "approved"
      }));
    }).catch((error) => {
      sendApiError(res, 500, "chat_message_failed", { detail: error.message });
    });
    return true;
  }

  return false;
}

function handleRequest(req, res, baseOrigin = `http://localhost:${PORT}`) {
  const url = new URL(req.url || "/", baseOrigin);
  if (url.pathname.startsWith("/api/")) {
    if (!handleApi(req, res, url)) {
      sendApiError(res, 404, "api_route_not_found", {
        method: req.method || "GET",
        path: url.pathname
      });
    }
    return;
  }

  const filePath = resolveRequestPath(req.url || "/");

  if (!filePath.startsWith(ROOT)) {
    send(res, 403, "Forbidden", "text/plain; charset=utf-8");
    return;
  }

  let targetPath = filePath;

  try {
    const stat = fs.existsSync(targetPath) ? fs.statSync(targetPath) : null;
    if (stat && stat.isDirectory()) {
      targetPath = path.join(targetPath, "index.html");
    }

    if (!fs.existsSync(targetPath)) {
      send(res, 404, "Not Found", "text/plain; charset=utf-8");
      return;
    }

    const ext = path.extname(targetPath).toLowerCase();
    const contentType = CONTENT_TYPES[ext] || "application/octet-stream";
    const content = fs.readFileSync(targetPath);
    send(res, 200, content, contentType);
  } catch (error) {
    send(res, 500, `Server Error\n${error.message}`, "text/plain; charset=utf-8");
  }
}

function createAppServer() {
  return http.createServer((req, res) => {
    handleRequest(req, res, `http://localhost:${PORT}`);
  });
}

function startServer(port = PORT, host = HOST) {
  const server = createAppServer();
  server.listen(port, host, () => {
    console.log(`seekdegen server running at http://${host}:${port}`);
  });
  return server;
}

module.exports = {
  handleRequest,
  createAppServer,
  startServer,
  __internal: {
    runtime,
    resetRuntimeState,
    getRuntimeState,
    createRelation,
    activatePendingRelation,
    ensureChatUnlocked,
    appendChatMessage,
    createAuthSession,
    createWalletAuthChallenge,
    verifyWalletLogin,
    refreshAuthSession,
    logoutAuthSession,
    getSessionByAccessToken,
    createReport,
    blockUser,
    unblockUser,
    getReportReasons,
    getMyReports,
    getBlockedUsers,
    getModerationQueue,
    getAdminStats,
    getAuditEvents,
    resolveReport,
    moderateTextContent,
    getCurrentUser,
    writeCurrentUser,
    readAllUsers,
    updateCurrentProfile,
    getBoundarySettings,
    setBoundarySettings,
    getCandidateStats,
    buildCandidateDetailData,
    getRecommendationsData,
    getIncomingResponses,
    getStoryRooms,
    getStoryRoomDetail,
    getChats,
    getChatThread,
    getCandidate,
    skipCandidate,
    favoriteCandidate,
    unfavoriteCandidate,
    restoreCandidate
  }
};

if (require.main === module) {
  startServer();
}

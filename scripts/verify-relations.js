const crypto = require("crypto");
const { __internal } = require("../server.js");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function encodeBase58(buffer) {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const source = Buffer.from(buffer);
  if (source.length === 0) {
    return "";
  }

  let digits = [0];
  for (const byte of source) {
    let carry = byte;
    for (let i = 0; i < digits.length; i += 1) {
      const value = digits[i] * 256 + carry;
      digits[i] = value % 58;
      carry = Math.floor(value / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }

  let leadingZeroes = 0;
  for (const byte of source) {
    if (byte !== 0) {
      break;
    }
    leadingZeroes += 1;
  }

  let result = "1".repeat(leadingZeroes);
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    result += alphabet[digits[i]];
  }
  return result;
}

function seedRealUser({
  userId,
  nickname,
  city,
  gender,
  signalText,
  verificationStatus = "wallet_verified"
}) {
  const {
    writeCurrentUser,
    getRuntimeState
  } = __internal;

  writeCurrentUser({
    user_id: userId,
    status: "active",
    verification_status: verificationStatus,
    onboarding_status: "eligible",
    profile: {
      nickname,
      age: 24,
      city,
      gender,
      match_preference: "stable_relationship",
      avatar_url: `https://example.com/avatar/${userId}.png`
    }
  }, userId);

  const runtime = getRuntimeState(userId);
  runtime.signalSubmitted = Boolean(signalText);
  runtime.signalAnswerText = signalText || "";
}

function main() {
  const {
    runtime,
    resetRuntimeState,
    createRelation,
    activatePendingRelation,
    ensureChatUnlocked,
    appendChatMessage,
    getBoundarySettings,
    setBoundarySettings,
    getCandidateStats,
    buildCandidateDetailData,
    getRecommendationsData,
    getIncomingResponses,
    getStoryRooms,
    getChats,
    getChatThread,
    getCandidate,
    createReport,
    getBlockedUsers,
    getMyReports,
    getModerationQueue,
    getAdminStats,
    getAuditEvents,
    resolveReport,
    getReportReasons,
    moderateTextContent,
    skipCandidate,
    favoriteCandidate,
    unfavoriteCandidate,
    restoreCandidate,
    createAuthSession,
    createWalletAuthChallenge,
    verifyWalletLogin,
    refreshAuthSession,
    logoutAuthSession,
    getSessionByAccessToken,
    updateCurrentProfile
  } = __internal;

  resetRuntimeState();

  updateCurrentProfile({
    nickname: "Kai",
    city: "Manila",
    age: 24,
    gender: "male"
  });
  runtime.signalSubmitted = true;
  runtime.signalAnswerText = "Layer 1 / Public Chains (Ethereum, Solana)";

  seedRealUser({
    userId: "u_wallet_luna",
    nickname: "Luna",
    city: "Manila",
    gender: "female",
    signalText: "Layer 2"
  });
  seedRealUser({
    userId: "u_wallet_aria",
    nickname: "Aria",
    city: "Shenzhen",
    gender: "female",
    signalText: "DeFi"
  });
  seedRealUser({
    userId: "u_wallet_miles",
    nickname: "Miles",
    city: "Manila",
    gender: "male",
    signalText: "AI"
  });
  seedRealUser({
    userId: "u_wallet_unknown",
    nickname: "Unknown",
    city: "Manila",
    gender: "unknown",
    signalText: "I am here."
  });
  seedRealUser({
    userId: "u_seeded_not_real",
    nickname: "Seeded",
    city: "Manila",
    gender: "female",
    signalText: "This account should not be matchable.",
    verificationStatus: "verified"
  });

  const session = createAuthSession();
  assert(Boolean(session.access_token), "login should create an access token");
  assert(Boolean(session.refresh_token), "login should create a refresh token");
  assert(session.is_admin === true, "default demo session should be admin");
  const storedSession = getSessionByAccessToken(session.access_token);
  assert(storedSession?.user_id === session.user_id, "access token lookup should resolve created session");
  const refreshedSession = refreshAuthSession(session.refresh_token);
  assert(Boolean(refreshedSession?.access_token), "refresh should rotate a new access token");
  assert(refreshedSession.access_token !== session.access_token, "refresh should rotate the access token");
  assert(refreshedSession.refresh_token !== session.refresh_token, "refresh should rotate the refresh token");
  assert(getSessionByAccessToken(refreshedSession.access_token)?.user_id === session.user_id, "rotated access token should stay bound to the same user");
  assert(logoutAuthSession({
    access_token: refreshedSession.access_token,
    user_id: refreshedSession.user_id
  }).logged_out === true, "logout should remove the refreshed access token");
  assert(getSessionByAccessToken(refreshedSession.access_token) === null, "logged out access token should no longer resolve");

  const walletKeys = crypto.generateKeyPairSync("ed25519");
  const walletSpkiDer = walletKeys.publicKey.export({ format: "der", type: "spki" });
  const walletPublicKeyRaw = walletSpkiDer.subarray(walletSpkiDer.length - 32);
  const walletAddress = encodeBase58(walletPublicKeyRaw);
  const walletChallenge = createWalletAuthChallenge(walletAddress);
  assert(walletChallenge.wallet_address === walletAddress, "wallet challenge should keep the same wallet address");
  const walletSignature = crypto.sign(
    null,
    Buffer.from(walletChallenge.message, "utf8"),
    walletKeys.privateKey
  );
  const walletLogin = verifyWalletLogin({
    walletAddress,
    signedMessage: walletChallenge.message,
    signatureBase64: walletSignature.toString("base64")
  });
  assert(Boolean(walletLogin.session?.access_token), "wallet login should mint an auth session");
  assert(walletLogin.wallet_address === walletAddress, "wallet login should return the verified wallet address");
  assert(walletLogin.session.user_id.startsWith("u_wallet_"), "wallet login should create a wallet-scoped user");

  const recommendedBeforeRelations = getRecommendationsData("recommended").items;
  assert(recommendedBeforeRelations.length === 3, `expected 3 real candidates, got ${recommendedBeforeRelations.length}`);
  assert(recommendedBeforeRelations.every((item) => item.is_real_user === true), "recommendations should only contain real wallet-verified users");
  assert(recommendedBeforeRelations.some((item) => item.candidate_user_id === "u_wallet_miles"), "same-gender users should now remain eligible");
  assert(!recommendedBeforeRelations.some((item) => item.candidate_user_id === "u_seeded_not_real"), "non-wallet users should be excluded");
  assert(recommendedBeforeRelations.some((item) => item.candidate_user_id === "u_wallet_luna"), "Luna should be recommended");
  assert(recommendedBeforeRelations.some((item) => item.candidate_user_id === "u_wallet_aria"), "Aria should be recommended");

  const lunaDetail = buildCandidateDetailData(getCandidate("u_wallet_luna"));
  assert(lunaDetail.recommendation_factors.length >= 3, "candidate detail should expose recommendation factors");
  assert(lunaDetail.next_action_advice?.title, "candidate detail should expose next action advice");

  const sameCityBeforeRelations = getRecommendationsData("same_city").items;
  assert(sameCityBeforeRelations.length === 2, "same_city tab should keep only same-city real users");
  const sameSignalBeforeRelations = getRecommendationsData("same_signal").items;
  assert(sameSignalBeforeRelations.length >= 1, "same_signal tab should surface shared-theme candidates");
  const newBeforeRelations = getRecommendationsData("new").items;
  assert(newBeforeRelations.length === 3, "new tab should include untouched real candidates");
  const reviewBeforeActions = getRecommendationsData("review").items;
  assert(reviewBeforeActions.length === 0, "review tab should be empty before any saved or timeline actions");

  setBoundarySettings({ accept_same_city_only: true });
  const sameCityOnlyRecommendations = getRecommendationsData().items;
  assert(sameCityOnlyRecommendations.length === 2, "same-city filter should hide cross-city candidates");
  assert(sameCityOnlyRecommendations.some((item) => item.candidate_user_id === "u_wallet_luna"), "same-city filter should keep Luna");
  assert(sameCityOnlyRecommendations.some((item) => item.candidate_user_id === "u_wallet_miles"), "same-city filter should keep Miles");
  setBoundarySettings({ accept_same_city_only: false });

  const luna = createRelation(getCandidate("u_wallet_luna"), "You seem thoughtful and real.");
  assert(luna.status === "responded_pending", "outgoing relation should stay pending until the other side accepts");
  assert(getIncomingResponses().items.length === 0, "sender should not receive a fake incoming response");
  const lunaIncoming = getIncomingResponses("u_wallet_luna").items;
  assert(lunaIncoming.length === 1, "the target user should receive a real incoming response");
  assert(lunaIncoming[0].from_user_id === "u_demo_kai", "incoming response should reference the real sender");

  const recommendations = getRecommendationsData().items;
  assert(recommendations.every((item) => item.match_label), "recommendations should include match labels");
  assert(recommendations.every((item) => item.score_breakdown), "recommendations should include score breakdowns");
  assert(recommendations.every((item) => "last_event_at" in item), "recommendations should expose last_event_at");
  assert(
    recommendations.find((item) => item.candidate_user_id === "u_wallet_luna")?.score_breakdown.stage_score < 0,
    "pending relations should receive a negative stage score"
  );

  const moderationRejected = moderateTextContent("add my wechat and move off-platform");
  assert(moderationRejected.approved === false, "moderation should reject risky contact text");
  const moderationApproved = moderateTextContent("I want to get to know you slowly");
  assert(moderationApproved.approved === true, "moderation should allow normal text");
  assert(getReportReasons().items.length >= 5, "report reasons should expose moderation choices");

  skipCandidate("u_wallet_aria");
  const ariaStats = getCandidateStats("u_wallet_aria");
  assert(ariaStats.skip_count === 1, "skip should increment candidate skip count");
  assert(ariaStats.skipped === true, "skip should mark candidate as skipped");
  restoreCandidate("u_wallet_aria");
  assert(ariaStats.skipped === false, "restore should clear skipped state");
  assert(ariaStats.skip_count === 0, "restore should clear skip penalty count");
  assert(ariaStats.timeline.some((item) => item.type === "restored"), "restore should append a timeline event");

  favoriteCandidate("u_wallet_luna");
  const lunaStats = getCandidateStats("u_wallet_luna");
  assert(lunaStats.favorited === true, "favorite should mark candidate as favorited");
  assert(lunaStats.timeline.some((item) => item.type === "favorited"), "favorite should append a timeline event");
  const lunaDetailAfterFavorite = buildCandidateDetailData(getCandidate("u_wallet_luna"));
  assert(lunaDetailAfterFavorite.relationship_timeline.length >= 1, "candidate detail should expose relationship timeline");
  const reviewAfterActions = getRecommendationsData("review").items;
  assert(reviewAfterActions.length >= 2, "review tab should include favorited or interacted candidates");
  unfavoriteCandidate("u_wallet_luna");
  assert(lunaStats.favorited === false, "unfavorite should clear favorited state");
  assert(lunaStats.timeline.some((item) => item.type === "unfavorited"), "unfavorite should append a timeline event");

  setBoundarySettings({ allow_proactive_responses: false }, "u_wallet_luna");
  assert(getIncomingResponses("u_wallet_luna").items.length === 0, "proactive responses off should hide incoming response list");
  setBoundarySettings({ allow_proactive_responses: true }, "u_wallet_luna");
  assert(getIncomingResponses("u_wallet_luna").items.length === 1, "re-enabling proactive responses should restore incoming responses");

  const lunaRelationForLuna = __internal.getRuntimeState("u_wallet_luna").relations.u_demo_kai;
  activatePendingRelation(lunaRelationForLuna, "u_wallet_luna");
  assert(lunaRelationForLuna.status === "story_room_active", "accepted relation should move to story_room_active");
  assert(Boolean(lunaRelationForLuna.story_room_id), "accepted relation should receive a story room id");
  assert(luna.status === "story_room_active", "story activation should sync back to the sender");
  assert(luna.story_room_id === lunaRelationForLuna.story_room_id, "story room id should stay in sync between both users");

  const storyRooms = getStoryRooms();
  assert(storyRooms.active_rooms.length === 1, `expected 1 active story room, got ${storyRooms.active_rooms.length}`);

  ensureChatUnlocked(luna);
  assert(luna.status === "chat_unlocked", "sender relation should unlock chat after story completion");
  assert(Boolean(luna.thread_id), "chat unlock should create a thread id");
  const lunaMirrorAfterUnlock = __internal.getRuntimeState("u_wallet_luna").relations.u_demo_kai;
  assert(lunaMirrorAfterUnlock.status === "chat_unlocked", "chat unlock should sync to the peer");
  assert(lunaMirrorAfterUnlock.thread_id === luna.thread_id, "chat thread id should stay in sync");

  const chats = getChats();
  assert(chats.items.some((item) => item.thread_id === luna.thread_id), "missing unlocked chat thread for Luna");

  const appended = appendChatMessage(luna, "This is a verified real-user chat message.");
  assert(appended?.thread_id === luna.thread_id, "appendChatMessage should append into unlocked thread");
  assert(lunaMirrorAfterUnlock.messages.some((message) => message.message_id === appended.message_id), "chat messages should mirror to the peer runtime");

  createReport({
    targetUserId: "u_wallet_aria",
    sourceType: "candidate",
    sourceId: "u_wallet_aria",
    reasonCode: "suspicious_behavior",
    detail: "verify report flow"
  });
  assert(
    !getRecommendationsData().items.some((item) => item.candidate_user_id === "u_wallet_aria"),
    "reported candidate should disappear from recommendations"
  );
  assert(getMyReports().items.length >= 1, "reports list should include submitted reports");
  assert(getModerationQueue().items.length >= 1, "moderation queue should include pending reports");
  assert(getAdminStats().pending_reports >= 1, "admin stats should count pending reports");
  resolveReport(getMyReports().items[0].report_id, "dismiss");
  assert(
    getRecommendationsData().items.some((item) => item.candidate_user_id === "u_wallet_aria"),
    "dismissed report should restore candidate visibility"
  );

  assert(getBlockedUsers().items.length === 0, "block list should stay empty while blocking is disabled");
  assert(getAuditEvents(20).items.length >= 5, "audit events should capture key product actions");

  resetRuntimeState();
  console.log("verify-relations: ok");
}

main();

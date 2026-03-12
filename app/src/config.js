export const apiRoutes = {
  walletChallenge: { method: "POST", path: "/api/v1/auth/wallet/challenge" },
  walletVerify: { method: "POST", path: "/api/v1/auth/wallet/verify" },
  refresh: { method: "POST", path: "/api/v1/auth/refresh" },
  logout: { method: "POST", path: "/api/v1/auth/logout" },
  session: { method: "GET", path: "/api/v1/auth/session" },
  me: { method: "GET", path: "/api/v1/me" },
  reportReasons: { method: "GET", path: "/api/v1/meta/report-reasons" },
  boundarySettings: { method: "GET", path: "/api/v1/me/boundary-settings" },
  myReports: { method: "GET", path: "/api/v1/me/reports" },
  myBlocks: { method: "GET", path: "/api/v1/me/blocks" },
  notifications: { method: "GET", path: "/api/v1/notifications?limit=20" },
  notificationsRead: { method: "POST", path: "/api/v1/notifications/read" },
  adminStats: { method: "GET", path: "/api/v1/admin/stats" },
  adminAuditEvents: { method: "GET", path: "/api/v1/admin/audit-events?limit=10" },
  moderationQueue: { method: "GET", path: "/api/v1/admin/moderation/queue" },
  personaQuestions: { method: "GET", path: "/api/v1/persona/questions" },
  personaSubmit: { method: "POST", path: "/api/v1/persona/answers" },
  personaResult: { method: "GET", path: "/api/v1/persona/result" },
  signalToday: { method: "GET", path: "/api/v1/signals/today" },
  signalSubmit: { method: "POST", path: "/api/v1/signals/answers" },
  responseCreate: { method: "POST", path: "/api/v1/responses" },
  responsesIncoming: { method: "GET", path: "/api/v1/responses/incoming" },
  home: { method: "GET", path: "/api/v1/home" },
  recommendations: { method: "GET", path: "/api/v1/recommendations?tab=recommended&page=1&page_size=10" },
  candidateLinlan: { method: "GET", path: "/api/v1/candidates/u_demo_linlan" },
  storyRooms: { method: "GET", path: "/api/v1/story-rooms" },
  chats: { method: "GET", path: "/api/v1/chats" }
};

export const titleMap = {
  home: ["Signal Hub", "Curated from your signals"],
  explore: ["Explore", "Potential matches"],
  story: ["Story Room", "Warm up before chat"],
  messages: ["Messages", "Unlocked connections only"],
  me: ["Me", "Profile and boundaries"]
};

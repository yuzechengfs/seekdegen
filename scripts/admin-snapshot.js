const { __internal } = require("../server.js");

const snapshot = {
  environment: process.env.APP_ENV || "development",
  port: Number(process.env.PORT || 4173),
  stats: __internal.getAdminStats(),
  reports: __internal.getMyReports(),
  blocks: __internal.getBlockedUsers(),
  moderation_queue: __internal.getModerationQueue(),
  audit_events: __internal.getAuditEvents(10)
};

console.log(JSON.stringify(snapshot, null, 2));

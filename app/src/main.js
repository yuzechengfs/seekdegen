import { loadBootstrapData, loadRealtimeData } from "./data.js";
import { $, setLoadStatus, setPanel, setScreen, showAttentionAlert } from "./dom.js";
import { bindBaseEvents } from "./events.js";
import { consumeNotificationTypes, renderApp } from "./render.js";
import { getPreferredInitialPanel, loadStoredAuth, state } from "./state.js";

let eventsBound = false;
let realtimeTimer = null;
let realtimeInFlight = false;

function buildRealtimeSnapshot(data) {
  return {
    notificationIds: new Set((data?.notifications?.data?.items || []).map((item) => item.notification_id)),
    unreadNotifications: (data?.notifications?.data?.items || []).filter((item) => !item.read_at),
    incomingResponseIds: new Set((data?.responsesIncoming?.data?.items || []).map((item) => item.response_id)),
    recommendationIds: new Set((data?.recommendations?.data?.items || []).map((item) => item.candidate_user_id))
  };
}

function showRealtimeAttention(previousData, nextData) {
  const previous = buildRealtimeSnapshot(previousData);
  const next = buildRealtimeSnapshot(nextData);

  const newIncoming = (nextData?.responsesIncoming?.data?.items || []).filter(
    (item) => !previous.incomingResponseIds.has(item.response_id)
  );
  if (newIncoming.length > 0) {
    const first = newIncoming[0];
    showAttentionAlert({
      eyebrow: "New response",
      title: `${first.nickname} sent you a response`,
      body: "Open Messages or Signal Hub to accept or decline it.",
      ctaLabel: "Open Messages",
      onAction: async () => {
        await consumeNotificationTypes(["response_received"]);
        setPanel("messages");
        renderApp();
      }
    });
    return;
  }

  const newUnread = next.unreadNotifications.filter(
    (item) => !previous.notificationIds.has(item.notification_id)
  );
  const accepted = newUnread.find((item) => item.type === "response_accepted");
  if (accepted) {
    showAttentionAlert({
      eyebrow: "It's a match",
      title: accepted.title,
      body: accepted.body,
      ctaLabel: "Open Story Room",
      onAction: async () => {
        await consumeNotificationTypes(["response_accepted"]);
        setPanel("story");
        renderApp();
      }
    });
    return;
  }

  const storyCompleted = newUnread.find((item) => item.type === "story_room_completed");
  if (storyCompleted) {
    showAttentionAlert({
      eyebrow: "Story Room done",
      title: storyCompleted.title,
      body: storyCompleted.body,
      ctaLabel: "Open Messages",
      onAction: async () => {
        await consumeNotificationTypes(["story_room_completed"]);
        setPanel("messages");
        renderApp();
      }
    });
    return;
  }

  const incomingMessage = newUnread.find((item) => item.type === "chat_message_received");
  if (incomingMessage) {
    showAttentionAlert({
      eyebrow: "New message",
      title: incomingMessage.title,
      body: incomingMessage.body,
      ctaLabel: "Reply now",
      onAction: async () => {
        await consumeNotificationTypes(["chat_message_received"]);
        setPanel("messages");
        renderApp();
      }
    });
    return;
  }

  const rejected = newUnread.find((item) => item.type === "response_rejected");
  if (rejected) {
    showAttentionAlert({
      eyebrow: "Update",
      title: rejected.title,
      body: rejected.body,
      ctaLabel: "Open Signal Hub",
      onAction: async () => {
        await consumeNotificationTypes(["response_rejected"]);
        setPanel("home");
        renderApp();
      }
    });
    return;
  }

  const newRecommendations = (nextData?.recommendations?.data?.items || []).filter(
    (item) => !previous.recommendationIds.has(item.candidate_user_id)
  );
  if (newRecommendations.length > 0) {
    showAttentionAlert({
      eyebrow: "New match",
      title: "A new real match is waiting",
      body: "Open Explore to see who just appeared for you.",
      ctaLabel: "Open Explore",
      onAction: () => setPanel("explore")
    });
  }
}

async function refreshRealtimeState() {
  if (realtimeInFlight || !state.auth?.access_token || state.currentScreen !== "screen-app") {
    return;
  }

  realtimeInFlight = true;
  try {
    const previousData = state.data;
    const realtime = await loadRealtimeData();
    state.data = {
      ...state.data,
      ...realtime
    };
    renderApp();
    if (previousData) {
      showRealtimeAttention(previousData, state.data);
    }
  } catch (error) {
    console.error("realtime_refresh_failed", error);
  } finally {
    realtimeInFlight = false;
  }
}

function ensureRealtimePolling() {
  if (realtimeTimer) {
    window.clearInterval(realtimeTimer);
  }
  realtimeTimer = window.setInterval(() => {
    void refreshRealtimeState();
  }, 8000);
}

async function init() {
  loadStoredAuth();
  try {
    if (!state.auth?.access_token) {
      setLoadStatus("", false, false);
      setScreen("screen-login");
      if (!eventsBound) {
        bindBaseEvents();
        eventsBound = true;
      }
      return;
    }

    state.data = await loadBootstrapData();
    setLoadStatus("", false, false);
    if (!eventsBound) {
      bindBaseEvents();
      eventsBound = true;
    }
    setScreen("screen-app");
    setPanel(getPreferredInitialPanel(state.data));
    renderApp();
    ensureRealtimePolling();
  } catch (error) {
    setLoadStatus("Can't enter right now. Try again.", true, true);
    setScreen("screen-login");
    if (!eventsBound) {
      bindBaseEvents();
      eventsBound = true;
    }
    console.error(error);
  }
}

const retryButton = $("load-retry-btn");
if (retryButton) {
  retryButton.addEventListener("click", () => {
    setLoadStatus("Trying again...", false, false);
    init();
  });
}

init();

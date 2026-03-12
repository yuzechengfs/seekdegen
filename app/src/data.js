import { apiRoutes } from "./config.js";
import { setLoadStatus, setPanel, setScreen, showToast } from "./dom.js";
import { clearStoredAuth, resetAppState, saveStoredAuth, state } from "./state.js";

function withCacheBust(path) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}_ts=${Date.now()}`;
}

function handleUnauthorizedState(message = "Your session expired. Sign in again.") {
  clearStoredAuth();
  resetAppState();
  setLoadStatus(message, true, false);
  setScreen("screen-login");
  setPanel("home");
  showToast(message);
}

async function refreshSessionToken() {
  if (!state.auth?.refresh_token) {
    return null;
  }

  const response = await fetch(apiRoutes.refresh.path, {
    method: apiRoutes.refresh.method,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      refresh_token: state.auth.refresh_token
    })
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    return null;
  }

  if (payload?.data) {
    saveStoredAuth(payload.data);
    return payload;
  }
  return null;
}

async function requestJson({ method = "GET", path, body, skipRefresh = false }) {
  const resolvedPath = method === "GET" ? withCacheBust(path) : path;
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store, no-cache, must-revalidate",
    Pragma: "no-cache"
  };
  if (state.auth?.access_token) {
    headers.Authorization = `Bearer ${state.auth.access_token}`;
  }

  const response = await fetch(resolvedPath, {
    method,
    headers,
    cache: "no-store",
    body: body ? JSON.stringify(body) : undefined
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.message || `Failed request ${method} ${resolvedPath}`;
    const error = new Error(message);
    error.payload = payload;
    error.status = response.status;
    if (response.status === 401) {
      if (!skipRefresh && state.auth?.refresh_token) {
        const refreshed = await refreshSessionToken();
        if (refreshed?.data?.access_token) {
          return requestJson({ method, path, body, skipRefresh: true });
        }
      }
      handleUnauthorizedState();
    }
    if (response.status === 403) {
      error.code = payload?.data?.reason || "forbidden";
    }
    throw error;
  }
  return payload;
}

async function requestOptionalJson(options) {
  try {
    return await requestJson(options);
  } catch (error) {
    if (error?.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function loadBootstrapData() {
  const adminKeys = new Set(["adminStats", "adminAuditEvents", "moderationQueue"]);
  const bootstrapKeys = [
    "session",
    "me",
    "reportReasons",
    "boundarySettings",
    "notifications",
    "myReports",
    "myBlocks",
    "adminStats",
    "adminAuditEvents",
    "moderationQueue",
    "personaQuestions",
    "personaResult",
    "signalToday",
    "home",
    "recommendations",
    "responsesIncoming",
    "storyRooms",
    "chats"
  ];

  const entries = await Promise.all(
    bootstrapKeys.map(async (key) => {
      if (key === "recommendations") {
        return [key, await requestJson({
          method: "GET",
          path: `/api/v1/recommendations?tab=${state.activeExploreTab}&page=1&page_size=10`
        })];
      }
      if (adminKeys.has(key)) {
        try {
          return [key, await requestJson(apiRoutes[key])];
        } catch (error) {
          if (error?.status === 403) {
            return [key, null];
          }
          throw error;
        }
      }
      return [key, await requestJson(apiRoutes[key])];
    })
  );
  const data = Object.fromEntries(entries);

  const selectedCandidateId = data.recommendations.data.items.find(
    (item) => item.candidate_user_id === state.selectedCandidateId
  )?.candidate_user_id || data.recommendations.data.items[0]?.candidate_user_id || null;
  state.selectedCandidateId = selectedCandidateId;

  if (selectedCandidateId) {
    data.selectedCandidate = await requestOptionalJson({
      method: "GET",
      path: `/api/v1/candidates/${selectedCandidateId}`
    });
  } else {
    data.selectedCandidate = null;
  }

  const availableStoryRooms = [
    ...(data.storyRooms?.data?.active_rooms || []),
    ...(data.storyRooms?.data?.completed_rooms || [])
  ];
  const storyRoomId = availableStoryRooms.find((room) => room.story_room_id === state.activeStoryRoomId)?.story_room_id
    || availableStoryRooms[0]?.story_room_id
    || null;

  state.activeStoryRoomId = storyRoomId;

  if (storyRoomId) {
    data.storyActive = await requestOptionalJson({
      method: "GET",
      path: `/api/v1/story-rooms/${storyRoomId}`
    });
  } else {
    state.activeStoryRoomId = null;
    data.storyActive = null;
  }

  const chatItems = data.chats?.data?.items || [];
  if (chatItems.length > 0) {
    const threadId = chatItems.find((item) => item.thread_id === state.activeThreadId)?.thread_id
      || chatItems[0].thread_id;
    state.activeThreadId = threadId;
    data.chatThread = await requestOptionalJson({
      method: "GET",
      path: `/api/v1/chats/${threadId}`
    });
  } else {
    state.activeThreadId = null;
    data.chatThread = null;
  }

  return data;
}

export async function loadRealtimeData() {
  const [home, notifications, responsesIncoming, recommendations, storyRooms, chats] = await Promise.all([
    requestJson(apiRoutes.home),
    requestJson({
      method: apiRoutes.notifications.method,
      path: "/api/v1/notifications?limit=20"
    }),
    requestJson(apiRoutes.responsesIncoming),
    requestJson({
      method: "GET",
      path: "/api/v1/recommendations?tab=recommended&page=1&page_size=10"
    }),
    requestJson(apiRoutes.storyRooms),
    requestJson(apiRoutes.chats)
  ]);

  const availableStoryRooms = [
    ...(storyRooms?.data?.active_rooms || []),
    ...(storyRooms?.data?.completed_rooms || [])
  ];
  const storyRoomId = availableStoryRooms.find((room) => room.story_room_id === state.activeStoryRoomId)?.story_room_id
    || availableStoryRooms[0]?.story_room_id
    || null;

  state.activeStoryRoomId = storyRoomId;

  const chatItems = chats?.data?.items || [];
  const threadId = chatItems.find((item) => item.thread_id === state.activeThreadId)?.thread_id
    || chatItems[0]?.thread_id
    || null;

  state.activeThreadId = threadId;

  const [storyActive, chatThread] = await Promise.all([
    storyRoomId
      ? requestOptionalJson({
        method: "GET",
        path: `/api/v1/story-rooms/${storyRoomId}`
      })
      : Promise.resolve(null),
    threadId
      ? requestOptionalJson({
        method: "GET",
        path: `/api/v1/chats/${threadId}`
      })
      : Promise.resolve(null)
  ]);

  return {
    home,
    notifications,
    responsesIncoming,
    recommendations,
    storyRooms,
    chats,
    storyActive,
    chatThread
  };
}

export async function submitSignal(answerText) {
  return requestJson({
    method: apiRoutes.signalSubmit.method,
    path: apiRoutes.signalSubmit.path,
    body: {
      signal_task_id: "st_007",
      selected_option_ids: [],
      answer_text: answerText
    }
  });
}

export async function createWalletChallenge(walletAddress) {
  return requestJson({
    method: apiRoutes.walletChallenge.method,
    path: apiRoutes.walletChallenge.path,
    body: {
      wallet_address: walletAddress
    }
  });
}

export async function loginWithWallet({ walletAddress, signedMessage, signatureBase64 }) {
  return requestJson({
    method: apiRoutes.walletVerify.method,
    path: apiRoutes.walletVerify.path,
    body: {
      wallet_address: walletAddress,
      signed_message: signedMessage,
      signature_base64: signatureBase64
    }
  });
}

export async function logoutSession() {
  return requestJson(apiRoutes.logout);
}

export async function loadNotifications(limit = 20) {
  return requestJson({
    method: apiRoutes.notifications.method,
    path: `/api/v1/notifications?limit=${limit}`
  });
}

export async function markNotificationsRead(notificationIds = []) {
  return requestJson({
    method: apiRoutes.notificationsRead.method,
    path: apiRoutes.notificationsRead.path,
    body: {
      notification_ids: notificationIds
    }
  });
}

export async function submitResponse(targetUserId, message) {
  return requestJson({
    method: apiRoutes.responseCreate.method,
    path: apiRoutes.responseCreate.path,
    body: {
      target_user_id: targetUserId,
      source_signal_answer_id: "usa_live_signal",
      message
    }
  });
}

export async function skipCandidate(candidateUserId) {
  return requestJson({
    method: "POST",
    path: `/api/v1/candidates/${candidateUserId}/skip`
  });
}

export async function favoriteCandidate(candidateUserId) {
  return requestJson({
    method: "POST",
    path: `/api/v1/candidates/${candidateUserId}/favorite`
  });
}

export async function unfavoriteCandidate(candidateUserId) {
  return requestJson({
    method: "POST",
    path: `/api/v1/candidates/${candidateUserId}/unfavorite`
  });
}

export async function restoreCandidate(candidateUserId) {
  return requestJson({
    method: "POST",
    path: `/api/v1/candidates/${candidateUserId}/restore`
  });
}

export async function submitStoryAnswer(storyRoomId, storyQuestionId, selectedOptionId) {
  return requestJson({
    method: "POST",
    path: `/api/v1/story-rooms/${storyRoomId}/answers`,
    body: {
      story_question_id: storyQuestionId,
      selected_option_id: selectedOptionId,
      answer_text: null
    }
  });
}

export async function acceptIncomingResponse(responseId) {
  return requestJson({
    method: "POST",
    path: `/api/v1/responses/${responseId}/accept`
  });
}

export async function rejectIncomingResponse(responseId) {
  return requestJson({
    method: "POST",
    path: `/api/v1/responses/${responseId}/reject`
  });
}

export async function updateBoundarySettings(patch) {
  return requestJson({
    method: "PUT",
    path: "/api/v1/me/boundary-settings",
    body: patch
  });
}

export async function updateProfile(patch) {
  return requestJson({
    method: "PUT",
    path: "/api/v1/me/profile",
    body: patch
  });
}

export async function sendChatMessage(threadId, content) {
  return requestJson({
    method: "POST",
    path: `/api/v1/chats/${threadId}/messages`,
    body: { content }
  });
}

export async function reportUser(targetUserId, reasonCode, sourceType = "candidate", sourceId = null, detail = "") {
  return requestJson({
    method: "POST",
    path: "/api/v1/reports",
    body: {
      target_user_id: targetUserId,
      reason_code: reasonCode,
      source_type: sourceType,
      source_id: sourceId,
      detail
    }
  });
}

export async function blockUser(targetUserId, reasonCode = "boundary", sourceId = null) {
  return requestJson({
    method: "POST",
    path: "/api/v1/blocks",
    body: {
      target_user_id: targetUserId,
      reason_code: reasonCode,
      source_id: sourceId
    }
  });
}

export async function unblockUser(targetUserId) {
  return requestJson({
    method: "POST",
    path: `/api/v1/blocks/${targetUserId}/unblock`
  });
}

export async function resolveReport(reportId, action) {
  return requestJson({
    method: "POST",
    path: `/api/v1/admin/reports/${reportId}/resolve`,
    body: { action }
  });
}

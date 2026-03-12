import { clearStoredAuth, getPreferredInitialPanel, isBasicProfileComplete, resetAppState, state } from "./state.js";
import { $, localizeInterface, setLoadStatus, setPanel, setScreen, showToast, updateTabBadges } from "./dom.js";
import {
  acceptIncomingResponse,
  favoriteCandidate,
  loadBootstrapData,
  markNotificationsRead,
  logoutSession,
  rejectIncomingResponse,
  resolveReport,
  reportUser,
  sendChatMessage,
  restoreCandidate,
  skipCandidate,
  submitResponse,
  submitSignal,
  submitStoryAnswer,
  unfavoriteCandidate,
  updateBoundarySettings,
  updateProfile
} from "./data.js";

function getCurrentStoryRoom() {
  const rooms = [
    ...(state.data.storyRooms?.data?.active_rooms || []),
    ...(state.data.storyRooms?.data?.completed_rooms || [])
  ];
  const selected = rooms.find((room) => room.story_room_id === state.activeStoryRoomId);
  return selected || rooms[0] || null;
}

function getCurrentChatThread() {
  const items = state.data.chats?.data?.items || [];
  const selected = items.find((item) => item.thread_id === state.activeThreadId);
  return selected || items[0] || null;
}

function getInteractionLabel(status) {
  const labels = {
    available: "可发起回应",
    responded_pending: "等待对方处理",
    story_room_active: "剧情房进行中",
    chat_unlocked: "聊天已解锁",
    skipped: "已跳过"
  };
  return labels[status] || status;
}

function getExploreTabLabel(tab) {
  const labels = {
    recommended: "推荐",
    same_signal: "同信号",
    same_city: "同城",
    new: "新加入",
    review: "回看"
  };
  return labels[tab] || "推荐";
}

function getReviewFilterLabel(filter) {
  const labels = {
    all: "全部",
    favorited: "已收藏",
    responded: "已回应",
    skipped: "已跳过",
    restored: "已放回",
    restartable: "可重新推进"
  };
  return labels[filter] || "全部";
}

function getReviewSortLabel(sort) {
  const labels = {
    stage: "阶段优先",
    recent: "最近动作",
    favorite: "收藏优先"
  };
  return labels[sort] || "阶段优先";
}

function getActionLabel(action) {
  const labels = {
    impression: "进入候选池",
    favorited: "加入收藏",
    unfavorited: "取消收藏",
    skipped: "已跳过",
    restored: "已放回",
    responded: "已回应",
    response_sent: "发出回应",
    story_room_active: "进入剧情房",
    chat_unlocked: "聊天解锁"
  };
  return labels[action] || "有新动作";
}

function formatShortDateTime(value) {
  if (!value) {
    return "暂无";
  }
  return new Date(value).toLocaleDateString("zh-CN", {
    month: "numeric",
    day: "numeric"
  });
}

function getNotificationActionLabel(type) {
  const labels = {
    response_received: "New response",
    response_accepted: "Response accepted",
    response_rejected: "Response declined",
    story_room_completed: "Story Room completed",
    chat_message_received: "New message"
  };
  return labels[type] || "Update";
}

function getPersonaActionAdvice(tags) {
  const primary = tags[0]?.tag_name || "";
  if (primary.includes("慢热")) {
    return "Pick the crypto sector you genuinely follow most. Honest choices create better interest matches.";
  }
  if (primary.includes("稳定")) {
    return "Set your boundaries first, then choose the market sector you want to connect around right now.";
  }
  return "Choose your current market interest first, then explore the people with the clearest overlap.";
}

const INTEREST_SIGNAL_OPTIONS = [
  "Layer 1 / Public Chains (Ethereum, Solana)",
  "Exchange Tokens",
  "DeFi",
  "AI",
  "GameFi",
  "Meme",
  "RWA",
  "DePIN",
  "Layer 2",
  "Payments / Finance",
  "Privacy",
  "Storage / Compute",
  "Stablecoins",
  "NFT",
  "SocialFi"
];

function renderInterestSignalSelect(id, selectedValue = "", placeholder = "Choose one sector") {
  return `
    <div class="field" style="margin-top:12px;">
      <select id="${id}">
        <option value="">${placeholder}</option>
        ${INTEREST_SIGNAL_OPTIONS.map((option) => `
          <option value="${option}" ${selectedValue === option ? "selected" : ""}>${option}</option>
        `).join("")}
      </select>
    </div>
  `;
}

function formatGenderLabel(gender) {
  if (gender === "male") {
    return "Male";
  }
  if (gender === "female") {
    return "Female";
  }
  return "Unset";
}

async function refreshMatchesAndRerender(toastMessage = "Matches refreshed") {
  state.data = await loadBootstrapData();
  renderHome();
  renderExplore();
  renderStory();
  renderMessages();
  renderMe();
  showToast(toastMessage);
}

export function renderPersonaQuestion() {
  const questions = state.data.personaQuestions.data.questions;
  const question = questions[state.personaIndex];
  $("persona-step").textContent = `人格卡 ${state.personaIndex + 1} / ${questions.length}`;
  $("persona-progress").style.width = `${((state.personaIndex + 1) / questions.length) * 100}%`;
  $("persona-question-text").textContent = question.question_text;
  $("persona-next").disabled = true;
  state.selectedPersonaOption = null;

  const optionsWrap = $("persona-options");
  optionsWrap.innerHTML = "";

  question.options.forEach((option) => {
    const button = document.createElement("button");
    button.className = "option";
    button.textContent = `${option.option_key}. ${option.option_text}`;
    button.addEventListener("click", () => {
      optionsWrap.querySelectorAll(".option").forEach((node) => node.classList.remove("selected"));
      button.classList.add("selected");
      state.selectedPersonaOption = option.option_id;
      $("persona-next").disabled = false;
    });
    optionsWrap.appendChild(button);
  });

  $("persona-next").textContent = state.personaIndex === questions.length - 1 ? "生成我的人格卡" : "下一题";
  localizeInterface($("screen-persona"));
}

export function renderPersonaResult() {
  const tags = state.data.personaResult.data.persona_tags;
  const boundary = state.data.boundarySettings.data;
  const me = state.data.me.data;
  const signalData = state.data.signalToday.data;
  const advice = getPersonaActionAdvice(tags);
  const genderReady = me.profile.gender && me.profile.gender !== "unknown";
  const signalReady = Boolean(signalData.submitted && signalData.main_task?.answer_text);
  $("persona-result-card").innerHTML = `
    <div class="eyebrow">Your Signal Type</div>
    <h3 style="margin-top:8px;">${tags[0].tag_name}</h3>
    <p class="subtle">Your profile suggests a steady, thoughtful style, which helps the system frame how you approach new people and ideas.</p>
    <div class="chips">
      ${tags.map((tag) => `<span class="chip">${tag.tag_name}</span>`).join("")}
    </div>
    <div class="card" style="margin-top:14px; margin-bottom:0;">
      <div class="mini">进入系统前的第一步</div>
      <p class="subtle" style="margin-top:8px;">${advice}</p>
    </div>
    <div class="card warm" style="margin-top:12px; margin-bottom:0;">
      <div class="mini">快速边界设置</div>
      <div class="detail-grid">
        <label class="detail-row">
          <span class="subtle">仅看同城</span>
          <input id="persona-boundary-same-city" type="checkbox" ${boundary.accept_same_city_only ? "checked" : ""} />
        </label>
        <label class="detail-row">
          <span class="subtle">允许主动回应</span>
          <input id="persona-boundary-proactive" type="checkbox" ${boundary.allow_proactive_responses ? "checked" : ""} />
        </label>
        <label class="detail-row">
          <span class="subtle">展示城市</span>
          <input id="persona-boundary-city" type="checkbox" ${boundary.show_city ? "checked" : ""} />
        </label>
      </div>
    </div>
    <div class="card" style="margin-top:12px; margin-bottom:0;">
      <div class="mini">Which crypto sector are you into most right now?</div>
      <p class="subtle" style="margin-top:8px;">Choose one sector before entering Degen Signal. It powers interest matching and AI scoring.</p>
      ${
        signalReady
          ? `<div class="chips" style="margin-top:12px;"><span class="chip">${signalData.main_task.answer_text}</span></div>`
          : `
            ${renderInterestSignalSelect("persona-signal-select")}
            <button id="persona-signal-save-btn" class="btn secondary block" style="margin-top:12px;">Save interest</button>
          `
      }
    </div>
    <div class="card" style="margin-top:12px; margin-bottom:0;">
      <div class="mini">What you unlock next</div>
      <div class="detail-grid">
        <p class="subtle" style="margin:0;">1. A daily interest signal so the system knows what part of crypto you care about today.</p>
        <p class="subtle" style="margin:0;">2. Ranked people with clear explanations for the overlap.</p>
        <p class="subtle" style="margin:0;">3. If both sides are interested, you move into Story Room and then chat.</p>
      </div>
    </div>
  `;
  $("persona-result-next").textContent = "Enter Degen Signal";
  $("persona-result-next").disabled = !(genderReady && signalReady);

  [
    ["persona-boundary-same-city", "accept_same_city_only"],
    ["persona-boundary-proactive", "allow_proactive_responses"],
    ["persona-boundary-city", "show_city"]
  ].forEach(([id, field]) => {
    const node = $(id);
    if (!node) {
      return;
    }
    node.addEventListener("change", async () => {
      await updateBoundarySettings({ [field]: node.checked });
      state.data = await loadBootstrapData();
      renderPersonaResult();
      showToast("边界设置已保存");
    });
  });

  const saveSignalButton = $("persona-signal-save-btn");
  if (saveSignalButton) {
    saveSignalButton.addEventListener("click", async () => {
      const value = $("persona-signal-select")?.value?.trim();
      if (!value) {
        showToast("Choose one crypto sector first");
        return;
      }
      try {
        await submitSignal(value);
        state.data = await loadBootstrapData();
        renderPersonaResult();
        showToast("Interest saved");
      } catch (error) {
        showToast(error.message || "Could not save your answer");
      }
    });
  }

  localizeInterface($("screen-persona-result"));
}

export async function consumeNotificationTypes(types = []) {
  if (!Array.isArray(types) || types.length === 0) {
    return;
  }

  const unreadItems = state.data?.notifications?.data?.items?.filter(
    (item) => !item.read_at && types.includes(item.type)
  ) || [];

  if (unreadItems.length === 0) {
    return;
  }

  await markNotificationsRead(unreadItems.map((item) => item.notification_id));
  const readAt = new Date().toISOString();
  unreadItems.forEach((item) => {
    item.read_at = readAt;
  });
}

export function renderHome() {
  const homeData = state.data.home.data;
  const signalData = state.data.signalToday.data;
  const incomingResponses = state.data.responsesIncoming?.data?.items || [];
  const notifications = state.data.notifications?.data?.items || [];
  const unreadNotifications = notifications.filter((item) => !item.read_at);
  const guideCard = $("home-guide-card");

  guideCard.classList.toggle("hidden", signalData.submitted);
  guideCard.innerHTML = signalData.submitted
    ? ""
    : `
      <div class="mini">Getting started</div>
      <h3>Pick your sector, then open your matches</h3>
      <div class="detail-grid">
        <p class="subtle" style="margin:0;">1. Start with the crypto sector you care about most right now.</p>
        <p class="subtle" style="margin:0;">2. Explore uses that signal plus your profile to explain why someone is a fit.</p>
        <p class="subtle" style="margin:0;">3. If both sides are interested, you move into Story Room and then chat.</p>
      </div>
    `;

  $("home-signal-card").innerHTML = signalData.submitted
    ? `
      <div class="between">
        <div>
          <div class="mini">今日信号任务</div>
          <h3>${signalData.main_task.title}</h3>
        </div>
        <span class="pill">已完成</span>
      </div>
      <p class="subtle">${signalData.main_task.answer_text || signalData.answer_text}</p>
      <button id="home-go-explore" class="btn secondary block">查看推荐</button>
      <button id="home-refresh-matches" class="btn secondary block" style="margin-top:12px;">Refresh matches</button>
    `
    : `
      <div class="between">
        <div>
          <div class="mini">今日信号任务</div>
          <h3>${signalData.main_task.title}</h3>
        </div>
        <span class="pill">待完成</span>
      </div>
      <p class="subtle">${signalData.main_task.prompt_text}</p>
      ${renderInterestSignalSelect("signal-answer-input", "", "Choose one sector")}
      <button id="signal-submit-btn" class="btn primary block">Save interest signal</button>
      <button id="home-refresh-matches" class="btn secondary block" style="margin-top:12px;">Refresh matches</button>
    `;

  const hasStory = homeData.story_room_summary.count > 0;
  $("home-story-card").classList.toggle("hidden", !hasStory);
  if (hasStory) {
    const room = homeData.story_room_summary.items[0];
    $("home-story-card").innerHTML = `
      <div class="between">
        <div>
          <div class="mini">待完成剧情房</div>
          <h3>${room.nickname}</h3>
        </div>
        <span class="pill">${room.progress_text}</span>
      </div>
      <p class="subtle">还有最后一轮互动，完成后会解锁聊天。</p>
      <button id="home-go-story" class="btn secondary block">继续互动</button>
    `;
  }

  $("home-summary-card").innerHTML = `
    <div class="between">
      <div>
        <div class="mini">今日推荐摘要</div>
        <h3>${homeData.recommendation_summary.unlocked ? "完整推荐已开放" : "推荐待解锁"}</h3>
      </div>
      <button id="home-summary-refresh" class="btn secondary small">Refresh matches</button>
    </div>
    <p class="subtle">当前可见推荐：${homeData.recommendation_summary.count} 人。未读消息 ${homeData.unread_message_count} 条。</p>
    <p class="subtle" style="margin-top:8px;">下一步：${
      homeData.story_room_summary.count > 0
        ? "先完成剧情房，当前这段关系已经比继续刷人更值。"
        : signalData.submitted
          ? "去探索页看解释最强的一位候选，再决定是否回应。"
          : "先完成今日信号，推荐才会真正开放。"
    }</p>
    ${unreadNotifications.length > 0 ? `
      <div class="card soft" style="margin-top:12px; margin-bottom:0;">
        <div class="between">
          <div class="mini">Notifications</div>
          <button id="home-mark-notifications-read" class="btn secondary small">Mark all read</button>
        </div>
        <div class="detail-grid" style="margin-top:10px;">
          ${unreadNotifications.slice(0, 3).map((item) => `
            <div>
              <div class="detail-row">
                <span class="subtle">${getNotificationActionLabel(item.type)}</span>
                <span>${formatShortDateTime(item.created_at)}</span>
              </div>
              <p class="subtle" style="margin:6px 0 0;">${item.title}</p>
              <p class="subtle" style="margin:6px 0 0;">${item.body}</p>
            </div>
          `).join("")}
        </div>
      </div>
    ` : ""}
    ${incomingResponses.length > 0 ? `
      <div class="card warm" style="margin-top:12px; margin-bottom:0;">
        <div class="mini">Responses waiting for you</div>
        ${incomingResponses.map((item) => `
          <div style="margin-top:12px;">
            <h3 style="font-size:18px;">${item.nickname}</h3>
            <p class="subtle">${item.message}</p>
            <p class="subtle" style="margin-top:6px;">Latest signal: ${item.source_signal_preview || "No preview yet."}</p>
            <div class="row" style="margin-top:10px;">
              <button class="btn secondary block" data-home-accept-response="${item.response_id}">Accept and enter Story Room</button>
              <button class="btn secondary block" data-home-reject-response="${item.response_id}">Decline</button>
            </div>
          </div>
        `).join("")}
      </div>
    ` : ""}
  `;

  const exploreButton = $("home-go-explore");
  if (exploreButton) {
    exploreButton.addEventListener("click", () => setPanel("explore"));
  }

  const refreshButton = $("home-refresh-matches");
  if (refreshButton) {
    refreshButton.addEventListener("click", async () => {
      await refreshMatchesAndRerender("Matches refreshed");
    });
  }

  const summaryRefreshButton = $("home-summary-refresh");
  if (summaryRefreshButton) {
    summaryRefreshButton.addEventListener("click", async () => {
      await refreshMatchesAndRerender("Matches refreshed");
    });
  }

  const signalSubmitButton = $("signal-submit-btn");
  if (signalSubmitButton) {
    signalSubmitButton.addEventListener("click", async () => {
      const value = $("signal-answer-input").value.trim();
      if (!value) {
        showToast("Choose one crypto sector first");
        return;
      }
      try {
        await submitSignal(value);
        state.data = await loadBootstrapData();
        renderHome();
        renderExplore();
        renderMe();
        showToast("Interest signal saved. Matches refreshed.");
      } catch (error) {
        showToast(error.message || "Could not save your interest");
      }
    });
  }

  const storyButton = $("home-go-story");
  if (storyButton) {
    storyButton.addEventListener("click", () => {
      state.activeStoryRoomId = homeData.story_room_summary.items[0]?.story_room_id || null;
      setPanel("story");
    });
  }

  $("home-summary-card").querySelectorAll("[data-home-accept-response]").forEach((button) => {
    button.addEventListener("click", async () => {
      const response = await acceptIncomingResponse(button.dataset.homeAcceptResponse);
      await consumeNotificationTypes(["response_received"]);
      state.activeStoryRoomId = response.data.story_room_id;
      state.data = await loadBootstrapData();
      renderHome();
      renderExplore();
      renderStory();
      renderMessages();
      renderMe();
      setPanel("story");
      showToast("Response accepted. Story Room is ready.");
    });
  });

  $("home-summary-card").querySelectorAll("[data-home-reject-response]").forEach((button) => {
    button.addEventListener("click", async () => {
      await rejectIncomingResponse(button.dataset.homeRejectResponse);
      await consumeNotificationTypes(["response_received"]);
      state.data = await loadBootstrapData();
      renderHome();
      renderExplore();
      renderMessages();
      renderMe();
      showToast("Response declined");
    });
  });

  const markNotificationsReadButton = $("home-mark-notifications-read");
  if (markNotificationsReadButton) {
    markNotificationsReadButton.addEventListener("click", async () => {
      const ids = unreadNotifications.map((item) => item.notification_id);
      await markNotificationsRead(ids);
      state.data = await loadBootstrapData();
      renderHome();
      showToast("Notifications cleared");
    });
  }
  localizeInterface($("panel-home"));
}

export function renderExplore() {
  const lock = $("explore-lock");
  const list = $("explore-list");
  const detail = $("explore-detail");
  const selectedCandidate = state.data.selectedCandidate?.data || null;

  $("explore-tabs").querySelectorAll("[data-explore-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.exploreTab === state.activeExploreTab);
    button.onclick = async () => {
      state.activeExploreTab = button.dataset.exploreTab;
      state.selectedCandidateId = null;
      state.data = await loadBootstrapData();
      renderExplore();
    };
  });

  const exploreRefreshButton = $("explore-refresh-btn");
  if (exploreRefreshButton) {
    exploreRefreshButton.onclick = async () => {
      await refreshMatchesAndRerender("Explore updated");
    };
  }

  if (!state.data.signalToday.data.submitted) {
    lock.classList.remove("hidden");
    lock.innerHTML = `
      <h3>推荐暂未完全开放</h3>
      <p class="subtle">先完成今天的信号任务，系统才会把更准确的人推荐给你。</p>
    `;
    list.innerHTML = "";
    detail.classList.add("hidden");
    detail.innerHTML = "";
    localizeInterface($("panel-explore"));
    return;
  }

  lock.classList.add("hidden");
  const items = state.data.recommendations.data.items;
  const filteredItems = state.activeExploreTab === "review"
    ? items.filter((item) => {
      switch (state.activeReviewFilter) {
        case "favorited":
          return item.favorited;
        case "responded":
          return ["responded", "responded_pending", "story_room_active", "chat_unlocked"].includes(item.last_action)
            || ["responded_pending", "story_room_active", "chat_unlocked"].includes(item.interaction_state);
        case "skipped":
          return item.interaction_state === "skipped" || item.last_action === "skipped";
        case "restored":
          return item.last_action === "restored";
        case "restartable":
          return !["story_room_active", "chat_unlocked"].includes(item.interaction_state);
        default:
          return true;
      }
    })
    : items;
  const sortedItems = state.activeExploreTab === "review"
    ? [...filteredItems].sort((a, b) => {
      if (state.activeReviewSort === "recent") {
        return new Date(b.last_event_at || 0).getTime() - new Date(a.last_event_at || 0).getTime();
      }
      if (state.activeReviewSort === "favorite") {
        return Number(b.favorited) - Number(a.favorited)
          || (new Date(b.last_event_at || 0).getTime() - new Date(a.last_event_at || 0).getTime());
      }
      return (b.interaction_priority || 0) - (a.interaction_priority || 0)
        || (new Date(b.last_event_at || 0).getTime() - new Date(a.last_event_at || 0).getTime());
    })
    : filteredItems;
  const reviewSummary = {
    favorited: items.filter((item) => item.favorited).length,
    responded: items.filter((item) => ["responded_pending", "story_room_active", "chat_unlocked"].includes(item.interaction_state)).length,
    skipped: items.filter((item) => item.interaction_state === "skipped").length,
    restartable: items.filter((item) => !["story_room_active", "chat_unlocked"].includes(item.interaction_state)).length
  };
  const recentReviewActions = state.activeExploreTab === "review"
    ? [...items]
      .filter((item) => item.last_event_at)
      .sort((a, b) => new Date(b.last_event_at).getTime() - new Date(a.last_event_at).getTime())
      .slice(0, 3)
    : [];
  detail.classList.toggle("hidden", !selectedCandidate);
  detail.innerHTML = selectedCandidate
    ? `
      <div class="between">
        <div>
          <div class="mini">${getExploreTabLabel(state.activeExploreTab)}详情</div>
          <h3>${selectedCandidate.nickname}</h3>
          <p class="subtle">${selectedCandidate.age} 岁 · ${selectedCandidate.city}</p>
        </div>
        <span class="pill">${selectedCandidate.match_label}</span>
      </div>
      <p class="subtle" style="margin-top:12px;">${selectedCandidate.bio}</p>
      <div class="chips">
        ${selectedCandidate.persona_tags.map((tag) => `<span class="chip">${tag.tag_name}</span>`).join("")}
        ${selectedCandidate.favorited ? '<span class="chip">已收藏</span>' : ""}
        ${state.activeExploreTab === "review" ? '<span class="chip">回看对象</span>' : ""}
      </div>
      <div class="row" style="margin-top:12px;">
        ${!selectedCandidate.favorited
          ? `<button class="btn secondary small" id="detail-favorite-btn">收藏待看</button>`
          : `<button class="btn secondary small" id="detail-unfavorite-btn">取消收藏</button>`}
        ${selectedCandidate.interaction_state === "skipped"
          ? `<button class="btn secondary small" id="detail-restore-btn">撤销跳过</button>`
          : state.activeExploreTab === "review"
            ? `<button class="btn secondary small" id="detail-return-btn">回到推荐</button>`
            : ""}
      </div>
      <div class="row" style="margin-top:12px;">
        <button class="btn secondary small" id="detail-report-btn">举报</button>
      </div>
      <div class="card warm" style="margin-top:12px; margin-bottom:0;">
        <div class="mini">为什么现在推荐她</div>
        <p class="subtle">${selectedCandidate.recommend_reason}</p>
        ${selectedCandidate.ai_match ? `
          <div class="detail-row" style="margin-top:10px;">
            <span class="subtle">Interest match</span>
            <span>${selectedCandidate.ai_match.score}/100</span>
          </div>
          <p class="subtle" style="margin-top:8px;">${selectedCandidate.ai_match.reason}</p>
        ` : ""}
        <div class="detail-grid">
          ${selectedCandidate.recommendation_factors.map((item) => `<p class="subtle" style="margin:0;">${item}</p>`).join("")}
        </div>
      </div>
      <div class="card" style="margin-top:12px; margin-bottom:0;">
        <div class="mini">共享点</div>
        <div class="chips">
          ${(selectedCandidate.shared_persona_tags || []).map((tag) => `<span class="chip">${tag}</span>`).join("")}
          ${(selectedCandidate.shared_signal_themes || []).map((theme) => `<span class="chip">${theme}</span>`).join("")}
          ${selectedCandidate.shared_persona_tags.length === 0 && selectedCandidate.shared_signal_themes.length === 0 ? '<span class="chip">还在观察中</span>' : ""}
        </div>
      </div>
      <div class="card" style="margin-top:12px; margin-bottom:0;">
        <div class="mini">边界适配</div>
        <div class="detail-grid">
          <div class="detail-row"><span class="subtle">当前阶段</span><span>${getInteractionLabel(selectedCandidate.interaction_state)}</span></div>
          <div class="detail-row"><span class="subtle">同城判断</span><span>${selectedCandidate.boundary_summary.same_city ? "是" : "否"}</span></div>
          <div class="detail-row"><span class="subtle">你的同城限制</span><span>${selectedCandidate.boundary_summary.same_city_required ? "已开启" : "未开启"}</span></div>
          <div class="detail-row"><span class="subtle">允许主动回应</span><span>${selectedCandidate.boundary_summary.accepts_proactive ? "是" : "否"}</span></div>
        </div>
      </div>
      <div class="card soft" style="margin-top:12px; margin-bottom:0;">
        <div class="mini">下一步建议</div>
        <h3 style="font-size:18px; margin-top:8px;">${selectedCandidate.next_action_advice.title}</h3>
        <p class="subtle">${selectedCandidate.next_action_advice.description}</p>
        <div class="detail-grid">
          <div class="detail-row"><span class="subtle">人格匹配分</span><span>${selectedCandidate.score_breakdown.tag_score.toFixed(3)}</span></div>
          <div class="detail-row"><span class="subtle">信号共振分</span><span>${selectedCandidate.score_breakdown.signal_score.toFixed(3)}</span></div>
          <div class="detail-row"><span class="subtle">关系阶段分</span><span>${selectedCandidate.score_breakdown.stage_score.toFixed(3)}</span></div>
          ${selectedCandidate.score_breakdown.ai_score !== undefined ? `<div class="detail-row"><span class="subtle">AI interest-fit</span><span>${selectedCandidate.score_breakdown.ai_score}</span></div>` : ""}
        </div>
      </div>
      <div class="card" style="margin-top:12px; margin-bottom:0;">
        <div class="mini">最近信号</div>
        <p class="subtle">${selectedCandidate.recent_signal_preview}</p>
      </div>
      <div class="card" style="margin-top:12px; margin-bottom:0;">
        <div class="mini">关系时间线</div>
        <div class="detail-grid">
          ${(selectedCandidate.relationship_timeline || []).map((item) => `
            <div>
              <div class="detail-row">
                <span class="subtle">${item.title}</span>
                <span>${new Date(item.created_at).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}</span>
              </div>
              <p class="subtle" style="margin:6px 0 0;">${item.description}</p>
            </div>
          `).join("") || '<p class="subtle" style="margin:0;">还没有更多互动记录。</p>'}
        </div>
      </div>
    `
    : "";

  const detailFavoriteButton = $("detail-favorite-btn");
  if (detailFavoriteButton && selectedCandidate) {
    detailFavoriteButton.addEventListener("click", async () => {
      await favoriteCandidate(selectedCandidate.candidate_user_id);
      state.data = await loadBootstrapData();
      renderExplore();
      showToast("已加入收藏，方便之后回看");
    });
  }

  const detailUnfavoriteButton = $("detail-unfavorite-btn");
  if (detailUnfavoriteButton && selectedCandidate) {
    detailUnfavoriteButton.addEventListener("click", async () => {
      await unfavoriteCandidate(selectedCandidate.candidate_user_id);
      state.data = await loadBootstrapData();
      renderExplore();
      showToast("已取消收藏");
    });
  }

  const detailRestoreButton = $("detail-restore-btn");
  if (detailRestoreButton && selectedCandidate) {
    detailRestoreButton.addEventListener("click", async () => {
      await restoreCandidate(selectedCandidate.candidate_user_id);
      state.activeExploreTab = "recommended";
      state.selectedCandidateId = selectedCandidate.candidate_user_id;
      state.data = await loadBootstrapData();
      renderExplore();
      showToast("这位候选人已放回推荐");
    });
  }

  const detailReturnButton = $("detail-return-btn");
  if (detailReturnButton && selectedCandidate) {
    detailReturnButton.addEventListener("click", async () => {
      state.activeExploreTab = "recommended";
      state.selectedCandidateId = selectedCandidate.candidate_user_id;
      state.data = await loadBootstrapData();
      renderExplore();
      showToast("已切回推荐视图");
    });
  }

  const detailReportButton = $("detail-report-btn");
  if (detailReportButton && selectedCandidate) {
    detailReportButton.addEventListener("click", async () => {
      await reportUser(
        selectedCandidate.candidate_user_id,
        "suspicious_behavior",
        "candidate",
        selectedCandidate.candidate_user_id,
        "前端演示举报入口"
      );
      state.selectedCandidateId = null;
      state.data = await loadBootstrapData();
      renderHome();
      renderExplore();
      renderMessages();
      showToast("举报已提交，系统会暂时隐藏这位用户");
    });
  }

  if (state.activeExploreTab === "review") {
    lock.classList.remove("hidden");
    lock.innerHTML = `
      <div class="between">
        <div>
          <div class="mini">回看总览</div>
          <h3 style="font-size:18px; margin-top:8px;">当前共有 ${items.length} 条可回看关系</h3>
        </div>
        <span class="pill">${getReviewFilterLabel(state.activeReviewFilter)}</span>
      </div>
      <div class="summary-grid">
        <button class="card soft summary-card ${state.activeReviewFilter === "favorited" ? "active" : ""}" data-summary-filter="favorited" style="margin:0;">
          <div class="mini">已收藏</div>
          <h3 style="font-size:18px; margin-top:8px;">${reviewSummary.favorited}</h3>
        </button>
        <button class="card soft summary-card ${state.activeReviewFilter === "responded" ? "active" : ""}" data-summary-filter="responded" style="margin:0;">
          <div class="mini">已回应</div>
          <h3 style="font-size:18px; margin-top:8px;">${reviewSummary.responded}</h3>
        </button>
        <button class="card soft summary-card ${state.activeReviewFilter === "skipped" ? "active" : ""}" data-summary-filter="skipped" style="margin:0;">
          <div class="mini">已跳过</div>
          <h3 style="font-size:18px; margin-top:8px;">${reviewSummary.skipped}</h3>
        </button>
        <button class="card soft summary-card ${state.activeReviewFilter === "restartable" ? "active" : ""}" data-summary-filter="restartable" style="margin:0;">
          <div class="mini">可重新推进</div>
          <h3 style="font-size:18px; margin-top:8px;">${reviewSummary.restartable}</h3>
        </button>
      </div>
      <div class="card warm" style="margin-top:12px; margin-bottom:0;">
        <div class="mini">最近 3 次动作</div>
        <div class="detail-grid">
          ${recentReviewActions.map((item) => `
            <div class="detail-row">
              <span class="subtle">${item.nickname} · ${getActionLabel(item.last_action)}</span>
              <span>${formatShortDateTime(item.last_event_at)}</span>
            </div>
          `).join("") || '<p class="subtle" style="margin:0;">当前还没有可摘要的动作。</p>'}
        </div>
      </div>
      <div class="row" style="margin-top:14px;">
        <button class="btn secondary small" id="review-filter-restartable">只看可重新推进</button>
        <button class="btn secondary small" id="review-restore-all">恢复全部已跳过</button>
      </div>
      <div class="mini" style="margin-top:14px;">回看排序</div>
      <div class="chips" style="margin-top:10px;">
        ${["stage", "recent", "favorite"].map((sort) => `
          <button class="chip chip-button ${state.activeReviewSort === sort ? "active" : ""}" data-review-sort="${sort}">
            ${getReviewSortLabel(sort)}
          </button>
        `).join("")}
      </div>
      <div class="mini" style="margin-top:14px;">回看筛选</div>
      <div class="chips" style="margin-top:10px;">
        ${["all", "favorited", "responded", "skipped", "restored", "restartable"].map((filter) => `
          <button class="chip chip-button ${state.activeReviewFilter === filter ? "active" : ""}" data-review-filter="${filter}">
            ${getReviewFilterLabel(filter)}
          </button>
        `).join("")}
      </div>
    `;
    lock.querySelectorAll("[data-review-filter]").forEach((button) => {
      button.onclick = () => {
        state.activeReviewFilter = button.dataset.reviewFilter;
        renderExplore();
      };
    });
    lock.querySelectorAll("[data-summary-filter]").forEach((button) => {
      button.onclick = () => {
        state.activeReviewFilter = button.dataset.summaryFilter;
        renderExplore();
      };
    });
    lock.querySelectorAll("[data-review-sort]").forEach((button) => {
      button.onclick = () => {
        state.activeReviewSort = button.dataset.reviewSort;
        renderExplore();
      };
    });

    const restartableButton = $("review-filter-restartable");
    if (restartableButton) {
      restartableButton.onclick = () => {
        state.activeReviewFilter = "restartable";
        renderExplore();
      };
    }

    const restoreAllButton = $("review-restore-all");
    if (restoreAllButton) {
      restoreAllButton.onclick = async () => {
        const skippedItems = items.filter((item) => item.interaction_state === "skipped");
        if (skippedItems.length === 0) {
          showToast("当前没有可恢复的已跳过对象");
          return;
        }
        await Promise.all(skippedItems.map((item) => restoreCandidate(item.candidate_user_id)));
        state.activeReviewFilter = "restartable";
        state.data = await loadBootstrapData();
        renderExplore();
        showToast(`已恢复 ${skippedItems.length} 个已跳过对象`);
      };
    }
  }

  if (sortedItems.length === 0) {
    list.innerHTML = `
      <div class="card warm">
        <div class="mini">${getExploreTabLabel(state.activeExploreTab)} · ${state.activeExploreTab === "review" ? getReviewFilterLabel(state.activeReviewFilter) : ""}</div>
        <h3>No people available here yet</h3>
        <p class="subtle">${
          state.activeExploreTab === "review"
            ? "Try another filter, or come back after you favorite, skip, or respond to someone."
            : "Only verified real members who have completed their interest signal can appear here. Check back after more people join."
        }</p>
      </div>
    `;
    localizeInterface($("panel-explore"));
    return;
  }

  list.innerHTML = sortedItems.map((item) => `
    <div class="candidate ${item.candidate_user_id === state.selectedCandidateId ? "selected" : ""}">
      <div class="between">
        <div class="row">
          <div class="avatar">${item.nickname.slice(0, 1)}</div>
          <div>
            <h3 style="font-size:18px;">${item.nickname}</h3>
            <p class="subtle">${item.age} 岁 · ${item.city}</p>
          </div>
        </div>
        <span class="pill">${item.match_label}</span>
      </div>
      <div class="chips">
        ${item.persona_tags.map((tag) => `<span class="chip">${tag}</span>`).join("")}
        ${item.favorited ? '<span class="chip">已收藏</span>' : ""}
      </div>
      <p class="subtle" style="margin-top:12px;">最近回答：${item.recent_signal_preview}</p>
        <div class="card warm" style="margin-top:12px;">
          <div class="mini">推荐理由</div>
          <p class="subtle">${item.recommend_reason}</p>
          ${item.ai_match ? `<p class="subtle" style="margin-top:8px;">Interest match ${item.ai_match.score}/100</p>` : ""}
          <p class="subtle" style="margin-top:8px;">当前阶段：${getInteractionLabel(item.interaction_state)}</p>
        ${state.activeExploreTab === "review"
          ? `<p class="subtle" style="margin-top:8px;">最近动作：${item.last_action || "还没有明显动作"} · ${formatShortDateTime(item.last_event_at)} · 记录 ${item.timeline_count} 条。</p>`
          : ""}
      </div>
      <div class="row" style="margin-top:12px;">
        <button class="btn secondary small" data-candidate-action="detail" data-candidate="${item.candidate_user_id}">查看详情</button>
        ${state.activeExploreTab === "review" && item.interaction_state === "skipped"
          ? `<button class="btn secondary small" data-candidate-action="restore" data-candidate="${item.candidate_user_id}">撤销跳过</button>`
          : state.activeExploreTab === "review"
            ? `<button class="btn secondary small" data-candidate-action="return" data-candidate="${item.candidate_user_id}">回到推荐</button>`
            : ""}
        ${!item.favorited
          ? `<button class="btn secondary small" data-candidate-action="favorite" data-candidate="${item.candidate_user_id}">收藏</button>`
          : `<button class="btn secondary small" data-candidate-action="unfavorite" data-candidate="${item.candidate_user_id}">取消收藏</button>`}
        <button class="btn ${item.interaction_state === "available" ? "primary" : "secondary"} small" data-candidate-action="primary" data-candidate="${item.candidate_user_id}">
          ${
            item.interaction_state === "story_room_active"
              ? "进入剧情房"
              : item.interaction_state === "responded_pending"
                ? "已回应"
                : item.interaction_state === "chat_unlocked"
                  ? "去聊天"
                  : item.interaction_state === "skipped"
                    ? "已跳过"
                    : "回应"
          }
        </button>
        ${item.interaction_state === "available"
          ? `<button class="btn secondary small" data-candidate-action="skip" data-candidate="${item.candidate_user_id}">跳过</button>`
          : ""}
      </div>
    </div>
  `).join("");

  list.querySelectorAll("[data-candidate]").forEach((button) => {
    button.addEventListener("click", async () => {
      const candidateId = button.dataset.candidate;
      const action = button.dataset.candidateAction || "primary";
      const candidate = sortedItems.find((item) => item.candidate_user_id === candidateId);

      if (!candidate) {
        return;
      }

      if (action === "detail") {
        state.selectedCandidateId = candidateId;
        state.data = await loadBootstrapData();
        renderExplore();
        return;
      }

      if (action === "favorite") {
        await favoriteCandidate(candidateId);
        state.selectedCandidateId = candidateId;
        state.data = await loadBootstrapData();
        renderExplore();
        showToast("已加入收藏，方便之后回看");
        return;
      }

      if (action === "unfavorite") {
        await unfavoriteCandidate(candidateId);
        state.selectedCandidateId = candidateId;
        state.data = await loadBootstrapData();
        renderExplore();
        showToast("已取消收藏");
        return;
      }

      if (action === "restore") {
        await restoreCandidate(candidateId);
        state.activeExploreTab = "recommended";
        state.selectedCandidateId = candidateId;
        state.data = await loadBootstrapData();
        renderExplore();
        showToast("这位候选人已放回推荐");
        return;
      }

      if (action === "return") {
        state.activeExploreTab = "recommended";
        state.selectedCandidateId = candidateId;
        state.data = await loadBootstrapData();
        renderExplore();
        showToast("已切回推荐视图");
        return;
      }

      if (action === "skip") {
        await skipCandidate(candidateId);
        if (state.selectedCandidateId === candidateId) {
          state.selectedCandidateId = null;
        }
        state.data = await loadBootstrapData();
        renderHome();
        renderExplore();
        renderMe();
        showToast("已降低这位候选人的曝光");
        return;
      }

      if (candidate.interaction_state === "available") {
        try {
          const response = await submitResponse(candidateId, `你的这条回答让我有点想继续了解。`);
          if (response.data.story_room_id) {
            state.activeStoryRoomId = response.data.story_room_id;
          }
          state.data = await loadBootstrapData();
          renderHome();
          renderExplore();
          renderStory();
          renderMessages();
          renderMe();
          if (response.data.relation_status === "story_room_active") {
            setPanel("story");
            showToast("回应成立，已进入剧情房");
            return;
          }
          showToast("回应已送达，等待对方查看");
        } catch (error) {
          showToast(error.message || "回应发送失败");
        }
        return;
      }

      if (candidate.interaction_state === "story_room_active") {
        state.activeStoryRoomId = candidate.story_room_id;
        setPanel("story");
        return;
      }

      if (candidate.interaction_state === "chat_unlocked") {
        state.activeThreadId = candidate.thread_id;
        setPanel("messages");
        return;
      }

      showToast("当前关系还在等待推进");
    });
  });
  localizeInterface($("panel-explore"));
}

export function renderStory() {
  const summary = state.data.storyRooms.data;
  const selectedRoom = getCurrentStoryRoom();
  const storyDetail = state.data.storyActive?.data || null;
  state.selectedStoryOption = null;

  if (!storyDetail || !selectedRoom) {
    $("story-list-card").innerHTML = `
      <div class="mini">剧情房列表</div>
      <h3>还没有进行中的剧情房</h3>
      <p class="subtle">先在探索页发起回应，双向成立后才会进入剧情房。</p>
    `;
    $("story-detail").classList.add("hidden");
    $("story-header-card").innerHTML = "";
    $("story-question-card").innerHTML = "";
    $("story-insight-card").innerHTML = "";
    localizeInterface($("panel-story"));
    return;
  }

  state.activeStoryRoomId = selectedRoom.story_room_id;

  const allRooms = [...summary.active_rooms, ...summary.completed_rooms];
  $("story-list-card").innerHTML = `
    <div class="mini">剧情房列表</div>
    ${allRooms.map((room) => `
      <div class="card ${room.story_room_id === state.activeStoryRoomId ? "warm" : ""}" data-story-room="${room.story_room_id}" style="margin-top:12px; cursor:pointer;">
        <div class="between">
          <div>
            <h3>${room.nickname}</h3>
            <p class="subtle">${
              room.room_status === "completed"
                ? "这段剧情已完成，聊天已解锁。"
                : `当前进行中：${room.answered_rounds} / ${room.total_questions}`
            }</p>
          </div>
          <span class="pill">${room.room_status === "completed" ? "已完成" : "进行中"}</span>
        </div>
      </div>
    `).join("")}
  `;

  $("story-list-card").querySelectorAll("[data-story-room]").forEach((button) => {
    button.addEventListener("click", async () => {
      state.activeStoryRoomId = button.dataset.storyRoom;
      state.storyInsightVisible = false;
      state.data = await loadBootstrapData();
      renderStory();
    });
  });

  $("story-detail").classList.remove("hidden");

  $("story-header-card").innerHTML = `
    <div class="between">
      <div>
        <div class="mini">剧情房对象</div>
        <h3>${storyDetail.peer.nickname}</h3>
      </div>
      <span class="pill">${storyDetail.room_status === "completed" ? "3 / 3" : `${storyDetail.answered_rounds} / ${storyDetail.total_questions}`}</span>
    </div>
    <p class="subtle">剩余时间：${storyDetail.expires_at}</p>
    <p class="subtle" style="margin-top:10px;">Finish the shared prompt here. Both of you will be moved into chat as soon as the room is completed.</p>
  `;

  $("story-question-card").innerHTML = storyDetail.room_status === "completed"
    ? `
      <div class="mini">当前状态</div>
      <h3>剧情房已完成</h3>
      <p class="subtle">最后一轮已经提交，关系已进入已解锁聊天。</p>
      <button id="story-go-chat" class="btn primary block">进入聊天</button>
    `
    : `
      <div class="mini">当前情境</div>
      <h3>${storyDetail.current_question.content}</h3>
      <p class="subtle">Answer this together. We will notify both sides as soon as chat unlocks.</p>
      <div id="story-options" class="option-list">
        ${storyDetail.current_question.options.map((option) => `
          <button class="option" data-story-option="${option.option_id}">
            ${option.option_id}. ${option.option_text}
          </button>
        `).join("")}
      </div>
      <button id="story-submit-btn" class="btn primary block" disabled>提交答案</button>
    `;

  $("story-insight-card").classList.toggle("hidden", !state.storyInsightVisible || !state.lastStoryInsight);
  if (state.storyInsightVisible) {
    const insight = state.lastStoryInsight;
    $("story-insight-card").innerHTML = `
      <div class="mini">系统观察</div>
      <h3>${insight.chat_unlocked ? "聊天已解锁" : "默契摘要"}</h3>
      <p class="subtle">${insight.insight}</p>
      <button id="insight-next-btn" class="btn secondary block">${insight.chat_unlocked ? "去聊天" : "继续"}</button>
    `;
    $("insight-next-btn").addEventListener("click", () => {
      if (insight.chat_unlocked) {
        setPanel("messages");
      }
    });
  } else {
    $("story-insight-card").innerHTML = "";
  }

  const optionsWrap = $("story-options");
  if (optionsWrap) {
    optionsWrap.querySelectorAll("[data-story-option]").forEach((button) => {
      button.addEventListener("click", () => {
        optionsWrap.querySelectorAll(".option").forEach((node) => node.classList.remove("selected"));
        button.classList.add("selected");
        state.selectedStoryOption = button.dataset.storyOption;
        $("story-submit-btn").disabled = false;
      });
    });
  }

  const storySubmit = $("story-submit-btn");
  if (storySubmit) {
    storySubmit.addEventListener("click", async () => {
      if (!state.selectedStoryOption) {
        return;
      }
      const response = await submitStoryAnswer(
        storyDetail.story_room_id,
        storyDetail.current_question.story_question_id,
        state.selectedStoryOption
      );
      state.lastStoryInsight = response.data;
      state.activeThreadId = response.data.chat_thread_id || state.activeThreadId;
      state.storyInsightVisible = true;
      state.data = await loadBootstrapData();
      renderStory();
      renderHome();
      renderMessages();
      renderMe();
      showToast("剧情房完成，聊天已解锁");
    });
  }

  const goChat = $("story-go-chat");
  if (goChat) {
    goChat.addEventListener("click", () => {
      state.activeThreadId = state.data.chatThread?.data?.thread_id || state.activeThreadId;
      setPanel("messages");
    });
  }
  localizeInterface($("panel-story"));
}

export function renderMessages() {
  const chats = state.data.chats.data.items;
  const currentChat = getCurrentChatThread();
  const thread = state.data.chatThread?.data || null;
  const isUnlocked = Boolean(currentChat && thread);
  const incoming = state.data.responsesIncoming?.data?.items || [];

  $("chat-list-card").innerHTML = isUnlocked
    ? `
      <div class="mini">已解锁聊天</div>
      ${chats.map((item) => `
        <div class="card ${item.thread_id === currentChat.thread_id ? "warm" : ""}" style="margin-top:12px;">
          <h3>${item.peer.nickname}</h3>
          <p class="subtle">最近一条：${item.last_message.content}</p>
          <p class="subtle" style="margin-top:6px;">Stay in sync here. New messages trigger an alert for the other side automatically.</p>
          <button class="btn secondary block" data-thread-id="${item.thread_id}" style="margin-top:12px;">打开聊天</button>
        </div>
      `).join("")}
    `
    : `
      <div class="mini">消息状态</div>
      <h3>聊天还没解锁</h3>
      <p class="subtle">完成剧情房 3 轮互动后，消息才会出现在这里。</p>
    `;

  if (incoming.length > 0) {
    $("chat-list-card").innerHTML += `
      ${incoming.map((item) => `
        <div class="card warm" style="margin-top:12px;">
          <div class="mini">待处理回应</div>
          <h3>${item.nickname}</h3>
          <p class="subtle">${item.message}</p>
          <p class="subtle">对方最近信号：${item.source_signal_preview}</p>
          <div class="row" style="margin-top:12px;">
            <button class="btn secondary block" data-accept-response="${item.response_id}">接受并进入剧情房</button>
            <button class="btn secondary block" data-reject-response="${item.response_id}">Decline</button>
          </div>
        </div>
      `).join("")}
    `;
  }

  $("chat-thread-card").innerHTML = isUnlocked
    ? thread.messages.map((message) => `
      <div class="message ${message.sender_user_id === state.auth?.user_id ? "outgoing" : "incoming"}">
        ${message.content}
      </div>
    `).join("")
    : `<p class="subtle">当前没有可见聊天线程。</p>`;

  $("chat-compose-card").innerHTML = isUnlocked
    ? `
      <div class="field">
        <textarea id="chat-draft" placeholder="输入一条消息"></textarea>
      </div>
      <button id="chat-send-btn" class="btn primary block">发送消息</button>
    `
    : `<p class="subtle">先完成剧情房，再回来这里。</p>`;

  const sendButton = $("chat-send-btn");
  if (sendButton) {
    sendButton.addEventListener("click", async () => {
      const draft = $("chat-draft").value.trim();
      if (!draft) {
        showToast("先输入一条消息");
        return;
      }
      try {
        await sendChatMessage(currentChat.thread_id, draft);
        state.data = await loadBootstrapData();
        renderMessages();
        showToast("消息已发送");
      } catch (error) {
        showToast(error.message || "消息发送失败");
      }
    });
  }

  $("chat-list-card").querySelectorAll("[data-thread-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      state.activeThreadId = button.dataset.threadId;
      state.data = await loadBootstrapData();
      renderMessages();
    });
  });

  $("chat-list-card").querySelectorAll("[data-accept-response]").forEach((button) => {
    button.addEventListener("click", async () => {
      const response = await acceptIncomingResponse(button.dataset.acceptResponse);
      await consumeNotificationTypes(["response_received"]);
      state.activeStoryRoomId = response.data.story_room_id;
      state.data = await loadBootstrapData();
      renderHome();
      renderExplore();
      renderStory();
      renderMessages();
      renderMe();
      setPanel("story");
      showToast("回应已接受，已进入剧情房");
    });
  });
  $("chat-list-card").querySelectorAll("[data-reject-response]").forEach((button) => {
    button.addEventListener("click", async () => {
      await rejectIncomingResponse(button.dataset.rejectResponse);
      await consumeNotificationTypes(["response_received"]);
      state.data = await loadBootstrapData();
      renderHome();
      renderExplore();
      renderStory();
      renderMessages();
      renderMe();
      showToast("Response declined");
    });
  });
  localizeInterface($("panel-messages"));
}

export function renderMe() {
  const me = state.data.me.data;
  const boundary = state.data.boundarySettings.data;
  const reportReasons = state.data.reportReasons.data.items;
  const myReports = state.data.myReports.data.items;
  const myBlocks = state.data.myBlocks.data.items;
  const adminStats = state.data.adminStats?.data || null;
  const auditEvents = state.data.adminAuditEvents?.data?.items || [];
  const moderationQueue = state.data.moderationQueue?.data?.items || [];
  const personaTags = state.data.personaResult.data.persona_tags;
  const signalPreview = state.data.signalToday.data.submitted
    ? state.data.home.data.today_signal.answer_preview
    : "今天还没有发出新的信号。";
  const isUnlocked = state.data.chats.data.items.length > 0;
  const profileComplete = isBasicProfileComplete(me.profile);
  const profileHeadline = me.profile.nickname?.trim() || "Your profile";
  const profileAvatar = (me.profile.nickname?.trim() || "U").slice(0, 1).toUpperCase();

  $("me-profile-card").innerHTML = `
    ${!profileComplete ? `
      <div class="card warm" style="margin:0 0 14px;">
        <div class="mini">Start here</div>
        <h3 style="margin-top:8px;">Complete your basic info first</h3>
        <p class="subtle" style="margin-top:8px;">Add your nickname, city, age, and gender before exploring matches. This keeps recommendations focused on real members who fit your profile.</p>
      </div>
    ` : ""}
    <div class="row">
      <div class="avatar">${profileAvatar}</div>
      <div>
        <h3>${profileHeadline}</h3>
        <p class="subtle">${me.profile.city} · ${me.profile.age} · ${formatGenderLabel(me.profile.gender)}</p>
      </div>
    </div>
    <div class="chips">
      ${personaTags.map((tag) => `<span class="chip">${tag.tag_name}</span>`).join("")}
    </div>
    <div class="field" style="margin-top:16px;">
      <label>昵称</label>
      <input id="profile-nickname-input" value="${me.profile.nickname}" maxlength="24" />
    </div>
    <div class="field" style="margin-top:12px;">
      <label>城市</label>
      <input id="profile-city-input" value="${me.profile.city}" maxlength="32" />
    </div>
    <div class="field" style="margin-top:12px;">
      <label>Age</label>
      <input id="profile-age-input" type="number" min="18" max="99" value="${me.profile.age}" />
    </div>
    <div class="field" style="margin-top:12px;">
      <label>Gender</label>
      <select id="profile-gender-input">
        <option value="" ${!["male", "female"].includes(me.profile.gender) ? "selected" : ""}>Select your gender</option>
        <option value="male" ${me.profile.gender === "male" ? "selected" : ""}>Male</option>
        <option value="female" ${me.profile.gender === "female" ? "selected" : ""}>Female</option>
      </select>
    </div>
    <div class="row" style="margin-top:12px;">
      <button id="profile-save-btn" class="btn secondary block">保存资料</button>
      <button id="logout-btn" class="btn secondary block">退出登录</button>
    </div>
  `;

  $("me-signal-card").innerHTML = `
    <div class="mini">最近信号</div>
    <h3>${signalPreview}</h3>
    <p class="subtle">系统会把这类表达用于推荐解释和回应入口。</p>
  `;

  $("me-stats-card").innerHTML = "";
  $("me-stats-card").classList.add("hidden");

  $("me-safety-card").innerHTML = `
    <div class="between">
      <div>
        <div class="mini">安全管理</div>
        <h3>举报 ${myReports.length} 条</h3>
      </div>
      <span class="pill">${reportReasons.length} 个原因</span>
    </div>
    <div class="detail-grid" style="margin-top:12px;">
      ${myReports.slice(0, 3).map((item) => `
        <div class="card warm" style="margin:0;">
          <div class="detail-row">
            <span class="subtle">${item.target_nickname}</span>
            <span>${item.status}</span>
          </div>
          <p class="subtle" style="margin:6px 0 0;">原因：${item.reason_code}${item.detail ? ` · ${item.detail}` : ""}</p>
        </div>
      `).join("") || '<p class="subtle" style="margin:0;">当前还没有举报记录。</p>'}
    </div>
  `;

  $("me-admin-card").innerHTML = "";
  $("me-admin-card").classList.add("hidden");

  const saveButton = $("profile-save-btn");
  const nicknameInput = $("profile-nickname-input");
  const cityInput = $("profile-city-input");
  const ageInput = $("profile-age-input");
  const genderInput = $("profile-gender-input");

  if (saveButton && nicknameInput && cityInput && ageInput && genderInput) {
    saveButton.addEventListener("click", async () => {
      const nickname = nicknameInput.value.trim();
      const city = cityInput.value.trim();
      const age = Number(ageInput.value || 0);
      const gender = genderInput.value;
      if (!nickname || !city || age < 18 || !gender) {
        showToast("Nickname, city, age, and gender are required");
        return;
      }

      await updateProfile({ nickname, city, age, gender });
      state.data = await loadBootstrapData();
      renderHome();
      renderExplore();
      renderMessages();
      renderMe();
      if (isBasicProfileComplete(state.data?.me?.data?.profile)) {
        showToast("Profile updated");
      } else {
        showToast("Keep going. Finish your basic profile to continue");
      }
    });
  }

  const logoutButton = $("logout-btn");
  if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
      try {
        await logoutSession();
      } catch (_error) {
        // Session may already be invalid; local logout should still continue.
      }
      if (session?.auth_method === "wallet") {
        try {
          const provider = window.phantom?.solana || window.solana;
          if (provider?.disconnect) {
            await provider.disconnect();
          }
        } catch (_error) {
          // Wallet disconnect is best-effort only.
        }
      }
      clearStoredAuth();
      resetAppState();
      const walletCard = $("wallet-connection-card");
      if (walletCard) {
        walletCard.classList.add("hidden");
        walletCard.innerHTML = "";
      }
      setLoadStatus("", false, false);
      setScreen("screen-login");
      setPanel("me");
      showToast("已退出登录");
    });
  }

  localizeInterface($("panel-me"));
}

export function renderApp() {
  renderHome();
  renderExplore();
  renderStory();
  renderMessages();
  renderMe();
  const unreadItems = state.data.notifications?.data?.items?.filter((item) => !item.read_at) || [];
  const unreadNotifications = unreadItems.length;
  const incomingResponses = state.data.responsesIncoming?.data?.items?.length || 0;
  const activeStories = state.data.storyRooms?.data?.active_rooms?.length || 0;
  const recommendedCount = state.data.recommendations?.data?.items?.length || 0;
  const storyAlerts = unreadItems.filter((item) => item.type === "story_room_completed").length;
  const messageAlerts = unreadItems.filter((item) => item.type === "chat_message_received").length;
  updateTabBadges({
    home: unreadNotifications,
    explore: recommendedCount,
    story: activeStories + storyAlerts,
    messages: incomingResponses + messageAlerts
  });
  localizeInterface($("screen-app"));
}

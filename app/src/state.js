export const state = {
  data: null,
  auth: null,
  walletConnection: null,
  currentScreen: "screen-login",
  currentPanel: "home",
  activeExploreTab: "recommended",
  activeReviewFilter: "all",
  activeReviewSort: "stage",
  selectedCandidateId: null,
  personaIndex: 0,
  selectedPersonaOption: null,
  selectedStoryOption: null,
  activeStoryRoomId: null,
  activeThreadId: null,
  storyInsightVisible: false,
  lastStoryInsight: null,
  seenNotificationIds: []
};

export function resetAppState() {
  state.data = null;
  state.walletConnection = null;
  state.currentScreen = "screen-login";
  state.currentPanel = "home";
  state.activeExploreTab = "recommended";
  state.activeReviewFilter = "all";
  state.activeReviewSort = "stage";
  state.selectedCandidateId = null;
  state.personaIndex = 0;
  state.selectedPersonaOption = null;
  state.selectedStoryOption = null;
  state.activeStoryRoomId = null;
  state.activeThreadId = null;
  state.storyInsightVisible = false;
  state.lastStoryInsight = null;
  state.seenNotificationIds = [];
}

const AUTH_STORAGE_KEY = "seeker_auth_session";

export function loadStoredAuth() {
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    state.auth = raw ? JSON.parse(raw) : null;
  } catch (_error) {
    state.auth = null;
  }
  return state.auth;
}

export function saveStoredAuth(session) {
  state.auth = session;
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  return state.auth;
}

export function clearStoredAuth() {
  state.auth = null;
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function isBasicProfileComplete(profile) {
  if (!profile) {
    return false;
  }

  const nicknameReady = Boolean(String(profile.nickname || "").trim());
  const cityReady = Boolean(String(profile.city || "").trim());
  const ageReady = Number(profile.age || 0) >= 18;
  const genderReady = ["male", "female"].includes(profile.gender);

  return nicknameReady && cityReady && ageReady && genderReady;
}

export function getPreferredInitialPanel(data) {
  const profile = data?.me?.data?.profile;
  return isBasicProfileComplete(profile) ? "home" : "me";
}

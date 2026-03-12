import { state } from "./state.js";
import { localizeInterface, setLoadStatus, setPanel, setScreen, showToast } from "./dom.js";
import {
  createWalletChallenge,
  loadBootstrapData,
  loginWithWallet,
  updateProfile
} from "./data.js";
import {
  consumeNotificationTypes,
  renderApp,
  renderPersonaQuestion,
  renderPersonaResult
} from "./render.js";
import { getPreferredInitialPanel, isBasicProfileComplete, saveStoredAuth } from "./state.js";

function getSolanaProvider() {
  if (window.phantom?.solana) {
    return window.phantom.solana;
  }
  if (window.solana) {
    return window.solana;
  }
  return null;
}

function renderWalletConnectionState() {
  const walletCard = document.getElementById("wallet-connection-card");
  if (!walletCard) {
    return;
  }

  const connection = state.walletConnection;
  if (!connection?.address) {
    walletCard.classList.add("hidden");
    walletCard.innerHTML = "";
    return;
  }

  walletCard.classList.remove("hidden");
  walletCard.innerHTML = `
    <div class="detail-row">
      <span class="mini">Wallet ready</span>
      <span>Connected</span>
    </div>
  `;
  localizeInterface(walletCard);
}

function updateLoginOptionState() {
  const connectButton = document.getElementById("wallet-connect-btn");
  const provider = getSolanaProvider();
  if (!connectButton) {
    return;
  }

  if (provider) {
    connectButton.disabled = false;
    renderWalletConnectionState();
    return;
  }

  connectButton.disabled = true;
}

function encodeBase64(bytes) {
  const array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  let binary = "";
  array.forEach((value) => {
    binary += String.fromCharCode(value);
  });
  return window.btoa(binary);
}

export function bindBaseEvents() {
  updateLoginOptionState();

  async function performWalletLogin(provider, walletAddress) {
    setLoadStatus("Confirm in your wallet", false, false);

    if (typeof provider.signIn === "function") {
      try {
        await provider.signIn({
          address: walletAddress,
          uri: window.location.origin
        });
      } catch (_error) {
        // Fallback to challenge flow below if wallet signIn is unavailable in practice.
      }
    }

    const challenge = await createWalletChallenge(walletAddress);
    const message = challenge.data.message;
    const encodedMessage = new TextEncoder().encode(message);
    const signed = await provider.signMessage(encodedMessage, "utf8");
    const signatureBase64 = encodeBase64(signed?.signature || signed);
    const response = await loginWithWallet({
      walletAddress,
      signedMessage: message,
      signatureBase64
    });

    saveStoredAuth(response.data);
    state.data = await loadBootstrapData();
    const me = state.data?.me?.data;
    if (me?.profile) {
      document.getElementById("nickname").value = me.profile.nickname || "";
      document.getElementById("city").value = me.profile.city || "";
      document.getElementById("age").value = me.profile.age || 24;
      document.getElementById("gender").value = me.profile.gender === "unknown" ? "" : me.profile.gender;
    }
    setLoadStatus("", false, false);
    setScreen("screen-profile");
    showToast("Signed in");
  }

  document.getElementById("wallet-connect-btn").addEventListener("click", async () => {
    const provider = getSolanaProvider();
    if (!provider) {
      setLoadStatus("No wallet detected.", true, false);
      showToast("Open your wallet first");
      return;
    }

    try {
      setLoadStatus("Connecting wallet...", false, false);
      const connectResult = await provider.connect();
      const walletAddress = connectResult?.publicKey?.toBase58?.()
        || provider.publicKey?.toBase58?.();

      if (!walletAddress) {
        throw new Error("wallet_address_unavailable");
      }

      state.walletConnection = {
        address: walletAddress,
        signInSupported: typeof provider.signIn === "function"
      };
      renderWalletConnectionState();
      await performWalletLogin(provider, walletAddress);
    } catch (error) {
      setLoadStatus("Could not connect. Try again.", true, true);
      showToast("Could not connect");
    }
  });

  document.querySelectorAll("[data-back]").forEach((button) => {
    button.addEventListener("click", () => setScreen(button.dataset.back));
  });

  document.getElementById("profile-submit").addEventListener("click", async () => {
    const nickname = document.getElementById("nickname").value.trim();
    const city = document.getElementById("city").value.trim();
    const age = Number(document.getElementById("age").value || 0);
    const gender = document.getElementById("gender").value;

    if (!nickname || !city || age < 18 || !gender) {
      showToast("Complete your profile before continuing");
      return;
    }

    try {
      await updateProfile({
        nickname,
        city,
        age,
        gender
      });
      state.data = await loadBootstrapData();
      setScreen("screen-persona");
      renderPersonaQuestion();
    } catch (error) {
      showToast(error.message || "Could not save your profile");
    }
  });

  document.getElementById("persona-next").addEventListener("click", () => {
    if (!state.selectedPersonaOption) {
      return;
    }
    const questions = state.data.personaQuestions.data.questions;
    if (state.personaIndex < questions.length - 1) {
      state.personaIndex += 1;
      renderPersonaQuestion();
    } else {
      renderPersonaResult();
      setScreen("screen-persona-result");
    }
  });

  document.getElementById("persona-result-next").addEventListener("click", () => {
    const me = state.data?.me?.data;
    const signal = state.data?.signalToday?.data;
    const ready = me?.profile?.gender
      && me.profile.gender !== "unknown"
      && signal?.submitted
      && signal?.main_task?.answer_text;
    if (!ready) {
      showToast("Set your gender and choose a sector before continuing");
      return;
    }
    setScreen("screen-app");
    setPanel(getPreferredInitialPanel(state.data));
    renderApp();
  });

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", async () => {
      const targetPanel = tab.dataset.panel;
      const profile = state.data?.me?.data?.profile;

      if (targetPanel !== "me" && !isBasicProfileComplete(profile)) {
        setPanel("me");
        showToast("Complete your basic profile first");
        return;
      }

      if (targetPanel === "messages") {
        await consumeNotificationTypes(["response_received", "chat_message_received", "story_room_completed"]);
      } else if (targetPanel === "story") {
        await consumeNotificationTypes(["response_accepted", "story_room_completed"]);
      } else if (targetPanel === "home") {
        await consumeNotificationTypes(["response_rejected"]);
      }

      setPanel(targetPanel);
      renderApp();
    });
  });
}

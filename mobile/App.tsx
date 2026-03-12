import { useEffect, useMemo, useRef, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Constants from "expo-constants";
import { StatusBar } from "expo-status-bar";
import { Buffer } from "buffer";
import { MobileWalletProvider, useMobileWallet } from "@wallet-ui/react-native-web3js";
import { clusterApiUrl } from "@solana/web3.js";
import { WebView } from "react-native-webview";

type AuthSession = {
  access_token: string;
  refresh_token: string;
  user_id: string;
  expires_at: string;
  onboarding_status: string;
  is_admin: boolean;
  auth_method: string;
  wallet_address: string | null;
  wallet_chain: string | null;
};

type WalletChallenge = {
  wallet_address: string;
  message: string;
  expires_at: string;
  chain: string;
  nonce: string;
};

const extra = (Constants.expoConfig?.extra || {}) as {
  appOrigin?: string;
  apiOrigin?: string;
};

const APP_BUILD_VERSION = `${Constants.expoConfig?.version || "0.1.0"}-20260312-01`;
const DEFAULT_API_ORIGIN = "https://your-firebase-project.web.app";
const DEFAULT_APP_ORIGIN = "https://your-firebase-project.web.app/app/";
const APP_ORIGIN = extra.appOrigin || DEFAULT_APP_ORIGIN;
const API_ORIGIN = extra.apiOrigin || DEFAULT_API_ORIGIN;
const REQUEST_TIMEOUT_MS = 15000;
const PROBE_TIMEOUT_MS = 2500;
const API_ORIGIN_CANDIDATES = Array.from(new Set([
  API_ORIGIN,
  DEFAULT_API_ORIGIN,
  "http://127.0.0.1:4173",
  "http://10.0.2.2:4173"
]));
const APP_ORIGIN_CANDIDATES = Array.from(new Set([
  APP_ORIGIN,
  DEFAULT_APP_ORIGIN,
  `${DEFAULT_API_ORIGIN}/app/`,
  "http://127.0.0.1:4173/app/",
  "http://10.0.2.2:4173/app/"
]));

function toAppOrigin(origin: string) {
  if (!origin) {
    return DEFAULT_APP_ORIGIN;
  }
  return origin.endsWith("/app/") ? origin : `${origin.replace(/\/+$/, "")}/app/`;
}

function extractSignatureBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) {
    return value;
  }

  if (value && typeof value === "object") {
    const record = value as {
      signature?: Uint8Array | number[];
      signatures?: Array<Uint8Array | number[]>;
    };

    if (record.signature instanceof Uint8Array) {
      return record.signature;
    }

    if (Array.isArray(record.signature)) {
      return Uint8Array.from(record.signature);
    }

    if (Array.isArray(record.signatures) && record.signatures.length > 0) {
      const first = record.signatures[0];
      if (first instanceof Uint8Array) {
        return first;
      }
      if (Array.isArray(first)) {
        return Uint8Array.from(first);
      }
    }
  }

  throw new Error("wallet_signature_missing");
}

type JsonResponse = {
  response: Response;
  payload: any;
  origin: string;
};

async function fetchJsonWithOrigin(origin: string, pathname: string, init: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS): Promise<JsonResponse> {
  const { response, payload } = await fetchJson(`${origin}${pathname}`, init, timeoutMs);
  return {
    response,
    payload,
    origin
  };
}

async function fetchJsonAcrossOrigins(pathname: string, init: RequestInit) {
  let lastError: unknown = null;

  for (const origin of API_ORIGIN_CANDIDATES) {
    try {
      return await fetchJsonWithOrigin(origin, pathname, init);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("network_request_failed");
}

async function resolveReachableAppOrigin(preferredOrigin?: string) {
  const candidates = Array.from(new Set([
    preferredOrigin,
    ...APP_ORIGIN_CANDIDATES
  ].filter(Boolean))) as string[];

  for (const origin of candidates) {
    try {
      await fetchJson(origin, {
        method: "GET",
        headers: {
          Accept: "text/html"
        }
      }, PROBE_TIMEOUT_MS);
      return origin;
    } catch (_error) {
      continue;
    }
  }

  return toAppOrigin(API_ORIGIN);
}

async function resolveReachableApiOrigin(preferredOrigin?: string) {
  const candidates = Array.from(new Set([
    preferredOrigin,
    ...API_ORIGIN_CANDIDATES
  ].filter(Boolean))) as string[];

  for (const origin of candidates) {
    try {
      await fetchJson(`${origin}/api/v1/auth/session`, {
        method: "GET",
        headers: {
          Accept: "application/json"
        }
      }, PROBE_TIMEOUT_MS);
      return origin;
    } catch (error) {
      if (error instanceof Error && (
        error.message === "network_request_timeout" ||
        error.message === "network_request_failed"
      )) {
        continue;
      }
    }
  }

  return preferredOrigin || API_ORIGIN;
}
function formatErrorMessage(error: string | null) {
  if (!error) {
    return null;
  }

  const normalized = error.replace(/_/g, " ");
  switch (error) {
    case "wallet_not_connected":
      return "Connect a wallet before signing in.";
    case "wallet_connect_failed":
      return "We could not connect your wallet right now.";
    case "wallet_disconnect_failed":
      return "We could not disconnect your wallet right now.";
    case "wallet_challenge_failed":
      return "We could not start entry right now.";
    case "wallet_verify_failed":
      return "We could not finish entry right now.";
    case "wallet_signature_missing":
      return "Your wallet did not return a valid signature.";
    case "wallet_auto_sign_in_failed":
      return "We couldn't restore your session. Please connect your wallet again.";
    case "network_request_failed":
      return "We could not reach Degen Signal right now.";
    case "network_request_timeout":
      return "This is taking longer than expected. Please try again.";
    default:
      return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }
}

function createTimeoutError(label: string) {
  return new Error(`${label}_timeout`);
}

async function fetchJson(input: string, init: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal
    });
    const payload = await response.json();
    return { response, payload };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw createTimeoutError("network_request");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function AppContent() {
  const { account, connect, disconnect, signMessage } = useMobileWallet();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [webviewReady, setWebviewReady] = useState(false);
  const [activeOrigin, setActiveOrigin] = useState(toAppOrigin(APP_ORIGIN));
  const [activeApiOrigin, setActiveApiOrigin] = useState(API_ORIGIN);
  const autoAttemptedWalletRef = useRef<string | null>(null);

  const walletAddress = account?.address?.toString() || null;
  const sessionWalletAddress = session?.wallet_address || null;
  const canRetry = Boolean(walletAddress) && !busy && !session;
  const prettyError = formatErrorMessage(error);
  const webViewSource = useMemo(() => {
    if (!session) {
      return null;
    }

    const separator = activeOrigin.includes("?") ? "&" : "?";
    return {
      uri: `${activeOrigin}${separator}appShell=android&build=${encodeURIComponent(APP_BUILD_VERSION)}`
    };
  }, [activeOrigin, session]);
  const injectedSession = useMemo(() => {
    if (!session) {
      return "true;";
    }
    const payload = JSON.stringify(session).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    return `
      window.localStorage.setItem('seeker_auth_session', '${payload}');
      true;
    `;
  }, [session]);

  useEffect(() => {
    if (!walletAddress || busy) {
      return;
    }
    if (sessionWalletAddress === walletAddress) {
      return;
    }
    if (autoAttemptedWalletRef.current === walletAddress) {
      return;
    }

    autoAttemptedWalletRef.current = walletAddress;
    void signInWithWallet(walletAddress, true, "auto");
  }, [busy, sessionWalletAddress, walletAddress]);

  useEffect(() => {
    if (busy || !session) {
      return;
    }

    if (!walletAddress) {
      setSession(null);
      setWebviewReady(false);
      autoAttemptedWalletRef.current = null;
      setStatusText(null);
      setError(null);
      return;
    }

    if (sessionWalletAddress !== walletAddress) {
      setSession(null);
      setWebviewReady(false);
      autoAttemptedWalletRef.current = null;
      setStatusText(null);
      setError(null);
    }
  }, [busy, session, sessionWalletAddress, walletAddress]);

  async function connectWallet() {
    try {
      setBusy(true);
      setError(null);
      setStatusText("Connecting wallet...");
      autoAttemptedWalletRef.current = null;
      const connectedAccount = await connect();
      const nextWalletAddress = connectedAccount?.address?.toString() || account?.address?.toString() || null;

      if (!nextWalletAddress) {
        throw new Error("wallet_not_connected");
      }

      autoAttemptedWalletRef.current = nextWalletAddress;
      await signInWithWallet(nextWalletAddress, false, "manual");
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : "wallet_connect_failed");
    } finally {
      setBusy(false);
    }
  }

  async function signInWithWallet(
    currentWalletAddress = walletAddress,
    manageBusy = true,
    mode: "auto" | "manual" = "manual"
  ) {
    if (!currentWalletAddress) {
      setError("wallet_not_connected");
      return;
    }

    try {
      if (manageBusy) {
        setBusy(true);
      }
      setError(null);
      setStatusText(mode === "auto" ? "Signing you in..." : "Entering Degen Signal...");
      const reachableApiOrigin = await resolveReachableApiOrigin(activeApiOrigin);
      setActiveApiOrigin(reachableApiOrigin);
      const reachableAppOrigin = await resolveReachableAppOrigin(activeOrigin);
      setActiveOrigin(reachableAppOrigin);
      const { response: challengeResponse, payload: challengePayload, origin: challengeOrigin } = await fetchJsonAcrossOrigins("/api/v1/auth/wallet/challenge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          wallet_address: currentWalletAddress
        })
      });
      setActiveApiOrigin(challengeOrigin);
      setActiveOrigin(toAppOrigin(challengeOrigin));
      if (!challengeResponse.ok) {
        throw new Error(challengePayload?.message || "wallet_challenge_failed");
      }

      const challenge = challengePayload.data as WalletChallenge;
      const encodedMessage = new TextEncoder().encode(challenge.message);
      setStatusText("Confirm in your wallet...");
      const signed = await signMessage(encodedMessage);
      const signatureBytes = extractSignatureBytes(signed);
      const signatureBase64 = Buffer.from(signatureBytes).toString("base64");

      setStatusText("Entering Degen Signal...");
      const { response: verifyResponse, payload: verifyPayload, origin: verifyOrigin } = await fetchJsonAcrossOrigins("/api/v1/auth/wallet/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          wallet_address: currentWalletAddress,
          signed_message: challenge.message,
          signature_base64: signatureBase64
        })
      });
      setActiveApiOrigin(verifyOrigin);
      setActiveOrigin(toAppOrigin(verifyOrigin));
      if (!verifyResponse.ok) {
        throw new Error(verifyPayload?.message || "wallet_verify_failed");
      }

      setWebviewReady(false);
      setSession(verifyPayload.data as AuthSession);
      autoAttemptedWalletRef.current = currentWalletAddress;
    } catch (signInError) {
      console.error("wallet_sign_in_failed", signInError);
      autoAttemptedWalletRef.current = null;
      if (mode === "auto") {
        try {
          await disconnect();
        } catch (_disconnectError) {
          // Keep the UI recoverable even if the wallet provider does not disconnect cleanly.
        }
        setSession(null);
        setWebviewReady(false);
        setError("wallet_auto_sign_in_failed");
      } else {
        setError(signInError instanceof Error ? signInError.message : "wallet_sign_in_failed");
      }
    } finally {
      if (manageBusy) {
        setBusy(false);
      }
      setStatusText(null);
    }
  }

  async function disconnectWallet() {
    try {
      setBusy(true);
      setError(null);
      setStatusText("Disconnecting...");
      autoAttemptedWalletRef.current = null;
      setWebviewReady(false);
      setSession(null);
      await disconnect();
    } catch (disconnectError) {
      setError(disconnectError instanceof Error ? disconnectError.message : "wallet_disconnect_failed");
    } finally {
      setBusy(false);
      setStatusText(null);
    }
  }

  if (session) {
    return (
      <SafeAreaView style={styles.appShell}>
        <StatusBar style="light" />
        <View style={styles.nativeBar}>
          <View style={styles.nativeHeading}>
            <Text style={styles.nativeTitle}>Degen Signal</Text>
          </View>
          <Pressable style={styles.secondaryButton} onPress={disconnectWallet} disabled={busy}>
            <Text style={styles.secondaryButtonText}>{busy ? "Working..." : "Disconnect"}</Text>
          </Pressable>
        </View>
        {webViewSource ? (
          <WebView
            key={webViewSource.uri}
            source={webViewSource}
            originWhitelist={["*"]}
            javaScriptEnabled
            domStorageEnabled
            cacheEnabled={false}
            incognito
            thirdPartyCookiesEnabled
            sharedCookiesEnabled
            injectedJavaScriptBeforeContentLoaded={injectedSession}
            onLoadEnd={() => setWebviewReady(true)}
            style={styles.webview}
          />
        ) : null}
        {!webviewReady ? (
          <View style={styles.webviewOverlay}>
            <View style={styles.webviewOverlayCard}>
              <ActivityIndicator color="#f4d06f" />
              <Text style={styles.webviewOverlayTitle}>Opening Degen Signal</Text>
              <Text style={styles.webviewOverlayText}>Just a moment.</Text>
            </View>
          </View>
        ) : null}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.loginShell}>
      <StatusBar style="light" />
      <View style={styles.backgroundOrbTop} />
      <View style={styles.backgroundOrbBottom} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.brandMark}>
            <View style={styles.brandPulseOuter}>
              <View style={styles.brandPulseInner} />
            </View>
            <Text style={styles.brandName}>Degen Signal</Text>
          </View>
          <Text style={styles.title}>Find the signal.{`\n`}Start the story.</Text>
          <Text style={styles.body}>Connect your wallet to enter Degen Signal.</Text>
          <View style={styles.trustRow}>
            <View style={styles.trustPill}>
              <Text style={styles.trustPillText}>Private</Text>
            </View>
            <View style={styles.trustPill}>
              <Text style={styles.trustPillText}>Direct</Text>
            </View>
            <View style={styles.trustPill}>
              <Text style={styles.trustPillText}>Secure</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardTitle}>Continue</Text>
              <Text style={styles.cardBody}>
                {walletAddress ? "Your wallet is connected." : "Connect a wallet to continue."}
              </Text>
            </View>
          </View>

          <View style={styles.walletPanel}>
            <View style={styles.walletGlyph}>
              <View style={styles.walletGlyphInner} />
            </View>
            <View style={styles.walletPanelCopy}>
              <Text style={styles.walletPanelTitle}>{walletAddress ? "Wallet connected" : "Connect your wallet"}</Text>
              <Text style={styles.walletPanelText}>
                {walletAddress ? "You can continue now." : "Use the button below to get started."}
              </Text>
            </View>
          </View>

          <Pressable
            style={[styles.primaryButton, walletAddress ? styles.primaryButtonDisabled : null]}
            onPress={connectWallet}
            disabled={busy || Boolean(walletAddress)}
          >
            <Text style={styles.primaryButtonText}>{walletAddress ? "Wallet Connected" : "Connect Wallet"}</Text>
          </Pressable>

          {walletAddress ? (
            <Pressable
              style={styles.secondaryWideButton}
              onPress={disconnectWallet}
              disabled={busy}
            >
              <Text style={styles.secondaryWideButtonText}>Disconnect Wallet</Text>
            </Pressable>
          ) : null}

          {canRetry ? (
            <Pressable
              style={styles.secondaryWideButton}
              onPress={() => void signInWithWallet()}
              disabled={busy}
            >
              <Text style={styles.secondaryWideButtonText}>Try Again</Text>
            </Pressable>
          ) : null}

          {busy ? <ActivityIndicator style={styles.loader} color="#f4d06f" /> : null}
          {statusText ? (
            <View style={styles.statusBanner}>
              <Text style={styles.statusText}>{statusText}</Text>
            </View>
          ) : null}
          {prettyError ? <Text style={styles.errorText}>{prettyError}</Text> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <MobileWalletProvider
      chain="solana:mainnet"
      endpoint={clusterApiUrl("mainnet-beta")}
      identity={{ name: "Degen Signal Android" }}
    >
      <AppContent />
    </MobileWalletProvider>
  );
}

const styles = StyleSheet.create({
  appShell: {
    flex: 1,
    backgroundColor: "#0f1720"
  },
  loginShell: {
    flex: 1,
    backgroundColor: "#0f1720",
    position: "relative"
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 28,
    gap: 18
  },
  backgroundOrbTop: {
    position: "absolute",
    top: -50,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "#1f3552",
    opacity: 0.45
  },
  backgroundOrbBottom: {
    position: "absolute",
    bottom: 40,
    left: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "#15332d",
    opacity: 0.4
  },
  hero: {
    gap: 12
  },
  trustRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  trustPill: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#162331",
    borderWidth: 1,
    borderColor: "#27394c"
  },
  trustPillText: {
    color: "#cad8e5",
    fontSize: 12,
    fontWeight: "600"
  },
  brandMark: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  brandPulseOuter: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#27405b"
  },
  brandPulseInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#f4d06f"
  },
  brandName: {
    color: "#f4f7fb",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.3
  },
  heroBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#1f2a38",
    borderWidth: 1,
    borderColor: "#314254"
  },
  eyebrow: {
    color: "#f4d06f",
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase"
  },
  title: {
    color: "#f9fafb",
    fontSize: 34,
    fontWeight: "700",
    lineHeight: 40
  },
  body: {
    color: "#b6c2cf",
    fontSize: 15,
    lineHeight: 22
  },
  stepsCard: {
    backgroundColor: "#131d28",
    borderRadius: 22,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: "#223142"
  },
  sectionTitle: {
    color: "#f4f7fb",
    fontSize: 16,
    fontWeight: "700"
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  stageRail: {
    flexDirection: "row",
    gap: 6
  },
  stageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#314254"
  },
  stageDotActive: {
    backgroundColor: "#f4d06f"
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12
  },
  stepIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f4d06f"
  },
  stepIndexText: {
    color: "#121826",
    fontSize: 13,
    fontWeight: "700"
  },
  stepBody: {
    flex: 1,
    gap: 4
  },
  stepTitle: {
    color: "#f4f7fb",
    fontSize: 14,
    fontWeight: "700"
  },
  stepText: {
    color: "#9db0c4",
    fontSize: 13,
    lineHeight: 18
  },
  card: {
    backgroundColor: "#17212c",
    borderRadius: 22,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: "#263547"
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12
  },
  cardTitle: {
    color: "#f9fafb",
    fontSize: 18,
    fontWeight: "700"
  },
  cardBody: {
    color: "#c6d2dd",
    fontSize: 14,
    lineHeight: 20
  },
  walletPanel: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#13202c",
    borderWidth: 1,
    borderColor: "#243547"
  },
  walletGlyph: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#22374d",
    alignItems: "center",
    justifyContent: "center"
  },
  walletGlyphInner: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#f4d06f"
  },
  walletPanelCopy: {
    flex: 1,
    gap: 4
  },
  walletPanelTitle: {
    color: "#f4f7fb",
    fontSize: 14,
    fontWeight: "700"
  },
  walletPanelText: {
    color: "#aebfd0",
    fontSize: 13,
    lineHeight: 18
  },
  statusIdle: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#243140"
  },
  statusReady: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#19352c"
  },
  statusIdleText: {
    color: "#bfd0e1",
    fontSize: 12,
    fontWeight: "700"
  },
  statusReadyText: {
    color: "#8ce0b3",
    fontSize: 12,
    fontWeight: "700"
  },
  primaryButton: {
    backgroundColor: "#f4d06f",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center"
  },
  primaryButtonText: {
    color: "#121826",
    fontSize: 15,
    fontWeight: "700"
  },
  primaryButtonDisabled: {
    opacity: 0.55
  },
  secondaryWideButton: {
    backgroundColor: "#243140",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center"
  },
  secondaryButtonDisabled: {
    opacity: 0.5
  },
  secondaryWideButtonText: {
    color: "#f9fafb",
    fontSize: 15,
    fontWeight: "700"
  },
  loader: {
    marginTop: 4
  },
  errorText: {
    color: "#fda4af",
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(127, 29, 29, 0.28)",
    borderRadius: 12
  },
  statusText: {
    color: "#dbe6f2",
    fontSize: 13,
    lineHeight: 18
  },
  statusBanner: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#1b2937"
  },
  hint: {
    color: "#92a1b1",
    fontSize: 12,
    lineHeight: 18
  },
  assuranceCard: {
    backgroundColor: "#121b26",
    borderRadius: 20,
    padding: 18,
    gap: 8,
    borderWidth: 1,
    borderColor: "#223142"
  },
  assuranceTitle: {
    color: "#f4f7fb",
    fontSize: 15,
    fontWeight: "700"
  },
  assuranceText: {
    color: "#bfd0e1",
    fontSize: 13,
    lineHeight: 19
  },
  assuranceHint: {
    color: "#8ea4b8",
    fontSize: 12,
    lineHeight: 18
  },
  legalText: {
    color: "#77889a",
    fontSize: 11,
    lineHeight: 17
  },
  nativeBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#111926",
    borderBottomWidth: 1,
    borderBottomColor: "#1f2c39"
  },
  nativeHeading: {
    flex: 1,
    gap: 4
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  nativeTitle: {
    color: "#f9fafb",
    fontSize: 18,
    fontWeight: "700"
  },
  nativeMeta: {
    color: "#9fb0c1",
    fontSize: 12,
    marginTop: 2
  },
  liveBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#18332a"
  },
  liveBadgeText: {
    color: "#86ddb0",
    fontSize: 11,
    fontWeight: "700"
  },
  secondaryButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#243140",
    borderRadius: 12
  },
  secondaryButtonText: {
    color: "#f9fafb",
    fontSize: 13,
    fontWeight: "600"
  },
  webview: {
    flex: 1,
    backgroundColor: "#0f1720"
  },
  webviewOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f1720"
  },
  webviewOverlayCard: {
    width: "78%",
    borderRadius: 20,
    padding: 18,
    gap: 10,
    backgroundColor: "#15212d",
    borderWidth: 1,
    borderColor: "#253547",
    alignItems: "center"
  },
  webviewOverlayTitle: {
    color: "#f4f7fb",
    fontSize: 16,
    fontWeight: "700"
  },
  webviewOverlayText: {
    color: "#9db0c4",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center"
  }
});

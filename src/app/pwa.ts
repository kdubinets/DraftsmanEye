/**
 * PWA installation helpers: registers the static service worker and uses the
 * native browser install prompt when the platform makes one available.
 */

type InstallOutcome = "accepted" | "dismissed";

type BeforeInstallPromptEvent = Event & {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: InstallOutcome; platform: string }>;
  prompt(): Promise<void>;
};

type InstallPromptState = {
  canInstall: boolean;
  isInstalled: boolean;
};

type InstallPromptListener = (state: InstallPromptState) => void;

const listeners = new Set<InstallPromptListener>();

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = isStandaloneDisplay();
let initialized = false;

export function initializePwa(): void {
  if (initialized) return;
  initialized = true;

  if ("serviceWorker" in navigator && import.meta.env.PROD) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
        console.error("Failed to register service worker.", error);
      });
    });
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notifyInstallPromptListeners();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installed = true;
    notifyInstallPromptListeners();
  });
}

export function subscribeInstallPrompt(
  listener: InstallPromptListener,
): () => void {
  listeners.add(listener);
  listener(getInstallPromptState());
  return () => {
    listeners.delete(listener);
  };
}

export async function promptPwaInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;

  const promptEvent = deferredPrompt;
  deferredPrompt = null;
  notifyInstallPromptListeners();

  try {
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") {
      installed = true;
    }
  } catch (error) {
    console.error("Failed to show install prompt.", error);
  } finally {
    notifyInstallPromptListeners();
  }
  return true;
}

function getInstallPromptState(): InstallPromptState {
  return {
    canInstall: deferredPrompt !== null && !installed,
    isInstalled: installed,
  };
}

function notifyInstallPromptListeners(): void {
  const state = getInstallPromptState();
  for (const listener of listeners) {
    listener(state);
  }
}

function isStandaloneDisplay(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && navigator.standalone === true)
  );
}

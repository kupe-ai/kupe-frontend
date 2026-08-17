/** Loads Razorpay's Checkout.js once and opens it as a centered popup
 * over the current page. No secret ever touches this file — only the
 * public key_id the backend hands back. */

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

export type RazorpayOptions = {
  key: string;
  amount?: number;
  currency?: string;
  order_id?: string;
  subscription_id?: string;
  name?: string;
  description?: string;
  theme?: { color?: string; backdrop_color?: string };
  parent?: string | HTMLElement;
  redirect?: boolean;
  handler: (response: {
    razorpay_payment_id: string;
    razorpay_order_id?: string;
    razorpay_subscription_id?: string;
    razorpay_signature: string;
  }) => void;
  modal?: { ondismiss?: () => void; animation?: boolean; backdropclose?: boolean; escape?: boolean };
};

const OVERLAY_ID = "kupe-rzp-overlay";
/** Checkout.js special-cases this id for in-page embed (not hosted redirect). */
const MOUNT_ID = "checkout-container";
const STYLE_ID = "kupe-rzp-popup-css";

let loadPromise: Promise<void> | null = null;
let previousBodyOverflow = "";

function loadCheckoutScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loadPromise = null;
      reject(new Error("Could not load Razorpay checkout — check your connection"));
    };
    document.body.appendChild(script);
  });
  return loadPromise;
}

/** Warm the Checkout.js cache so Pay can open the overlay without a blank navigation. */
export function preloadRazorpayCheckout() {
  void loadCheckoutScript().catch(() => {});
}

function teardownCheckoutHost() {
  document.getElementById(OVERLAY_ID)?.remove();
  document.getElementById(STYLE_ID)?.remove();
  document.body.style.overflow = previousBodyOverflow;
}

function mountCheckoutHost() {
  teardownCheckoutHost();
  previousBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";

  const mobile = window.matchMedia("(max-width: 640px)").matches;

  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.setAttribute("role", "presentation");
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    zIndex: "400",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: mobile ? "0" : "24px",
    background: "rgb(0 0 0 / 0.5)",
    pointerEvents: "auto",
  });

  const mount = document.createElement("div");
  mount.id = MOUNT_ID;
  Object.assign(mount.style, {
    width: mobile ? "100%" : "min(920px, calc(100vw - 48px))",
    height: mobile ? "100%" : "min(640px, calc(100vh - 48px))",
    minHeight: mobile ? "100%" : "520px",
    borderRadius: mobile ? "0" : "16px",
    overflow: "hidden",
    background: "#fff",
    boxShadow: mobile ? "none" : "0 24px 80px rgb(0 0 0 / 0.4)",
    pointerEvents: "auto",
  });

  overlay.appendChild(mount);
  document.body.appendChild(overlay);

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${MOUNT_ID} iframe,
    #${MOUNT_ID} .razorpay-checkout-frame {
      width: 100% !important;
      height: 100% !important;
      min-height: 0 !important;
      border: 0 !important;
    }
  `;
  document.head.appendChild(style);
}

/** Opens Checkout.js as a popup over the current SPA. */
export async function openRazorpayCheckout(
  options: Omit<RazorpayOptions, "handler" | "modal" | "parent" | "redirect">,
): Promise<{
  razorpay_payment_id: string;
  razorpay_order_id?: string;
  razorpay_subscription_id?: string;
  razorpay_signature: string;
}> {
  await loadCheckoutScript();
  if (!window.Razorpay) throw new Error("Razorpay checkout script failed to initialize");

  // Let a closing Radix dialog drop `inert` / pointer-events on body first.
  await new Promise((r) => setTimeout(r, 60));

  mountCheckoutHost();

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      teardownCheckoutHost();
      fn();
    };

    try {
      const rzp = new window.Razorpay!({
        ...options,
        parent: `#${MOUNT_ID}`,
        redirect: false,
        theme: {
          color: options.theme?.color ?? "#111827",
          backdrop_color: "rgba(0, 0, 0, 0)",
        },
        handler: (response) => {
          finish(() => resolve(response));
        },
        modal: {
          animation: true,
          escape: true,
          backdropclose: true,
          ondismiss: () => {
            finish(() => reject(new Error("cancelled")));
          },
        },
      });
      rzp.open();
    } catch (e) {
      finish(() => reject(e instanceof Error ? e : new Error("Could not open checkout")));
    }
  });
}

/** Loads Razorpay Checkout.js and opens the native centered modal over the SPA.

No secrets here — only the public `key_id` the backend returns with the order.
We deliberately do **not** set `parent` (DOM embed): that path fills a full-screen
host and looks like a blank white page around the widget. Native modal = popup.
*/

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void; close: () => void };
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
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  /** Must stay false — true navigates away to a hosted white page. */
  redirect?: boolean;
  handler: (response: {
    razorpay_payment_id: string;
    razorpay_order_id?: string;
    razorpay_subscription_id?: string;
    razorpay_signature: string;
  }) => void;
  modal?: {
    ondismiss?: () => void;
    animation?: boolean;
    /** Click outside — we keep false so only Razorpay's own close dismisses. */
    backdropclose?: boolean;
    /** Escape key — same. */
    escape?: boolean;
    confirm_close?: boolean;
  };
};

let loadPromise: Promise<void> | null = null;

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

/** Warm Checkout.js so Pay opens without a cold script fetch. */
export function preloadRazorpayCheckout() {
  void loadCheckoutScript().catch(() => {});
}

/**
 * Opens Razorpay as a centered modal over the current page.
 * Not dismissible by backdrop click or Escape — only Razorpay's own close
 * (or a successful payment) ends the session.
 */
export async function openRazorpayCheckout(
  options: Omit<RazorpayOptions, "handler" | "modal" | "redirect">,
): Promise<{
  razorpay_payment_id: string;
  razorpay_order_id?: string;
  razorpay_subscription_id?: string;
  razorpay_signature: string;
}> {
  await loadCheckoutScript();
  if (!window.Razorpay) throw new Error("Razorpay checkout script failed to initialize");

  // Let a closing Radix dialog drop focus-trap / inert on body first.
  await new Promise((r) => setTimeout(r, 80));

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    try {
      const rzp = new window.Razorpay!({
        ...options,
        redirect: false,
        theme: {
          color: options.theme?.color ?? "#111827",
        },
        handler: (response) => {
          finish(() => resolve(response));
        },
        modal: {
          animation: true,
          // Locked to the Razorpay widget — our SPA must not dismiss underneath.
          escape: false,
          backdropclose: false,
          confirm_close: true,
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

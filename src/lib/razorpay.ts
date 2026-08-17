/** Loads Razorpay's Checkout.js once and exposes a typed helper to open it.
 * No secret ever touches this file — only the public key_id the backend
 * hands back from GET /v1/billing/config or a checkout-order response. */

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
  theme?: { color?: string };
  handler: (response: {
    razorpay_payment_id: string;
    razorpay_order_id?: string;
    razorpay_subscription_id?: string;
    razorpay_signature: string;
  }) => void;
  modal?: { ondismiss?: () => void };
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

/** Opens Checkout.js with the given options. Resolves/rejects based on the
 * `handler` callback firing vs. the user dismissing the modal — callers
 * don't need to wire modal.ondismiss themselves. */
export async function openRazorpayCheckout(
  options: Omit<RazorpayOptions, "handler" | "modal">,
): Promise<{
  razorpay_payment_id: string;
  razorpay_order_id?: string;
  razorpay_subscription_id?: string;
  razorpay_signature: string;
}> {
  await loadCheckoutScript();
  if (!window.Razorpay) throw new Error("Razorpay checkout script failed to initialize");

  return new Promise((resolve, reject) => {
    let settled = false;
    const rzp = new window.Razorpay!({
      ...options,
      handler: (response) => {
        settled = true;
        resolve(response);
      },
      modal: {
        ondismiss: () => {
          if (!settled) reject(new Error("cancelled"));
        },
      },
    });
    rzp.open();
  });
}

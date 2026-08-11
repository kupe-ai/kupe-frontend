import { useState } from "react";
import { supabase } from "./lib/supabase";

export default function AuthPanel() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      if (mode === "sign-up") {
        const { error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        setInfo("Check your email to confirm your account, then sign in.");
        setMode("sign-in");
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-panel">
      <h2>{mode === "sign-in" ? "Sign in" : "Create an account"}</h2>
      <form onSubmit={handleSubmit}>
        <label className="provider-field">
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        <label className="provider-field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
          />
        </label>
        <button className="connect-button" type="submit" disabled={submitting}>
          {submitting ? "Please wait..." : mode === "sign-in" ? "Sign in" : "Sign up"}
        </button>
      </form>
      <button
        className="auth-switch"
        type="button"
        onClick={() => {
          setMode(mode === "sign-in" ? "sign-up" : "sign-in");
          setError(null);
          setInfo(null);
        }}
      >
        {mode === "sign-in" ? "Need an account? Sign up" : "Already have an account? Sign in"}
      </button>
      {info && <p className="auth-info">{info}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

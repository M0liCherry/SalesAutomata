import { useState, type FormEvent } from "react";

import { Icon } from "../components/Icon";
import { useAuth } from "../lib/auth";

type Mode = "signin" | "signup";

export function LoginPage() {
  const { signIn, signUp, configured } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!configured) {
      setError("Supabase Auth is not configured. Add the frontend env variables first.");
      return;
    }
    if (mode === "signup" && password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "signin") {
        await signIn(email.trim(), password);
      } else {
        const result = await signUp(email.trim(), password);
        if (result.needsConfirmation) {
          setNotice("Check your inbox to confirm the account, then sign in.");
          setMode("signin");
        }
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Authentication failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <section className="auth-panel auth-panel--brand">
        <div className="auth-brand">
          <span className="brand-mark brand-mark--lg">
            <Icon name="whatsapp" size={26} />
          </span>
          <span>SalesAutomata</span>
        </div>
        <h1>Turn WhatsApp enquiries into booked appointments.</h1>
        <p>
          Qualify leads, follow up consistently and give your sales team a single command
          centre for every conversation.
        </p>
        <ul className="auth-points">
          <li>
            <Icon name="check" size={16} /> Unified WhatsApp inbox with agent handoff
          </li>
          <li>
            <Icon name="check" size={16} /> Qualification, pipeline and follow-up tracking
          </li>
          <li>
            <Icon name="check" size={16} /> Appointment booking and conversion reporting
          </li>
        </ul>
        <div className="auth-kpis">
          <div>
            <strong>1 place</strong>
            <span>for every lead</span>
          </div>
          <div>
            <strong>0 missed</strong>
            <span>follow-ups</span>
          </div>
          <div>
            <strong>Real-time</strong>
            <span>pipeline view</span>
          </div>
        </div>
      </section>

      <section className="auth-panel auth-panel--form">
        <div className="auth-form-wrap">
          <h2>{mode === "signin" ? "Sign in to your workspace" : "Create your account"}</h2>
          <p className="muted">
            {mode === "signin"
              ? "Use the account provisioned for your sales team."
              : "New accounts may require email confirmation."}
          </p>

          <div className="segmented">
            <button
              type="button"
              className={mode === "signin" ? "segmented__item segmented__item--active" : "segmented__item"}
              onClick={() => {
                setMode("signin");
                setError(null);
              }}
            >
              Sign in
            </button>
            <button
              type="button"
              className={mode === "signup" ? "segmented__item segmented__item--active" : "segmented__item"}
              onClick={() => {
                setMode("signup");
                setError(null);
              }}
            >
              Create account
            </button>
          </div>

          <form onSubmit={(event) => void onSubmit(event)} className="form-stack">
            <label className="field">
              <span>Work email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                required
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
              />
            </label>
            {mode === "signup" ? (
              <label className="field">
                <span>Confirm password</span>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  placeholder="••••••••"
                />
              </label>
            ) : null}

            {error ? <p className="form-error">{error}</p> : null}
            {notice ? <p className="form-notice">{notice}</p> : null}

            <button type="submit" className="button button--primary button--block" disabled={submitting}>
              {submitting ? "Please wait..." : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          {!configured ? (
            <p className="auth-config-note">
              Auth is not configured. Add <code>VITE_SUPABASE_URL</code> and{" "}
              <code>VITE_SUPABASE_ANON_KEY</code> to <code>frontend/.env</code>.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

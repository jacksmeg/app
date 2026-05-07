import { useMemo, useState } from "react";
import { JhimsLogo } from "./JhimsLogo";
import { useJhims } from "../state/JhimsStore";
import type { SignUpInput } from "../types";

const initialSignUp: SignUpInput = {
  fullName: "",
  email: "",
  password: "",
  phone: "",
  location: "Accra",
  role: "buyer",
  shopName: "",
};

export const AuthScreen = () => {
  const { state, actions } = useJhims();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [recoveryConfirmPassword, setRecoveryConfirmPassword] = useState("");
  const [signUp, setSignUp] = useState<SignUpInput>(initialSignUp);
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signup");

  const authMode = useMemo<"signin" | "signup" | "forgot" | "recovery">(
    () => (state.pendingPasswordRecovery ? "recovery" : mode),
    [mode, state.pendingPasswordRecovery],
  );
  const recoveryMismatch =
    authMode === "recovery" &&
    Boolean(recoveryPassword && recoveryConfirmPassword && recoveryPassword !== recoveryConfirmPassword);

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <JhimsLogo size="auth" />
          <p>
            {authMode === "recovery"
              ? "Create a new password for your JHIMS Marketplace account and get back into the system."
              : "Create your buyer or seller account, then manage your profile, security, and orders from one place."}
          </p>
        </div>

        {authMode !== "recovery" ? (
          <div className="workspace-switch auth-switch">
            <button className={authMode === "signin" ? "switch-active" : ""} onClick={() => setMode("signin")}>
              Sign in
            </button>
            <button className={authMode === "signup" ? "switch-active" : ""} onClick={() => setMode("signup")}>
              Create account
            </button>
            <button className={authMode === "forgot" ? "switch-active" : ""} onClick={() => setMode("forgot")}>
              Forgot password
            </button>
          </div>
        ) : null}

        {authMode === "signup" ? (
          <>
            <div className="auth-oauth">
              <button
                className="button-google button-wide"
                onClick={() => void actions.signInWithGoogle(signUp)}
                disabled={state.authLoading}
              >
                <span className="auth-google-mark" aria-hidden="true">
                  G
                </span>
                <span>{`Create ${signUp.role} account with Google`}</span>
              </button>
              <p className="auth-helper">
                Choose buyer or seller first. After Google returns, JHIMS will create the account,
                open your profile, and let you continue from there.
              </p>
              <div className="auth-divider">
                <span>or continue with email</span>
              </div>
            </div>

            <div className="auth-form auth-form-grid">
              <label className="field">
                <span>Full name</span>
                <input value={signUp.fullName} onChange={(event) => setSignUp((current) => ({ ...current, fullName: event.target.value }))} />
              </label>
              <label className="field">
                <span>Email</span>
                <input value={signUp.email} onChange={(event) => setSignUp((current) => ({ ...current, email: event.target.value }))} />
              </label>
              <label className="field">
                <span>Password</span>
                <input type="password" value={signUp.password} onChange={(event) => setSignUp((current) => ({ ...current, password: event.target.value }))} />
              </label>
              <label className="field">
                <span>Phone</span>
                <input value={signUp.phone} onChange={(event) => setSignUp((current) => ({ ...current, phone: event.target.value }))} />
              </label>
              <label className="field">
                <span>Location</span>
                <input value={signUp.location} onChange={(event) => setSignUp((current) => ({ ...current, location: event.target.value }))} />
              </label>
              <label className="field">
                <span>Role</span>
                <select value={signUp.role} onChange={(event) => setSignUp((current) => ({ ...current, role: event.target.value as SignUpInput["role"] }))}>
                  <option value="buyer">Buyer</option>
                  <option value="seller">Seller</option>
                </select>
              </label>
              {signUp.role === "seller" ? (
                <label className="field field-span">
                  <span>Shop name</span>
                  <input value={signUp.shopName} onChange={(event) => setSignUp((current) => ({ ...current, shopName: event.target.value }))} />
                </label>
              ) : null}
              <button className="button-primary button-wide field-span" onClick={() => void actions.signUp(signUp)} disabled={state.authLoading}>
                {state.authLoading ? "Creating account..." : "Create account"}
              </button>
            </div>
          </>
        ) : null}

        {authMode === "signin" ? (
          <>
            <div className="auth-oauth">
              <button
                className="button-google button-wide"
                onClick={() => void actions.signInWithGoogle(null)}
                disabled={state.authLoading}
              >
                <span className="auth-google-mark" aria-hidden="true">
                  G
                </span>
                <span>Continue with Google</span>
              </button>
              <p className="auth-helper">
                Use Google for a faster sign-in if your account was created with Google or linked later from your profile.
              </p>
              <div className="auth-divider">
                <span>or continue with email</span>
              </div>
            </div>

            <div className="auth-form">
              <label className="field">
                <span>Email</span>
                <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
              </label>
              <label className="field">
                <span>Password</span>
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" />
              </label>
              <div className="auth-inline-actions">
                <button className="button-primary button-wide" onClick={() => void actions.signIn({ email, password })} disabled={state.authLoading}>
                  {state.authLoading ? "Signing in..." : "Sign in"}
                </button>
                <button className="link-button auth-link-button" onClick={() => setMode("forgot")}>
                  Forgot password?
                </button>
              </div>
            </div>
          </>
        ) : null}

        {authMode === "forgot" ? (
          <div className="auth-form">
            <div className="profile-note auth-note">
              <strong>Forgot your password?</strong>
              <p>Enter the account email and JHIMS will send a reset link so you can create a new password.</p>
            </div>
            <label className="field">
              <span>Email</span>
              <input value={resetEmail} onChange={(event) => setResetEmail(event.target.value)} placeholder="you@example.com" />
            </label>
            <div className="auth-inline-actions">
              <button className="button-primary button-wide" onClick={() => void actions.requestPasswordReset(resetEmail)} disabled={state.authLoading}>
                {state.authLoading ? "Sending..." : "Send reset link"}
              </button>
              <button className="button-ghost" onClick={() => setMode("signin")}>
                Back to sign in
              </button>
            </div>
          </div>
        ) : null}

        {authMode === "recovery" ? (
          <div className="auth-form">
            <div className="profile-note auth-note">
              <strong>Reset your password</strong>
              <p>Set a new password now. After saving, you will go straight back into your real JHIMS account.</p>
            </div>
            <label className="field">
              <span>New password</span>
              <input
                type="password"
                value={recoveryPassword}
                onChange={(event) => setRecoveryPassword(event.target.value)}
                placeholder="Use at least 8 characters"
              />
            </label>
            <label className="field">
              <span>Confirm password</span>
              <input
                type="password"
                value={recoveryConfirmPassword}
                onChange={(event) => setRecoveryConfirmPassword(event.target.value)}
                placeholder="Re-enter password"
              />
            </label>
            {recoveryMismatch ? <p className="profile-inline-error">Passwords do not match yet.</p> : null}
            <button
              className="button-primary button-wide"
              onClick={() => void actions.completePasswordRecovery(recoveryPassword)}
              disabled={state.authLoading || !recoveryPassword || recoveryMismatch}
            >
              {state.authLoading ? "Saving..." : "Save new password"}
            </button>
          </div>
        ) : null}

        {state.authError ? <p className="auth-error">{state.authError}</p> : null}
      </div>
    </div>
  );
};

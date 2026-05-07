import { useState } from "react";
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
  const [signUp, setSignUp] = useState<SignUpInput>(initialSignUp);
  const [mode, setMode] = useState<"signin" | "signup">("signup");

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <JhimsLogo size="auth" />
          <p>Create your buyer or seller account, then manage your profile, security, and orders from one place.</p>
        </div>

        <div className="workspace-switch auth-switch">
          <button className={mode === "signin" ? "switch-active" : ""} onClick={() => setMode("signin")}>
            Sign in
          </button>
          <button className={mode === "signup" ? "switch-active" : ""} onClick={() => setMode("signup")}>
            Create account
          </button>
        </div>

        <div className="auth-oauth">
          <button
            className="button-google button-wide"
            onClick={() => void actions.signInWithGoogle(mode === "signup" ? signUp : null)}
            disabled={state.authLoading}
          >
            <span className="auth-google-mark" aria-hidden="true">
              G
            </span>
            <span>
              {mode === "signup"
                ? `Create ${signUp.role} account with Google`
                : "Continue with Google"}
            </span>
          </button>
          <p className="auth-helper">
            {mode === "signup"
              ? "Choose buyer or seller first. After Google returns, JHIMS will create the account and open your profile."
              : "Use Google for a faster sign-in if your account was created with Google or if you already linked it."}
          </p>
          <div className="auth-divider">
            <span>or continue with email</span>
          </div>
        </div>

        {mode === "signin" ? (
          <div className="auth-form">
            <label className="field">
              <span>Email</span>
              <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
            </label>
            <label className="field">
              <span>Password</span>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" />
            </label>
            <button className="button-primary button-wide" onClick={() => void actions.signIn({ email, password })} disabled={state.authLoading}>
              {state.authLoading ? "Signing in..." : "Sign in"}
            </button>
          </div>
        ) : (
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
        )}

        {state.authError ? <p className="auth-error">{state.authError}</p> : null}
      </div>
    </div>
  );
};

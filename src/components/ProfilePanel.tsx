import { useEffect, useState } from "react";
import { formatCompactMoney } from "../lib/format";
import { useJhims } from "../state/JhimsStore";
import type { ProfileUpdateInput } from "../types";
import { TonePill } from "./Ui";

const buildProfileDraft = (
  fullName: string,
  phone: string,
  location: string,
  shopName: string,
): ProfileUpdateInput => ({
  fullName,
  phone,
  location,
  shopName,
});

export const ProfilePanel = () => {
  const { state, actions } = useJhims();
  const profile = state.profile;
  const sellerProfile = profile?.role === "seller"
    ? state.sellers.find((seller) => seller.id === profile.id)
    : undefined;
  const [draft, setDraft] = useState<ProfileUpdateInput>(
    buildProfileDraft("", "", "Accra", ""),
  );
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (!profile) {
      return;
    }

    setDraft(
      buildProfileDraft(
        profile.name,
        profile.phone,
        profile.location,
        sellerProfile?.shopName ?? "",
      ),
    );
  }, [profile, sellerProfile?.shopName]);

  if (!profile || !state.isProfileOpen) {
    return null;
  }

  const initials = profile.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "J";
  const activeOrders = state.orders.filter(
    (order) => !["Completed", "Delivered", "Rejected"].includes(order.status),
  ).length;
  const liveListings = state.products.filter((product) => product.sellerId === profile.id).length;
  const pendingPayout = state.payouts
    .filter((payout) => payout.sellerId === profile.id && payout.status === "Pending")
    .reduce((sum, payout) => sum + payout.amount, 0);
  const passwordsMismatch = Boolean(nextPassword && confirmPassword && nextPassword !== confirmPassword);

  const handleProfileSave = async () => {
    await actions.updateProfile(draft);
  };

  const handlePasswordSave = async () => {
    if (passwordsMismatch) {
      return;
    }

    const saved = await actions.updatePassword(nextPassword);
    if (saved) {
      setNextPassword("");
      setConfirmPassword("");
    }
  };

  return (
    <div className="profile-overlay" onClick={() => actions.closeProfile()}>
      <div className="profile-panel" onClick={(event) => event.stopPropagation()}>
        <div className="profile-head">
          <div className="profile-identity">
            <div className="profile-avatar" aria-hidden="true">
              {initials}
            </div>
            <div>
              <p className="eyebrow">My profile</p>
              <h2>{profile.name}</h2>
              <div className="profile-badges">
                <TonePill
                  label={profile.role === "seller" ? "Seller account" : profile.role === "admin" ? "Admin account" : "Buyer account"}
                  tone={profile.role === "seller" ? "accent" : profile.role === "admin" ? "warning" : "neutral"}
                />
                <TonePill
                  label={profile.verified ? "Verified" : "Verification pending"}
                  tone={profile.verified ? "success" : "warning"}
                />
              </div>
            </div>
          </div>
          <button className="button-ghost profile-close" onClick={() => actions.closeProfile()}>
            Close
          </button>
        </div>

        <div className="profile-stats">
          <article>
            <span>Open orders</span>
            <strong>{activeOrders}</strong>
          </article>
          <article>
            <span>Saved items</span>
            <strong>{state.favorites.length}</strong>
          </article>
          <article>
            <span>{profile.role === "seller" ? "Live listings" : "Notifications"}</span>
            <strong>{profile.role === "seller" ? liveListings : state.notifications.length}</strong>
          </article>
          <article>
            <span>{profile.role === "seller" ? "Pending payout" : "Current workspace"}</span>
            <strong>{profile.role === "seller" ? formatCompactMoney(pendingPayout) : state.activeView}</strong>
          </article>
        </div>

        <div className="profile-layout">
          <section className="profile-card">
            <div className="profile-section-head">
              <div>
                <p className="eyebrow">Account details</p>
                <h3>Edit your information</h3>
              </div>
            </div>

            <div className="profile-form-grid">
              <label className="field">
                <span>Full name</span>
                <input
                  value={draft.fullName}
                  onChange={(event) => setDraft((current) => ({ ...current, fullName: event.target.value }))}
                />
              </label>
              <label className="field field-readonly">
                <span>Email</span>
                <input value={profile.email} readOnly />
              </label>
              <label className="field">
                <span>Phone</span>
                <input
                  value={draft.phone}
                  onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))}
                  placeholder="+233 24 000 0000"
                />
              </label>
              <label className="field">
                <span>Location</span>
                <input
                  value={draft.location}
                  onChange={(event) => setDraft((current) => ({ ...current, location: event.target.value }))}
                />
              </label>
              <label className="field field-readonly">
                <span>Role</span>
                <input value={profile.role} readOnly />
              </label>
              {profile.role === "seller" ? (
                <label className="field">
                  <span>Shop name</span>
                  <input
                    value={draft.shopName}
                    onChange={(event) => setDraft((current) => ({ ...current, shopName: event.target.value }))}
                  />
                </label>
              ) : null}
            </div>

            <div className="profile-card-actions">
              <button
                className="button-primary"
                onClick={() => void handleProfileSave()}
                disabled={state.profileSaving}
              >
                {state.profileSaving ? "Saving..." : "Save profile"}
              </button>
            </div>
          </section>

          <section className="profile-card profile-security-card">
            <div className="profile-section-head">
              <div>
                <p className="eyebrow">Security</p>
                <h3>Change or reset password</h3>
              </div>
            </div>

            <div className="profile-note">
              <strong>Google and email login can live together.</strong>
              <p>
                If you used Google to create the account, setting a password here also lets you
                sign in later with your email and password.
              </p>
            </div>

            <div className="profile-form-grid profile-password-grid">
              <label className="field">
                <span>New password</span>
                <input
                  type="password"
                  value={nextPassword}
                  onChange={(event) => setNextPassword(event.target.value)}
                  placeholder="Use at least 8 characters"
                />
              </label>
              <label className="field">
                <span>Confirm password</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Re-enter password"
                />
              </label>
            </div>

            {passwordsMismatch ? (
              <p className="profile-inline-error">Passwords do not match yet.</p>
            ) : null}

            <div className="profile-card-actions">
              <button
                className="button-primary"
                onClick={() => void handlePasswordSave()}
                disabled={state.passwordSaving || !nextPassword || passwordsMismatch}
              >
                {state.passwordSaving ? "Updating..." : "Update password"}
              </button>
              <button
                className="button-secondary"
                onClick={() => void actions.sendPasswordReset()}
              >
                Send reset link
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

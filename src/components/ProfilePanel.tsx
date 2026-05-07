import { useEffect, useMemo, useState } from "react";
import { formatCompactMoney } from "../lib/format";
import { useJhims } from "../state/JhimsStore";
import type { ProfileUpdateInput, SellerOnboardingInput } from "../types";
import { TonePill } from "./Ui";

const buildProfileDraft = (
  fullName: string,
  phone: string,
  location: string,
  shopName: string,
  bio: string,
  payoutPhone: string,
): ProfileUpdateInput => ({
  fullName,
  phone,
  location,
  shopName,
  bio,
  payoutPhone,
});

const buildSellerDraft = (
  shopName: string,
  bio: string,
  payoutPhone: string,
  idDocumentType: string,
  idDocumentNumber: string,
): SellerOnboardingInput => ({
  shopName,
  bio,
  payoutPhone,
  idDocumentType,
  idDocumentNumber,
});

export const ProfilePanel = () => {
  const { state, actions } = useJhims();
  const profile = state.profile;
  const sellerProfile = profile?.role === "seller"
    ? state.sellers.find((seller) => seller.id === profile.id)
    : undefined;
  const [draft, setDraft] = useState<ProfileUpdateInput>(
    buildProfileDraft("", "", "Accra", "", "", ""),
  );
  const [sellerDraft, setSellerDraft] = useState<SellerOnboardingInput>(
    buildSellerDraft("", "", "", "National ID", ""),
  );
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [kycFile, setKycFile] = useState<File | null>(null);
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (!profile) {
      return;
    }

    const nextShopName = sellerProfile?.shopName ?? `${profile.name} Shop`;
    const nextBio = sellerProfile?.bio ?? "";
    const nextPayoutPhone = sellerProfile?.payoutPhone ?? profile.phone;

    setDraft(
      buildProfileDraft(
        profile.name,
        profile.phone,
        profile.location,
        nextShopName,
        nextBio,
        nextPayoutPhone,
      ),
    );
    setSellerDraft(
      buildSellerDraft(
        nextShopName,
        nextBio,
        nextPayoutPhone,
        sellerProfile?.idDocumentType ?? "National ID",
        sellerProfile?.idDocumentNumber ?? "",
      ),
    );
  }, [profile, sellerProfile]);

  const previewAvatar = useMemo(() => {
    if (avatarFile) {
      return URL.createObjectURL(avatarFile);
    }
    return profile?.avatarUrl ?? "";
  }, [avatarFile, profile?.avatarUrl]);

  useEffect(() => {
    return () => {
      if (previewAvatar && avatarFile) {
        URL.revokeObjectURL(previewAvatar);
      }
    };
  }, [avatarFile, previewAvatar]);

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
  const canBecomeSeller = profile.role === "buyer";

  const handleProfileSave = async () => {
    const saved = await actions.updateProfile(draft, avatarFile);
    if (saved) {
      setAvatarFile(null);
    }
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

  const handleSellerUpgrade = async () => {
    const saved = await actions.upgradeToSeller(sellerDraft, kycFile);
    if (saved) {
      setKycFile(null);
    }
  };

  return (
    <div className="profile-overlay" onClick={() => actions.closeProfile()}>
      <div className="profile-panel" onClick={(event) => event.stopPropagation()}>
        <div className="profile-head">
          <div className="profile-identity">
            <div className="profile-avatar-frame" aria-hidden="true">
              {previewAvatar ? (
                <img src={previewAvatar} alt={profile.name} className="profile-avatar-image" />
              ) : (
                <div className="profile-avatar">{initials}</div>
              )}
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
                  label={profile.verified ? "Verified badge active" : "Verification pending"}
                  tone={profile.verified ? "success" : "warning"}
                />
                {sellerProfile?.verificationStatus ? (
                  <TonePill
                    label={`KYC ${sellerProfile.verificationStatus}`}
                    tone={sellerProfile.verificationStatus === "Approved" ? "success" : sellerProfile.verificationStatus === "Pending" ? "accent" : "warning"}
                  />
                ) : null}
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

            <div className="profile-avatar-upload">
              <div className="profile-avatar-upload-preview">
                {previewAvatar ? (
                  <img src={previewAvatar} alt={profile.name} className="profile-avatar-image" />
                ) : (
                  <div className="profile-avatar">{initials}</div>
                )}
              </div>
              <label className="field profile-upload-field">
                <span>Profile photo</span>
                <input type="file" accept="image/*" onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)} />
                <small>Upload a buyer or seller profile photo to make the account look complete.</small>
              </label>
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
              {profile.role === "seller" ? (
                <>
                  <label className="field field-span">
                    <span>Shop bio</span>
                    <textarea
                      value={draft.bio ?? ""}
                      onChange={(event) => setDraft((current) => ({ ...current, bio: event.target.value }))}
                      rows={4}
                    />
                  </label>
                  <label className="field">
                    <span>Payout phone</span>
                    <input
                      value={draft.payoutPhone ?? ""}
                      onChange={(event) => setDraft((current) => ({ ...current, payoutPhone: event.target.value }))}
                    />
                  </label>
                </>
              ) : null}
            </div>

            <div className="profile-card-actions">
              <button
                className="button-primary"
                onClick={() => void handleProfileSave()}
                disabled={state.profileSaving || state.profileUploading}
              >
                {state.profileSaving || state.profileUploading ? "Saving..." : "Save profile"}
              </button>
            </div>
          </section>

          <div className="profile-sidebar-stack">
            {canBecomeSeller ? (
              <section className="profile-card profile-seller-upgrade">
                <div className="profile-section-head">
                  <div>
                    <p className="eyebrow">Seller onboarding</p>
                    <h3>Upgrade this account to seller</h3>
                  </div>
                </div>

                <div className="profile-note">
                  <strong>Make this buyer account a real seller account.</strong>
                  <p>
                    Submit your shop details, payout phone, and KYC document. JHIMS will switch the
                    account to seller mode so you can start posting real products immediately.
                  </p>
                </div>

                <div className="profile-form-grid">
                  <label className="field">
                    <span>Shop name</span>
                    <input
                      value={sellerDraft.shopName}
                      onChange={(event) => setSellerDraft((current) => ({ ...current, shopName: event.target.value }))}
                    />
                  </label>
                  <label className="field">
                    <span>Payout phone</span>
                    <input
                      value={sellerDraft.payoutPhone}
                      onChange={(event) => setSellerDraft((current) => ({ ...current, payoutPhone: event.target.value }))}
                    />
                  </label>
                  <label className="field field-span">
                    <span>Shop bio</span>
                    <textarea
                      value={sellerDraft.bio}
                      onChange={(event) => setSellerDraft((current) => ({ ...current, bio: event.target.value }))}
                      rows={4}
                    />
                  </label>
                  <label className="field">
                    <span>ID type</span>
                    <select
                      value={sellerDraft.idDocumentType}
                      onChange={(event) => setSellerDraft((current) => ({ ...current, idDocumentType: event.target.value }))}
                    >
                      <option value="National ID">National ID</option>
                      <option value="Passport">Passport</option>
                      <option value="Driver's Licence">Driver's Licence</option>
                      <option value="Business Registration">Business Registration</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>ID number</span>
                    <input
                      value={sellerDraft.idDocumentNumber}
                      onChange={(event) => setSellerDraft((current) => ({ ...current, idDocumentNumber: event.target.value }))}
                    />
                  </label>
                  <label className="field field-span">
                    <span>KYC document upload</span>
                    <input type="file" accept=".pdf,image/*" onChange={(event) => setKycFile(event.target.files?.[0] ?? null)} />
                    <small>{kycFile ? `Ready to upload: ${kycFile.name}` : "Upload an ID image or PDF."}</small>
                  </label>
                </div>

                <div className="profile-card-actions">
                  <button
                    className="button-primary"
                    onClick={() => void handleSellerUpgrade()}
                    disabled={state.sellerOnboardingSaving}
                  >
                    {state.sellerOnboardingSaving ? "Submitting..." : "Become a seller"}
                  </button>
                </div>
              </section>
            ) : (
              <section className="profile-card profile-seller-status">
                <div className="profile-section-head">
                  <div>
                    <p className="eyebrow">Seller status</p>
                    <h3>Business verification</h3>
                  </div>
                </div>

                <div className="profile-note">
                  <strong>{sellerProfile?.shopName ?? "Your seller profile"}</strong>
                  <p>
                    {sellerProfile?.verificationStatus === "Approved"
                      ? "Your verification badge is active and your seller account is ready for orders."
                      : sellerProfile?.verificationStatus === "Pending"
                        ? "Your KYC submission is pending review. You can still manage your shop and add products."
                        : "Complete your onboarding details to unlock the full seller badge experience."}
                  </p>
                </div>

                <div className="profile-status-grid">
                  <div className="simple-row simple-row-block">
                    <div>
                      <strong>Verification status</strong>
                      <small>{sellerProfile?.verificationStatus ?? "Not Started"}</small>
                    </div>
                  </div>
                  <div className="simple-row simple-row-block">
                    <div>
                      <strong>KYC document</strong>
                      <small>{sellerProfile?.idDocumentType ?? "Not uploaded"} {sellerProfile?.idDocumentPath ? "submitted" : ""}</small>
                    </div>
                  </div>
                  <div className="simple-row simple-row-block">
                    <div>
                      <strong>Submitted on</strong>
                      <small>{sellerProfile?.onboardingSubmittedAt ?? "Not submitted yet"}</small>
                    </div>
                  </div>
                </div>
              </section>
            )}

            <section className="profile-card profile-security-card">
              <div className="profile-section-head">
                <div>
                  <p className="eyebrow">Security</p>
                  <h3>Forgot and reset password</h3>
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
                  onClick={() => void actions.requestPasswordReset()}
                >
                  Send reset link
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

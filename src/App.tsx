import { startTransition, useEffect } from "react";
import { AdminView } from "./components/AdminView";
import { AuthScreen } from "./components/AuthScreen";
import { MarketplaceView } from "./components/MarketplaceView";
import { ProfilePanel } from "./components/ProfilePanel";
import { SellerView } from "./components/SellerView";
import { formatCompactMoney } from "./lib/format";
import { useJhims } from "./state/JhimsStore";
import type { AppView } from "./types";

const viewMeta: Record<
  AppView,
  { label: string; blurb: string; statLabel: string; statValue: (gmv: number, orders: number, products: number) => string }
> = {
  buyer: {
    label: "Marketplace",
    blurb: "Search, favourite, order, pay, and track delivery.",
    statLabel: "Live listings",
    statValue: (_gmv, _orders, products) => products.toString(),
  },
  seller: {
    label: "Seller Hub",
    blurb: "Manage listings, orders, payouts, reviews, and buyer chat.",
    statLabel: "Open orders",
    statValue: (_gmv, orders) => orders.toString(),
  },
  admin: {
    label: "Admin Ops",
    blurb: "Moderate users, escrow, payouts, reports, and platform safety.",
    statLabel: "GMV",
    statValue: (gmv) => formatCompactMoney(gmv),
  },
};

function App() {
  const { state, actions } = useJhims();

  useEffect(() => {
    if (!state.toast) {
      return undefined;
    }

    const timer = window.setTimeout(() => actions.clearToast(), 2800);
    return () => window.clearTimeout(timer);
  }, [actions, state.toast]);

  const gmv = state.orders.reduce((sum, order) => sum + order.total, 0);
  const openOrders = state.orders.filter(
    (order) => !["Completed", "Delivered", "Rejected"].includes(order.status),
  ).length;
  const activeMeta = viewMeta[state.activeView];
  const isBuyer = state.activeView === "buyer";
  const isAuthenticatedLive = !state.backendConfigured || Boolean(state.sessionUser);
  const profileInitials = state.profile?.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  if (state.backendConfigured && !isAuthenticatedLive) {
    return <AuthScreen />;
  }

  return (
    <div className="app-shell">
      <div className="app-backdrop" />
      <header className="topbar">
        <div className="brand-block">
          <span className="brand-wordmark">JHIMS</span>
          <span className="brand-tag">Ghana marketplace</span>
        </div>
        <nav className="workspace-switch" aria-label="Workspace switcher">
          {(["buyer", "seller", "admin"] as AppView[]).map((view) => (
            <button
              key={view}
              className={state.activeView === view ? "switch-active" : ""}
              onClick={() => startTransition(() => actions.setView(view))}
            >
              {viewMeta[view].label}
            </button>
          ))}
        </nav>
        <div className="topbar-tools">
          {!isBuyer ? (
            <div className="summary-chip">
              <span>{activeMeta.statLabel}</span>
              <strong>{activeMeta.statValue(gmv, openOrders, state.products.length)}</strong>
            </div>
          ) : null}
          {state.profile ? (
            <button className="profile-trigger" onClick={() => actions.openProfile()}>
              <span className="profile-trigger-avatar">{profileInitials || "J"}</span>
              <span className="profile-trigger-copy">
                <strong>{state.profile.name}</strong>
                <small>{state.profile.role === "seller" ? "Seller profile" : state.profile.role === "admin" ? "Admin profile" : "Buyer profile"}</small>
              </span>
            </button>
          ) : null}
          {state.backendConfigured ? (
            <button className="top-link" onClick={() => void actions.signOut()}>
              Sign out
            </button>
          ) : (
            <span className="top-link top-link-static">Demo mode</span>
          )}
          <button className="button-primary topbar-cta">
            {isBuyer ? "Sell" : "Live status"}
          </button>
        </div>
      </header>

      {!state.backendConfigured ? (
        <section className="setup-banner">
          <strong>Demo mode is active.</strong>
          <p>Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env` to enable real auth, database, storage, chat, and checkout.</p>
        </section>
      ) : null}

      {!isBuyer ? (
        <section className="workspace-banner">
          <div>
            <p className="eyebrow">{activeMeta.label}</p>
            <h1>{activeMeta.blurb}</h1>
          </div>
          <div className="banner-stats">
            <div>
              <span>Orders</span>
              <strong>{state.orders.length}</strong>
            </div>
            <div>
              <span>Verified sellers</span>
              <strong>{state.sellers.filter((seller) => seller.verified).length}</strong>
            </div>
            <div>
              <span>Escrow cases</span>
              <strong>{state.payments.filter((payment) => payment.status === "Held in Escrow").length}</strong>
            </div>
          </div>
        </section>
      ) : null}

      {state.activeView === "buyer" ? <MarketplaceView /> : null}
      {state.activeView === "seller" ? <SellerView /> : null}
      {state.activeView === "admin" ? <AdminView /> : null}

      {state.toast ? <div className="toast">{state.toast}</div> : null}
      <ProfilePanel />
    </div>
  );
}

export default App;

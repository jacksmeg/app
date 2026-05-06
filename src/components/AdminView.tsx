import { formatCompactMoney, formatMoney, statusTone } from "../lib/format";
import { useJhims } from "../state/JhimsStore";
import { DeliveryFeed, NotificationsPanel } from "./LivePanels";
import { MetricCard, SectionCard, TonePill } from "./Ui";

export const AdminView = () => {
  const { state, actions } = useJhims();

  const gmv = state.orders
    .filter((order) => order.status !== "Rejected")
    .reduce((sum, order) => sum + order.total, 0);
  const activeUsers = state.users.filter((user) => !user.banned).length;
  const heldEscrow = state.payments
    .filter((payment) => payment.status === "Held in Escrow")
    .reduce((sum, payment) => sum + payment.amount, 0);
  const verificationQueue = state.sellers.filter((seller) => !seller.verified);
  const openComplaints = state.complaints.filter((complaint) => complaint.status !== "Resolved");
  const moderationUsers = state.users.filter((user) => user.role !== "admin");

  return (
    <div className="workspace-grid">
      <div className="workspace-main">
        <section className="hero-shell admin-shell">
          <div className="hero-copy">
            <p className="eyebrow">Admin control tower</p>
            <h1>Moderate sellers, approve payouts, protect buyers, and keep JHIMS secure.</h1>
            <p className="hero-text">
              The admin workspace gives operations one live surface for users, products, payments,
              complaints, escrow balances, and fraud-sensitive delivery flows.
            </p>
          </div>
          <div className="hero-panel metrics-grid">
            <MetricCard
              label="Gross merchandise"
              value={formatCompactMoney(gmv)}
              detail="Total order value moving through the platform."
              tone="accent"
            />
            <MetricCard
              label="Active accounts"
              value={activeUsers.toString()}
              detail="Buyers and sellers not currently suspended."
              tone="success"
            />
            <MetricCard
              label="Escrow held"
              value={formatCompactMoney(heldEscrow)}
              detail="Funds protected until delivery confirmation."
              tone="neutral"
            />
          </div>
        </section>

        <div className="split-grid">
          <SectionCard
            title="Seller verification"
            eyebrow="Trust and safety"
            action={`${verificationQueue.length} awaiting review`}
          >
            <div className="stack-list">
              {verificationQueue.map((seller) => (
                <article key={seller.id} className="simple-row simple-row-block">
                  <div>
                    <strong>{seller.shopName}</strong>
                    <p>
                      {seller.name} · {seller.location} · {seller.responseTime} response time
                    </p>
                  </div>
                  <div className="card-actions">
                    <TonePill label="Pending ID check" tone="warning" />
                    <button
                      className="button-primary"
                      onClick={() => actions.verifySeller(seller.id)}
                    >
                      Approve seller
                    </button>
                  </div>
                </article>
              ))}
              {!verificationQueue.length ? (
                <p className="empty-text">No sellers are waiting for approval right now.</p>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard
            title="Escrow and payouts"
            eyebrow="Payments"
            action={`${state.payouts.length} payout requests`}
          >
            <div className="stack-list">
              {state.payments.map((payment) => (
                <div key={payment.id} className="simple-row">
                  <div>
                    <strong>{payment.orderId}</strong>
                    <p>
                      {payment.method} · {formatMoney(payment.amount)}
                    </p>
                  </div>
                  <TonePill
                    label={payment.status}
                    tone={
                      payment.status === "Settled"
                        ? "success"
                        : payment.status === "Held in Escrow"
                          ? "accent"
                          : "warning"
                    }
                  />
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <SectionCard
          title="Complaints and reports"
          eyebrow="Moderation queue"
          action={`${openComplaints.length} active cases`}
        >
          <div className="stack-list">
            {state.complaints.map((complaint) => (
              <article key={complaint.id} className="simple-row simple-row-block">
                <div>
                  <strong>{complaint.reason}</strong>
                  <p>
                    {complaint.targetType} · {complaint.reporter} · {complaint.openedAt}
                  </p>
                </div>
                <div className="card-actions">
                  <TonePill
                    label={complaint.status}
                    tone={
                      complaint.status === "Resolved"
                        ? "success"
                        : complaint.severity === "High"
                          ? "danger"
                          : "warning"
                    }
                  />
                  {complaint.status !== "Resolved" ? (
                    <button
                      className="button-primary"
                      onClick={() => actions.resolveComplaint(complaint.id)}
                    >
                      Resolve
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </SectionCard>

        <div className="split-grid">
          <SectionCard title="User moderation" eyebrow="Accounts">
            <div className="stack-list">
              {moderationUsers.map((user) => (
                <div key={user.id} className="simple-row">
                  <div>
                    <strong>{user.name}</strong>
                    <p>
                      {user.role} · {user.location} · {user.verified ? "Verified" : "Unverified"}
                    </p>
                  </div>
                  <div className="card-actions">
                    <TonePill label={user.banned ? "Suspended" : "Active"} tone={user.banned ? "danger" : "success"} />
                    <button
                      className="button-secondary"
                      onClick={() => actions.toggleUserBan(user.id)}
                    >
                      {user.banned ? "Restore" : "Suspend"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Operational orders" eyebrow="Delivery pipeline">
            <div className="stack-list">
              {state.orders.slice(0, 5).map((order) => (
                <div key={order.id} className="simple-row">
                  <div>
                    <strong>{order.id}</strong>
                    <p>
                      {order.location} · {formatMoney(order.total + order.deliveryFee)}
                    </p>
                  </div>
                  <div className="card-actions">
                    <TonePill label={order.status} tone={statusTone(order.status)} />
                    <button
                      className="button-ghost"
                      onClick={() => actions.advanceOrder(order.id)}
                      disabled={["Completed", "Delivered", "Rejected", "Reviewing"].includes(order.status)}
                    >
                      Move forward
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="split-grid">
          <NotificationsPanel />
          <DeliveryFeed orderId={state.orders[0]?.id} />
        </div>
      </div>
    </div>
  );
};

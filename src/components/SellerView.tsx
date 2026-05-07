import { useState } from "react";
import { formatCompactMoney, formatMoney, statusTone } from "../lib/format";
import { useJhims } from "../state/JhimsStore";
import { ConversationPanel, DeliveryFeed, NotificationsPanel, SellerProductComposer } from "./LivePanels";
import { MetricCard, SectionCard, Timeline, TonePill } from "./Ui";

export const SellerView = () => {
  const { state, actions } = useJhims();
  const [payoutAmount, setPayoutAmount] = useState("1200");
  const [sellerNote, setSellerNote] = useState(
    "Use the payout box to simulate withdrawals from seller balance.",
  );

  const seller = state.sellers.find((entry) => entry.id === state.currentSellerId);
  if (!seller) {
    return null;
  }

  const inventory = state.products.filter((product) => product.sellerId === seller.id);
  const sellerOrders = state.orders.filter((order) => order.sellerId === seller.id).slice(0, 5);
  const sellerPayouts = state.payouts.filter((payout) => payout.sellerId === seller.id).slice(0, 4);
  const lowStockCount = inventory.filter((product) => product.stock <= 15).length;
  const openOrders = sellerOrders.filter(
    (order) => !["Delivered", "Completed", "Rejected"].includes(order.status),
  ).length;

  return (
    <div className="workspace-grid">
      <div className="workspace-main">
        <section className="hero-shell seller-shell">
          <div className="hero-copy">
            <p className="eyebrow">Seller center</p>
            <h1>{seller.shopName} runs inventory, orders, chats, and withdrawals from one desk.</h1>
            <p className="hero-text">
              {seller.bio?.trim()
                ? seller.bio
                : "Track every listing, move orders through delivery, keep buyer response time low, and request payouts as soon as orders settle."}
            </p>
            <div className="pill-row">
              <TonePill
                label={seller.verified ? "Verified badge active" : `KYC ${seller.verificationStatus ?? "Pending"}`}
                tone={seller.verified ? "success" : seller.verificationStatus === "Pending" ? "accent" : "warning"}
              />
              {seller.onboardingSubmittedAt ? (
                <TonePill label={`Submitted ${seller.onboardingSubmittedAt}`} tone="neutral" />
              ) : null}
            </div>
            <div className="hero-actions">
              <button
                className="button-primary"
                onClick={() => {
                  actions.selectProduct(inventory[0]?.id ?? state.selectedProductId);
                  setSellerNote("Highlighted your top inventory item for quick editing.");
                }}
              >
                Focus top listing
              </button>
              <button
                className="button-secondary"
                onClick={() => setSellerNote("Seller chat queue synced. Average reply time is 8 mins.")}
              >
                Open chat queue
              </button>
            </div>
          </div>
          <div className="hero-panel metrics-rail">
            <MetricCard
              label="Available balance"
              value={formatCompactMoney(seller.balance)}
              detail="Settled funds ready for withdrawal."
              tone="accent"
            />
            <MetricCard
              label="Open orders"
              value={openOrders.toString()}
              detail="Orders that still need acceptance, packing, or delivery."
              tone="success"
            />
            <MetricCard
              label="Low stock"
              value={lowStockCount.toString()}
              detail="Listings that should be restocked soon."
              tone="neutral"
            />
          </div>
        </section>

        <div className="split-grid">
          <SectionCard title="Inventory" eyebrow="Listings" action={`${inventory.length} products`}>
            <div className="inventory-stack">
              {!inventory.length ? (
                <div className="note-box">
                  <strong>Post your first real product</strong>
                  <p>
                    Your seller account is live. Use the product manager below to upload real images,
                    set pricing, and publish your first listing to the marketplace.
                  </p>
                </div>
              ) : null}
              {inventory.map((product) => (
                <article key={product.id} className="inventory-row">
                  <div className="inventory-meta">
                    <div
                      className="mini-swatch"
                      style={{
                        background: `linear-gradient(135deg, ${product.palette[0]}, ${product.palette[1]})`,
                      }}
                    />
                    <div>
                      <strong>{product.name}</strong>
                      <p>
                        {product.category} in {product.location}
                      </p>
                    </div>
                  </div>
                  <div className="inventory-stats">
                    <span>{formatMoney(product.discountPrice ?? product.price)}</span>
                    <span>{product.stock} in stock</span>
                    <TonePill
                      label={product.escrowEligible ? "Escrow" : "Direct"}
                      tone={product.escrowEligible ? "accent" : "neutral"}
                    />
                    <button
                      className="button-ghost"
                      onClick={() =>
                        setSellerNote(`${product.name} opened for editing. Boost and media tools are next.`)
                      }
                    >
                      Edit listing
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Payouts and reviews" eyebrow="Finance">
            <div className="payout-box">
              <div className="payout-head">
                <strong>Withdraw funds</strong>
                <TonePill label={seller.subscription} tone="accent" />
              </div>
              <label className="field">
                <span>Amount</span>
                <input
                  value={payoutAmount}
                  onChange={(event) => setPayoutAmount(event.target.value)}
                  inputMode="numeric"
                />
              </label>
              <button
                className="button-primary button-wide"
                onClick={() => actions.requestPayout(Number(payoutAmount) || 0)}
              >
                Request withdrawal
              </button>
              <div className="note-box">
                <strong>Seller note</strong>
                <p>{sellerNote}</p>
              </div>
              <div className="payout-list">
                {sellerPayouts.map((payout) => (
                  <div key={payout.id} className="simple-row">
                    <div>
                      <strong>{formatMoney(payout.amount)}</strong>
                      <small>{payout.requestedAt}</small>
                    </div>
                    <TonePill
                      label={payout.status}
                      tone={payout.status === "Paid" ? "success" : payout.status === "Approved" ? "accent" : "warning"}
                    />
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Order pipeline" eyebrow="Fulfilment" action={`${sellerOrders.length} recent orders`}>
          <div className="order-stack">
            {sellerOrders.map((order) => (
              <article key={order.id} className="order-card">
                <div className="order-head">
                  <div>
                    <strong>{order.id}</strong>
                    <p>
                      {order.location} · {formatMoney(order.total + order.deliveryFee)}
                    </p>
                  </div>
                  <TonePill label={order.status} tone={statusTone(order.status)} />
                </div>
                <Timeline trail={order.statusTrail} current={order.status} />
                <div className="card-actions">
                  {order.status === "Pending" ? (
                    <>
                      <button
                        className="button-primary"
                        onClick={() => actions.sellerDecision(order.id, true)}
                      >
                        Accept
                      </button>
                      <button
                        className="button-secondary"
                        onClick={() => actions.sellerDecision(order.id, false)}
                      >
                        Reject
                      </button>
                    </>
                  ) : (
                    <button
                      className="button-primary"
                      onClick={() => actions.advanceOrder(order.id)}
                      disabled={["Completed", "Delivered", "Rejected", "Reviewing"].includes(order.status)}
                    >
                      Advance status
                    </button>
                  )}
                  <button
                    className="button-ghost"
                    onClick={() => setSellerNote(`Buyer conversation opened for ${order.id}.`)}
                  >
                    Chat buyer
                  </button>
                </div>
              </article>
            ))}
          </div>
        </SectionCard>

        <div className="split-grid">
          <SellerProductComposer />
          <NotificationsPanel />
        </div>

        <div className="split-grid">
          <ConversationPanel />
          <DeliveryFeed orderId={sellerOrders[0]?.id} />
        </div>
      </div>
    </div>
  );
};

import { useDeferredValue, useState } from "react";
import { formatMoney, statusTone } from "../lib/format";
import { ConversationPanel, DeliveryFeed, NotificationsPanel } from "./LivePanels";
import {
  CATEGORY_OPTIONS,
  CONDITION_OPTIONS,
  DELIVERY_OPTIONS,
  LOCATION_OPTIONS,
  useJhims,
} from "../state/JhimsStore";
import type { DeliveryOption, PaymentMethod, Product } from "../types";
import { PriceLine, ProductArt, SectionCard, Timeline, TonePill } from "./Ui";

const PAYMENT_OPTIONS: PaymentMethod[] = ["Escrow", "Mobile Money", "Card", "Bank Transfer", "Cash on Delivery", "Wallet"];
const CHECKOUT_DELIVERY_OPTIONS: DeliveryOption[] = ["JHIMS Rider", "Seller Delivery", "Pickup"];

export const MarketplaceView = () => {
  const { state, actions } = useJhims();
  const deferredSearch = useDeferredValue(state.searchTerm);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Escrow");
  const [deliveryOption, setDeliveryOption] = useState<DeliveryOption>("JHIMS Rider");
  const [buyerNote, setBuyerNote] = useState("Escrow is enabled by default for high-value orders.");

  const selectedProduct = state.products.find((product) => product.id === state.selectedProductId) ?? state.products[0] ?? null;
  const filteredProducts = state.products.filter((product) => {
    const text = `${product.name} ${product.description} ${product.category}`.toLowerCase();
    const matchesSearch = !deferredSearch || text.includes(deferredSearch.toLowerCase());
    const matchesCategory = state.filters.category === "All" || product.category === state.filters.category;
    const matchesLocation = state.filters.location === "All Ghana" || product.location === state.filters.location;
    const matchesCondition = state.filters.condition === "All" || product.condition === state.filters.condition;
    const matchesDelivery = state.filters.delivery === "Any" || product.deliveryOptions.includes(state.filters.delivery);
    const matchesPrice = (product.discountPrice ?? product.price) <= state.filters.maxPrice;
    const matchesEscrow = !state.filters.escrowOnly || product.escrowEligible;
    return matchesSearch && matchesCategory && matchesLocation && matchesCondition && matchesDelivery && matchesPrice && matchesEscrow;
  });

  const favouriteProducts = state.products.filter((product) => state.favorites.includes(product.id));
  const cartLines = state.cart
    .map((line) => {
      const product = state.products.find((item) => item.id === line.productId);
      if (!product) return null;
      return { ...line, product, subtotal: line.quantity * (product.discountPrice ?? product.price) };
    })
    .filter((line): line is { productId: string; quantity: number; product: Product; subtotal: number } => line !== null);

  const cartSubtotal = cartLines.reduce((sum, line) => sum + line.subtotal, 0);
  const deliveryFee = deliveryOption === "Pickup" ? 0 : 45;
  const trackedOrder = state.orders[0];
  const featuredProducts = filteredProducts.slice(0, 6);
  const selectedSeller = selectedProduct ? state.sellers.find((seller) => seller.id === selectedProduct.sellerId) : undefined;
  const hasProducts = featuredProducts.length > 0;
  const categoryCards = CATEGORY_OPTIONS.filter((category) => category !== "All").map((category) => ({
    name: category,
    count: state.products.filter((product) => product.category === category).length,
  }));
  const promoCards = [
    { className: "promo-lilac", title: "Pay in escrow", body: "Protect high-value orders until delivery is confirmed." },
    { className: "promo-green", title: "Sell on JHIMS", body: "Create your shop, post products, and receive orders fast." },
    { className: "promo-gold", title: "Reliable delivery", body: "Pickup, seller dropoff, or JHIMS rider coverage." },
    { className: "promo-blue", title: "Track every order", body: "See payment, packing, dispatch, and delivery in one place." },
  ];
  const supportCards = [
    { label: "Call / WhatsApp", detail: "+233 30 001 5500", action: () => setBuyerNote("Support line copied: +233 30 001 5500.") },
    { label: "Sell on JHIMS", detail: "Start a shop and reach buyers nationwide.", action: () => setBuyerNote("Seller onboarding checklist opened for new vendors.") },
    { label: "Track your order", detail: trackedOrder ? `${trackedOrder.id} is ${trackedOrder.status}.` : "No active order yet.", action: () => setBuyerNote(trackedOrder ? `${trackedOrder.id} is currently ${trackedOrder.status}.` : "Place an order to start tracking.") },
  ];

  return (
    <div className="workspace-grid">
      <div className="workspace-main marketplace-page">
        <section className="marketplace-hero">
          <div className="marketplace-hero-copy">
            <div className="marketplace-hero-meta">
              <span>Verified sellers</span>
              <span>Secure payments</span>
              <span>Reliable delivery</span>
            </div>
            <h1>What are you looking for?</h1>
            <div className="marketplace-search">
              <select value={state.filters.location} onChange={(event) => actions.updateFilters({ location: event.target.value })}>
                {LOCATION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
              <input value={state.searchTerm} onChange={(event) => actions.setSearch(event.target.value)} placeholder="Search products, brands and categories" />
              <button className="button-primary">Search</button>
            </div>
            <div className="marketplace-tags">
              <button onClick={() => actions.updateFilters({ category: "Electronics" })}>Phones & Tablets</button>
              <button onClick={() => actions.updateFilters({ category: "Home" })}>Home & Office</button>
              <button onClick={() => actions.updateFilters({ category: "Fashion" })}>Fashion</button>
              <button onClick={() => actions.updateFilters({ category: "Vehicles" })}>Vehicles</button>
            </div>
          </div>
        </section>

        <div className="marketplace-board">
          <aside className="category-sidebar">
            <div className="category-sidebar-head">
              <h2>Browse categories</h2>
              <p>Find products faster by shopping the main departments.</p>
            </div>
            <div className="category-list">
              {categoryCards.map((category) => (
                <button key={category.name} className={`category-item ${state.filters.category === category.name ? "is-active" : ""}`} onClick={() => actions.updateFilters({ category: category.name })}>
                  <div>
                    <strong>{category.name}</strong>
                    <small>{category.count} live ads</small>
                  </div>
                  <span>{">"}</span>
                </button>
              ))}
            </div>
          </aside>

          <div className="marketplace-center">
            <div className="promo-strip">
              {promoCards.map((card) => (
                <article key={card.title} className={`promo-card ${card.className}`}>
                  <strong>{card.title}</strong>
                  <p>{card.body}</p>
                </article>
              ))}
            </div>

            <SectionCard title="Trending ads" eyebrow="Verified marketplace" action={`${filteredProducts.length} matches`} className="listing-card">
              <div className="marketplace-filterbar">
                <label className="field">
                  <span>Category</span>
                  <select value={state.filters.category} onChange={(event) => actions.updateFilters({ category: event.target.value as typeof CATEGORY_OPTIONS[number] })}>
                    {CATEGORY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>Condition</span>
                  <select value={state.filters.condition} onChange={(event) => actions.updateFilters({ condition: event.target.value as typeof CONDITION_OPTIONS[number] })}>
                    {CONDITION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>Delivery</span>
                  <select value={state.filters.delivery} onChange={(event) => actions.updateFilters({ delivery: event.target.value as typeof DELIVERY_OPTIONS[number] })}>
                    {DELIVERY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>Max price</span>
                  <input type="range" min={200} max={25000} step={100} value={state.filters.maxPrice} onChange={(event) => actions.updateFilters({ maxPrice: Number(event.target.value) })} />
                  <small>{formatMoney(state.filters.maxPrice)}</small>
                </label>
                <button className={`button-secondary ${state.filters.escrowOnly ? "is-active-filter" : ""}`} onClick={() => actions.updateFilters({ escrowOnly: !state.filters.escrowOnly })}>
                  {state.filters.escrowOnly ? "Escrow only on" : "Escrow only"}
                </button>
              </div>

              <div className="product-grid market-grid">
                {featuredProducts.map((product) => {
                  const isFavorite = state.favorites.includes(product.id);
                  const currentPrice = product.discountPrice ?? product.price;
                  return (
                    <article key={product.id} className={`product-card market-product-card ${product.id === selectedProduct?.id ? "selected" : ""}`}>
                      <button className="product-hitbox" onClick={() => actions.selectProduct(product.id)} aria-label={`Open ${product.name}`} />
                      <ProductArt product={product} />
                      <div className="product-copy">
                        <div className="product-headline">
                          <div>
                            <p>{product.category}</p>
                            <h3>{product.name}</h3>
                          </div>
                          <TonePill label={product.escrowEligible ? "Verified ID" : "Trusted seller"} tone={product.escrowEligible ? "success" : "neutral"} />
                        </div>
                        <p className="product-description">{product.description}</p>
                        <div className="product-meta">
                          <span>{product.location}</span>
                          <span>{product.condition}</span>
                          <span>{product.reviews} reviews</span>
                        </div>
                        <div className="product-price">
                          <strong>{formatMoney(currentPrice)}</strong>
                          {product.discountPrice ? <span>{formatMoney(product.price)}</span> : null}
                        </div>
                        <div className="card-actions">
                          <button className="button-primary" onClick={() => actions.addToCart(product.id)}>Add to cart</button>
                          <button className="button-ghost" onClick={() => actions.toggleFavorite(product.id)}>{isFavorite ? "Saved" : "Save"}</button>
                        </div>
                      </div>
                    </article>
                  );
                })}
                {!hasProducts ? <p className="empty-text">No live products yet. Add your first seller listing to populate the marketplace.</p> : null}
              </div>
            </SectionCard>

            <div className="split-grid">
              <SectionCard title="Track your order" eyebrow="Buyer tools">
                {trackedOrder ? (
                  <article className="order-card">
                    <div className="order-head">
                      <div>
                        <strong>{trackedOrder.id}</strong>
                        <p>{trackedOrder.eta}</p>
                      </div>
                      <TonePill label={trackedOrder.status} tone={statusTone(trackedOrder.status)} />
                    </div>
                    <Timeline trail={trackedOrder.statusTrail} current={trackedOrder.status} />
                    <div className="order-foot">
                      <span>{formatMoney(trackedOrder.total + trackedOrder.deliveryFee)}</span>
                      <span>{trackedOrder.paymentMethod}</span>
                      <span>{trackedOrder.deliveryOption}</span>
                    </div>
                  </article>
                ) : <p className="empty-text">Place an order to start seeing live tracking updates here.</p>}
              </SectionCard>

            <SectionCard title="Saved for later" eyebrow="Favourites">
              <div className="saved-stack">
                {favouriteProducts.map((product) => (
                  <button key={product.id} className="saved-item" onClick={() => actions.selectProduct(product.id)}>
                      <div className="saved-swatch" style={{ background: `linear-gradient(135deg, ${product.palette[0]}, ${product.palette[1]})` }} />
                      <div>
                        <strong>{product.name}</strong>
                        <small>{product.location}</small>
                      </div>
                      <span>{formatMoney(product.discountPrice ?? product.price)}</span>
                    </button>
                  ))}
                  {!favouriteProducts.length ? <p className="empty-text">Saved items will appear here after buyers bookmark products.</p> : null}
                </div>
              </SectionCard>
            </div>

            <div className="split-grid">
              <ConversationPanel />
              <NotificationsPanel />
            </div>
          </div>

          <aside className="marketplace-rail">
            <div className="marketplace-support-stack">
              {supportCards.map((card) => <button key={card.label} className="support-card" onClick={card.action}><strong>{card.label}</strong><p>{card.detail}</p></button>)}
            </div>

            <SectionCard title="Product details" eyebrow="Selected product">
              {selectedProduct ? (
                <>
                  <ProductArt product={selectedProduct} />
                  <div className="detail-copy">
                    <h3>{selectedProduct.name}</h3>
                    <p>{selectedProduct.description}</p>
                    <div className="pill-row">
                      <TonePill label={selectedProduct.location} tone="neutral" />
                      <TonePill label={selectedProduct.condition} tone="warning" />
                      <TonePill label={selectedProduct.escrowEligible ? "Escrow protected" : "Direct payment"} tone={selectedProduct.escrowEligible ? "accent" : "neutral"} />
                    </div>
                    <div className="price-stack">
                      <strong>{formatMoney(selectedProduct.discountPrice ?? selectedProduct.price)}</strong>
                      {selectedProduct.discountPrice ? <span>{formatMoney(selectedProduct.price)}</span> : null}
                    </div>
                    <div className="seller-mini-profile">
                      <strong>{selectedSeller?.shopName ?? "Verified seller"}</strong>
                      <small>{selectedSeller?.rating ?? "4.7"} rating · replies in {selectedSeller?.responseTime ?? "15 mins"}</small>
                    </div>
                    <div className="card-actions">
                      <button className="button-primary" onClick={() => { actions.addToCart(selectedProduct.id); setBuyerNote(`Added ${selectedProduct.name} to cart.`); }}>Add now</button>
                      <button className="button-secondary" onClick={() => setBuyerNote(`Chat queue opened with ${selectedSeller?.shopName ?? "seller"} and expected reply in ${selectedSeller?.responseTime ?? "15 mins"}.`)}>Chat seller</button>
                    </div>
                  </div>
                </>
              ) : (
                <p className="empty-text">No product is selected yet because the live catalog is currently empty.</p>
              )}
            </SectionCard>

            <SectionCard title="Cart" eyebrow="Checkout">
              <div className="cart-lines">
                {cartLines.length ? cartLines.map((line) => (
                  <div key={line.product.id} className="cart-line">
                    <div>
                      <strong>{line.product.name}</strong>
                      <small>{formatMoney(line.product.discountPrice ?? line.product.price)}</small>
                    </div>
                    <div className="cart-line-controls">
                      <button className="stepper" onClick={() => actions.updateCartQuantity(line.product.id, line.quantity - 1)}>-</button>
                      <span>{line.quantity}</span>
                      <button className="stepper" onClick={() => actions.updateCartQuantity(line.product.id, line.quantity + 1)}>+</button>
                      <button className="link-button" onClick={() => actions.removeFromCart(line.product.id)}>Remove</button>
                    </div>
                  </div>
                )) : <p className="empty-text">Your cart is empty. Add a few items to simulate checkout.</p>}
              </div>
              <div className="field-group">
                <label className="field">
                  <span>Payment</span>
                  <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}>
                    {PAYMENT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>Delivery</span>
                  <select value={deliveryOption} onChange={(event) => setDeliveryOption(event.target.value as DeliveryOption)}>
                    {CHECKOUT_DELIVERY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
              </div>
              <PriceLine label="Subtotal" amount={cartSubtotal} />
              <PriceLine label="Delivery fee" amount={deliveryFee} />
              <PriceLine label="Total" amount={cartSubtotal + deliveryFee} emphasis />
              <button className="button-primary button-wide" onClick={() => actions.placeOrder(paymentMethod, deliveryOption)}>Place order</button>
              <div className="note-box">
                <strong>Buyer note</strong>
                <p>{buyerNote}</p>
              </div>
            </SectionCard>

            <DeliveryFeed orderId={trackedOrder?.id} />
          </aside>
        </div>
      </div>
    </div>
  );
};

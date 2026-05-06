import { formatDateOnly, formatDateTime } from "./dates";
import type {
  AppState,
  AppView,
  CartLine,
  Complaint,
  Conversation,
  DeliveryEvent,
  Filters,
  Message,
  NotificationItem,
  Order,
  OrderItem,
  Payment,
  Product,
  ProductCategory,
  ProductCondition,
  ProductDraft,
  Review,
  Seller,
  User,
} from "../types";

export const LOCATION_OPTIONS = ["All Ghana", "Accra", "Tema", "Cape Coast", "Kumasi"];
export const CATEGORY_OPTIONS: Array<ProductCategory | "All"> = ["All", "Electronics", "Fashion", "Home", "Vehicles", "Beauty", "Groceries"];
export const CONDITION_OPTIONS: Array<ProductCondition | "All"> = ["All", "New", "Used"];
export const DELIVERY_OPTIONS: Array<Filters["delivery"]> = ["Any", "Pickup", "Seller Delivery", "JHIMS Rider"];

export const defaultFilters: Filters = {
  category: "All",
  location: "All Ghana",
  condition: "All",
  delivery: "Any",
  maxPrice: 25000,
  escrowOnly: false,
};

export const createBlankProductDraft = (): ProductDraft => ({
  name: "",
  category: "Electronics",
  description: "",
  price: "",
  discountPrice: "",
  location: "Accra",
  stock: "1",
  condition: "New",
  deliveryOptions: ["JHIMS Rider"],
  escrowEligible: false,
  featured: false,
  published: true,
  artLabel: "JHIMS",
});

export const applyViewOverride = (state: AppState): AppState => {
  if (typeof window === "undefined") {
    return state;
  }

  const requestedView = new URLSearchParams(window.location.search).get("view");
  if (requestedView === "buyer" || requestedView === "seller" || requestedView === "admin") {
    return { ...state, activeView: requestedView };
  }

  return state;
};

export const allowedViewForRole = (role: User["role"] | null | undefined, requested: AppView): AppView => {
  if (!role) return requested;
  if (role === "admin") return requested;
  if (role === "seller") return requested === "admin" ? "seller" : requested;
  return requested === "buyer" ? "buyer" : "buyer";
};

export const normalizeUser = (row: any): User => ({
  id: row.id,
  name: row.full_name ?? row.name ?? "JHIMS User",
  role: row.role ?? "buyer",
  email: row.email ?? "",
  phone: row.phone ?? "",
  location: row.location ?? "Accra",
  verified: Boolean(row.verified),
  banned: Boolean(row.banned),
  avatarUrl: row.avatar_url ?? undefined,
});

export const normalizeSeller = (row: any): Seller => {
  const profile = row.profiles ?? row.profile ?? {};
  return {
    id: row.id,
    name: profile.full_name ?? "Seller",
    shopName: row.shop_name ?? "JHIMS Shop",
    location: profile.location ?? "Accra",
    verified: Boolean(profile.verified),
    rating: Number(row.rating ?? 0),
    reviews: Number(row.review_count ?? 0),
    balance: Number(row.balance ?? 0),
    joined: formatDateOnly(row.created_at ?? new Date().toISOString()),
    responseTime: `${row.response_time_minutes ?? 15} mins`,
    completedOrders: Number(row.completed_orders ?? 0),
    subscription: row.subscription_tier ?? "Starter",
    pendingWithdrawal: Number(row.pending_withdrawal ?? 0),
    payoutEnabled: Boolean(row.payout_enabled),
    stripeConnected: Boolean(row.stripe_onboarding_complete),
  };
};

export const normalizeProduct = (row: any): Product => ({
  id: row.id,
  sellerId: row.seller_id,
  name: row.name,
  category: row.category,
  description: row.description,
  price: Number(row.price ?? 0),
  discountPrice: row.discount_price == null ? undefined : Number(row.discount_price),
  location: row.location ?? "Accra",
  stock: Number(row.stock ?? 0),
  condition: row.condition,
  deliveryOptions: (row.delivery_options ?? []) as Product["deliveryOptions"],
  escrowEligible: Boolean(row.escrow_eligible),
  featured: Boolean(row.featured),
  published: Boolean(row.published),
  rating: Number(row.rating ?? 0),
  reviews: Number(row.review_count ?? 0),
  palette: [row.palette_a ?? "#00b53f", row.palette_b ?? "#f68b1e"],
  artLabel: row.art_label ?? "JHIMS",
  imagePath: row.cover_image_path ?? undefined,
  imageUrl: row.cover_image_url ?? undefined,
});

export const normalizeOrderItem = (row: any): OrderItem => ({
  productId: row.product_id ?? "",
  quantity: Number(row.quantity ?? 1),
  unitPrice: Number(row.unit_price ?? 0),
});

export const normalizePayment = (row: any): Payment => ({
  id: row.id,
  orderId: row.order_id,
  amount: Number(row.amount ?? 0),
  method: row.method,
  status: row.status,
  settledAt: row.settled_at ? formatDateTime(row.settled_at) : undefined,
});

export const normalizeOrder = (row: any, paymentByOrderId: Map<string, Payment>): Order => {
  const payment = paymentByOrderId.get(row.id);
  return {
    id: row.id,
    buyerId: row.buyer_id,
    sellerId: row.seller_id,
    location: row.location,
    items: (row.order_items ?? []).map(normalizeOrderItem),
    total: Number(row.total ?? 0),
    deliveryFee: Number(row.delivery_fee ?? 0),
    deliveryOption: row.delivery_option,
    paymentMethod: row.payment_method,
    paymentStatus: payment?.status,
    status: row.status,
    statusTrail: [],
    escrowHeld: Boolean(row.escrow_held),
    eta: row.eta ?? "Delivery timeline pending",
    placedAt: formatDateOnly(row.created_at ?? new Date().toISOString()),
    checkoutSessionId: row.stripe_checkout_session_id ?? undefined,
  };
};

export const normalizeReview = (row: any): Review => ({
  id: row.id,
  orderId: row.order_id,
  productId: row.product_id,
  sellerId: row.seller_id,
  buyerId: row.buyer_id,
  rating: Number(row.rating ?? 0),
  comment: row.comment ?? "",
  createdAt: formatDateOnly(row.created_at ?? new Date().toISOString()),
});

export const normalizeComplaint = (row: any, reporterName: string): Complaint => ({
  id: row.id,
  orderId: row.order_id ?? undefined,
  targetId: row.target_id ?? "",
  targetType: row.target_type,
  reason: row.reason,
  severity: row.severity,
  status: row.status,
  reporter: reporterName,
  openedAt: formatDateOnly(row.created_at ?? new Date().toISOString()),
});

export const normalizeConversation = (row: any): Conversation => ({
  id: row.id,
  orderId: row.order_id ?? undefined,
  buyerId: row.buyer_id,
  sellerId: row.seller_id,
  label: row.label ?? "Conversation",
  lastMessageAt: formatDateTime(row.updated_at ?? row.created_at ?? new Date().toISOString()),
});

export const normalizeMessage = (row: any): Message => ({
  id: row.id,
  conversationId: row.conversation_id,
  senderId: row.sender_id,
  body: row.body,
  createdAt: formatDateTime(row.created_at ?? new Date().toISOString()),
});

export const normalizeNotification = (row: any): NotificationItem => ({
  id: row.id,
  userId: row.user_id,
  kind: row.kind ?? "info",
  title: row.title,
  body: row.body,
  createdAt: formatDateTime(row.created_at ?? new Date().toISOString()),
  read: Boolean(row.read_at),
});

export const normalizeDeliveryEvent = (row: any): DeliveryEvent => ({
  id: row.id,
  orderId: row.order_id,
  status: row.status,
  note: row.note,
  createdAt: formatDateTime(row.created_at ?? new Date().toISOString()),
});

export const buildOrderTrails = (orders: Order[], deliveryEvents: DeliveryEvent[]) => {
  const trailMap = new Map<string, Order["statusTrail"]>();
  for (const event of deliveryEvents) {
    const existing = trailMap.get(event.orderId) ?? [];
    if (!existing.includes(event.status)) {
      existing.push(event.status);
    }
    trailMap.set(event.orderId, existing);
  }

  return orders.map((order) => ({
    ...order,
    statusTrail: trailMap.get(order.id)?.length ? trailMap.get(order.id)! : [order.status],
  }));
};

export const buildCart = (rows: any[]): CartLine[] =>
  rows.map((row) => ({
    productId: row.product_id,
    quantity: Number(row.quantity ?? 1),
  }));

export const mergeProductRatings = (products: Product[], reviews: Review[]) => {
  const grouped = new Map<string, Review[]>();
  for (const review of reviews) {
    const collection = grouped.get(review.productId) ?? [];
    collection.push(review);
    grouped.set(review.productId, collection);
  }

  return products.map((product) => {
    const collection = grouped.get(product.id);
    if (!collection?.length) {
      return product;
    }

    const average = collection.reduce((sum, review) => sum + review.rating, 0) / collection.length;
    return {
      ...product,
      rating: Number(average.toFixed(1)),
      reviews: collection.length,
    };
  });
};

export const sellerMatchesOrder = (order: Order, sellerId: string) => order.sellerId === sellerId;

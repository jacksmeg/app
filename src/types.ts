export type Role = "buyer" | "seller" | "admin";
export type AppView = Role;

export type ProductCategory =
  | "Electronics"
  | "Fashion"
  | "Home"
  | "Vehicles"
  | "Beauty"
  | "Groceries";

export type ProductCondition = "New" | "Used";
export type DeliveryOption = "Pickup" | "Seller Delivery" | "JHIMS Rider";

export type OrderStatus =
  | "Pending"
  | "Accepted"
  | "Paid"
  | "Packed"
  | "Out for Delivery"
  | "Delivered"
  | "Completed"
  | "Rejected"
  | "Reviewing";

export type PaymentMethod =
  | "Mobile Money"
  | "Card"
  | "Bank Transfer"
  | "Wallet"
  | "Cash on Delivery"
  | "Escrow";

export type ComplaintStatus = "Open" | "Reviewing" | "Resolved";
export type PayoutStatus = "Pending" | "Approved" | "Paid";
export type PaymentRecordStatus =
  | "Held in Escrow"
  | "Settled"
  | "Pending Confirmation"
  | "Refunded";

export interface SessionUser {
  id: string;
  email: string;
}

export interface User {
  id: string;
  name: string;
  role: Role;
  email: string;
  phone: string;
  location: string;
  verified: boolean;
  banned: boolean;
  avatarUrl?: string;
}

export interface Seller {
  id: string;
  name: string;
  shopName: string;
  location: string;
  verified: boolean;
  rating: number;
  reviews: number;
  balance: number;
  joined: string;
  responseTime: string;
  completedOrders: number;
  subscription: "Starter" | "Growth" | "Premium";
  pendingWithdrawal: number;
  payoutEnabled?: boolean;
  stripeConnected?: boolean;
}

export interface Product {
  id: string;
  sellerId: string;
  name: string;
  category: ProductCategory;
  description: string;
  price: number;
  discountPrice?: number;
  location: string;
  stock: number;
  condition: ProductCondition;
  deliveryOptions: DeliveryOption[];
  escrowEligible: boolean;
  featured: boolean;
  published?: boolean;
  rating: number;
  reviews: number;
  palette: [string, string];
  artLabel: string;
  imagePath?: string;
  imageUrl?: string;
}

export interface ProductDraft {
  id?: string;
  name: string;
  category: ProductCategory;
  description: string;
  price: string;
  discountPrice: string;
  location: string;
  stock: string;
  condition: ProductCondition;
  deliveryOptions: DeliveryOption[];
  escrowEligible: boolean;
  featured: boolean;
  published: boolean;
  artLabel: string;
}

export interface CartLine {
  productId: string;
  quantity: number;
}

export interface OrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  buyerId: string;
  sellerId: string;
  location: string;
  items: OrderItem[];
  total: number;
  deliveryFee: number;
  deliveryOption: DeliveryOption;
  paymentMethod: PaymentMethod;
  paymentStatus?: PaymentRecordStatus;
  status: OrderStatus;
  statusTrail: OrderStatus[];
  escrowHeld: boolean;
  eta: string;
  placedAt: string;
  checkoutSessionId?: string;
}

export interface Complaint {
  id: string;
  orderId?: string;
  targetId: string;
  targetType: "Product" | "Seller" | "Buyer";
  reason: string;
  severity: "Low" | "Medium" | "High";
  status: ComplaintStatus;
  reporter: string;
  openedAt: string;
}

export interface Payment {
  id: string;
  orderId: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentRecordStatus;
  settledAt?: string;
}

export interface PayoutRequest {
  id: string;
  sellerId: string;
  amount: number;
  requestedAt: string;
  status: PayoutStatus;
}

export interface Review {
  id: string;
  orderId: string;
  productId: string;
  sellerId: string;
  buyerId: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  orderId?: string;
  buyerId: string;
  sellerId: string;
  label: string;
  lastMessageAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  kind: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

export interface DeliveryEvent {
  id: string;
  orderId: string;
  status: OrderStatus;
  note: string;
  createdAt: string;
}

export interface Filters {
  category: ProductCategory | "All";
  location: string;
  condition: ProductCondition | "All";
  delivery: DeliveryOption | "Any";
  maxPrice: number;
  escrowOnly: boolean;
}

export interface SignInInput {
  email: string;
  password: string;
}

export interface SignUpInput {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  location: string;
  role: Exclude<Role, "admin">;
  shopName: string;
}

export interface ProfileUpdateInput {
  fullName: string;
  phone: string;
  location: string;
  shopName: string;
}

export interface AppState {
  backendConfigured: boolean;
  mode: "demo" | "live";
  loading: boolean;
  authLoading: boolean;
  authError: string | null;
  isProfileOpen: boolean;
  profileSaving: boolean;
  passwordSaving: boolean;
  activeView: AppView;
  searchTerm: string;
  selectedProductId: string;
  selectedConversationId: string;
  cart: CartLine[];
  favorites: string[];
  filters: Filters;
  currentBuyerId: string;
  currentSellerId: string;
  currentAdminId: string;
  sessionUser: SessionUser | null;
  profile: User | null;
  users: User[];
  sellers: Seller[];
  products: Product[];
  orders: Order[];
  complaints: Complaint[];
  payments: Payment[];
  payouts: PayoutRequest[];
  reviews: Review[];
  conversations: Conversation[];
  messages: Message[];
  notifications: NotificationItem[];
  deliveryEvents: DeliveryEvent[];
  productDraft: ProductDraft;
  checkoutLoading: boolean;
  toast: string | null;
}

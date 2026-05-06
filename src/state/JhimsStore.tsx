import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { createInitialState } from "../data/seed";
import {
  CATEGORY_OPTIONS,
  CONDITION_OPTIONS,
  DELIVERY_OPTIONS,
  LOCATION_OPTIONS,
  allowedViewForRole,
  applyViewOverride,
  buildCart,
  buildOrderTrails,
  createBlankProductDraft,
  defaultFilters,
  mergeProductRatings,
  normalizeComplaint,
  normalizeConversation,
  normalizeDeliveryEvent,
  normalizeMessage,
  normalizeNotification,
  normalizeOrder,
  normalizePayment,
  normalizeProduct,
  normalizeReview,
  normalizeSeller,
  normalizeUser,
} from "../lib/jhimsData";
import { env } from "../lib/env";
import { supabase } from "../lib/supabase";
import type {
  AppState,
  AppView,
  DeliveryOption,
  Filters,
  OrderStatus,
  PaymentMethod,
  ProductDraft,
  SignInInput,
  SignUpInput,
} from "../types";

const DEMO_STORAGE_KEY = "jhims-marketplace-demo-state";
const OAUTH_INTENT_KEY = "jhims-marketplace-oauth-intent";
const ORDER_FLOW: OrderStatus[] = [
  "Pending",
  "Accepted",
  "Paid",
  "Packed",
  "Out for Delivery",
  "Delivered",
  "Completed",
];

interface OAuthIntent {
  mode: "signin" | "signup";
  email?: string;
  fullName?: string;
  phone?: string;
  location?: string;
  role?: SignUpInput["role"];
  shopName?: string;
  createdAt: number;
}

interface JhimsStoreValue {
  state: AppState;
  actions: {
    signIn: (input: SignInInput) => Promise<void>;
    signUp: (input: SignUpInput) => Promise<void>;
    signInWithGoogle: (intent?: SignUpInput | null) => Promise<void>;
    signOut: () => Promise<void>;
    refreshLiveData: () => Promise<void>;
    setView: (view: AppView) => void;
    setSearch: (value: string) => void;
    selectProduct: (productId: string) => void;
    selectConversation: (conversationId: string) => void;
    toggleFavorite: (productId: string) => void;
    addToCart: (productId: string) => Promise<void> | void;
    removeFromCart: (productId: string) => Promise<void> | void;
    updateCartQuantity: (productId: string, quantity: number) => Promise<void> | void;
    updateFilters: (patch: Partial<Filters>) => void;
    placeOrder: (paymentMethod: PaymentMethod, deliveryOption: DeliveryOption) => Promise<void> | void;
    advanceOrder: (orderId: string) => Promise<void> | void;
    sellerDecision: (orderId: string, accepted: boolean) => Promise<void> | void;
    requestPayout: (amount: number) => Promise<void> | void;
    verifySeller: (sellerId: string) => Promise<void> | void;
    resolveComplaint: (complaintId: string) => Promise<void> | void;
    toggleUserBan: (userId: string) => Promise<void> | void;
    setProductDraft: (patch: Partial<ProductDraft>) => void;
    toggleProductDraftDelivery: (option: DeliveryOption) => void;
    editProductDraft: (productId: string) => void;
    resetProductDraft: () => void;
    saveProduct: (imageFile?: File | null) => Promise<void>;
    sendMessage: (body: string) => Promise<void>;
    markNotificationRead: (notificationId: string) => Promise<void>;
    clearToast: () => void;
  };
}

const readOAuthIntent = (): OAuthIntent | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const rawIntent = window.localStorage.getItem(OAUTH_INTENT_KEY);
  if (!rawIntent) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawIntent) as OAuthIntent;
    const isFresh = typeof parsed.createdAt === "number" && Date.now() - parsed.createdAt < 1000 * 60 * 30;
    if (!isFresh) {
      window.localStorage.removeItem(OAUTH_INTENT_KEY);
      return null;
    }
    return parsed;
  } catch {
    window.localStorage.removeItem(OAUTH_INTENT_KEY);
    return null;
  }
};

const writeOAuthIntent = (intent: OAuthIntent | null) => {
  if (typeof window === "undefined") {
    return;
  }

  if (!intent) {
    window.localStorage.removeItem(OAUTH_INTENT_KEY);
    return;
  }

  window.localStorage.setItem(OAUTH_INTENT_KEY, JSON.stringify(intent));
};

const readDemoState = (): AppState => {
  if (typeof window === "undefined") {
    return createInitialState();
  }

  const saved = window.localStorage.getItem(DEMO_STORAGE_KEY);
  if (!saved) {
    return applyViewOverride(createInitialState());
  }

  try {
    return applyViewOverride(JSON.parse(saved) as AppState);
  } catch {
    return applyViewOverride(createInitialState());
  }
};

const nextStatusFor = (status: OrderStatus) => {
  const currentIndex = ORDER_FLOW.indexOf(status);
  if (currentIndex < 0 || currentIndex === ORDER_FLOW.length - 1) {
    return status;
  }
  return ORDER_FLOW[currentIndex + 1];
};

const JhimsStoreContext = createContext<JhimsStoreValue | null>(null);

export const JhimsStoreProvider = ({ children }: PropsWithChildren) => {
  const [state, setState] = useState<AppState>(() => readDemoState());

  const persistDemoState = useCallback((nextState: AppState) => {
    if (typeof window === "undefined" || nextState.mode !== "demo") {
      return;
    }
    window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(nextState));
  }, []);

  useEffect(() => {
    persistDemoState(state);
  }, [persistDemoState, state]);

  const updateDemoState = useCallback((updater: (current: AppState) => AppState) => {
    setState((current) => applyViewOverride(updater(current)));
  }, []);

  const finalizeOAuthProfile = useCallback(async (profileRow: Record<string, unknown>, sessionEmail: string) => {
    if (!supabase) {
      return profileRow;
    }

    const intent = readOAuthIntent();
    if (!intent) {
      return profileRow;
    }
    if (intent.mode !== "signup") {
      writeOAuthIntent(null);
      return profileRow;
    }

    if (intent.email?.trim() && sessionEmail && intent.email.trim().toLowerCase() !== sessionEmail.toLowerCase()) {
      writeOAuthIntent(null);
      return profileRow;
    }

    const nextRole = intent.role === "seller" ? "seller" : "buyer";
    const updates: Record<string, string> = {};
    const currentName = typeof profileRow.full_name === "string" ? profileRow.full_name : "";
    const currentPhone = typeof profileRow.phone === "string" ? profileRow.phone : "";
    const currentLocation = typeof profileRow.location === "string" ? profileRow.location : "Accra";
    const currentRole = typeof profileRow.role === "string" ? profileRow.role : "buyer";

    if (intent.fullName?.trim() && intent.fullName.trim() !== currentName) {
      updates.full_name = intent.fullName.trim();
    }
    if (intent.phone?.trim() && intent.phone.trim() !== currentPhone) {
      updates.phone = intent.phone.trim();
    }
    if (intent.location?.trim() && intent.location.trim() !== currentLocation) {
      updates.location = intent.location.trim();
    }
    if (nextRole !== currentRole) {
      updates.role = nextRole;
    }

    let nextProfileRow = profileRow;
    if (Object.keys(updates).length) {
      const { data: updatedProfile, error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", profileRow.id as string)
        .select("*")
        .single();

      if (!error && updatedProfile) {
        nextProfileRow = updatedProfile;
      }
    }

    if (nextRole === "seller") {
      const sellerName =
        intent.shopName?.trim() ||
        (typeof nextProfileRow.full_name === "string" && nextProfileRow.full_name.trim()
          ? `${nextProfileRow.full_name.trim()} Shop`
          : "JHIMS Seller Shop");

      await supabase.from("seller_profiles").upsert(
        {
          id: profileRow.id as string,
          shop_name: sellerName,
        },
        { onConflict: "id" },
      );
    }

    writeOAuthIntent(null);
    return nextProfileRow;
  }, []);

  const refreshLiveData = useCallback(async () => {
    if (!supabase) {
      return;
    }

    setState((current) => ({
      ...current,
      backendConfigured: true,
      mode: "live",
      loading: true,
      authLoading: true,
      authError: null,
    }));

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      setState((current) => ({
        ...current,
        backendConfigured: true,
        mode: "live",
        loading: false,
        authLoading: false,
        authError: sessionError.message,
      }));
      return;
    }

    if (!session?.user) {
      setState((current) => ({
        ...current,
        backendConfigured: true,
        mode: "live",
        loading: false,
        authLoading: false,
        authError: null,
        sessionUser: null,
        profile: null,
        users: [],
        sellers: [],
        products: [],
        orders: [],
        complaints: [],
        payments: [],
        payouts: [],
        reviews: [],
        conversations: [],
        messages: [],
        notifications: [],
        deliveryEvents: [],
        cart: [],
        activeView: "buyer",
      }));
      return;
    }

    const userId = session.user.id;
    const sessionUser = { id: userId, email: session.user.email ?? "" };

    const { data: profileRow, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (profileError || !profileRow) {
      setState((current) => ({
        ...current,
        backendConfigured: true,
        mode: "live",
        loading: false,
        authLoading: false,
        authError: profileError?.message ?? "Unable to load your profile.",
      }));
      return;
    }

    const hydratedProfileRow = await finalizeOAuthProfile(profileRow, sessionUser.email);
    const role = hydratedProfileRow.role as AppView;
    const profilesQuery = supabase.from("profiles").select("*").order("created_at", { ascending: true });
    const sellersQuery = supabase
      .from("seller_profiles")
      .select("*, profiles!inner(id, full_name, location, verified)")
      .order("created_at", { ascending: true });
    const productsQuery = supabase.from("products").select("*").order("created_at", { ascending: false });
    const cartQuery = supabase
      .from("carts")
      .select("id, cart_items(id, product_id, quantity)")
      .eq("buyer_id", userId)
      .maybeSingle();

    const ordersQuery = (() => {
      const query = supabase
        .from("orders")
        .select("*, order_items(*)")
        .order("created_at", { ascending: false });
      if (role === "admin") return query;
      if (role === "seller") return query.eq("seller_id", userId);
      return query.eq("buyer_id", userId);
    })();

    const paymentsQuery = (() => {
      const query = supabase.from("payments").select("*").order("created_at", { ascending: false });
      if (role === "admin") return query;
      if (role === "seller") return query.eq("seller_id", userId);
      return query.eq("buyer_id", userId);
    })();

    const complaintsQuery = (() => {
      const query = supabase.from("complaints").select("*").order("created_at", { ascending: false });
      if (role === "admin") return query;
      if (role === "seller") return query.or(`target_id.eq.${userId},reporter_id.eq.${userId}`);
      return query.eq("reporter_id", userId);
    })();

    const payoutsQuery = (() => {
      const query = supabase.from("payout_requests").select("*").order("created_at", { ascending: false });
      return role === "admin" ? query : query.eq("seller_id", userId);
    })();

    const conversationsQuery = (() => {
      const query = supabase.from("conversations").select("*").order("updated_at", { ascending: false });
      return role === "admin" ? query : query.or(`buyer_id.eq.${userId},seller_id.eq.${userId}`);
    })();

    const [
      profilesResult,
      sellersResult,
      productsResult,
      cartResult,
      ordersResult,
      paymentsResult,
      complaintsResult,
      payoutsResult,
      reviewsResult,
      conversationsResult,
      notificationsResult,
    ] = await Promise.all([
      profilesQuery,
      sellersQuery,
      productsQuery,
      cartQuery,
      ordersQuery,
      paymentsQuery,
      complaintsQuery,
      payoutsQuery,
      supabase.from("reviews").select("*").order("created_at", { ascending: false }),
      conversationsQuery,
      supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    ]);

    const orderIds = (ordersResult.data ?? []).map((row) => row.id);
    const conversationIds = (conversationsResult.data ?? []).map((row) => row.id);

    const [deliveryResult, messagesResult] = await Promise.all([
      orderIds.length
        ? supabase.from("delivery_events").select("*").in("order_id", orderIds).order("created_at", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      conversationIds.length
        ? supabase.from("messages").select("*").in("conversation_id", conversationIds).order("created_at", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
    ]);

    const users = (profilesResult.data ?? []).map((row) => {
      const user = normalizeUser(row);
      return row.id === userId ? { ...user, email: sessionUser.email } : user;
    });
    const profile = users.find((entry) => entry.id === userId) ?? {
      ...normalizeUser(hydratedProfileRow),
      email: sessionUser.email,
    };
    const sellers = (sellersResult.data ?? []).map(normalizeSeller);
    const reviews = (reviewsResult.data ?? []).map(normalizeReview);
    const products = mergeProductRatings((productsResult.data ?? []).map(normalizeProduct), reviews);
    const payments = (paymentsResult.data ?? []).map(normalizePayment);
    const paymentByOrderId = new Map(payments.map((payment) => [payment.orderId, payment]));
    const deliveryEvents = (deliveryResult.data ?? []).map(normalizeDeliveryEvent);
    const orders = buildOrderTrails(
      (ordersResult.data ?? []).map((row) => normalizeOrder(row, paymentByOrderId)),
      deliveryEvents,
    );

    const reporterNames = new Map(users.map((user) => [user.id, user.name]));
    const complaints = (complaintsResult.data ?? []).map((row) =>
      normalizeComplaint(row, reporterNames.get(row.reporter_id) ?? "JHIMS User"),
    );
    const payouts = (payoutsResult.data ?? []).map((row) => ({
      id: row.id,
      sellerId: row.seller_id,
      amount: Number(row.amount ?? 0),
      requestedAt: row.created_at,
      status: row.status,
    }));
    const conversations = (conversationsResult.data ?? []).map((row) =>
      normalizeConversation({
        ...row,
        label: `${reporterNames.get(row.buyer_id) ?? "Buyer"} and ${sellers.find((seller) => seller.id === row.seller_id)?.shopName ?? "Seller"}`,
      }),
    );
    const messages = (messagesResult.data ?? []).map(normalizeMessage);
    const notifications = (notificationsResult.data ?? []).map(normalizeNotification);
    const cart = buildCart(cartResult.data?.cart_items ?? []);

    setState((current) =>
      applyViewOverride({
        ...current,
        backendConfigured: true,
        mode: "live",
        loading: false,
        authLoading: false,
        authError: null,
        sessionUser,
        profile,
        users,
        sellers,
        products,
        orders,
        complaints,
        payments,
        payouts,
        reviews,
        conversations,
        messages,
        notifications,
        deliveryEvents,
        cart,
        filters: current.filters ?? defaultFilters,
        activeView: allowedViewForRole(profile.role, current.activeView),
        currentBuyerId: profile.role === "buyer" ? profile.id : current.currentBuyerId,
        currentSellerId:
          profile.role === "seller" ? profile.id : current.currentSellerId || sellers[0]?.id || "",
        currentAdminId: profile.role === "admin" ? profile.id : current.currentAdminId,
        selectedProductId:
          current.selectedProductId && products.some((product) => product.id === current.selectedProductId)
            ? current.selectedProductId
            : products[0]?.id ?? "",
        selectedConversationId:
          current.selectedConversationId &&
          conversations.some((conversation) => conversation.id === current.selectedConversationId)
            ? current.selectedConversationId
            : conversations[0]?.id ?? "",
        productDraft: current.productDraft?.id ? current.productDraft : createBlankProductDraft(),
        checkoutLoading: false,
      }),
    );
  }, [finalizeOAuthProfile]);

  useEffect(() => {
    if (!supabase) {
      setState((current) => ({
        ...current,
        backendConfigured: false,
        mode: "demo",
        loading: false,
        authLoading: false,
        authError: null,
      }));
      return;
    }

    void refreshLiveData();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void refreshLiveData();
    });

    return () => subscription.unsubscribe();
  }, [refreshLiveData]);

  const ensureLiveCartId = useCallback(async () => {
    if (!supabase || !state.sessionUser) return null;
    const { data: cart } = await supabase.from("carts").select("id").eq("buyer_id", state.sessionUser.id).single();
    return cart?.id ?? null;
  }, [state.sessionUser]);

  const createManualOrder = useCallback(async (paymentMethod: PaymentMethod, deliveryOption: DeliveryOption) => {
    if (!supabase || !state.sessionUser) return;
    const cartId = await ensureLiveCartId();
    if (!cartId) return;

    const { data: cartItems } = await supabase
      .from("cart_items")
      .select("quantity, product:products!inner(id, name, price, discount_price, seller_id)")
      .eq("cart_id", cartId);

    const normalizedCartItems = ((cartItems ?? []) as unknown as Array<{
      quantity: number;
      product:
        | {
            id: string;
            name: string;
            price: number;
            discount_price: number | null;
            seller_id: string;
          }
        | Array<{
            id: string;
            name: string;
            price: number;
            discount_price: number | null;
            seller_id: string;
          }>;
    }>)
      .map((entry) => ({
        ...entry,
        product: Array.isArray(entry.product) ? entry.product[0] : entry.product,
      }))
      .filter((entry): entry is {
        quantity: number;
        product: {
          id: string;
          name: string;
          price: number;
          discount_price: number | null;
          seller_id: string;
        };
      } => Boolean(entry.product));

    if (!normalizedCartItems.length) {
      setState((current) => ({ ...current, toast: "Your cart is empty." }));
      return;
    }

    const sellerIds = [...new Set(normalizedCartItems.map((entry) => entry.product.seller_id))];
    if (sellerIds.length !== 1) {
      setState((current) => ({ ...current, toast: "Live orders currently support one seller per checkout." }));
      return;
    }

    const subtotal = normalizedCartItems.reduce((sum, entry) => sum + Number(entry.product.discount_price ?? entry.product.price) * entry.quantity, 0);
    const deliveryFee = deliveryOption === "Pickup" ? 0 : 45;
    const total = subtotal + deliveryFee;

    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        buyer_id: state.sessionUser.id,
        seller_id: sellerIds[0],
        status: "Pending",
        payment_method: paymentMethod,
        escrow_held: paymentMethod === "Escrow",
        delivery_option: deliveryOption,
        location: state.profile?.location ?? "Accra",
        subtotal,
        delivery_fee: deliveryFee,
        total,
        eta: deliveryOption === "Pickup" ? "Pickup after seller confirmation" : "Seller will update the timeline after acceptance",
      })
      .select("id")
      .single();

    if (error || !order) {
      setState((current) => ({ ...current, toast: "Unable to create the order right now." }));
      return;
    }

    await Promise.all([
      supabase.from("order_items").insert(
        normalizedCartItems.map((entry) => ({
          order_id: order.id,
          product_id: entry.product.id,
          quantity: entry.quantity,
          unit_price: Number(entry.product.discount_price ?? entry.product.price),
        })),
      ),
      supabase.from("payments").insert({
        order_id: order.id,
        buyer_id: state.sessionUser.id,
        seller_id: sellerIds[0],
        amount: total,
        method: paymentMethod,
        status: "Pending Confirmation",
        provider: "manual",
      }),
      supabase.from("delivery_events").insert({
        order_id: order.id,
        status: "Pending",
        note: "Order created and waiting for seller confirmation.",
        created_by: state.sessionUser.id,
      }),
      supabase.from("cart_items").delete().eq("cart_id", cartId),
    ]);

    await refreshLiveData();
    setState((current) => ({ ...current, toast: `${paymentMethod} order created successfully.` }));
  }, [ensureLiveCartId, refreshLiveData, state.profile?.location, state.sessionUser]);

  const actions = useMemo<JhimsStoreValue["actions"]>(() => ({
    signIn: async (input) => {
      if (!supabase) return;
      writeOAuthIntent(null);
      setState((current) => ({ ...current, authLoading: true, authError: null }));
      const { error } = await supabase.auth.signInWithPassword({
        email: input.email,
        password: input.password,
      });
      if (error) {
        setState((current) => ({ ...current, authLoading: false, authError: error.message }));
        return;
      }
      await refreshLiveData();
    },
    signUp: async (input) => {
      if (!supabase) return;
      writeOAuthIntent(null);
      setState((current) => ({ ...current, authLoading: true, authError: null }));
      const { error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: {
            full_name: input.fullName,
            phone: input.phone,
            location: input.location,
            role: input.role,
            shop_name: input.shopName,
          },
        },
      });
      if (error) {
        setState((current) => ({ ...current, authLoading: false, authError: error.message }));
        return;
      }
      setState((current) => ({
        ...current,
        authLoading: false,
        authError: null,
        toast: "Account created. Check your email if confirmation is enabled.",
      }));
      await refreshLiveData();
    },
    signInWithGoogle: async (intent) => {
      if (!supabase) return;

      setState((current) => ({ ...current, authLoading: true, authError: null }));
      writeOAuthIntent(
        intent
          ? {
              mode: "signup",
              email: intent.email,
              fullName: intent.fullName,
              phone: intent.phone,
              location: intent.location,
              role: intent.role,
              shopName: intent.shopName,
              createdAt: Date.now(),
            }
          : {
              mode: "signin",
              createdAt: Date.now(),
            },
      );

      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}${window.location.pathname}${window.location.search}`
          : env.siteUrl;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) {
        writeOAuthIntent(null);
        setState((current) => ({ ...current, authLoading: false, authError: error.message }));
      }
    },
    signOut: async () => {
      if (!supabase) return;
      writeOAuthIntent(null);
      await supabase.auth.signOut();
      setState((current) => ({
        ...current,
        sessionUser: null,
        profile: null,
        users: [],
        sellers: [],
        products: [],
        orders: [],
        complaints: [],
        payments: [],
        payouts: [],
        reviews: [],
        conversations: [],
        messages: [],
        notifications: [],
        deliveryEvents: [],
        cart: [],
        toast: "Signed out.",
      }));
    },
    refreshLiveData,
    setView: (view) => setState((current) => {
      const allowedView = allowedViewForRole(current.profile?.role, view);
      if (allowedView !== view) {
        return {
          ...current,
          activeView: allowedView,
          toast:
            view === "seller"
              ? "Seller Hub requires a seller account. Sign in as a seller or create one first."
              : "Admin Ops requires an admin account. An admin must promote your profile before you can open it.",
        };
      }

      return {
        ...current,
        activeView: allowedView,
      };
    }),
    setSearch: (value) => setState((current) => ({ ...current, searchTerm: value })),
    selectProduct: (productId) => setState((current) => ({ ...current, selectedProductId: productId })),
    selectConversation: (conversationId) => setState((current) => ({ ...current, selectedConversationId: conversationId })),
    toggleFavorite: (productId) => setState((current) => {
      const exists = current.favorites.includes(productId);
      return {
        ...current,
        favorites: exists ? current.favorites.filter((id) => id !== productId) : [...current.favorites, productId],
        toast: exists ? "Removed from favourites." : "Saved to favourites.",
      };
    }),
    addToCart: async (productId) => {
      if (!supabase || state.mode === "demo") {
        updateDemoState((current) => {
          const existing = current.cart.find((line) => line.productId === productId);
          const cart = existing
            ? current.cart.map((line) => line.productId === productId ? { ...line, quantity: line.quantity + 1 } : line)
            : [...current.cart, { productId, quantity: 1 }];
          return { ...current, cart, toast: "Item added to cart." };
        });
        return;
      }

      const cartId = await ensureLiveCartId();
      if (!cartId) return;

      const selectedProduct = state.products.find((product) => product.id === productId);
      const currentSellerIds = state.cart
        .map((line) => state.products.find((product) => product.id === line.productId)?.sellerId)
        .filter(Boolean);
      if (selectedProduct && currentSellerIds.length && !currentSellerIds.every((sellerId) => sellerId === selectedProduct.sellerId)) {
        setState((current) => ({ ...current, toast: "Live checkout supports one seller per cart right now." }));
        return;
      }

      const existing = state.cart.find((line) => line.productId === productId);
      await supabase.from("cart_items").upsert(
        {
          cart_id: cartId,
          product_id: productId,
          quantity: existing ? existing.quantity + 1 : 1,
        },
        { onConflict: "cart_id,product_id" },
      );
      await refreshLiveData();
      setState((current) => ({ ...current, toast: "Item added to cart." }));
    },
    removeFromCart: async (productId) => {
      if (!supabase || state.mode === "demo") {
        updateDemoState((current) => ({
          ...current,
          cart: current.cart.filter((line) => line.productId !== productId),
          toast: "Item removed from cart.",
        }));
        return;
      }
      const cartId = await ensureLiveCartId();
      if (!cartId) return;
      await supabase.from("cart_items").delete().eq("cart_id", cartId).eq("product_id", productId);
      await refreshLiveData();
    },
    updateCartQuantity: async (productId, quantity) => {
      if (!supabase || state.mode === "demo") {
        updateDemoState((current) => ({
          ...current,
          cart: current.cart.map((line) => line.productId === productId ? { ...line, quantity: Math.max(1, quantity) } : line),
        }));
        return;
      }
      const cartId = await ensureLiveCartId();
      if (!cartId) return;
      await supabase
        .from("cart_items")
        .upsert({ cart_id: cartId, product_id: productId, quantity: Math.max(1, quantity) }, { onConflict: "cart_id,product_id" });
      await refreshLiveData();
    },
    updateFilters: (patch) => setState((current) => ({ ...current, filters: { ...current.filters, ...patch } })),
    placeOrder: async (paymentMethod, deliveryOption) => {
      if (!supabase || state.mode === "demo") {
        updateDemoState((current) => ({
          ...current,
          toast: current.cart.length ? `${paymentMethod} order placed successfully.` : "Cart is empty.",
        }));
        return;
      }

      if (paymentMethod === "Card" || paymentMethod === "Wallet" || paymentMethod === "Escrow") {
        setState((current) => ({ ...current, checkoutLoading: true }));
        const { data, error } = await supabase.functions.invoke("create-checkout-session", {
          body: {
            deliveryOption,
            paymentMethod,
            location: state.profile?.location ?? "Accra",
          },
        });
        if (error || !data?.url) {
          setState((current) => ({
            ...current,
            checkoutLoading: false,
            toast: error?.message ?? "Unable to start live checkout.",
          }));
          return;
        }
        window.location.assign(data.url as string);
        return;
      }

      await createManualOrder(paymentMethod, deliveryOption);
    },
    advanceOrder: async (orderId) => {
      if (!supabase || state.mode === "demo") {
        updateDemoState((current) => ({
          ...current,
          orders: current.orders.map((order) => order.id === orderId ? { ...order, status: nextStatusFor(order.status), statusTrail: [...order.statusTrail, nextStatusFor(order.status)] } : order),
          toast: "Order moved to the next stage.",
        }));
        return;
      }
      const order = state.orders.find((entry) => entry.id === orderId);
      if (!order) return;
      const status = nextStatusFor(order.status);
      if (status === order.status) return;
      await supabase.from("orders").update({ status }).eq("id", orderId);
      await refreshLiveData();
    },
    sellerDecision: async (orderId, accepted) => {
      if (!supabase || state.mode === "demo") {
        updateDemoState((current) => ({
          ...current,
          orders: current.orders.map((order) => order.id === orderId ? { ...order, status: accepted ? "Accepted" : "Rejected", statusTrail: [...order.statusTrail, accepted ? "Accepted" : "Rejected"] } : order),
          toast: accepted ? "Order accepted." : "Order rejected.",
        }));
        return;
      }
      await supabase.from("orders").update({ status: accepted ? "Accepted" : "Rejected" }).eq("id", orderId);
      await refreshLiveData();
    },
    requestPayout: async (amount) => {
      if (!supabase || state.mode === "demo") {
        updateDemoState((current) => ({
          ...current,
          payouts: [{ id: `payout-${Date.now()}`, sellerId: current.currentSellerId, amount, requestedAt: new Date().toISOString(), status: "Pending" }, ...current.payouts],
          toast: "Withdrawal request created.",
        }));
        return;
      }
      if (!state.currentSellerId) return;
      await supabase.from("payout_requests").insert({ seller_id: state.currentSellerId, amount, status: "Pending" });
      await refreshLiveData();
      setState((current) => ({ ...current, toast: "Withdrawal request created." }));
    },
    verifySeller: async (sellerId) => {
      if (!supabase || state.mode === "demo") {
        updateDemoState((current) => ({
          ...current,
          sellers: current.sellers.map((seller) => seller.id === sellerId ? { ...seller, verified: true } : seller),
          users: current.users.map((user) => user.id === sellerId ? { ...user, verified: true } : user),
          toast: "Seller verification approved.",
        }));
        return;
      }
      await Promise.all([
        supabase.from("profiles").update({ verified: true }).eq("id", sellerId),
        supabase.from("seller_profiles").update({ payout_enabled: true }).eq("id", sellerId),
      ]);
      await refreshLiveData();
    },
    resolveComplaint: async (complaintId) => {
      if (!supabase || state.mode === "demo") {
        updateDemoState((current) => ({
          ...current,
          complaints: current.complaints.map((complaint) => complaint.id === complaintId ? { ...complaint, status: "Resolved" } : complaint),
          toast: "Complaint marked as resolved.",
        }));
        return;
      }
      await supabase.from("complaints").update({ status: "Resolved" }).eq("id", complaintId);
      await refreshLiveData();
    },
    toggleUserBan: async (userId) => {
      if (!supabase || state.mode === "demo") {
        updateDemoState((current) => ({
          ...current,
          users: current.users.map((user) => user.id === userId ? { ...user, banned: !user.banned } : user),
          toast: "User status updated.",
        }));
        return;
      }
      const user = state.users.find((entry) => entry.id === userId);
      if (!user) return;
      await supabase.from("profiles").update({ banned: !user.banned }).eq("id", userId);
      await refreshLiveData();
    },
    setProductDraft: (patch) => setState((current) => ({ ...current, productDraft: { ...current.productDraft, ...patch } })),
    toggleProductDraftDelivery: (option) => setState((current) => {
      const exists = current.productDraft.deliveryOptions.includes(option);
      return {
        ...current,
        productDraft: {
          ...current.productDraft,
          deliveryOptions: exists
            ? current.productDraft.deliveryOptions.filter((item) => item !== option)
            : [...current.productDraft.deliveryOptions, option],
        },
      };
    }),
    editProductDraft: (productId) => setState((current) => {
      const product = current.products.find((entry) => entry.id === productId);
      if (!product) return current;
      return {
        ...current,
        selectedProductId: productId,
        productDraft: {
          id: product.id,
          name: product.name,
          category: product.category,
          description: product.description,
          price: String(product.price),
          discountPrice: product.discountPrice ? String(product.discountPrice) : "",
          location: product.location,
          stock: String(product.stock),
          condition: product.condition,
          deliveryOptions: product.deliveryOptions,
          escrowEligible: product.escrowEligible,
          featured: product.featured,
          published: product.published ?? true,
          artLabel: product.artLabel,
        },
      };
    }),
    resetProductDraft: () => setState((current) => ({ ...current, productDraft: createBlankProductDraft() })),
    saveProduct: async (imageFile) => {
      const draft = state.productDraft;
      if (!draft.name.trim()) {
        setState((current) => ({ ...current, toast: "Product name is required." }));
        return;
      }

      if (!supabase || state.mode === "demo") {
        const nextId = draft.id ?? `product-${Date.now()}`;
        updateDemoState((current) => {
          const product = {
            id: nextId,
            sellerId: current.currentSellerId,
            name: draft.name,
            category: draft.category,
            description: draft.description,
            price: Number(draft.price || 0),
            discountPrice: draft.discountPrice ? Number(draft.discountPrice) : undefined,
            location: draft.location,
            stock: Number(draft.stock || 0),
            condition: draft.condition,
            deliveryOptions: draft.deliveryOptions,
            escrowEligible: draft.escrowEligible,
            featured: draft.featured,
            published: draft.published,
            rating: 0,
            reviews: 0,
            palette: ["#00b53f", "#f68b1e"] as [string, string],
            artLabel: draft.artLabel || "JHIMS",
          };
          const products = current.products.some((entry) => entry.id === nextId)
            ? current.products.map((entry) => entry.id === nextId ? product : entry)
            : [product, ...current.products];
          return { ...current, products, productDraft: createBlankProductDraft(), toast: "Product saved." };
        });
        return;
      }

      if (!state.sessionUser) return;

      let imagePath: string | undefined;
      let imageUrl: string | undefined;
      if (imageFile) {
        const extension = imageFile.name.split(".").pop() ?? "jpg";
        imagePath = `${state.sessionUser.id}/${Date.now()}.${extension}`;
        const uploadResult = await supabase.storage.from("product-images").upload(imagePath, imageFile, { cacheControl: "3600", upsert: true });
        if (uploadResult.error) {
          setState((current) => ({ ...current, toast: uploadResult.error.message }));
          return;
        }
        imageUrl = supabase.storage.from("product-images").getPublicUrl(imagePath).data.publicUrl;
      }

      const payload = {
        seller_id: state.currentSellerId || state.sessionUser.id,
        name: draft.name,
        category: draft.category,
        description: draft.description,
        price: Number(draft.price || 0),
        discount_price: draft.discountPrice ? Number(draft.discountPrice) : null,
        location: draft.location,
        stock: Number(draft.stock || 0),
        condition: draft.condition,
        delivery_options: draft.deliveryOptions,
        escrow_eligible: draft.escrowEligible,
        featured: draft.featured,
        published: draft.published,
        art_label: draft.artLabel || "JHIMS",
        cover_image_path: imagePath,
        cover_image_url: imageUrl,
      };

      const query = draft.id
        ? supabase.from("products").update(payload).eq("id", draft.id)
        : supabase.from("products").insert(payload);
      const { error } = await query;
      if (error) {
        setState((current) => ({ ...current, toast: error.message }));
        return;
      }
      await refreshLiveData();
      setState((current) => ({ ...current, productDraft: createBlankProductDraft(), toast: "Product saved." }));
    },
    sendMessage: async (body) => {
      if (!body.trim()) return;
      if (!supabase || !state.sessionUser) {
        setState((current) => current.selectedConversationId ? {
          ...current,
          messages: [...current.messages, { id: `message-${Date.now()}`, conversationId: current.selectedConversationId, senderId: current.profile?.id ?? "buyer-1", body, createdAt: new Date().toISOString() }],
        } : current);
        return;
      }

      let conversationId = state.selectedConversationId;
      if (!conversationId) {
        const fallbackSellerId = state.profile?.role === "seller"
          ? state.profile.id
          : state.products.find((product) => product.id === state.selectedProductId)?.sellerId;
        if (!fallbackSellerId || !state.profile) return;
        const { data: conversation, error } = await supabase
          .from("conversations")
          .insert({
            buyer_id: state.profile.role === "buyer" ? state.profile.id : state.currentBuyerId,
            seller_id: state.profile.role === "seller" ? state.profile.id : fallbackSellerId,
          })
          .select("id")
          .single();
        if (error || !conversation) {
          setState((current) => ({ ...current, toast: error?.message ?? "Unable to start the conversation." }));
          return;
        }
        conversationId = conversation.id;
      }

      const { error } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: state.sessionUser.id,
        body,
      });
      if (error) {
        setState((current) => ({ ...current, toast: error.message }));
        return;
      }
      await refreshLiveData();
    },
    markNotificationRead: async (notificationId) => {
      if (!supabase) {
        setState((current) => ({
          ...current,
          notifications: current.notifications.map((notification) => notification.id === notificationId ? { ...notification, read: true } : notification),
        }));
        return;
      }
      await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", notificationId);
      await refreshLiveData();
    },
    clearToast: () => setState((current) => ({ ...current, toast: null })),
  }), [
    createManualOrder,
    ensureLiveCartId,
    refreshLiveData,
    state.cart,
    state.currentBuyerId,
    state.currentSellerId,
    state.mode,
    state.notifications,
    state.orders,
    state.productDraft,
    state.products,
    state.profile,
    state.selectedConversationId,
    state.selectedProductId,
    state.sessionUser,
    state.users,
    updateDemoState,
  ]);

  return (
    <JhimsStoreContext.Provider value={{ state, actions }}>
      {children}
    </JhimsStoreContext.Provider>
  );
};

export const useJhims = () => {
  const context = useContext(JhimsStoreContext);
  if (!context) {
    throw new Error("useJhims must be used inside JhimsStoreProvider");
  }
  return context;
};

export { CATEGORY_OPTIONS, CONDITION_OPTIONS, DELIVERY_OPTIONS, LOCATION_OPTIONS, defaultFilters };

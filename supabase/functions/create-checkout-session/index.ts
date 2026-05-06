import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18?target=denonext";
import { corsHeaders } from "../_shared/cors.ts";

type CheckoutBody = {
  deliveryOption: "Pickup" | "Seller Delivery" | "JHIMS Rider";
  paymentMethod: "Card" | "Wallet" | "Escrow";
  location?: string;
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2026-02-25.clover",
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";
    const siteUrl = Deno.env.get("SITE_URL") ?? req.headers.get("origin") ?? "http://localhost:5173";

    if (!supabaseUrl || !serviceRole || !anonKey || !stripe.apiKey) {
      return new Response(JSON.stringify({ error: "Missing server configuration." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceRole);
    const [{ data: authData, error: authError }, body] = await Promise.all([
      userClient.auth.getUser(),
      req.json() as Promise<CheckoutBody>,
    ]);

    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = authData.user;
    const { data: cart } = await admin.from("carts").select("id").eq("buyer_id", user.id).single();
    if (!cart) {
      return new Response(JSON.stringify({ error: "Cart not found." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: cartItems, error: cartError } = await admin
      .from("cart_items")
      .select("quantity, product:products!inner(id, name, price, discount_price, stock, published, seller_id)")
      .eq("cart_id", cart.id);

    if (cartError || !cartItems?.length) {
      return new Response(JSON.stringify({ error: "Your cart is empty." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sellerIds = [...new Set(cartItems.map((entry) => entry.product.seller_id))];
    if (sellerIds.length !== 1) {
      return new Response(JSON.stringify({ error: "Live checkout currently supports one seller per order." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const subtotal = cartItems.reduce((sum, entry) => {
      const unitPrice = entry.product.discount_price ?? entry.product.price;
      return sum + Number(unitPrice) * entry.quantity;
    }, 0);
    const deliveryFee = body.deliveryOption === "Pickup" ? 0 : 45;
    const total = subtotal + deliveryFee;
    const sellerId = sellerIds[0];

    const { data: order, error: orderError } = await admin
      .from("orders")
      .insert({
        buyer_id: user.id,
        seller_id: sellerId,
        status: "Pending",
        payment_method: body.paymentMethod,
        escrow_held: body.paymentMethod === "Escrow",
        delivery_option: body.deliveryOption,
        location: body.location ?? "Accra",
        subtotal,
        delivery_fee: deliveryFee,
        total,
        eta: body.deliveryOption === "Pickup" ? "Pickup after payment confirmation" : "Delivery timeline starts after seller acceptance",
      })
      .select("id")
      .single();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: "Unable to create order draft." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orderItems = cartItems.map((entry) => ({
      order_id: order.id,
      product_id: entry.product.id,
      quantity: entry.quantity,
      unit_price: Number(entry.product.discount_price ?? entry.product.price),
    }));

    const paymentInsert = {
      order_id: order.id,
      buyer_id: user.id,
      seller_id: sellerId,
      amount: total,
      method: body.paymentMethod,
      status: "Pending Confirmation",
      provider: "stripe",
    };

    const [itemsResult, paymentResult] = await Promise.all([
      admin.from("order_items").insert(orderItems),
      admin.from("payments").insert(paymentInsert),
    ]);

    if (itemsResult.error || paymentResult.error) {
      return new Response(JSON.stringify({ error: "Unable to save checkout items." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lineItems = cartItems.map((entry) => ({
      quantity: entry.quantity,
      price_data: {
        currency: "ghs",
        product_data: {
          name: entry.product.name,
        },
        unit_amount: Math.round(Number(entry.product.discount_price ?? entry.product.price) * 100),
      },
    }));

    if (deliveryFee > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: "ghs",
          product_data: { name: `Delivery (${body.deliveryOption})` },
          unit_amount: Math.round(deliveryFee * 100),
        },
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email ?? undefined,
      line_items: lineItems,
      success_url: `${siteUrl}/?view=buyer&checkout=success`,
      cancel_url: `${siteUrl}/?view=buyer&checkout=cancelled`,
      metadata: {
        order_id: order.id,
        buyer_id: user.id,
        seller_id: sellerId,
        payment_method: body.paymentMethod,
      },
    });

    await Promise.all([
      admin.from("orders").update({ stripe_checkout_session_id: session.id }).eq("id", order.id),
      admin
        .from("payments")
        .update({ stripe_checkout_session_id: session.id })
        .eq("order_id", order.id),
    ]);

    return new Response(JSON.stringify({ url: session.url, orderId: order.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected checkout error.";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18?target=denonext";
import { corsHeaders } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2026-02-25.clover",
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const signature = req.headers.get("stripe-signature");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!signature || !webhookSecret || !supabaseUrl || !serviceRole || !stripe.apiKey) {
      return new Response("Webhook configuration missing.", { status: 400, headers: corsHeaders });
    }

    const payload = await req.text();
    const event = await stripe.webhooks.constructEventAsync(payload, signature, webhookSecret);
    const admin = createClient(supabaseUrl, serviceRole);

    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.order_id;
      const sellerId = session.metadata?.seller_id;
      const buyerId = session.metadata?.buyer_id;
      const method = session.metadata?.payment_method ?? "Card";

      if (orderId && sellerId && buyerId) {
        await Promise.all([
          admin
            .from("payments")
            .update({
              status: method === "Escrow" ? "Held in Escrow" : "Settled",
              stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
              settled_at: new Date().toISOString(),
            })
            .eq("order_id", orderId),
          admin
            .from("orders")
            .update({
              stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
            })
            .eq("id", orderId),
          admin.from("delivery_events").insert({
            order_id: orderId,
            status: "Pending",
            note: method === "Escrow" ? "Payment received and held in escrow." : "Payment confirmed. Waiting for seller acceptance.",
            created_by: buyerId,
          }),
          admin.from("notifications").insert([
            {
              user_id: buyerId,
              kind: "payment",
              title: "Payment confirmed",
              body: `Your payment for order ${orderId} was confirmed successfully.`,
            },
            {
              user_id: sellerId,
              kind: "order",
              title: "New paid order",
              body: `Order ${orderId} has been paid and is waiting for your acceptance.`,
            },
          ]),
        ]);

        const { data: cart } = await admin.from("carts").select("id").eq("buyer_id", buyerId).single();
        if (cart) {
          await admin.from("cart_items").delete().eq("cart_id", cart.id);
        }
      }
    }

    if (event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.order_id;
      const buyerId = session.metadata?.buyer_id;

      if (orderId && buyerId) {
        await Promise.all([
          admin.from("payments").update({ status: "Pending Confirmation" }).eq("order_id", orderId),
          admin.from("notifications").insert({
            user_id: buyerId,
            kind: "payment",
            title: "Payment failed",
            body: `Payment for order ${orderId} did not complete. You can try checkout again.`,
          }),
        ]);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook error";
    return new Response(message, { status: 400, headers: corsHeaders });
  }
});

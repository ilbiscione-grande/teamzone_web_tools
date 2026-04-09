import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/utils/stripe";
import Stripe from "stripe";
import {
  inferAppSlugFromPriceId,
  TACTICSBOARD_APP_SLUG,
} from "@/utils/appEntitlements";

const upsertAppEntitlement = async (
  supabase: any,
  params: {
    userId: string;
    appSlug: string;
    customerId: string | null;
    subscriptionId: string | null;
    priceId: string | null;
    status: string;
    tier: "FREE" | "PAID";
    currentPeriodEnd: string | null;
  }
) => {
  await supabase.from("app_entitlements").upsert(
    ({
      user_id: params.userId,
      app_slug: params.appSlug,
      stripe_customer_id: params.customerId,
      stripe_subscription_id: params.subscriptionId,
      stripe_price_id: params.priceId,
      status: params.status,
      tier: params.tier,
      current_period_end: params.currentPeriodEnd,
      updated_at: new Date().toISOString(),
    } as never),
    { onConflict: "user_id,app_slug" }
  );
};

const syncLegacyProfilePlan = async (
  supabase: any,
  params: {
    userId?: string | null;
    customerId?: string | null;
    plan: "AUTH" | "PAID";
  }
) => {
  const query = supabase.from("profiles").update({
    plan: params.plan,
    updated_at: new Date().toISOString(),
  } as never);

  if (params.customerId) {
    await query.eq("stripe_customer_id", params.customerId);
    return;
  }
  if (params.userId) {
    await query.eq("id", params.userId);
  }
};

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!stripe || !webhookSecret || !supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Stripe webhook not configured." },
      { status: 500 }
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId =
      session.client_reference_id ?? session.metadata?.userId ?? null;
    const appSlug = String(
      session.metadata?.appSlug ?? TACTICSBOARD_APP_SLUG
    ).trim().toLowerCase();
    if (userId) {
      await supabase
        .from("profiles")
        .update({
          plan: "PAID",
          stripe_customer_id: session.customer
            ? String(session.customer)
            : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (session.subscription) {
        const subscription = (await stripe.subscriptions.retrieve(
          String(session.subscription)
        )) as Stripe.Subscription;
        const firstItem = subscription.items.data[0];
        const priceId = firstItem?.price?.id ?? null;
        const shouldBePaid =
          subscription.status === "active" ||
          subscription.status === "trialing" ||
          subscription.status === "past_due";
        await upsertAppEntitlement(supabase, {
          userId,
          appSlug,
          customerId: session.customer ? String(session.customer) : null,
          subscriptionId: String(subscription.id),
          priceId,
          status: subscription.status,
          tier: shouldBePaid ? "PAID" : "FREE",
          currentPeriodEnd: (subscription as Stripe.Subscription & {
            current_period_end?: number;
          }).current_period_end
            ? new Date(
                (
                  subscription as Stripe.Subscription & {
                    current_period_end?: number;
                  }
                ).current_period_end! * 1000
              ).toISOString()
            : null,
        });
        if (appSlug === TACTICSBOARD_APP_SLUG) {
          await syncLegacyProfilePlan(supabase, {
            userId,
            customerId: session.customer ? String(session.customer) : null,
            plan: shouldBePaid ? "PAID" : "AUTH",
          });
        }
      }
    }
  }

  if (
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId =
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer?.id;
    const firstItem = subscription.items.data[0];
    const priceId = firstItem?.price?.id ?? null;
    const metadataAppSlug = String(
      subscription.metadata?.appSlug ?? ""
    ).trim().toLowerCase();
    const appSlug =
      metadataAppSlug || inferAppSlugFromPriceId(priceId) || TACTICSBOARD_APP_SLUG;
    const metadataUserId = String(subscription.metadata?.userId ?? "").trim();
    if (customerId) {
      const activeLikeStatuses: Stripe.Subscription.Status[] = [
        "active",
        "trialing",
        "past_due",
      ];
      const shouldBePaid = activeLikeStatuses.includes(subscription.status);
      let userId = metadataUserId || null;
      if (!userId) {
        const { data: existingEntitlement } = await supabase
          .from("app_entitlements")
          .select("user_id")
          .eq("stripe_subscription_id", subscription.id)
          .maybeSingle<{ user_id: string }>();
        userId = existingEntitlement?.user_id ?? null;
      }
      if (!userId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle<{ id: string }>();
        userId = profile?.id ?? null;
      }
      if (userId) {
        await upsertAppEntitlement(supabase, {
          userId,
          appSlug,
          customerId,
          subscriptionId: subscription.id,
          priceId,
          status: subscription.status,
          tier: shouldBePaid ? "PAID" : "FREE",
          currentPeriodEnd: (subscription as Stripe.Subscription & {
            current_period_end?: number;
          }).current_period_end
            ? new Date(
                (
                  subscription as Stripe.Subscription & {
                    current_period_end?: number;
                  }
                ).current_period_end! * 1000
              ).toISOString()
            : null,
        });
      }
      if (appSlug === TACTICSBOARD_APP_SLUG) {
        await syncLegacyProfilePlan(supabase, {
          userId,
          customerId,
          plan: shouldBePaid ? "PAID" : "AUTH",
        });
      }
    }
  }

  return NextResponse.json({ received: true });
}

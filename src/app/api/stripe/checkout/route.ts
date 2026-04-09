import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/utils/stripe";
import {
  getStripePriceIdForApp,
  getStripeSuccessPathForApp,
  TACTICSBOARD_APP_SLUG,
} from "@/utils/appEntitlements";

type CheckoutPayload = {
  accessToken: string;
  appSlug?: string;
};

export async function POST(request: Request) {
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe is not configured." },
      { status: 500 }
    );
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: "Missing Supabase or Stripe configuration." },
      { status: 500 }
    );
  }

  const body = (await request.json()) as CheckoutPayload;
  const accessToken = body?.accessToken?.trim();
  const appSlug = String(body?.appSlug ?? TACTICSBOARD_APP_SLUG).trim().toLowerCase();
  const priceId = getStripePriceIdForApp(appSlug);
  if (!accessToken) {
    return NextResponse.json({ error: "Missing access token." }, { status: 401 });
  }
  if (!priceId) {
    return NextResponse.json({ error: "Missing price for app." }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const origin =
    request.headers.get("origin") ??
    `https://${request.headers.get("host") ?? ""}`;

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userData.user.id)
    .maybeSingle<{ stripe_customer_id: string | null }>();

  const successPath = getStripeSuccessPathForApp(appSlug);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}${successPath}?checkout=success`,
    cancel_url: `${origin}${successPath}?checkout=cancel`,
    client_reference_id: userData.user.id,
    customer: profile?.stripe_customer_id ?? undefined,
    customer_email: profile?.stripe_customer_id
      ? undefined
      : userData.user.email ?? undefined,
    metadata: {
      userId: userData.user.id,
      appSlug,
    },
    subscription_data: {
      metadata: {
        userId: userData.user.id,
        appSlug,
      },
    },
  });

  if (session.customer) {
    await supabase
      .from("profiles")
      .update({
        stripe_customer_id: String(session.customer),
        updated_at: new Date().toISOString(),
      })
      .eq("id", userData.user.id);
  }

  return NextResponse.json({ url: session.url });
}

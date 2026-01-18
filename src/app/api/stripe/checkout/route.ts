import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/utils/stripe";

type CheckoutPayload = {
  accessToken: string;
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
  const priceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID ?? "";
  if (!supabaseUrl || !supabaseAnonKey || !priceId) {
    return NextResponse.json(
      { error: "Missing Supabase or Stripe configuration." },
      { status: 500 }
    );
  }

  const body = (await request.json()) as CheckoutPayload;
  const accessToken = body?.accessToken?.trim();
  if (!accessToken) {
    return NextResponse.json({ error: "Missing access token." }, { status: 401 });
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

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/?checkout=success`,
    cancel_url: `${origin}/?checkout=cancel`,
    client_reference_id: userData.user.id,
    customer_email: userData.user.email ?? undefined,
    metadata: {
      userId: userData.user.id,
    },
  });

  return NextResponse.json({ url: session.url });
}

import { NextResponse } from "next/server";
import { stripe } from "@/utils/stripe";

export async function GET() {
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe is not configured." },
      { status: 500 }
    );
  }
  const priceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID ?? "";
  if (!priceId) {
    return NextResponse.json(
      { error: "Missing Stripe price ID." },
      { status: 500 }
    );
  }
  const price = await stripe.prices.retrieve(priceId);
  return NextResponse.json({
    id: price.id,
    currency: price.currency,
    unit_amount: price.unit_amount,
    recurring: price.recurring?.interval ?? null,
  });
}

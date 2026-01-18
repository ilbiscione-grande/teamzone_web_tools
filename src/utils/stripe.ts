import Stripe from "stripe";

const stripeSecret = process.env.STRIPE_SECRET_KEY ?? "";

export const stripe = stripeSecret ? new Stripe(stripeSecret) : null;

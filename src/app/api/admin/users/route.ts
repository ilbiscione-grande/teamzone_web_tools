import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/api/admin/_utils";

type UpdateUserFlagsPayload = {
  id?: string;
  betaUser?: boolean;
  isAdmin?: boolean;
};

type ProfileRow = {
  id: string;
  plan: string;
  beta_user: boolean | null;
  is_admin: boolean | null;
  created_at: string;
  updated_at: string;
};

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const { data: profiles, error: profilesError } = await admin.service
    .from("profiles")
    .select("id,plan,beta_user,is_admin,created_at,updated_at")
    .order("updated_at", { ascending: false })
    .limit(1000);

  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 });
  }

  const usersById = new Map<string, { email: string | null; name: string | null }>();
  let page = 1;
  const perPage = 200;
  while (true) {
    const { data: userPage, error } = await admin.service.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) {
      break;
    }
    const users = userPage?.users ?? [];
    for (const user of users) {
      usersById.set(user.id, {
        email: user.email ?? null,
        name:
          (typeof user.user_metadata?.full_name === "string"
            ? user.user_metadata.full_name
            : typeof user.user_metadata?.name === "string"
              ? user.user_metadata.name
              : null) ?? null,
      });
    }
    if (users.length < perPage) {
      break;
    }
    page += 1;
    if (page > 10) {
      break;
    }
  }

  return NextResponse.json({
    users: ((profiles ?? []) as ProfileRow[]).map((profile) => {
      const auth = usersById.get(profile.id);
      return {
        id: profile.id,
        email: auth?.email ?? null,
        name: auth?.name ?? null,
        plan: profile.plan,
        betaUser: profile.beta_user === true,
        isAdmin: profile.is_admin === true,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at,
      };
    }),
  });
}

export async function PATCH(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const body = (await request.json()) as UpdateUserFlagsPayload;
  const id = String(body?.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ error: "Missing user id." }, { status: 400 });
  }

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  let changed = false;
  if (typeof body.betaUser === "boolean") {
    payload.beta_user = body.betaUser;
    changed = true;
  }
  if (typeof body.isAdmin === "boolean") {
    payload.is_admin = body.isAdmin;
    changed = true;
  }
  if (!changed) {
    return NextResponse.json(
      { error: "No changes provided." },
      { status: 400 }
    );
  }

  const { error } = await admin.service
    .from("profiles")
    .update(payload as any)
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

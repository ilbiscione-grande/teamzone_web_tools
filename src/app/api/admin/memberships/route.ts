import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/api/admin/_utils";

type ClubMembershipRow = {
  id: string;
  club_id: string;
  club_role: string;
  is_club_admin: boolean | null;
  clubs: {
    id: string;
    name: string;
  } | null;
};

type TeamMembershipRow = {
  id: string;
  team_id: string;
  team_role: string | null;
  team_position: string | null;
  is_team_admin: boolean | null;
  teams: {
    id: string;
    name: string;
    club_id: string | null;
  } | null;
};

type ClubOptionRow = {
  id: string;
  name: string;
};

type TeamOptionRow = {
  id: string;
  club_id: string | null;
  name: string;
};

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const url = new URL(request.url);
  const userId = url.searchParams.get("userId")?.trim() ?? "";
  if (!userId) {
    return NextResponse.json({ error: "Missing user id." }, { status: 400 });
  }

  const [{ data: clubsData, error: clubsError }, { data: teamsData, error: teamsError }, { data: clubMembershipsData, error: clubMembershipsError }, { data: teamMembershipsData, error: teamMembershipsError }] =
    await Promise.all([
      admin.service.from("clubs").select("id,name").order("name", { ascending: true }),
      admin.service
        .from("teams")
        .select("id,club_id,name")
        .order("name", { ascending: true }),
      admin.service
        .from("club_members")
        .select("id,club_id,club_role,is_club_admin,clubs(id,name)")
        .eq("user_id", userId),
      admin.service
        .from("team_members")
        .select("id,team_id,team_role,team_position,is_team_admin,teams(id,name,club_id)")
        .eq("user_id", userId),
    ]);

  const error =
    clubsError ?? teamsError ?? clubMembershipsError ?? teamMembershipsError;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    memberships: {
      clubs: ((clubsData ?? []) as ClubOptionRow[]).map((club) => ({
        id: club.id,
        name: club.name,
      })),
      teams: ((teamsData ?? []) as TeamOptionRow[])
        .filter((team) => !!team.club_id)
        .map((team) => ({
          id: team.id,
          clubId: team.club_id as string,
          name: team.name,
        })),
      clubMemberships: ((clubMembershipsData ?? []) as ClubMembershipRow[]).map((membership) => ({
        id: membership.id,
        clubId: membership.club_id,
        clubName: membership.clubs?.name ?? "Club",
        clubRole: membership.club_role,
        isClubAdmin: membership.is_club_admin === true,
      })),
      teamMemberships: ((teamMembershipsData ?? []) as TeamMembershipRow[])
        .filter((membership) => membership.teams?.club_id)
        .map((membership) => ({
          id: membership.id,
          teamId: membership.team_id,
          clubId: membership.teams?.club_id as string,
          teamName: membership.teams?.name ?? "Team",
          teamRole: membership.team_role ?? "other",
          teamPosition: membership.team_position,
          isTeamAdmin: membership.is_team_admin === true,
        })),
    },
  });
}

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const kind = String(body.kind ?? "").trim();
  const userId = String(body.userId ?? "").trim();
  if (!userId) {
    return NextResponse.json({ error: "Missing user id." }, { status: 400 });
  }

  if (kind === "club") {
    const clubId = String(body.clubId ?? "").trim();
    const clubRole = String(body.clubRole ?? "member").trim() || "member";
    const isClubAdmin = body.isClubAdmin === true;
    if (!clubId) {
      return NextResponse.json({ error: "Missing club id." }, { status: 400 });
    }
    const { error } = await admin.service.from("club_members").upsert(
      {
        club_id: clubId,
        user_id: userId,
        club_role: clubRole,
        is_club_admin: isClubAdmin,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "club_id,user_id" }
    );
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (kind === "team") {
    const teamId = String(body.teamId ?? "").trim();
    const teamRole = String(body.teamRole ?? "other").trim() || "other";
    const teamPosition =
      typeof body.teamPosition === "string" && body.teamPosition.trim()
        ? body.teamPosition.trim()
        : null;
    const isTeamAdmin = body.isTeamAdmin === true;
    if (!teamId) {
      return NextResponse.json({ error: "Missing team id." }, { status: 400 });
    }

    const { data: team, error: teamError } = await admin.service
      .from("teams")
      .select("club_id,name")
      .eq("id", teamId)
      .single();
    if (teamError || !team?.club_id) {
      return NextResponse.json({ error: "Team not found." }, { status: 404 });
    }

    const { data: existingClubMember } = await admin.service
      .from("club_members")
      .select("id")
      .eq("club_id", team.club_id)
      .eq("user_id", userId)
      .maybeSingle();

    const { data: profile } = await admin.service
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();
    const displayName = profile?.id ? null : null;

    const { error } = await admin.service.from("team_members").upsert(
      {
        team_id: teamId,
        user_id: userId,
        club_member_id: existingClubMember?.id ?? null,
        display_name: displayName,
        team_role: teamRole,
        team_position: teamPosition,
        is_team_admin: isTeamAdmin,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "team_id,user_id" }
    );
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unsupported membership kind." }, { status: 400 });
}

export async function PATCH(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const kind = String(body.kind ?? "").trim();
  const membershipId = String(body.membershipId ?? "").trim();
  if (!membershipId) {
    return NextResponse.json({ error: "Missing membership id." }, { status: 400 });
  }

  if (kind === "club") {
    const clubRole = String(body.clubRole ?? "member").trim() || "member";
    const isClubAdmin = body.isClubAdmin === true;
    const { error } = await admin.service
      .from("club_members")
      .update({
        club_role: clubRole,
        is_club_admin: isClubAdmin,
        updated_at: new Date().toISOString(),
      })
      .eq("id", membershipId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (kind === "team") {
    const teamRole = String(body.teamRole ?? "other").trim() || "other";
    const teamPosition =
      typeof body.teamPosition === "string" && body.teamPosition.trim()
        ? body.teamPosition.trim()
        : null;
    const isTeamAdmin = body.isTeamAdmin === true;
    const { error } = await admin.service
      .from("team_members")
      .update({
        team_role: teamRole,
        team_position: teamPosition,
        is_team_admin: isTeamAdmin,
        updated_at: new Date().toISOString(),
      })
      .eq("id", membershipId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unsupported membership kind." }, { status: 400 });
}

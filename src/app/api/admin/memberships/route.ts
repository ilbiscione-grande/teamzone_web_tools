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
    status: string | null;
    logo_url: string | null;
    kit_shirt: string | null;
    kit_shirt_secondary: string | null;
    kit_shorts: string | null;
    kit_socks: string | null;
    kit_vest: string | null;
    kit_jersey_type: string | null;
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
    status: string | null;
    club_id: string | null;
    team_type: string | null;
    age_group: string | null;
    season_label: string | null;
    club_logo: string | null;
    kit_shirt: string | null;
    kit_shirt_secondary: string | null;
    kit_shorts: string | null;
    kit_socks: string | null;
    kit_vest: string | null;
    kit_jersey_type: string | null;
  } | null;
};

type ClubOptionRow = {
  id: string;
  name: string;
  status: string | null;
};

type TeamOptionRow = {
  id: string;
  club_id: string | null;
  name: string;
  status: string | null;
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
      admin.service.from("clubs").select("id,name,status").order("name", { ascending: true }),
      admin.service
        .from("teams")
        .select("id,club_id,name,status")
        .order("name", { ascending: true }),
      admin.service
        .from("club_members")
        .select("id,club_id,club_role,is_club_admin,clubs(id,name,status,logo_url,kit_shirt,kit_shirt_secondary,kit_shorts,kit_socks,kit_vest,kit_jersey_type)")
        .eq("user_id", userId),
      admin.service
        .from("team_members")
        .select("id,team_id,team_role,team_position,is_team_admin,teams(id,name,status,club_id,team_type,age_group,season_label,club_logo,kit_shirt,kit_shirt_secondary,kit_shorts,kit_socks,kit_vest,kit_jersey_type)")
        .eq("user_id", userId),
    ]);

  const error =
    clubsError ?? teamsError ?? clubMembershipsError ?? teamMembershipsError;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    memberships: {
      clubs: ((clubsData ?? []) as ClubOptionRow[])
        .filter((club) => (club.status ?? "active") === "active")
        .map((club) => ({
        id: club.id,
        name: club.name,
      })),
      teams: ((teamsData ?? []) as TeamOptionRow[])
        .filter(
          (team) => !!team.club_id && (team.status ?? "active") === "active"
        )
        .map((team) => ({
          id: team.id,
          clubId: team.club_id as string,
          name: team.name,
        })),
      clubMemberships: ((clubMembershipsData ?? []) as ClubMembershipRow[]).map((membership) => ({
        id: membership.id,
        clubId: membership.club_id,
        clubName: membership.clubs?.name ?? "Club",
        clubStatus:
          (membership.clubs?.status ?? "active") === "archived" ? "archived" : "active",
        clubLogoUrl: membership.clubs?.logo_url ?? null,
        kitShirt: membership.clubs?.kit_shirt ?? "#e4573f",
        kitShirtSecondary: membership.clubs?.kit_shirt_secondary ?? "#f3f3f3",
        kitShorts: membership.clubs?.kit_shorts ?? "#f3f3f3",
        kitSocks: membership.clubs?.kit_socks ?? "#f3f3f3",
        kitVest: membership.clubs?.kit_vest ?? null,
        kitJerseyType:
          membership.clubs?.kit_jersey_type === "split" ||
          membership.clubs?.kit_jersey_type === "stripe" ||
          membership.clubs?.kit_jersey_type === "sash" ||
          membership.clubs?.kit_jersey_type === "pinstripe"
            ? membership.clubs.kit_jersey_type
            : "solid",
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
          teamStatus:
            (membership.teams?.status ?? "active") === "archived" ? "archived" : "active",
          teamLogoUrl: membership.teams?.club_logo ?? null,
          teamType: membership.teams?.team_type ?? "other",
          ageGroup: membership.teams?.age_group ?? null,
          seasonLabel: membership.teams?.season_label ?? null,
          kitShirt: membership.teams?.kit_shirt ?? null,
          kitShirtSecondary: membership.teams?.kit_shirt_secondary ?? null,
          kitShorts: membership.teams?.kit_shorts ?? null,
          kitSocks: membership.teams?.kit_socks ?? null,
          kitVest: membership.teams?.kit_vest ?? null,
          kitJerseyType:
            membership.teams?.kit_jersey_type === "split" ||
            membership.teams?.kit_jersey_type === "stripe" ||
            membership.teams?.kit_jersey_type === "sash" ||
            membership.teams?.kit_jersey_type === "pinstripe"
              ? membership.teams.kit_jersey_type
              : null,
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

  if (kind === "create_club") {
    const clubName = String(body.clubName ?? "").trim();
    const clubRole = String(body.clubRole ?? "member").trim() || "member";
    const isClubAdmin = body.isClubAdmin === true;
    if (!clubName) {
      return NextResponse.json({ error: "Missing club name." }, { status: 400 });
    }
    const { data: club, error: clubError } = await admin.service
      .from("clubs")
      .insert({
        name: clubName,
        created_by_user_id: userId,
        primary_admin_user_id: userId,
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (clubError || !club) {
      return NextResponse.json(
        { error: clubError?.message ?? "Could not create club." },
        { status: 500 }
      );
    }
    const { error: membershipError } = await admin.service.from("club_members").upsert(
        {
          club_id: club.id,
          user_id: userId,
          club_role: clubRole,
          is_club_admin: true,
          updated_at: new Date().toISOString(),
        },
      { onConflict: "club_id,user_id" }
    );
    if (membershipError) {
      return NextResponse.json({ error: membershipError.message }, { status: 500 });
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

  if (kind === "create_team") {
    const clubId = String(body.clubId ?? "").trim();
    const teamName = String(body.teamName ?? "").trim();
    const teamType = String(body.teamType ?? "other").trim() || "other";
    const ageGroup =
      typeof body.ageGroup === "string" && body.ageGroup.trim() ? body.ageGroup.trim() : null;
    const seasonLabel =
      typeof body.seasonLabel === "string" && body.seasonLabel.trim()
        ? body.seasonLabel.trim()
        : null;
    const teamRole = String(body.teamRole ?? "leader").trim() || "leader";
    const teamPosition =
      typeof body.teamPosition === "string" && body.teamPosition.trim()
        ? body.teamPosition.trim()
        : null;
    const isTeamAdmin = body.isTeamAdmin !== false;
    if (!clubId || !teamName) {
      return NextResponse.json(
        { error: "Missing club id or team name." },
        { status: 400 }
      );
    }

    const { data: clubMember } = await admin.service
      .from("club_members")
      .upsert(
        {
          club_id: clubId,
          user_id: userId,
          club_role: "member",
          is_club_admin: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "club_id,user_id" }
      )
      .select("id")
      .single();

    const { data: team, error: teamInsertError } = await admin.service
      .from("teams")
      .insert({
        owner_id: userId,
        club_id: clubId,
        name: teamName,
        team_type: teamType,
        age_group: ageGroup,
        season_label: seasonLabel,
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (teamInsertError || !team) {
      return NextResponse.json(
        { error: teamInsertError?.message ?? "Could not create team." },
        { status: 500 }
      );
    }

    const { error: teamMemberError } = await admin.service.from("team_members").upsert(
      {
        team_id: team.id,
        user_id: userId,
        club_member_id: clubMember?.id ?? null,
        display_name: null,
        team_role: teamRole,
        team_position: teamPosition,
        is_team_admin: isTeamAdmin,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "team_id,user_id" }
    );
    if (teamMemberError) {
      return NextResponse.json({ error: teamMemberError.message }, { status: 500 });
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

  if (kind === "club") {
    const membershipId = String(body.membershipId ?? "").trim();
    if (!membershipId) {
      return NextResponse.json({ error: "Missing membership id." }, { status: 400 });
    }
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
    const membershipId = String(body.membershipId ?? "").trim();
    if (!membershipId) {
      return NextResponse.json({ error: "Missing membership id." }, { status: 400 });
    }
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

  if (kind === "club_details") {
    const clubId = String(body.clubId ?? "").trim();
    const clubName = String(body.clubName ?? "").trim();
    const clubLogoUrl =
      typeof body.clubLogoUrl === "string" && body.clubLogoUrl.trim()
        ? body.clubLogoUrl.trim()
        : null;
    const kitShirt = String(body.kitShirt ?? "").trim() || "#e4573f";
    const kitShirtSecondary = String(body.kitShirtSecondary ?? "").trim() || "#f3f3f3";
    const kitShorts = String(body.kitShorts ?? "").trim() || "#f3f3f3";
    const kitSocks = String(body.kitSocks ?? "").trim() || "#f3f3f3";
    const kitVest =
      typeof body.kitVest === "string" && body.kitVest.trim() ? body.kitVest.trim() : null;
    const kitJerseyType =
      body.kitJerseyType === "split" ||
      body.kitJerseyType === "stripe" ||
      body.kitJerseyType === "sash" ||
      body.kitJerseyType === "pinstripe"
        ? body.kitJerseyType
        : "solid";
    if (!clubId || !clubName) {
      return NextResponse.json({ error: "Missing club id or name." }, { status: 400 });
    }
    const { error } = await admin.service
      .from("clubs")
      .update({
        name: clubName,
        logo_url: clubLogoUrl,
        kit_shirt: kitShirt,
        kit_shirt_secondary: kitShirtSecondary,
        kit_shorts: kitShorts,
        kit_socks: kitSocks,
        kit_vest: kitVest,
        kit_jersey_type: kitJerseyType,
        updated_at: new Date().toISOString(),
      })
      .eq("id", clubId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (kind === "team_details") {
    const teamId = String(body.teamId ?? "").trim();
    const teamName = String(body.teamName ?? "").trim();
    const teamLogoUrl =
      typeof body.teamLogoUrl === "string" && body.teamLogoUrl.trim()
        ? body.teamLogoUrl.trim()
        : null;
    const teamType = String(body.teamType ?? "other").trim() || "other";
    const ageGroup =
      typeof body.ageGroup === "string" && body.ageGroup.trim() ? body.ageGroup.trim() : null;
    const seasonLabel =
      typeof body.seasonLabel === "string" && body.seasonLabel.trim()
        ? body.seasonLabel.trim()
        : null;
    const kitShirt =
      typeof body.kitShirt === "string" && body.kitShirt.trim() ? body.kitShirt.trim() : null;
    const kitShirtSecondary =
      typeof body.kitShirtSecondary === "string" && body.kitShirtSecondary.trim()
        ? body.kitShirtSecondary.trim()
        : null;
    const kitShorts =
      typeof body.kitShorts === "string" && body.kitShorts.trim() ? body.kitShorts.trim() : null;
    const kitSocks =
      typeof body.kitSocks === "string" && body.kitSocks.trim() ? body.kitSocks.trim() : null;
    const kitVest =
      typeof body.kitVest === "string" && body.kitVest.trim() ? body.kitVest.trim() : null;
    const kitJerseyType =
      body.kitJerseyType === "split" ||
      body.kitJerseyType === "stripe" ||
      body.kitJerseyType === "sash" ||
      body.kitJerseyType === "pinstripe"
        ? body.kitJerseyType
        : null;
    if (!teamId || !teamName) {
      return NextResponse.json({ error: "Missing team id or name." }, { status: 400 });
    }
    const { error } = await admin.service
      .from("teams")
      .update({
        name: teamName,
        club_logo: teamLogoUrl,
        team_type: teamType,
        age_group: ageGroup,
        season_label: seasonLabel,
        kit_shirt: kitShirt,
        kit_shirt_secondary: kitShirtSecondary,
        kit_shorts: kitShorts,
        kit_socks: kitSocks,
        kit_vest: kitVest,
        kit_jersey_type: kitJerseyType,
        updated_at: new Date().toISOString(),
      })
      .eq("id", teamId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (kind === "club_status") {
    const clubId = String(body.clubId ?? "").trim();
    const status = body.status === "archived" ? "archived" : "active";
    if (!clubId) {
      return NextResponse.json({ error: "Missing club id." }, { status: 400 });
    }
    const { error } = await admin.service
      .from("clubs")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", clubId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (kind === "team_status") {
    const teamId = String(body.teamId ?? "").trim();
    const status = body.status === "archived" ? "archived" : "active";
    if (!teamId) {
      return NextResponse.json({ error: "Missing team id." }, { status: 400 });
    }
    const { error } = await admin.service
      .from("teams")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", teamId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unsupported membership kind." }, { status: 400 });
}

export async function DELETE(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const kind = String(body.kind ?? "").trim();

  if (kind === "club_delete") {
    const clubId = String(body.clubId ?? "").trim();
    if (!clubId) {
      return NextResponse.json({ error: "Missing club id." }, { status: 400 });
    }
    const { error } = await admin.service.from("clubs").delete().eq("id", clubId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (kind === "team_delete") {
    const teamId = String(body.teamId ?? "").trim();
    if (!teamId) {
      return NextResponse.json({ error: "Missing team id." }, { status: 400 });
    }
    const { error } = await admin.service.from("teams").delete().eq("id", teamId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unsupported membership kind." }, { status: 400 });
}

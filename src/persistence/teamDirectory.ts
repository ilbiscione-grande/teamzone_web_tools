import type {
  Squad,
  SquadPlayer,
  SquadPreset,
  TeamDirectoryClub,
  TeamDirectoryMember,
  TeamDirectoryTeam,
} from "@/models";
import { supabase } from "@/utils/supabaseClient";
import { fetchTeamsWithSquad } from "@/persistence/teamSquads";

type ClubMembershipRow = {
  club_id: string;
  membership_role: string;
  is_club_admin: boolean;
  clubs: {
    id: string;
    name: string;
    slug: string | null;
    logo_url: string | null;
    status: string;
  } | {
    id: string;
    name: string;
    slug: string | null;
    logo_url: string | null;
    status: string;
  }[] | null;
};

type TeamRow = {
  id: string;
  club_id: string | null;
  name: string;
  slug: string | null;
  team_type: string | null;
  age_group: string | null;
  season_label: string | null;
  status: string | null;
  club_logo: string | null;
};

type TeamMemberRow = {
  id: string;
  team_id: string;
  user_id: string | null;
  display_name: string | null;
  member_role: string | null;
  team_position: string | null;
  is_team_admin: boolean | null;
  is_guest: boolean | null;
  is_active: boolean | null;
  shirt_number: number | null;
  photo_url: string | null;
  sort_order: number | null;
};

const buildSquadFromMembers = (
  team: Pick<TeamRow, "id" | "name" | "club_logo">,
  members: TeamMemberRow[]
): Squad => {
  const orderedMembers = members
    .slice()
    .sort(
      (a, b) =>
        (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
        (a.display_name ?? "").localeCompare(b.display_name ?? "", "sv")
    );
  const players: SquadPlayer[] = orderedMembers
    .filter((member) => member.member_role === "player" || member.is_guest === true)
    .map((member) => ({
      id: member.id,
      name: member.display_name?.trim() || "Unnamed member",
      positionLabel: member.team_position?.trim() || "POS",
      guest: member.is_guest ?? false,
      active: member.is_active ?? true,
      number: member.shirt_number ?? undefined,
      photoUrl: member.photo_url ?? undefined,
      sourceTeamId: team.id,
      sourceTeamName: team.name,
      sourcePlayerId: member.id,
    }));

  return {
    id: team.id,
    name: team.name,
    clubLogo: team.club_logo ?? undefined,
    kit: {
      shirt: "#e4573f",
      shirtSecondary: "#f3f3f3",
      shorts: "#f3f3f3",
      socks: "#f3f3f3",
    },
    players,
  };
};

const toDirectoryMember = (member: TeamMemberRow): TeamDirectoryMember => ({
  id: member.id,
  userId: member.user_id,
  displayName: member.display_name?.trim() || "Unnamed member",
  memberRole: member.member_role?.trim() || "other",
  teamPosition: member.team_position,
  isTeamAdmin: member.is_team_admin ?? false,
  isGuest: member.is_guest ?? false,
  isActive: member.is_active ?? true,
  shirtNumber: member.shirt_number,
  photoUrl: member.photo_url,
  sortOrder: member.sort_order ?? 0,
});

export const mapLegacyPresetsToDirectory = (
  presets: SquadPreset[]
): TeamDirectoryClub[] => {
  if (presets.length === 0) {
    return [];
  }
  return [
    {
      id: "legacy-personal-club",
      name: "My teams",
      slug: "my-teams",
      logoUrl: null,
      status: "active",
      membershipRole: "member",
      isCurrentUserClubAdmin: true,
      teams: presets.map((preset) => ({
        id: preset.teamId ?? preset.id,
        clubId: "legacy-personal-club",
        name: preset.teamName ?? preset.name,
        slug: null,
        teamType: "other",
        ageGroup: null,
        seasonLabel: null,
        status: "active",
        squad: preset.squad,
        members: preset.squad.players.map((player, index) => ({
          id: player.id,
          userId: null,
          displayName: player.name,
          memberRole: "player",
          teamPosition: player.positionLabel,
          isTeamAdmin: false,
          isGuest: player.guest ?? false,
          isActive: player.active ?? true,
          shirtNumber: player.number ?? null,
          photoUrl: player.photoUrl ?? null,
          sortOrder: index,
        })),
        isCurrentUserTeamAdmin: true,
      })),
    },
  ];
};

export const buildTeamDirectory = (params: {
  clubMemberships: ClubMembershipRow[];
  teams: TeamRow[];
  teamMembers: TeamMemberRow[];
  currentUserId: string;
}): TeamDirectoryClub[] => {
  const teamsByClubId = new Map<string, TeamRow[]>();
  params.teams.forEach((team) => {
    if (!team.club_id) {
      return;
    }
    const list = teamsByClubId.get(team.club_id) ?? [];
    list.push(team);
    teamsByClubId.set(team.club_id, list);
  });

  const membersByTeamId = new Map<string, TeamMemberRow[]>();
  params.teamMembers.forEach((member) => {
    const list = membersByTeamId.get(member.team_id) ?? [];
    list.push(member);
    membersByTeamId.set(member.team_id, list);
  });

  const clubs: TeamDirectoryClub[] = [];

  params.clubMemberships
    .filter((membership) => membership.clubs)
    .forEach((membership) => {
      const clubValue = Array.isArray(membership.clubs)
        ? membership.clubs[0] ?? null
        : membership.clubs;
      if (!clubValue) {
        return;
      }
      const club = clubValue;
      const teams = (teamsByClubId.get(membership.club_id) ?? [])
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, "sv"))
        .map((team) => {
          const teamMembers = membersByTeamId.get(team.id) ?? [];
          return {
            id: team.id,
            clubId: membership.club_id,
            name: team.name,
            slug: team.slug ?? null,
            teamType: team.team_type ?? "other",
            ageGroup: team.age_group,
            seasonLabel: team.season_label,
            status: team.status ?? "active",
            squad: buildSquadFromMembers(team, teamMembers),
            members: teamMembers
              .map(toDirectoryMember)
              .sort(
                (a, b) =>
                  a.sortOrder - b.sortOrder ||
                  a.displayName.localeCompare(b.displayName, "sv")
              ),
            isCurrentUserTeamAdmin: teamMembers.some(
              (member) =>
                member.user_id === params.currentUserId &&
                (member.is_team_admin ?? false)
            ),
          } satisfies TeamDirectoryTeam;
        });

      const nextClub: TeamDirectoryClub = {
        id: club.id,
        name: club.name,
        slug: club.slug ?? null,
        logoUrl: club.logo_url ?? null,
        status: club.status,
        membershipRole: membership.membership_role,
        isCurrentUserClubAdmin: membership.is_club_admin,
        teams,
      };
      if (nextClub.teams.length > 0) {
        clubs.push(nextClub);
      }
    });

  return clubs;
};

export const fetchClubTeamDirectory = async () => {
  if (!supabase) {
    return { ok: false as const, error: "Supabase not configured." };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { ok: false as const, error: "Not authenticated." };
  }
  const currentUserId = userData.user.id;

  const { data: clubMembershipData, error: clubMembershipError } = await supabase
    .from("club_members")
    .select(
      "club_id,membership_role,is_club_admin,clubs(id,name,slug,logo_url,status)"
    )
    .eq("user_id", currentUserId);

  if (clubMembershipError) {
    const legacy = await fetchTeamsWithSquad();
    if (!legacy.ok) {
      return legacy;
    }
    return { ok: true as const, clubs: mapLegacyPresetsToDirectory(legacy.teams) };
  }

  const clubMemberships = (clubMembershipData ?? []) as ClubMembershipRow[];
  const clubIds = clubMemberships.map((membership) => membership.club_id);
  if (clubIds.length === 0) {
    const legacy = await fetchTeamsWithSquad();
    if (!legacy.ok) {
      return legacy;
    }
    return { ok: true as const, clubs: mapLegacyPresetsToDirectory(legacy.teams) };
  }

  const { data: teamData, error: teamError } = await supabase
    .from("teams")
    .select(
      "id,club_id,name,slug,team_type,age_group,season_label,status,club_logo"
    )
    .in("club_id", clubIds)
    .order("name", { ascending: true });

  if (teamError) {
    return { ok: false as const, error: teamError.message };
  }

  const teams = (teamData ?? []) as TeamRow[];
  const teamIds = teams.map((team) => team.id);
  if (teamIds.length === 0) {
    return { ok: true as const, clubs: buildTeamDirectory({
      clubMemberships,
      teams: [],
      teamMembers: [],
      currentUserId,
    }) };
  }

  const { data: teamMembersData, error: teamMembersError } = await supabase
    .from("team_members")
    .select(
      "id,team_id,user_id,display_name,member_role,team_position,is_team_admin,is_guest,is_active,shirt_number,photo_url,sort_order"
    )
    .in("team_id", teamIds);

  if (teamMembersError) {
    return { ok: false as const, error: teamMembersError.message };
  }

  return {
    ok: true as const,
    clubs: buildTeamDirectory({
      clubMemberships,
      teams,
      teamMembers: (teamMembersData ?? []) as TeamMemberRow[],
      currentUserId,
    }),
  };
};

import { supabase } from "@/utils/supabaseClient";
import type { Squad, SquadPlayer, SquadPreset } from "@/models";

type TeamRow = {
  id: string;
  owner_id: string;
  name: string;
  club_logo: string | null;
  created_at: string;
  updated_at: string;
};

type TeamSquadRow = {
  id: string;
  team_id: string;
  name: string;
  kit_data: Squad["kit"];
  captain_player_id: string | null;
  substitute_player_ids: string[] | null;
  created_at: string;
  updated_at: string;
};

type TeamPlayerRow = {
  id: string;
  team_id: string;
  name: string;
  position_label: string;
  number: number | null;
  vest_color: string | null;
  photo_url: string | null;
};

type TeamSquadPlayerRow = {
  id: string;
  squad_id: string;
  player_id: string;
  order_index: number;
  is_captain: boolean;
  is_substitute: boolean;
  source_team_id: string | null;
  source_player_id: string | null;
};

const TEAMS_TABLE = "teams";
const TEAM_MEMBERS_TABLE = "team_members";
const TEAM_SQUADS_TABLE = "team_squads";
const TEAM_PLAYERS_TABLE = "team_players";
const TEAM_SQUAD_PLAYERS_TABLE = "team_squad_players";

const getAuthUser = async () => {
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return null;
  }
  return data.user;
};

const toSquadPlayer = (
  player: TeamPlayerRow,
  relation: TeamSquadPlayerRow,
  sourceTeamNameById: Map<string, string>
): SquadPlayer => ({
  id: player.id,
  name: player.name,
  positionLabel: player.position_label,
  number: player.number ?? undefined,
  vestColor: player.vest_color ?? undefined,
  photoUrl: player.photo_url ?? undefined,
  sourceTeamId: relation.source_team_id ?? undefined,
  sourceTeamName: relation.source_team_id
    ? sourceTeamNameById.get(relation.source_team_id)
    : undefined,
  sourcePlayerId: relation.source_player_id ?? undefined,
});

const fetchTeamsByIds = async (teamIds: string[]) => {
  if (!supabase || teamIds.length === 0) {
    return [] as TeamRow[];
  }
  const { data } = await supabase
    .from(TEAMS_TABLE)
    .select("id, owner_id, name, club_logo, created_at, updated_at")
    .in("id", teamIds);
  return (data ?? []) as TeamRow[];
};

const buildTeamsFromRows = async (
  teams: TeamRow[]
): Promise<SquadPreset[]> => {
  if (!supabase || teams.length === 0) {
    return [];
  }

  const teamIds = teams.map((team) => team.id);

  const [{ data: squadsData }, { data: playersData }] = await Promise.all([
    supabase
      .from(TEAM_SQUADS_TABLE)
      .select(
        "id, team_id, name, kit_data, captain_player_id, substitute_player_ids, created_at, updated_at"
      )
      .in("team_id", teamIds),
    supabase
      .from(TEAM_PLAYERS_TABLE)
      .select(
        "id, team_id, name, position_label, number, vest_color, photo_url"
      )
      .in("team_id", teamIds),
  ]);

  const squads = (squadsData ?? []) as TeamSquadRow[];
  const players = (playersData ?? []) as TeamPlayerRow[];

  const squadIds = squads.map((squad) => squad.id);
  const { data: squadPlayersData } = await supabase
    .from(TEAM_SQUAD_PLAYERS_TABLE)
    .select(
      "id, squad_id, player_id, order_index, is_captain, is_substitute, source_team_id, source_player_id"
    )
    .in("squad_id", squadIds.length > 0 ? squadIds : ["00000000-0000-0000-0000-000000000000"]);

  const squadPlayers = (squadPlayersData ?? []) as TeamSquadPlayerRow[];

  const sourceTeamIds = Array.from(
    new Set(
      squadPlayers
        .map((entry) => entry.source_team_id)
        .filter((value): value is string => Boolean(value))
    )
  );

  const sourceTeams = await fetchTeamsByIds(sourceTeamIds);
  const sourceTeamNameById = new Map<string, string>();
  sourceTeams.forEach((team) => sourceTeamNameById.set(team.id, team.name));

  const squadByTeamId = new Map<string, TeamSquadRow>();
  squads.forEach((squad) => squadByTeamId.set(squad.team_id, squad));

  const playersById = new Map<string, TeamPlayerRow>();
  players.forEach((player) => playersById.set(player.id, player));

  const squadPlayersBySquadId = new Map<string, TeamSquadPlayerRow[]>();
  squadPlayers.forEach((entry) => {
    const list = squadPlayersBySquadId.get(entry.squad_id) ?? [];
    list.push(entry);
    squadPlayersBySquadId.set(entry.squad_id, list);
  });

  return teams
    .slice()
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .map((team) => {
      const squad = squadByTeamId.get(team.id);
      const orderedRelations = squad
        ? (squadPlayersBySquadId.get(squad.id) ?? [])
            .slice()
            .sort((a, b) => a.order_index - b.order_index)
        : [];

      const mappedPlayers = orderedRelations
        .map((relation) => {
          const player = playersById.get(relation.player_id);
          if (!player) {
            return null;
          }
          return toSquadPlayer(player, relation, sourceTeamNameById);
        })
        .filter((player): player is SquadPlayer => Boolean(player));

      const captainId = squad?.captain_player_id ?? undefined;
      const substituteIds =
        squad?.substitute_player_ids?.filter((id): id is string => Boolean(id)) ??
        orderedRelations
          .filter((relation) => relation.is_substitute)
          .map((relation) => relation.player_id);

      const squadData: Squad = {
        id: squad?.id ?? team.id,
        name: squad?.name ?? team.name,
        clubLogo: team.club_logo ?? undefined,
        kit:
          squad?.kit_data ??
          ({
            shirt: "#e4573f",
            shirtSecondary: "#f3f3f3",
            shorts: "#f3f3f3",
            socks: "#f3f3f3",
          } as Squad["kit"]),
        players: mappedPlayers,
        captainId,
        substituteIds,
      };

      return {
        id: team.id,
        userId: team.owner_id,
        teamId: team.id,
        teamName: team.name,
        name: team.name,
        squad: squadData,
        createdAt: team.created_at,
        updatedAt: team.updated_at,
      } satisfies SquadPreset;
    });
};

const createOrReplaceTeamSquad = async (params: {
  teamId: string;
  squadName: string;
  kit: Squad["kit"];
  players: SquadPlayer[];
  captainId?: string;
  substituteIds?: string[];
}) => {
  if (!supabase) {
    return { ok: false as const, error: "Supabase not configured." };
  }

  const upsertSquad = await supabase
    .from(TEAM_SQUADS_TABLE)
    .upsert(
      {
        team_id: params.teamId,
        name: params.squadName,
        kit_data: params.kit,
        captain_player_id: null,
        substitute_player_ids: [],
        updated_at: new Date().toISOString(),
      },
      { onConflict: "team_id" }
    )
    .select(
      "id, team_id, name, kit_data, captain_player_id, substitute_player_ids, created_at, updated_at"
    )
    .single();

  if (upsertSquad.error || !upsertSquad.data) {
    return {
      ok: false as const,
      error: upsertSquad.error?.message ?? "Could not save squad.",
    };
  }

  const squadId = (upsertSquad.data as TeamSquadRow).id;

  const { error: clearRelationsError } = await supabase
    .from(TEAM_SQUAD_PLAYERS_TABLE)
    .delete()
    .eq("squad_id", squadId);
  if (clearRelationsError) {
    return { ok: false as const, error: clearRelationsError.message };
  }

  const { error: clearPlayersError } = await supabase
    .from(TEAM_PLAYERS_TABLE)
    .delete()
    .eq("team_id", params.teamId);
  if (clearPlayersError) {
    return { ok: false as const, error: clearPlayersError.message };
  }

  const insertPlayersPayload = params.players.map((player) => ({
    team_id: params.teamId,
    name: player.name,
    position_label: player.positionLabel,
    number: player.number ?? null,
    vest_color: player.vestColor ?? null,
    photo_url: player.photoUrl ?? null,
    updated_at: new Date().toISOString(),
  }));

  const { data: insertedPlayers, error: insertPlayersError } =
    insertPlayersPayload.length > 0
      ? await supabase
          .from(TEAM_PLAYERS_TABLE)
          .insert(insertPlayersPayload)
          .select(
            "id, team_id, name, position_label, number, vest_color, photo_url"
          )
      : ({ data: [] as TeamPlayerRow[], error: null } as const);

  if (insertPlayersError) {
    return { ok: false as const, error: insertPlayersError.message };
  }

  const originalToInserted = new Map<string, TeamPlayerRow>();
  params.players.forEach((player, index) => {
    const inserted = (insertedPlayers ?? [])[index];
    if (inserted) {
      originalToInserted.set(player.id, inserted as TeamPlayerRow);
    }
  });

  const captainTarget = params.captainId
    ? originalToInserted.get(params.captainId)?.id
    : undefined;
  const substituteTargets = (params.substituteIds ?? [])
    .map((id) => originalToInserted.get(id)?.id)
    .filter((id): id is string => Boolean(id));

  const relationPayload = params.players
    .map((player, orderIndex) => {
      const inserted = originalToInserted.get(player.id);
      if (!inserted) {
        return null;
      }
      return {
        squad_id: squadId,
        player_id: inserted.id,
        order_index: orderIndex,
        is_captain: captainTarget ? captainTarget === inserted.id : false,
        is_substitute: substituteTargets.includes(inserted.id),
        source_team_id: player.sourceTeamId ?? null,
        source_player_id: player.sourcePlayerId ?? null,
        updated_at: new Date().toISOString(),
      };
    })
    .filter((item) => item !== null);

  if (relationPayload.length > 0) {
    const { error: relationError } = await supabase
      .from(TEAM_SQUAD_PLAYERS_TABLE)
      .insert(relationPayload);
    if (relationError) {
      return { ok: false as const, error: relationError.message };
    }
  }

  const { error: updateCaptainError } = await supabase
    .from(TEAM_SQUADS_TABLE)
    .update({
      captain_player_id: captainTarget ?? null,
      substitute_player_ids: substituteTargets,
      updated_at: new Date().toISOString(),
    })
    .eq("id", squadId);

  if (updateCaptainError) {
    return { ok: false as const, error: updateCaptainError.message };
  }

  return { ok: true as const };
};

export const fetchTeamsWithSquad = async () => {
  if (!supabase) {
    return { ok: false as const, error: "Supabase not configured." };
  }
  const user = await getAuthUser();
  if (!user) {
    return { ok: false as const, error: "Not authenticated." };
  }

  const { data: teamRows, error: teamError } = await supabase
    .from(TEAMS_TABLE)
    .select("id, owner_id, name, club_logo, created_at, updated_at")
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false });

  if (!teamError && (teamRows ?? []).length > 0) {
    const teams = await buildTeamsFromRows((teamRows ?? []) as TeamRow[]);
    return { ok: true as const, teams };
  }

  if (teamError) {
    return { ok: false as const, error: teamError.message };
  }

  return { ok: true as const, teams: [] as SquadPreset[] };
};

export const createTeamWithSquad = async (payload: {
  name: string;
  squad: Squad;
}) => {
  if (!supabase) {
    return { ok: false as const, error: "Supabase not configured." };
  }
  const user = await getAuthUser();
  if (!user) {
    return { ok: false as const, error: "Not authenticated." };
  }

  const now = new Date().toISOString();
  const { data: team, error: teamError } = await supabase
    .from(TEAMS_TABLE)
    .insert({
      owner_id: user.id,
      name: payload.name,
      club_logo: payload.squad.clubLogo ?? null,
      updated_at: now,
    })
    .select("id, owner_id, name, club_logo, created_at, updated_at")
    .single();

  if (teamError || !team) {
    return { ok: false as const, error: teamError?.message ?? "Could not create team." };
  }

  await supabase
    .from(TEAM_MEMBERS_TABLE)
    .upsert(
      {
        team_id: team.id,
        user_id: user.id,
        role: "owner",
      },
      { onConflict: "team_id,user_id" }
    );

  const saveSquad = await createOrReplaceTeamSquad({
    teamId: team.id,
    squadName: payload.squad.name || payload.name,
    kit: payload.squad.kit,
    players: payload.squad.players,
    captainId: payload.squad.captainId,
    substituteIds: payload.squad.substituteIds,
  });

  if (!saveSquad.ok) {
    return saveSquad;
  }

  const teams = await buildTeamsFromRows([team as TeamRow]);
  if (teams.length === 0) {
    return { ok: false as const, error: "Could not fetch saved team." };
  }

  return { ok: true as const, team: teams[0] };
};

export const updateTeamWithSquad = async (payload: {
  id: string;
  name?: string;
  squad?: Squad;
}) => {
  if (!supabase) {
    return { ok: false as const, error: "Supabase not configured." };
  }
  const user = await getAuthUser();
  if (!user) {
    return { ok: false as const, error: "Not authenticated." };
  }

  const { data: team, error: teamError } = await supabase
    .from(TEAMS_TABLE)
    .select("id, owner_id, name, club_logo, created_at, updated_at")
    .eq("id", payload.id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (teamError) {
    return { ok: false as const, error: teamError.message };
  }
  if (!team) {
    return { ok: false as const, error: "Team not found." };
  }

  const teamUpdate: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (payload.name) {
    teamUpdate.name = payload.name;
  }
  if (payload.squad?.clubLogo !== undefined) {
    teamUpdate.club_logo = payload.squad.clubLogo ?? null;
  }

  const { error: teamUpdateError } = await supabase
    .from(TEAMS_TABLE)
    .update(teamUpdate)
    .eq("id", team.id)
    .eq("owner_id", user.id);

  if (teamUpdateError) {
    return { ok: false as const, error: teamUpdateError.message };
  }

  if (payload.squad) {
    const saveSquad = await createOrReplaceTeamSquad({
      teamId: team.id,
      squadName: payload.squad.name || payload.name || team.name,
      kit: payload.squad.kit,
      players: payload.squad.players,
      captainId: payload.squad.captainId,
      substituteIds: payload.squad.substituteIds,
    });
    if (!saveSquad.ok) {
      return saveSquad;
    }
  }

  const updatedTeams = await fetchTeamsByIds([team.id]);
  const teams = await buildTeamsFromRows(updatedTeams);
  const teamWithSquad = teams[0];
  if (!teamWithSquad) {
    return { ok: false as const, error: "Could not fetch updated team." };
  }

  return { ok: true as const, team: teamWithSquad };
};

export const deleteTeam = async (teamId: string) => {
  if (!supabase) {
    return { ok: false as const, error: "Supabase not configured." };
  }
  const user = await getAuthUser();
  if (!user) {
    return { ok: false as const, error: "Not authenticated." };
  }

  const { error } = await supabase
    .from(TEAMS_TABLE)
    .delete()
    .eq("id", teamId)
    .eq("owner_id", user.id);

  if (error) {
    return { ok: false as const, error: error.message };
  }

  return { ok: true as const };
};

export const listTeamPlayerCandidates = async (targetTeamId: string) => {
  if (!supabase) {
    return { ok: false as const, error: "Supabase not configured." };
  }
  const user = await getAuthUser();
  if (!user) {
    return { ok: false as const, error: "Not authenticated." };
  }

  const { data: teamsData, error: teamsError } = await supabase
    .from(TEAMS_TABLE)
    .select("id, name")
    .eq("owner_id", user.id)
    .neq("id", targetTeamId);

  if (teamsError) {
    return { ok: false as const, error: teamsError.message };
  }

  const sourceTeams = (teamsData ?? []) as Array<{ id: string; name: string }>;
  if (sourceTeams.length === 0) {
    return { ok: true as const, players: [] as Array<SquadPlayer & { teamId: string; teamName: string }> };
  }

  const { data: playersData, error: playersError } = await supabase
    .from(TEAM_PLAYERS_TABLE)
    .select("id, team_id, name, position_label, number, vest_color, photo_url")
    .in(
      "team_id",
      sourceTeams.map((team) => team.id)
    );

  if (playersError) {
    return { ok: false as const, error: playersError.message };
  }

  const teamNameById = new Map(sourceTeams.map((team) => [team.id, team.name]));
  const players = ((playersData ?? []) as TeamPlayerRow[]).map((player) => ({
    id: player.id,
    teamId: player.team_id,
    teamName: teamNameById.get(player.team_id) ?? "Other team",
    name: player.name,
    positionLabel: player.position_label,
    number: player.number ?? undefined,
    vestColor: player.vest_color ?? undefined,
    photoUrl: player.photo_url ?? undefined,
    sourceTeamId: player.team_id,
    sourcePlayerId: player.id,
  }));

  return { ok: true as const, players };
};

import { describe, expect, it } from "vitest";
import { buildTeamDirectory, mapLegacyPresetsToDirectory } from "./teamDirectory";
import type { SquadPreset } from "@/models";

describe("teamDirectory", () => {
  it("maps legacy squad presets into a fallback club structure", () => {
    const presets: SquadPreset[] = [
      {
        id: "preset-1",
        userId: "user-1",
        teamId: "team-1",
        teamName: "Team One",
        name: "Team One",
        createdAt: "2026-03-13T00:00:00.000Z",
        updatedAt: "2026-03-13T00:00:00.000Z",
        squad: {
          id: "squad-1",
          name: "Team One",
          kit: {
            shirt: "#111111",
            shorts: "#222222",
            socks: "#333333",
          },
          players: [
            {
              id: "player-1",
              name: "Player One",
              positionLabel: "CM",
            },
          ],
        },
      },
    ];

    const clubs = mapLegacyPresetsToDirectory(presets);

    expect(clubs[0]?.name).toBe("My teams");
    expect(clubs[0]?.teams[0]?.squad.players[0]?.name).toBe("Player One");
  });

  it("builds club/team/member hierarchy from new schema rows", () => {
    const clubs = buildTeamDirectory({
      currentUserId: "user-1",
      clubMemberships: [
        {
          club_id: "club-1",
          club_role: "staff",
          is_club_admin: true,
          clubs: {
            id: "club-1",
            name: "Club One",
            slug: "club-one",
            logo_url: null,
            status: "active",
            kit_shirt: "#111111",
            kit_shirt_secondary: "#222222",
            kit_shorts: "#333333",
            kit_socks: "#444444",
            kit_vest: "#555555",
            kit_jersey_type: "sash",
          },
        },
      ],
      teams: [
        {
          id: "team-1",
          club_id: "club-1",
          name: "Team One",
          slug: "team-one",
          team_type: "boys",
          age_group: "U17",
          season_label: "2026",
          status: "active",
          club_logo: null,
          kit_shirt: null,
          kit_shirt_secondary: null,
          kit_shorts: null,
          kit_socks: null,
          kit_vest: null,
          kit_jersey_type: null,
        },
      ],
      teamMembers: [
        {
          id: "member-1",
          team_id: "team-1",
          user_id: "user-1",
          display_name: "Head Coach",
          team_role: "leader",
          team_position: "head_coach",
          is_team_admin: true,
          is_guest: false,
          is_active: true,
          shirt_number: null,
          photo_url: null,
          sort_order: 0,
        },
        {
          id: "member-2",
          team_id: "team-1",
          user_id: null,
          display_name: "Goalkeeper",
          team_role: "player",
          team_position: "goalkeeper",
          is_team_admin: false,
          is_guest: false,
          is_active: true,
          shirt_number: 1,
          photo_url: null,
          sort_order: 1,
        },
      ],
    });

    expect(clubs[0]?.isCurrentUserClubAdmin).toBe(true);
    expect(clubs[0]?.teams[0]?.isCurrentUserTeamAdmin).toBe(true);
    expect(clubs[0]?.teams[0]?.squad.players[0]).toMatchObject({
      teamMemberId: "member-2",
      name: "Goalkeeper",
      positionLabel: "goalkeeper",
      number: 1,
    });
    expect(clubs[0]?.teams[0]?.squad.kit).toMatchObject({
      shirt: "#111111",
      shirtSecondary: "#222222",
      shorts: "#333333",
      socks: "#444444",
      vest: "#555555",
      jerseyType: "sash",
    });
  });
});

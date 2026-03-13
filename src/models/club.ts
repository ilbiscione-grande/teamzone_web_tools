import type { Squad } from "./squad";

export type TeamDirectoryMember = {
  id: string;
  userId?: string | null;
  displayName: string;
  memberRole: string;
  teamPosition?: string | null;
  isTeamAdmin: boolean;
  isGuest: boolean;
  isActive: boolean;
  shirtNumber?: number | null;
  photoUrl?: string | null;
  sortOrder: number;
};

export type TeamDirectoryTeam = {
  id: string;
  clubId: string;
  name: string;
  slug?: string | null;
  teamType: string;
  ageGroup?: string | null;
  seasonLabel?: string | null;
  status: string;
  squad: Squad;
  members: TeamDirectoryMember[];
  isCurrentUserTeamAdmin: boolean;
};

export type TeamDirectoryClub = {
  id: string;
  name: string;
  slug?: string | null;
  logoUrl?: string | null;
  status: string;
  membershipRole: string;
  isCurrentUserClubAdmin: boolean;
  teams: TeamDirectoryTeam[];
};

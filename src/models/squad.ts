export type JerseyType = "solid" | "split" | "stripe" | "sash" | "pinstripe";

export type SquadPlayer = {
  id: string;
  teamMemberId?: string;
  name: string;
  positionLabel: string;
  guest?: boolean;
  active?: boolean;
  number?: number;
  vestColor?: string;
  photoUrl?: string;
  sourceTeamId?: string;
  sourceTeamName?: string;
  sourcePlayerId?: string;
};

export type SquadKit = {
  shirt: string;
  shirtSecondary?: string;
  shorts: string;
  socks: string;
  vest?: string;
  jerseyType?: JerseyType;
};

export type Squad = {
  id: string;
  name: string;
  clubLogo?: string;
  kit: SquadKit;
  players: SquadPlayer[];
  captainId?: string;
  substituteIds?: string[];
};

export type SquadPreset = {
  id: string;
  userId: string;
  teamId?: string;
  teamName?: string;
  name: string;
  squad: Squad;
  createdAt: string;
  updatedAt: string;
};

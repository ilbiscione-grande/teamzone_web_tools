export type SquadPlayer = {
  id: string;
  name: string;
  positionLabel: string;
  number?: number;
  vestColor?: string;
  photoUrl?: string;
};

export type SquadKit = {
  shirt: string;
  shirtSecondary?: string;
  shorts: string;
  socks: string;
  vest?: string;
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
  name: string;
  squad: Squad;
  createdAt: string;
  updatedAt: string;
};

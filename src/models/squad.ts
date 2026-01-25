export type SquadPlayer = {
  id: string;
  name: string;
  positionLabel: string;
  number?: number;
  vestColor?: string;
};

export type SquadKit = {
  shirt: string;
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
};

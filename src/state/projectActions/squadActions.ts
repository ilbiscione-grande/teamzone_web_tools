import type { StateCreator } from "zustand";
import type { ProjectStore } from "./types";
import type { Squad, SquadPlayer } from "@/models";
import { createId } from "@/utils/id";

export const createSquadActions: StateCreator<ProjectStore, [], []> = (
  set
) => ({
  addSquad: (name) => {
    set((state) => {
      if (!state.project) {
        return;
      }
      state.project.squads.push({
        id: createId(),
        name,
        clubLogo: undefined,
        kit: {
          shirt: "#e24a3b",
          shorts: "#0f1b1a",
          socks: "#f06d4f",
        },
        players: [],
      });
      state.project.updatedAt = new Date().toISOString();
    });
  },
  addSquadWithData: (squad) => {
    set((state) => {
      if (!state.project) {
        return;
      }
      state.project.squads.push(squad);
      state.project.updatedAt = new Date().toISOString();
    });
  },
  updateSquad: (squadId, payload: Partial<Squad>) => {
    set((state) => {
      const squad = state.project?.squads.find((item) => item.id === squadId);
      if (!squad) {
        return;
      }
      Object.assign(squad, payload);
      if (state.project) {
        state.project.updatedAt = new Date().toISOString();
      }
    });
  },
  addSquadPlayer: (squadId, player: SquadPlayer) => {
    set((state) => {
      const squad = state.project?.squads.find((item) => item.id === squadId);
      if (!squad) {
        return;
      }
      squad.players.push(player);
      if (state.project) {
        state.project.updatedAt = new Date().toISOString();
      }
    });
  },
  updateSquadPlayer: (squadId, playerId, payload) => {
    set((state) => {
      const squad = state.project?.squads.find((item) => item.id === squadId);
      const player = squad?.players.find((item) => item.id === playerId);
      if (!player) {
        return;
      }
      Object.assign(player, payload);
      if (state.project) {
        state.project.updatedAt = new Date().toISOString();
      }
    });
  },
  removeSquadPlayer: (squadId, playerId) => {
    set((state) => {
      const squad = state.project?.squads.find((item) => item.id === squadId);
      if (!squad) {
        return;
      }
      squad.players = squad.players.filter((item) => item.id !== playerId);
      if (state.project) {
        state.project.updatedAt = new Date().toISOString();
      }
    });
  },
});

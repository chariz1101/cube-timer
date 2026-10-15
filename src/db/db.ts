import Dexie, { type Table } from "dexie";

export type Penalty = "+2" | "DNF";

export interface Solve {
  id?: number;
  time: number;        // milliseconds
  scramble: string;
  event: string;        // e.g. "333"
  date: number;          // timestamp
  penalty?: Penalty | null;
  synced?: boolean;      // for Supabase sync tracking
}

export class CubeTimerDB extends Dexie {
  solves!: Table<Solve, number>;

  constructor() {
    super("CubeTimerDB");
    this.version(1).stores({
      solves: "++id, event, date, synced",
    });
  }
}

export const db = new CubeTimerDB();
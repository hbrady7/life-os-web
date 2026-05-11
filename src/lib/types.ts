export type Goal = {
  id: string;
  text: string;
  done: boolean;
};

export type ListItem = {
  id: string;
  text: string;
};

export type LifeOSData = {
  dayType: string;
  reminder: string;
  goals: Goal[];
  planTomorrow: ListItem[];
  wins: ListItem[];
  struggles: ListItem[];
  /** ISO date stamp for the day this snapshot belongs to. */
  date: string;
};

export const STORAGE_KEY = "life-os:v1";

export const defaultData = (): LifeOSData => ({
  dayType: "",
  reminder: "Midday — keep moving",
  goals: [],
  planTomorrow: [],
  wins: [],
  struggles: [],
  date: new Date().toISOString().slice(0, 10),
});

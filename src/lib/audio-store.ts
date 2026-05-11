"use client";

import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "life-os-audio";
const STORE = "audio";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      },
    });
  }
  return dbPromise;
}

export async function saveAudio(key: string, blob: Blob): Promise<void> {
  const db = await getDb();
  await db.put(STORE, blob, key);
}

export async function getAudio(key: string): Promise<Blob | undefined> {
  const db = await getDb();
  return db.get(STORE, key);
}

export async function deleteAudio(key: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE, key);
}

export async function clearAllAudio(): Promise<void> {
  const db = await getDb();
  await db.clear(STORE);
}

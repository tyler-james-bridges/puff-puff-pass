import { PostgresStore } from "../../src/store/postgres-store.mjs";
import { createDbClient } from "../../src/store/db-client.mjs";

let storePromise: Promise<any> | null = null;

export function getStore(): Promise<any> {
  if (!storePromise) {
    storePromise = (async () => {
      const db = await createDbClient();
      const store = new PostgresStore(db);
      await store.init();
      return store;
    })().catch((error) => {
      storePromise = null;
      throw error;
    });
  }
  return storePromise;
}

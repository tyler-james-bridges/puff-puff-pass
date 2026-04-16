import { createApp } from "../src/server.mjs";

let appPromise;

export default async function handler(req, res) {
  if (!appPromise) appPromise = createApp();
  const app = await appPromise;
  return app(req, res);
}

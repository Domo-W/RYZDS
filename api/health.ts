import { healthInfo } from "../server/canvas.js";

export function GET(): Response {
  return Response.json(healthInfo());
}

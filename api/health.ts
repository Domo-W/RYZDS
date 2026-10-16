import { healthInfo } from "../server/canvas";

export function GET(): Response {
  return Response.json(healthInfo());
}

import {
  isIsoDate,
  validateDose,
  validateEvent,
  validateLogPatch,
  validateNote,
  validateScope,
  validateSettings,
  type Result,
} from "../src/domain/validate";
import {
  addDose,
  addEvent,
  addNote,
  addScope,
  deleteById,
  deleteLog,
  getSettings,
  listDoses,
  listEvents,
  listLogs,
  listNotes,
  listScopes,
  patchLog,
  putSettings,
  type IdTable,
} from "./db";
import type { ApiState } from "../src/domain/api";

export interface Context {
  db: D1Database;
  /** The signed-in caregiver. */
  email: string;
  params: Record<string, string>;
  /** The parsed JSON body, or `undefined` when it's missing or isn't JSON. */
  body: unknown;
}

type Handler = (ctx: Context) => Promise<Response>;

const json = (data: unknown, status = 200) => Response.json(data, { status });
const noContent = () => new Response(null, { status: 204 });
const notFound = () => json({ error: "Not found" }, 404);
const badDate = () =>
  json({ error: "Invalid", fields: { date: "Must be a date as YYYY-MM-DD" } }, 400);

/** A handler that deletes a row from `table` by the `:id` in the URL. */
const deleteFrom =
  (table: IdTable): Handler =>
  async ({ db, params }) => {
    const id = Number(params.id);
    if (!Number.isInteger(id)) return notFound();
    return (await deleteById(db, table, id)) ? noContent() : notFound();
  };

/** Runs `then` with the validated value, or returns a 400 naming the invalid fields. */
function valid<T>(result: Result<T>, then: (value: T) => Promise<Response>): Promise<Response> {
  return result.ok
    ? then(result.value)
    : Promise.resolve(json({ error: "Invalid", fields: result.errors }, 400));
}

export const routes: Record<string, Handler> = {
  "GET /api/state": async ({ db }) =>
    json({
      settings: await getSettings(db),
      logs: await listLogs(db),
      notes: await listNotes(db),
      doses: await listDoses(db),
      scopes: await listScopes(db),
      events: await listEvents(db),
    } satisfies ApiState),

  "PUT /api/settings": async ({ db, body }) =>
    valid(validateSettings(body), async (settings) => {
      await putSettings(db, settings);
      return json(settings);
    }),

  "PATCH /api/logs/:date": async ({ db, email, params, body }) => {
    if (!isIsoDate(params.date)) return badDate();
    return valid(validateLogPatch(body), async (patch) =>
      json(await patchLog(db, params.date!, patch, email)),
    );
  },

  "DELETE /api/logs/:date": async ({ db, params }) => {
    if (!isIsoDate(params.date)) return badDate();
    return (await deleteLog(db, params.date)) ? noContent() : notFound();
  },

  "POST /api/notes": async ({ db, email, body }) =>
    valid(validateNote(body), async (note) => json(await addNote(db, note, email), 201)),

  "DELETE /api/notes/:id": deleteFrom("day_notes"),

  "POST /api/doses": async ({ db, email, body }) =>
    valid(validateDose(body), async (dose) => {
      const settings = await getSettings(db);
      if (!settings) return json({ error: "Set up the dose schedule first" }, 409);
      return json(await addDose(db, dose, settings.intervalDays, email), 201);
    }),

  "DELETE /api/doses/:id": deleteFrom("doses"),

  "POST /api/scopes": async ({ db, body }) =>
    valid(validateScope(body), async (scope) => json(await addScope(db, scope), 201)),

  "DELETE /api/scopes/:id": deleteFrom("scopes"),

  "POST /api/events": async ({ db, email, body }) =>
    valid(validateEvent(body), async (event) => json(await addEvent(db, event, email), 201)),

  "DELETE /api/events/:id": deleteFrom("events"),
};

/** Finds the handler for a request, filling `params` from `:name` segments in the route. */
export function match(
  method: string,
  pathname: string,
): { handler: Handler; params: Record<string, string> } | null {
  const parts = pathname.split("/");
  for (const [key, handler] of Object.entries(routes)) {
    const [routeMethod, routePath] = key.split(" ") as [string, string];
    const routeParts = routePath.split("/");
    if (routeMethod !== method || routeParts.length !== parts.length) continue;

    const params: Record<string, string> = {};
    const matches = routeParts.every((part, i) => {
      if (part.startsWith(":")) {
        params[part.slice(1)] = decodeURIComponent(parts[i]!);
        return true;
      }
      return part === parts[i];
    });
    if (matches) return { handler, params };
  }
  return null;
}

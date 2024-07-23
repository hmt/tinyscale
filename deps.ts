export { deferred } from "https://deno.land/std/async/mod.ts";
export type { Deferred } from "https://deno.land/std/async/mod.ts";
export { join } from "https://deno.land/std/path/mod.ts";
export { createHash } from "https://deno.land/std/hash/mod.ts";
export * as Color from "https://deno.land/std/fmt/colors.ts";
export { HttpError } from "https://deno.land/x/http_error@0.7.0/mod.ts";
export { opine, Router } from "https://deno.land/x/opine@2.3.4/mod.ts";
export type { ErrorRequestHandler, Request, ParamsDictionary } from "https://deno.land/x/opine@2.3.4/mod.ts";
export const secret: string = Deno.env.get("TINYSCALE_SECRET") || ""
export interface server { host: string; secret: string };
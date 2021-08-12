export { deferred } from "https://deno.land/std/async/mod.ts";
export type { Deferred } from "https://deno.land/std/async/mod.ts";
export { join } from "https://deno.land/std/path/mod.ts";
export { createHash } from "https://deno.land/std/hash/mod.ts";
export * as Color from "https://deno.land/std/fmt/colors.ts";
export { createError } from "https://deno.land/x/http_errors@3.0.0/mod.ts";
export { opine, Router } from "https://deno.land/x/opine@1.7.1/mod.ts";
export type { ErrorRequestHandler, Request, ParamsDictionary } from "https://deno.land/x/opine@1.7.1/mod.ts";
export const secret: string = Deno.env.get("TINYSCALE_SECRET") || ""
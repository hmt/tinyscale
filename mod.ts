import { Color, secret } from './deps.ts'

const VERSION = 'v1.6.4'
// give your tinyscale server a secret so it looks like a BBB server
if (!secret) throw "No secret set for tinyscale"
console.log(Color.green(`Starting tinyscale ${VERSION} on Deno ${Deno.version.deno}`))
console.log(`Your secret is set to ${Color.green(secret)}`)

import app from "./app.ts";
// Get the PORT from the environment variables and store in Opine.
const port = parseInt(Deno.env.get("PORT") ?? "3005");
app.set("port", port);

// Get the DENO_ENV from the environment variables and store in Opine.
const env = Deno.env.get("DENO_ENV") ?? "development";
app.set("env", env);

// Start our Opine server on the provided or default port.
app.listen(port, () => console.log(`listening on port ${port}`));

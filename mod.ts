import app from "./app.ts";

// Get the PORT from the environment variables and store in Opine.
const port = parseInt(Deno.env.get("PORT") ?? "3000");
app.set("port", port);

// Get the DENO_ENV from the environment variables and store in Opine.
const env = Deno.env.get("DENO_ENV") ?? "development";
app.set("env", env);

// Start our Opine server on the provided or default port.
app.listen(port, () => console.log(`listening on port ${port}`));

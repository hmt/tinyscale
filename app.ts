import { createError, opine } from "./deps.ts";
import { ErrorRequestHandler, Router, server } from "./deps.ts";
import { BBB } from './bbb.ts';

// give your tinyscale server a secret so it looks like a BBB server
const secret = Deno.env.get("TINYSCALE_SECRET") || ""
if (!secret) throw "No secret set for tinyscale"

// store your BBB servers in servers.json
const file: string = await Deno.readTextFile('servers.json')
const servers: server[] = JSON.parse(file)
// create an iterator so that we can trat all servers equally
let iterator = servers[Symbol.iterator]();
console.log(servers)

// pick the next server, using an iterator to cycle through all servers available
function get_available_server(): server {
  let candidate = iterator.next()
  if (candidate.done) {
    iterator = servers[Symbol.iterator]()
    candidate = iterator.next()
  }
  console.log(`Using next server ${candidate.value.host}`)
  return candidate.value;
}

const router = Router()
// the api itself answering to every call
router.get("/bigbluebutton/api/:call", async (req, res, next) => {
  const handler = new BBB(req)
  if (!handler.authenticated(secret)) {
    res.setStatus(401).end()
    return
  }
  let server: server
  try {
    server = await handler.find_meeting_id(servers)
  } catch (e) {
    console.log(`Found no server with Meeting ID ${handler.meeting_id}`)
    server = get_available_server()
  }
  console.log(`Redirecting to ${server.host}`)
  res.redirect(handler.rewritten_query(server))
});
// the fake answering machine to make sure we are recognized as a proper api
router.get("/bigbluebutton/api", (req, res, next) => {
  console.log('sending fake xml response')
  res.set('Content-Type', 'text/xml');
  res.send(`<response>
<returncode>SUCCESS</returncode>
<version>2.0</version>
</response>`);
})

const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  // Set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};
  // Render the error page
  res.setStatus(err.status ?? 500);
  console.log(err, req)
  res.send(err);
};
const app = opine()
            .use("/", router)
            .use((req, res, next) => { next(createError(404)); })
            .use(errorHandler);

export default app;

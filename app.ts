import { createError, opine, ErrorRequestHandler, Router, server, createHash } from "./deps.ts";
import { BBB } from './bbb.ts';

// give your tinyscale server a secret so it looks like a BBB server
const secret = Deno.env.get("TINYSCALE_SECRET") || ""
if (!secret) throw "No secret set for tinyscale"

// store your BBB servers in servers.json
const file: string = await Deno.readTextFile('servers.json')
const servers: server[] = JSON.parse(file)
// create an iterator so that we can treat all servers equally
let iterator = servers[Symbol.iterator]();
console.log(servers)
console.log('Checking servers first …')
// check servers for connectivity and if the secret is correct
servers.forEach(async s => {
  const hash = createHash("sha1");
  hash.update(`getMeetings${s.secret}`)
  try {
    // throw an error if cannot connect or if secret fails
    const res = await fetch(`${s.host}/bigbluebutton/api/getMeetings?checksum=${hash.toString()}`)
    if (!res.ok) throw "Connection error. Please check your host configuration"
    const body = await res.text()
    const ok = body.includes('SUCCESS')
    console.log(`${s.host} is ${ok ? 'ok':'misconfigured. Please check your secret in servers.json'}`)
    if (!ok) throw "Configuration error. Exiting …"
  } catch (e) {
    // exit tinyscale if an error is encountered in servers.json
    console.log(e)
    Deno.exit(1);
  }
})

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
router.all("/bigbluebutton/api/:call", async (req, res, next) => {
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
  res.setStatus(err.status ?? 500);
  console.log(res.status, req.originalUrl)
  res.end();
};

const app = opine()
            .use("/", router)
            .use((req, res, next) => { next(createError(404)); })
            .use(errorHandler);

export default app;

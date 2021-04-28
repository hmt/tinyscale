import { opine, ErrorRequestHandler, Router, createHash, server, createError, Color } from "./deps.ts";
import { BBB } from './bbb.ts';

const date = () => new Date().toLocaleTimeString('de')
const VERSION = 'v1.5.0'
// give your tinyscale server a secret so it looks like a BBB server
const secret: string = Deno.env.get("TINYSCALE_SECRET") || ""
if (!secret) throw "No secret set for tinyscale"
const tinyscale_strict: boolean = Deno.env.get("TINYSCALE_STRICT") === 'false' ? false : true
console.log(date() + Color.green(` Starting tinyscale ${VERSION} in ${tinyscale_strict ? 'strict':'loose'} mode`))
console.log(`Your secret is set to ${Color.green(secret)}`)

// store your BBB servers in servers.json
const file: string = await Deno.readTextFile('servers.json')
const servers: server[] = JSON.parse(file)
// create an iterator so that we can treat all servers equally
let iterator = servers[Symbol.iterator]();
console.log('Checking servers first …')
console.log(servers)
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
    console.log(`${s.host} is ${ok ? Color.green('ok') : Color.red('misconfigured. Please check your secret in servers.json')}`)
    if (!ok) throw "Configuration error. Exiting …"
  } catch (e) {
    // exit tinyscale if an error is encountered in servers.json
    console.log(Color.brightRed(e))
    Deno.exit(1);
  }
})
let current_server: server
get_available_server()
// pick the next server, using an iterator to cycle through all servers available
function get_available_server(): server {
  let candidate = iterator.next()
  if (candidate.done) {
    iterator = servers[Symbol.iterator]()
    candidate = iterator.next()
  }
  console.log(`Using next server ${Color.green(candidate.value.host)}`)
  current_server = candidate.value;
  return current_server
}

const router = Router()
// the api itself answering to every call
router.all("/:call", async (req, res, next) => {
  const handler = new BBB(req)
  console.log(`${date()} New call to ${Color.green(handler.call)}`)
  if (!handler.authenticated(secret)) {
    console.log(`${Color.red("Rejected incoming call to "+handler.call)}`)
    next(createError(401))
    return
  }
  let server: server
  try {
    server = await handler.find_meeting_id(servers)
  } catch (e) {
    console.log(`Found no server with Meeting ID ${Color.yellow(handler.meeting_id)}`)
    if (handler.call === 'create' && tinyscale_strict) get_available_server()
    server = current_server
  }
  console.log(`Redirecting to ${server.host}`)
  const redirect = handler.rewritten_query(server)
  if (handler.call === 'join') {
    res.redirect(redirect)
  } else {
    try {
      const data = await fetch(redirect)
      const body = await data.text()
      res.set('Content-Type', 'text/xml');
      res.send(body)
    } catch (e) {
      next(createError(500))
    }
  }
});
// the fake answering machine to make sure we are recognized as a proper api
router.get("/", (req, res, next) => {
  console.log('sending fake xml response')
  res.set('Content-Type', 'text/xml');
  res.send(`<response>
<returncode>SUCCESS</returncode>
<version>2.0</version>
</response>`);
})

const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  res.setStatus(err.status ?? 500);
  res.end();
  console.log(`${Color.red(`${res.status}`)} ${req.originalUrl}`)
};

const app = opine()
  .use("/bigbluebutton/api", router)
  .use((req, res, next) => next(createError(404)))
  .use(errorHandler);

export default app;
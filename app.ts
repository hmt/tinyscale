import { createError, opine } from "./deps.ts";
import { ErrorRequestHandler, Router, Request, ParamsDictionary } from "./deps.ts";
import { createHash } from "https://deno.land/std@0.87.0/hash/mod.ts";

interface server { host: string; secret: string }

// store your BBB servers in servers.json
const file: string = await Deno.readTextFile('servers.json')
const servers: server[] = JSON.parse(file)

// create an iterator so that we can trat all servers equally
let iterator = servers[Symbol.iterator]();
console.log(servers)

// give your tinyscale server a secret so it looks like a BBB server
const secret = Deno.env.get("TINYSCALE_SECRET") || ""
if (!secret) throw "No secret set for tinyscale"

const router = Router()

// check if request is autheticated with correct checksum
function authenticated(req: Request<ParamsDictionary, any, any>): boolean {
  const hash = createHash("sha1");
  const checksum = req.query.checksum
  const query = req._parsedUrl?.query
  hash.update(`${req.params.call}${query?.replace(/[?|&]checksum.*$/, secret)}`);
  const hashInHex = hash.toString();
  return hashInHex === checksum
}
// pick the next server
function get_available_server(): server {
  // simple server selection, just cycle through all servers available
  let candidate = iterator.next()
  if (candidate.done) {
    iterator = servers[Symbol.iterator]()
    candidate = iterator.next()
  }
  return candidate.value;
}
function gen_checksum(call: string, query: string, secret: string): string {
  const hash = createHash("sha1");
  console.log(`${call}${query}${secret}`)
  hash.update(`${call}${query}${secret}`);
  return hash.toString();
}
// fetch a getMeetingInfo from all available servers and see if meeting exists
async function find_server(id: string): Promise<server> {
  if (!id) return get_available_server()
  const promises = servers.map(async s => {
    const checksum = gen_checksum(`getMeetingInfo`, `meetingID=${id}`, s.secret)
    const res = await fetch(`${s.host}/bigbluebutton/api/getMeetingInfo?meetingID=${id}&checksum=${checksum}`)
    if (!res.ok) throw Error
    const text = await res.text()
    if (text.includes(id)) return s
    else throw Error
  })
  try {
    // if any of the responses resolves it is our server
    const server = await Promise.any(promises)
    console.log("RES: ", server)
    // use that server for our response
    return server
  } catch (e) {
    console.log("Kein Server gefunden")
    return get_available_server()
  }
}
// redirect api call to proper BBB Server
function rewrite_api_call(req: Request<ParamsDictionary, any, any>, server: server) {
  const hash = createHash("sha1");
  const checksum = req.query.checksum
  const query = req._parsedUrl?.query
  hash.update(`${req.params.call}${query?.replace(/[?|&]checksum.*$/g, server.secret)}`);
  const hashInHex = hash.toString();
  return `${server.host}/${req.originalUrl.replace(checksum, hashInHex)}`
}

// the api itself answering to every call
router.get("/bigbluebutton/api/:call", async (req, res, next) => {
  console.log("Calling: ", req.params.call)
  if (!authenticated(req)) {
    res.setStatus(401).end()
    console.log('rejected')
    return
  }
  const meeting_id: string = req.query.meetingID;
  const server: server = await find_server(meeting_id)
  const url = rewrite_api_call(req, server)
  console.log(url)
  res.redirect(url)
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

const app = opine();

// Mount our routers
app.use("/", router);

// catch 404 and forward to error handler
app.use((req, res, next) => {
  next(createError(404));
});

// Error handler
const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  // Set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // Render the error page
  res.setStatus(err.status ?? 500);
  console.log(err, req)
  res.send(err);
};

app.use(errorHandler);

export default app;

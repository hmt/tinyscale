import { opine, ErrorRequestHandler, Router, secret, createError, Color, deferred, Deferred } from "./deps.ts";
import { BBB } from './bbb.ts';
import { Servers, server } from './servers.ts'

const date = () => new Date().toLocaleTimeString('de')

const S = new Servers()
await S.init()
let queue: Record<string, Deferred<string>> = {}

const router = Router()
router.use((req, res, next)=> {
  res.set('Content-Type', 'text/xml')
  next()
});
// check authentication via checksum
router.use(":call", (req, res, next) => {
  const handler = new BBB(req)
  const authenticated = handler.authenticated(secret)
  console.log(`${date()} New call to ${Color.green(handler.call)} ${authenticated ? Color.red('Rejected'):''}`)
  if (authenticated) { 
    res.locals.handler = handler
    next()
  } else {
    next(createError(401))
  }
})
// if the param is call, check for races
router.all('/create', async (req, res, next) => {
  const meeting_id = req.query.meetingID
  const existing_id = queue[meeting_id]
  if (existing_id) {
    console.log(`Race pending for meeting-ID: ${Color.red(meeting_id)}`)
    await existing_id
  }
  queue[meeting_id] = deferred<string>();
  next()
})
// the api itself answering to every call
router.all("/:call", async (req, res, next) => {
  const handler = res.locals.handler
  let server: server
  try {
    server = await handler.find_meeting_id(S.servers)
  } catch (e) {
    console.log(`Found no server with Meeting ID ${Color.yellow(handler.meeting_id)}`)
    if (handler.call === 'create') { S.get_available_server() }
    server = S.current_server
  }
  console.log(`Redirecting to ${server.host}`)
  const redirect = handler.rewritten_query(server)
  if (handler.call === 'join') {
    res.redirect(redirect)
  } else {
    try {
      const data = await fetch(redirect)
      const body = await data.text()
      if (handler.call === 'create') { queue[handler.meeting_id]?.resolve(body); delete queue[handler.meeting_id] }
      res.send(body)
    } catch (e) {
      if (handler.call === 'create') { queue[handler.meeting_id]?.resolve(e); delete queue[handler.meeting_id] }
      next(createError(500))
    }
  }
});
// the fake answering machine to make sure we are recognized as a proper api
router.get("/", (req, res, next) => {
  res.send(`<response><returncode>SUCCESS</returncode><version>2.0</version></response>`);
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
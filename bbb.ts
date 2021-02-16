import { Request, ParamsDictionary, server } from "./deps.ts";
import { createHash } from "https://deno.land/std@0.87.0/hash/mod.ts";

export class BBB {
  call: string
  checksum_incoming: string
  query: string
  params: string
  meeting_id: string
  url: string

  constructor (req: Request<ParamsDictionary, any, any>) {
    this.call = req.params.call
    this.checksum_incoming = req.query.checksum
    this.query = req._parsedUrl?.query || ""
    this.params = this.query.replace(/[?|&]checksum.*$/, '')
    this.meeting_id = req.query.meetingID
    this.url = req.originalUrl
    console.log(`New call to ${this.call}`)
  }
  // generate a checksum for various calls
  generate_checksum = (secret: string, call: string = this.call, params: string = this.params) => {
    const hash = createHash("sha1");
    hash.update(`${call}${params}${secret}`)
    return hash.toString()
  }
  // generate a url to check if meeting is available
  check_for_meeting_query = (server: server) => {
    const checksum = this.generate_checksum(server.secret, 'getMeetingInfo', `meetingID=${this.meeting_id}`)
    return `${server.host}/bigbluebutton/api/getMeetingInfo?meetingID=${this.meeting_id}&checksum=${checksum}`
  }
  // write new query for target bbb server
  rewritten_query = (server: server) => {
    const checksum_outgoing = this.generate_checksum(server.secret)
    return `${server.host}/${this.url.replace(this.checksum_incoming, checksum_outgoing)}`
  }
  // check if request is autheticated with correct checksum
  authenticated = (secret: string) => {
    const checksum = this.generate_checksum(secret)
    console.log(`Rejected incoming call to ${this.call}`)
    return checksum === this.checksum_incoming
  }
  find_meeting_id = (servers: server[]): Promise<server> => {
    if (!this.meeting_id) throw Error
    const promises = servers.map(async s => {
      const res = await fetch(this.check_for_meeting_query(s))
      if (!res.ok) throw Error
      const text = await res.text()
      if (text.includes(this.meeting_id)) return s
      else throw Error
    })
    return Promise.any(promises)
  }
}
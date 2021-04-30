import { createHash, Color } from "./deps.ts";
export interface server { host: string; secret: string };

export class Servers {
  servers: server[]
  iterator!: IterableIterator<server>
  current_server!: server

  constructor() {
    this.servers = []
  }
  async init(): Promise<server[]> {
    // store your BBB servers in servers.json
    const file: string = await Deno.readTextFile('servers.json')
    this.servers = JSON.parse(file)
    // create an iterator so that we can treat all servers equally
    this.iterator = this.servers[Symbol.iterator]();
    this.check()
    this.get_available_server()
    return this.servers
  }
  check(): void {
    console.log('Checking servers first …')
    console.log(this.servers)
    // check servers for connectivity and if the secret is correct
    this.servers.forEach(async s => {
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
  }
  // pick the next server, using an iterator to cycle through all servers available
  get_available_server(): server {
    let candidate = this.iterator.next()
    if (candidate.done) {
      this.iterator = this.servers[Symbol.iterator]()
      candidate = this.iterator.next()
    }
    this.current_server = candidate.value;
    return this.current_server
  }
}
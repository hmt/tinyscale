import SERVERS from './servers.json' with { type: 'json' };

import { crypto } from "@std/crypto"; 
import { encodeHex } from "@std/encoding"
import { red, green, yellow } from "@std/fmt/colors";

const SECRET = Deno.env.get("TINYSCALE_SECRET");
const _port = Deno.env.get("PORT");
const PORT = _port ? parseInt(_port) : undefined;
const VERSION = 'v2.0.2'

if (SECRET === undefined)
	throw "No `TINYSCALE_SECRET` set. tinyscale will exit.";

if (SERVERS.length === 0)
	throw "There are no servers listed in `servers.json`";

const date = () => new Date().toLocaleTimeString('de');
const queue: Map<string, Promise<unknown>> = new Map();

class Server {
	host: string;
	#secret: string;
	static listServer: Server[] = [];

	static #currentServerIndex = 0;

	static get currentServer() {
		return Server.listServer[Server.#currentServerIndex];
	}

	constructor(host: string, secret: string) {
		this.host = host;
		this.#secret = secret;
		this.test().then(_ => Server.listServer.push(this)).catch(_ => Deno.exit(1));
	}

	static getNextServer() {
		Server.#currentServerIndex++;
		if (Server.#currentServerIndex === Server.listServer.length)
			Server.#currentServerIndex = 0;
		return Server.listServer[Server.#currentServerIndex];
	}

	static async hashCreate(params: string) {
		const hash = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(params));
		return encodeHex(hash);
	}

	static splitURL(url: URL) {
		// entferne `/bigbluebutton/api/`
		const call = url.pathname.slice(19);
		const params = url.search.replace('?', '').replace(/[?&]?checksum.*$/, '');
		return { call, params };
	}

	static async checkAuthenticated(url: URL) {
		const checksum = url.searchParams.get('checksum');
		if (checksum === null)
			return false;
		const { call, params } = Server.splitURL(url);
		const hash = await Server.hashCreate(`${call}${params}${SECRET}`);
		return hash === checksum;
	}

	async urlCreate(call: string, params = "") {
		const hash = await Server.hashCreate(`${call}${params}${this.#secret}`);
		return new URL(`${this.host}/${call}?${params}${params === '' ? '' : '&'}checksum=${hash}`);
	}

	async getResponse(query: string, params = "") {
		const url = await this.urlCreate(query, params);
		const res = await fetch(url);
		if (!res.ok)
			throw "Connection error. Please check your host configuration";
		const body = await res.text();
		return body;
	}

	async test() {
		try {
			const res = await this.getResponse('getMeetings');
			const ok = res.includes('SUCCESS');
			if (!ok)
				throw Error;
			console.log(`${this.host} is ${green('ok')}`);
		} catch (e) {
			console.log(`${this.host} is ${red('misconfigured. Please check your secret in servers.json')}`);
			throw e;
		}
	}
}

SERVERS.forEach(server => new Server(server.host, server.secret));

Deno.serve({ port: PORT,
	onListen({ port, hostname }) {
		console.log(green(`Starting tinyscale ${VERSION} on Deno ${Deno.version.deno}`));
		console.log(`Your secret is set to ${green(SECRET)}`);
		console.log(`API available at ${green(`http://${hostname}:${port}/bigbluebutton/api/`)}`);
		console.log();
		console.log(`Running tests on ${SERVERS.length} host${SERVERS.length === 1 ? '':'s'}:`);
	}}, async (req) => {
	const url = new URL(req.url);
	const { call, params } = Server.splitURL(url);
	const { promise, resolve } = Promise.withResolvers();
	let log = `${date()} `;

	// voicemail if just looking for a life sign from the server
	if (url.pathname === '/bigbluebutton/api/' || url.pathname === '/bigbluebutton/')
		return new Response("<response><returncode>SUCCESS</returncode><version>2.0</version></response>", { headers: { "content-type": "text/xml" } });

	// check the checksum and fail if not true
	const authenticated = await Server.checkAuthenticated(url);
	if (!authenticated) {
		log = log + red(`401: ${url.pathname}`);
		return new Response("<response><returncode>FAILED</returncode><messageKey>checksumError</messageKey><message>Checksums do not match</message></response>",
			{ status: 401, headers: { "content-type": "text/xml" } });
	}

	// if there's a meeting/recording id, find the server which has it
	let selectedServer: Server | undefined;
	const meetingID = url.searchParams.get('meetingID');
	const recordingID = url.searchParams.get('recordingID');
	if (meetingID !== null) {
		if (call === 'create') {
			// if there's a request for the same room creation, wait for it
			if (queue.has(meetingID)) {
				console.log(`Race pending for meeting-ID: ${red(meetingID)}`);
				await queue.get(meetingID);
			}
			queue.set(meetingID, promise);
		}
		for (const server of Server.listServer) {
			const meetings = await server.getResponse('getMeetings');
			if (meetings.includes(meetingID)) {
				selectedServer = server;
				break;
			}
		}
	}
	else if (recordingID !== null)
		for (const server of Server.listServer) {
			const recordings = await server.getResponse('getRecordings');
			if (recordings.includes(recordingID)) {
				selectedServer = server;
				break
			}
		}
	log = log + `${green(`${call}`)} found, reply with`;

	if (call === 'create' && selectedServer === undefined && meetingID !== null) {
		selectedServer = Server.getNextServer();
		console.log(date()+' '+green('create')+' '+yellow('not found')+", opening a new room on "+green(selectedServer.host));
		const body = await selectedServer.getResponse('create', params);
		resolve(meetingID);
		queue.delete(meetingID);
		return new Response(body, { headers: { "content-type": "text/xml" } });
	} else if (call === 'create' && meetingID !== null) {
		resolve(meetingID);
		queue.delete(meetingID);
	}
	if (selectedServer === undefined)
		selectedServer = Server.currentServer;
	log = log + ' ' + selectedServer.host;
	console.log(log);

	// return the new URL to the real BBB server
	const newURL = await selectedServer.urlCreate(call, params);
	return Response.redirect(newURL);
})
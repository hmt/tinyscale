import servers from './servers.json' with { type: 'json' };

import { crypto } from "https://deno.land/std@0.224.0/crypto/mod.ts"; 
import { encodeHex } from "https://deno.land/std@0.224.0/encoding/hex.ts"
import { red, green, yellow } from "https://deno.land/std@0.115.1/fmt/colors.ts";

const secret = Deno.env.get("TINYSCALE_SECRET");
const _port = Deno.env.get("PORT");
const port = _port ? parseInt(_port) : undefined;

if (secret === undefined)
	throw "No `TINYSCALE_SECRET` set. tinyscale will exit.";

if (servers.length === 0)
	throw "There are no servers listed in `servers.json`";

class Server {
	host: string;
	#secret: string;
	#apiPrefix: string = "/api/";

	constructor(host: string, secret: string) {
		this.host = host;
		this.#secret = secret;
	}

	static async hashCreate(params: string) {
		const hash = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(params));
		return encodeHex(hash);
	}

	async urlCreate(call: string, params = "") {
		const hash = await Server.hashCreate(`${call}${params}${this.#secret}`);
		return new URL(`${this.host}${this.#apiPrefix}${call}?${params}${params === '' ? '' : '&'}checksum=${hash}`);
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
			console.log(`${this.host} is ${ok ? green('ok') : red('misconfigured. Please check your secret in servers.json')}`);
			if (!ok)
				throw Error;
		} catch (e) {
			throw e;
		}
	}
}

const listServer: Server[] = [];
const listTest = [];
const queue: Map<string, Promise<unknown>> = new Map();

for (const server of servers) {
	const s = new Server(server.host, server.secret);
	listTest.push(s.test());
	listServer.push(s);
}

let currentServerIndex = 0;
function getNextServer() {
	currentServerIndex++;
	if (currentServerIndex === listServer.length)
		currentServerIndex = 0;
	return listServer[currentServerIndex];
}

await Promise.allSettled(listTest).then(list => list.forEach(res => res.status === 'rejected' && Deno.exit(1)));

async function checkAuthenticated(url: URL) {
	const checksum = url.searchParams.get('checksum');
	if (checksum === null)
		return false;
	const call = url.pathname.slice(5);
	const params = url.search.replace('?', '').replace(/[?&]?checksum.*$/, '');
	const hash = await Server.hashCreate(`${call}${params}${secret}`);
	return hash === checksum;
}

Deno.serve({ port }, async (req) => {
	const url = new URL(req.url);
	const call = url.pathname.slice(5);
	const { promise, resolve } = Promise.withResolvers();
	let log = "";

	// voicemail if just looking for a life sign from the server
	if (url.pathname === '/' || url.pathname === '/api/')
		return new Response("<response><returncode>SUCCESS</returncode><version>2.0</version></response>");

	// check the checksum and fail if not true
	const authenticated = await checkAuthenticated(url);
	if (!authenticated) {
		log = red(`401: ${url.pathname}`);
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
		for (const server of listServer) {
			const meetings = await server.getResponse('getMeetings')
			if (meetings.includes(meetingID)) {
				selectedServer = server;
				break;
			}
		}
	}
	else if (recordingID !== null)
		for (const server of listServer) {
			const recordings = await server.getResponse('getRecordings')
			if (recordings.includes(recordingID))
				selectedServer = server;
		}
	log = `${green(`${call}`)} found, reply with`;

	const params = url.search.replace('?', '').replace(/[?&]?checksum.*$/, '');
	if (call === 'create' && selectedServer === undefined && meetingID !== null) {
		selectedServer = getNextServer();
		console.log(green('create')+' '+yellow('not found')+", opening a new room on "+green(selectedServer.host));
		const body = await selectedServer.getResponse('create', params);
		resolve(meetingID);
		queue.delete(meetingID);
		return new Response(body, { headers: { "content-type": "text/xml" } });
	} else if (call === 'create' && meetingID !== null) {
		resolve(meetingID);
		queue.delete(meetingID);
	}
	if (selectedServer === undefined)
		selectedServer = listServer[currentServerIndex];
	log = log + ' ' + selectedServer.host;
	console.log(log);

	// return the new URL to the real BBB server
	const newURL = await selectedServer.urlCreate(call, params);
	return Response.redirect(newURL);
})
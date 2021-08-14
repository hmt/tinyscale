# Tinyscale

**Warning, currently tinyscale is not compatible with Deno 1.13.x due to changes in Error handling. Please use 1.12.x instead until further notice.**

Depending on your requirements for BigBlueButton and your server capabilities you may need to host more than one instance of BigBlueButton to host meetings for your users. But as soon as you run more than one server you either need to split up servers for different endpoints, let's say one BBB server for Greenlight and another one for moodle, or you install a load balancer that decides for you where new meetings are set up and where users are routed to. If you only use one endpoint for all your meetings you will have to use a load balancer such as scalelite to run more than one BBB server.

While scalelite is a very good load balancer it also uses a lot of resources and is somewhat complicated to set up (ymmv). Since my resources were low and I could not affort to rent yet another server to run scalelite, I created tinyscale to solve the issue of load balancing multiple BBB instances.

tinyscale is called tinyscale because, well, it is tiny. It runs on low end hardware and some spare CPU cycles on on of your existing servers is enough to deploy it. It is a simple TypeScript application that runs on deno, the next generation of NodeJS.

## So, how does it work?
tinyscale offers a unified gateway to your set of BBB servers. Just like BBB you have to give your endpoint your tinyscale address and a secret and on the server side you have to give tinyscale a JSON file with your servers in it. tinyscale then checks to see if it can connect to your BBB servers and wait for incoming calls from your endpoint(s). If you send it a `create` request, i.e. you want to open a new meeting room, tinyscale checks if that room exists on any of the BBB servers. If it does it will return that server's reply to your endpoint. If a user wants to `join` a meeting tinyscale does the same again and checks if there is on any of the BBB servers a meeting with the incoming ID. If there is it will redirect the client to that server. If the meeting does not exist tinyscale will reply with the original reply of one of the connected servers.

The loadbalancing part is where a user wants to `create` a new room on a server which does not yet exist. When that happens tinyscale will send the request to the next server. So each time a new server is created the next server in the list of available servers is called to create the room and will accept all incoming users. There is no advanced number checking of rooms or participants or if your server is actually capable of serving more people. It just tries to create new rooms evenly on all servers. tinyscale does not know if your server is capable of serving that room or if there are too many people on the server. Just like BBB it will accept every request and forward it to the servers. As administrator you are still responsible to monitor the BBB servers and make sure they are capable of serving enough meetings for your users.

## Getting started
To get this load balancer to work you need a server that runs Deno. In most cases you should be ok to just run the installer script: https://deno.land/manual/getting_started/installation

Then create a `servers.json` file like this here:

```json
[
  {
    "host": "http://bbb1.schule.de",
    "secret": "secret_string"
  },
  {
    "host": "http://bbb2.schule.de",
    "secret": "secret_string"
  }
]
```

Now you are ready to start the script. Make sure to have an environment variable called `TINYSCALE_SECRET`:

    TINYSCALE_SECRET=some_secret_string deno run --allow-net --allow-read --allow-env https://deno.land/x/tinyscale@v1.6.1/mod.ts

tinyscale will then run on port 3005 and you will have to set up your reverse proxy so that it can pick up requests. If you prefer a different port you can set one with another env var: `PORT 3006`

When started, tinyscale will connect to each server and make a single call to check if your configuration is correct. If there is a problem tinyscale will abort. If your configuration works you can start using it in your environment by replacing your existing BBB settings with the new tinyscale url in your endpoints. Make sure to also replace the BBB secrets with your new `TINYSCALE_SECRET`.

tinyscale has been tested to work with NextCloud, Moodle and Greenlight. Let me know if it works with other endpoints as well.

## Caveats
* tinyscale does not combine requests like `getMeetings`. It will return the list of meetings from the current server (i.e. the last one used for creating a room).
* you cannot get recordings if the requests don't include the `meedingID` as part of the request query. Also you can't get a list of recordings since tinyscale only checks for `meetingID`s. So if you do request all recordings you will receive the list of the current server.

MIT Licensed

---

**This project uses BigBlueButton and is not endorsed or certified by BigBlueButton Inc. BigBlueButton and the BigBlueButton Logo are trademarks of BigBlueButton Inc.**

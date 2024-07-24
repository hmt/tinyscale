# Tinyscale

TLDR: tinyscale is a single file load balancing solution for BigBlueButton that
runs on deno.

Depending on your requirements for BigBlueButton and your server capabilities
you may need to host more than one instance of BigBlueButton to host meetings
for your users. But as soon as you run more than one server you either need to
split up servers for different endpoints, let's say one BBB server for
Greenlight and another one for moodle, or you install a load balancer that
decides for you where new meetings are set up and where users are routed to. If
you only use one endpoint for all your meetings you will have to use a load
balancer such as scalelite to run more than one BBB instance.

While scalelite is a very good load balancer it also uses a lot of resources and
is somewhat complicated to set up (ymmv). tinyscale aims to fill the niche for a
lightweight load balancing option that uses very little resources and keeps
things as simple as possible.

## So, how does it work?

tinyscale offers a unified gateway to your set of BBB servers. Just like BBB you
have to give your endpoint your tinyscale address and a secret and on the server
side you have to give tinyscale a JSON file with your servers in it. tinyscale
then checks to see if it can connect to your BBB servers and wait for incoming
calls from your endpoint(s).

If you send a request to tinyscale it checks basically for two things: is there
a BBB instance running that has the requested `meetingID` or `recordingID` and
then redirects your request to that instance. You will from then on communicate
directly with that instance.

In case the request is a `create` call and the `meetingID` doesn't yet exist
tinyscale will pick the next instance from the list of your BBB instances and
will create a new room on that instance. The response is then returned to your
endpoint.

Apart from that all incoming requests are checked for a valid checksum according
to BBB's own API. If an invalid checksum is found you will get an error
response.

The load balancing feature is basically a cycle through the available servers
with every room creation request where no room could be found on any of the
available instances.

## Getting started

To get this load balancer to work you need a server that runs Deno. In most
cases you should be ok to just run the installer script:
https://deno.land/manual/getting_started/installation

Then create a `servers.json` file like this here:

```json
[
  {
    "host": "http://bbb1.schule.de/bigbluebutton/api",
    "secret": "secret_string"
  },
  {
    "host": "http://bbb2.schule.de/bigbluebutton/api",
    "secret": "secret_string"
  }
]
```

Now you are ready to start the script. Make sure to have an environment variable
called `TINYSCALE_SECRET`:

    TINYSCALE_SECRET=some_secret_string deno run --allow-net --allow-env https://deno.land/x/tinyscale@v2.0.0/main.ts

tinyscale will then run on port 8000 and you will have to set up your reverse
proxy so that it can pick up requests. If you prefer a different port you can
set one with another env var: `PORT 3005`

When started, tinyscale will connect to each server and make a single call to
check if your configuration is correct. If there is a problem tinyscale will
abort. If your configuration works you can start using it in your environment by
replacing your existing BBB settings with the new tinyscale url in your
endpoints. Make sure to also replace the BBB secrets with your new
`TINYSCALE_SECRET`.

tinyscale has been battle tested to work with NextCloud, Moodle and Mattermost.

## Caveats

- tinyscale does not combine requests like `getMeetings`. It will return the
  list of meetings from the current server (i.e. the last one used for creating
  a room).

MIT Licensed

---

**This project uses BigBlueButton and is not endorsed or certified by
BigBlueButton Inc. BigBlueButton and the BigBlueButton Logo are trademarks of
BigBlueButton Inc.**

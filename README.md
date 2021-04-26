# Tinyscale

A very simple load balancer for BigBlueButton running on Deno

All this load balancer does is forward calls to a _real_ BBB-server if a meeting already exists. If you send a _create_ request for a new meeting and the meeting does not exist on any of the known BBB-servers it will cycle through the list of servers that are stored in `servers.json` and pick the next one. There is no advanced number checking of rooms or participants or if your server is actually capable of serving more people. It just tries to create new rooms evenly on all servers.

Since ended meetings are garbage collected by BBB this technique seems ok and straight forward. If there is a better way please open an issue or send a pull request.

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

Now you are ready to start the script with setting a port and a secret:

    TINYSCALE_SECRET=some_secret_string deno run --allow-net --allow-read --allow-env https://deno.land/x/tinyscale@v1.4.0/mod.ts

tinyscales then runs on port 3005 and you will have to set up your reverse proxy so that it can pick up requests or you leave it on that port. If you prefer a different port you can set one with another env-var: `PORT 3006`

When started, tinyscale will connect to each server and make a single call to check if your configuration is correct. If there is a problem tinyscale will abort. If your configuration works you can start using it in your environment by replacing your existing BBB settings with the new tinyscale url in your third party apps. Make sure to also replace the BBB secrets with your new `TINYSCALE_SECRET`.

If you set the additional env var `TINYSCALE_STRICT=true` you can have tinyscale only switch servers when called with a `create`. This may result in better server handling (ymmv).

tinyscale has been tested to work with NextCloud, Moodle and Greenlight.

If you want to use recordings they will work but you cannot get a list of all recordings. tinyscale will only respond with the next available server since it is a call to bbb without a `meetingID`. The same goes for the call to get infos on all meetings.

MIT Licensed

---

**This project uses BigBlueButton and is not endorsed or certified by BigBlueButton Inc. BigBlueButton and the BigBlueButton Logo are trademarks of BigBlueButton Inc.**

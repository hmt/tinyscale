# Tinyscale
A very simple load balancer for BigBlueButton running on Deno

All this load balancer does is forward calls to a _real_ BBB-server if a meeting already exists. If you send a _create_ request for a new meeting and the meeting does not exist on any of the known BBB-servers it will cycle through the list of servers that are stored in `servers.json` and pick the next one. There is no advanced number checking of rooms or participants or if your server is actually capable of serving more people. It just tries to create new rooms evenly on all servers.

Since ended meetings are garbage collected by BBB this technique seems ok and straight forward. If there is a better way please open an issue or send a pull request.

To get this load balancer to work you need a server that runs Deno. In most cases you should be ok to just run the installer script: https://deno.land/manual/getting_started/installation

Then clone this repository:

    git clone https://github.com/hmt/tinyscale.git
    cd tinyscale

edit servers.json (there is a servers.json.example) to your needs
and then start the script with a free port and a secret:
    
    PORT=3005 TINYSCALE_SECRET=some_secret_string deno run --allow-net --allow-read --allow-env --unstable mod.ts

Now tinyscales runs on port 3005 and you will have to set up your reverse proxy so that it can pick up requests or you leave it on that port.

Next you replace your existing BBB settings with the new tinyscale url in your third party apps.

tinyscale has been tested to work with NextCloud and Moodle.
It has only been tested with meetings. Since I don't use recordings I have no idea if they work or not.

__This is alpha software. Use at your own risk.__

MIT Licensed
___
__This project uses BigBlueButton and is not endorsed or certified by BigBlueButton Inc. BigBlueButton and the BigBlueButton Logo are trademarks of BigBlueButton Inc.__

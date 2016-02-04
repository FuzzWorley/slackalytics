# Slackalytics

Slackalytics is a textual analysis bot built in Node.js that allows for deeper custom analytics.

Created by [Nico Miceli](http://nicomiceli.com) and [Joe Zeoli](http://joezeoli.com)

Customized for RbND and expanded upon by Fuzz Worley and Jeff Donovan.


Change Log
------------

- Create a wrapper for Slacks realtime API using slackwrapi.
- Create user_list.json and use the realtime API to store data that isn't available via Outgoing Webhooks.
- Create scheduled task to update user information every hour.
- Customize post data to include user name and user email.

Config.json
------------
In order for this to work, you will need to create a file named "config.json" in the same directory. Your config.json file should look like this:

{
	"auth_key" : "<Your-slack-token>",
	"GA_UA" : "<Your-GA-token>"
}
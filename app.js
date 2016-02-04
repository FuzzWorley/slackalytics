//Set up Reqs
var express = require('express');
var bodyParser = require('body-parser');
var request = require('request');
var qs = require('querystring');
var slackWrapi = require('slack-wrapi');
var fs = require('fs');

var config = JSON.parse(fs.readFileSync(config.json))
console.log(config.auth_key + "   " + config.GA_UA)

var client = new slackWrapi(config.auth_key);

//Server Details
var app = express();
var port = process.env.PORT || 3000;

//Set Body Parser
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(bodyParser.json({ type: 'application/vnd.api+json' }));

//Functions
function updateEmailList(req, res){
	client.users.list(function(err, data) {
	  if (!err) {
	    var users = data;
	    var email = {}
	    users.members.forEach(function(member){ 
	    		email[member.name] = member.profile.email;
	    });
	    fs.writeFile('user_list.json', JSON.stringify(email));
	    console.log('User list updated.')
	  } else {
	  	console.log('Something is not right with me.');
	  };
	});
};

setInterval(updateEmailList, 360000)

//Routes
app.get('/', function(req, res){
	res.send('Hey! What are you doing here?');
});

app.get('/users', function(req, res){
	updateEmailList(req, res);
	res.send('You just manually updated the user list!')
});

app.post('/collect', function(req, res){
  
	var user_list = JSON.parse(fs.readFileSync('user_list.json'));

	var channel = {
		id: 	req.body.channel_id,
		name: 	req.body.channel_name
	};
	var user = {
		id: 	req.body.user_id,
		name:   req.body.user_name,
	};

	user.email = user_list[user.name]

	var msgText = req.body.text;
	var teamDomain = req.body.team_domain;


	function searchM(regex){
		var searchStr = msgText.match(regex);
		if(searchStr != null){
			return searchStr.length;
		}
		return 0;
	};

	function searchS(regex){
		var searchStr = msgText.split(regex);
		if(searchStr != undefined){
			return searchStr.length;
		}
		return 0;
	};


	var wordCount = searchS(/\s+\b/);
	var emojiCount = searchM(/:[a-z_0-9]*:/g);
	var exclaCount = searchM(/!/g);
	var elipseCount = searchM(/\.\.\./g);
	var questionMark = searchM(/\?/g);


	//Structure Data
	//cd = custom dimension
	//cm = custom metric
	//values line up with index in GA
	var data = {
		v: 		1,
		tid: 	config.GA_UA,
		cid: 	user.id,
		ds:  	"slack", //data source
		cs: 	"slack", // campaign source
		cd1: 	user.id,
		cd2: 	channel.name,
		cd3: 	user.name+"("+user.email+")",
		//cd4:  ,
		cd5:  msgText,
		cm1: 	wordCount,
		cm2: 	emojiCount,
		cm3: 	exclaCount,
		cm4: 	elipseCount, 
		cm5: 	questionMark,
		dh:		teamDomain+".slack.com",
		dp:		"/"+channel.name,
		dt:		"Slack Channel: "+channel.name,
		t: 		"event",
		ec: 	"slack: "+ channel.name + "|" + channel.id,
		ea: 	"post by " + user.id,
		el: 	msgText,
		ev: 	1 
	};
	console.log(JSON.stringify(data));
	console.log(req.body);

	//Make Post Request	
	request.post("https://www.google-analytics.com/collect?" + qs.stringify(data), 
	function(error, resp, body){
		console.log(error);
	});

	res.send("OK");
});

//Start Server
app.listen(port, function () {
	console.log('Listening on port ' + port); 
});

//Set up Reqs
var express = require('express');
var bodyParser = require('body-parser');
var request = require('request');
var qs = require('querystring');
var slackWrapi = require('slack-wrapi');
var fs = require('fs');
var Analytics = require('analytics-node');

//set up heroku environment variables
var env_var = {
	ga_key: process.env.GOOGLE_ANALYTICS_UAID,
	ga_test_key: process.env.GOOGLE_ANALYTICS_UAID_TEST,
	slack_token: process.env.SLACK_TOKEN,
	segment_key: process.env.SEGMENT_KEY
};

var client = new slackWrapi(env_var.slack_token);

var analytics = new Analytics(env_var.segment_key, { flushAt: 1 });

//Server Details
var app = express();
var port = process.env.PORT || 3000;

//Set Body Parser
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(bodyParser.json({ type: 'application/vnd.api+json' }));

//Functions

// function updateUserList(){
// 	client.users.list(function(err, data) {
// 	  if (!err) {
// 	    var users = data;
// 	    users.members.forEach(function(member){
// 		    analytics.identify({
// 		    	userId: member.id,
// 		    	traits: {
// 		    		username: member.name,
// 		    		email: member.profile.email,
// 		    		first_name: member.profile.first_name,
// 		    		last_name: member.profile.last_name,
// 		    		real_name: member.profile.real_name,
// 		    		skype: member.profile.skype,
// 		    		phone: member.profile.phone,
// 		    		is_admin: member.is_admin,
// 		    		deleted: member.deleted
// 		    	}
// 		    });
// 		  });
// 	    console.log('User list updated.');
// 	  } else {
// 	  	console.log('Something is not right with me.');
// 	  };
// 	});
// };

// setInterval(updateUserList, 3600000);

//Make Post Request	
function postRequest(data){
	request.post("https://www.google-analytics.com/collect?" + qs.stringify(data), 
	function(error, resp, body){
	console.log(error);
	});
};

function getDate(){
	var date = new Date();
  var dd = date.getDate();
  var mm = date.getMonth()+1; //January is 0!

  var yyyy = date.getFullYear();
  if(dd<10){
      dd='0'+dd
  } 
  if(mm<10){
      mm='0'+mm
  } 
  var date = parseInt(yyyy+mm+dd);
  return date;
}

function getTime(){
	var time = new Date();
	var hh = time.getHours();
	hh < 10 ? hh = "0" + hh : hh;
	var mm = time.getMinutes();
	mm < 10 ? mm = "0" + mm : mm;
	var time = parseInt(""+hh+mm);
	return time;
};

function getActivityCount(callbackfn){
	var user_list = JSON.parse(fs.readFileSync('user_list.json'));
  var num_users = user_list.members.length;
  //console.log(num_users);
	var activity_count = 0;
	var i = 0;
	user_list.members.forEach(function(member){
		client.users.getPresence({user: member.id}, function(err, data){
			data.presence === "active" ? activity_count += 1 : activity_count += 0;
			i += 1;
			//console.log(i);
			if (i == num_users) {
				callbackfn(activity_count);
			}
		});
	});
};

// var last_sent_at = 0;

// function sendActiveUser(activity_history){
// 	var active_users = 0;
// 	var last_entry = activity_history.counts[activity_history.counts.length -1];
// 	active_users += last_entry.active_users;
// 	last_sent_at = last_entry.time;
// 	return active_users;
// }	

function updateActivityHistory(){
	if (fs.existsSync('./activity_history.json')) {
		var activity_history = JSON.parse(fs.readFileSync('activity_history.json'));
	} else {
		var activity_history = { counts: [] };
	};

	getActivityCount(function(count) {

		activity_history.counts.push({
			date: getDate(),
			time: getTime(),
			active_users: count
		});
		fs.writeFileSync('activity_history.json', JSON.stringify(activity_history), {'flags': 'w+'});
		console.log(activity_history);
	});
	//return sendActiveUser(activity_history);
}

function updateUserList(){
	client.users.list(function(err, data) {
	  if (!err) {
	    var users = data;
	    var userlist_hash = {"members": []};
	    users.members.forEach(function(member){
	    	userlist_hash["members"].push({
	    		name: member.name,
	    		id: member.id,
	    		email: member.profile.email,
	    		real_name: member.profile.real_name
	    	});
	    });
	    fs.writeFileSync('user_list.json', JSON.stringify(userlist_hash), {'flags': 'w+'});
	    console.log('User list updated.');
	  } else {
	  	console.log('Something is not right with me.');
	  };
	});
};

updateUserList();
//updateActivityHistory();

setInterval(updateUserList, 3600000);
//setInterval(updateActivityHistory, 3600000);

//Routes
app.get('/', function(req, res){
	res.send('Hey! What are you doing here?');
});

app.get('/users', function(req, res){
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

	user.email = user_list[user.name];

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
		cid: 	user.id,
		tid:  env_var.ga_key,
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

	var test_data = data;
	//set test_data to send to the test analytics
	test_data.tid = env_var.ga_test_key;

	console.log(JSON.stringify(data));
	console.log(JSON.stringify(test_data));
	console.log(req.body);

	analytics.identify({
		userId: user.id,
		traits: {
			username: user.name,
			email: user.email
			// first_name: member.profile.first_name,
			// last_name: member.profile.last_name,
			// real_name: member.profile.real_name,
			// skype: member.profile.skype,
			// phone: member.profile.phone,
			// is_admin: member.is_admin,
			// deleted: member.deleted
		}
	});

	analytics.track({
	  userId: user.id,
	  event: 'Sent a Message',
	  properties: {
	  	username: user.name,
	  	email: user.email,
	  	channel: channel.name,
	    message: msgText,
	    wordCount: wordCount,
	    questionCount: questionMark,
	    emojiCount: emojiCount
	  }
	});

	postRequest(data);
	postRequest(test_data);

	res.send("OK");
});

//Start Server
app.listen(port, function () {
	console.log('Listening on port ' + port); 
});

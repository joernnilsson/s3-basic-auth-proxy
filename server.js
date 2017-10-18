"use strict"

var http = require('http');
var url = require('url');
var auth = require('basic-auth');
var dispatcher = require('httpdispatcher');
var Promise = require('promise');

const PORT=process.env.PORT || 8080; 


var AWS = require('aws-sdk');

AWS.config.region = process.env.S3_REGION;

var s3 = new AWS.S3({signatureVersion: 'v4'});



//Lets use our dispatcher
function handleRequest(request, response){
	var credentials = auth(request);
	  if (!credentials || credentials.name !== process.env.AUTH_USER || credentials.pass !== process.env.AUTH_PASSWORD) {
	    response.statusCode = 401
	    response.setHeader('WWW-Authenticate', 'Basic realm="S3Proxy"')
	    response.end('Access denied')
	    return;
	  } 
    try {
        console.log(request.url);
        dispatcher.dispatch(request, response);
    } catch(err) {
        console.log(err);
    }
}


dispatcher.onGet(/^\/server\/((\breleases\b)|(\bsnapshots\b))\/.*/, function(req, res) {

	let key = req.url.replace("/server/", "");
	console.log(key);

	s3.getSignedUrl('getObject', {
		Bucket: process.env.S3_BUCKET,
		Key: key
	  }, function(err, url){
		if(err){
	  		res.writeHead(500, {'Content-Type': 'text/plain'});
	  		res.end("S3 error");
	  		console.log(err);
		} else {
			res.writeHead(302, {
			  'Location': url
			});
			res.end();
		}
	});

});

dispatcher.onGet("/", function(req, res) {
	res.writeHead(200, {'Content-Type': 'text/html'});
	res.end("releases: <a href='/server/releases'>/server/releases</a><br>snapshots: <a href='/server/snapshots'>/server/snapshots</a>");
}); 

dispatcher.onGet("/server/releases", function(req, res) {
	getList("releases", req, res);
});    

dispatcher.onGet("/server/snapshots", function(req, res) {
	getList("snapshots", req, res);
});

function getList(type, req, res){
	s3.listObjects({
		Bucket: process.env.S3_BUCKET
	}, function(err, slist){
	  if (err){
	  	console.log(err, err.stack); // an error occurred
	  	res.writeHead(500, {'Content-Type': 'text/plain'});
	  	res.end("S3 error");
	  } else  {
	  	console.log(slist);
	  	res.writeHead(200, {'Content-Type': 'text/html'});
	  	let list = {snapshots: [], releases: []};
	  	
	  	let files = slist.Contents
		  	.filter(e => null != e.Key.match(/\w-(\d+)\.(\d+)\.(\d+)/))
		  	.map(e => {
		  		let data = {
		  			type: "",
		  			va: 0,
		  			va: 0,
		  			va: 0,
		  			date: new Date(),
		  			branch: "",
		  			key: e.Key,
		  			url: ""
		  		};

		  		data.type = e.Key.split("/")[0];

		  		let v = e.Key.match(/\w-(\d+)\.(\d+)\.(\d+)/);

		  		console.log(e.Key);
		  		data.va = v[1];
		  		data.vb = v[2];
		  		data.vc = v[3];

		  		if(data.type == "snapshots"){
		  			let a = e.Key.match(/\w-\d+\.\d+\.\d+\.(.*)\.(\d\d\d\d-\d\d-\d\d)\..*\.zip/);
		  			data.date = new Date(a[2]);
		  			data.branch = a[1]
		  		}else if(data.type == "releases"){

		  		}
		  		return data;
		  	})
		  	.filter(k => k.type == type)
		  	.sort((a, b) => {
		  		if (a.date > b.date) return -1
		  		else return 1
		  	}).map ( e => {

		  		return new Promise((resolve, reject) => {

		  			// Fetch signed url
					s3.getSignedUrl('getObject', {
						Bucket: process.env.S3_BUCKET,
						Key: e.key
					  }, function(err, url){
						if(err){
							console.log(err)
							// TODO fail properly
							e.url = "Error fetching url for "+e.key;
					  	} else {
					  		e.url = url;
						}
						resolve(e);
					});

		  		});
		   	});

	  	let plist = Promise.all(files);

	  	plist.then(list => {
	  		let str = list
	  			.map(k => "<a href='"+k.url+"'>" + k.key + "</a>")
	  			.join("<br />");
	  		res.end(str);
	  	}, err => {
	  		console.log(err)
	  		res.end(err);
	  	});
	  }
	});
}

//Create a server
var server = http.createServer(handleRequest);

//Lets start our server
server.listen(PORT, function(){
    //Callback triggered when server is successfully listening. Hurray!
    console.log("Server listening on port: %s", PORT);

    if(process.env.KEEPALIVE_URL){
    	let kurl = url.parse(process.env.KEEPALIVE_URL);
	    setInterval(() => {
	    	http.get({
	    		protocol: kurl.protocol,
		        host: kurl.hostname,
		        port: kurl.port,
		        path: kurl.path
		    });
	    }, 30*1000);
	}

});


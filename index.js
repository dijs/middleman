'use strict';

var express = require('express');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var request = require('request');
var uuid = require('uuid');
var prefixer = require('html-prefixer');
var injector = require('./injector');
var Url = require('url');

var mods = {};

var userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.8; rv:24.0) Gecko/20100101 Firefox/24.0';

var app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
	extended: true
}));
app.use(cookieParser());

var verbose = false;

function log(o) {
	if (verbose) {
		console.log(o);
	}
}

// TODO: Convert to jade for editing later...
app.use(express.static('./public'));

// TODO: Delete old cached pages every few mins
// TODO: Handle HTTPS also

// Web site testing tool is getting flagged by imperva (45.55.189.121)

// TODO: Add editing capability via /edit/:key ...

app.get('/*', function(req, res, next) {
	//console.log(req.path);
	//console.log(req.cookies['middleman-id']);
	if (req.path === '/' || req.path.indexOf('/view') === 0) {
		next();
	} else {
		// Proxying async dependencies
		// TODO: Check for errors here
		request({
			url: Url.resolve(mods[req.cookies['middleman-id']].url, req.path),
			headers: {
				'User-Agent': userAgent
			}
		}).pipe(res);
	}
});

// TODO: Fetch on save... that way the view is always sending cached data...

app.post('/save', function(req, res) {
	// TODO: Run URL through validator
	// TODO: Run CSS through validator
	// TODO: Set a max limit for URL, CSS, and JS
	var key = uuid.v4();
	mods[key] = {
		url: req.body.url,
		css: req.body.css || '',
		js: req.body.js || ''
	};
	res.redirect('view/' + key);
});

function fetch(mod, callback) {
	log('Fetching ' + mod.url);
	// Get URL stream
	var stream = request({
		url: mod.url,
		headers: {
			'User-Agent': userAgent
		}
	});
	// Inject styles
	if (mod.css) {
		stream = stream.pipe(injector('head', '<style type="text/css">\n' + mod.css + '\n</style>\n'));
	}
	// Inject script
	if (mod.js) {
		// TODO: head or body
		stream = stream.pipe(injector('head', '<script type=\"text/javascript\">\n' + mod.js + '\n<\/script>\n'));
	}
	// Modify relative URL paths in response
	prefixer(stream, {
		prefix: mod.url
	}, callback);
}

app.get('/view/:modKey', function(req, res, next) {
	var mod = mods[req.params.modKey];
	if (mod) {
		res.cookie('middleman-id', req.params.modKey);
		if (mod.cache) {
			log('Using cached version of ' + mod.url);
			// Might need to write headers...
			res.write(mod.cache);
			res.end();
		} else {
			fetch(mod, function(err, buffer) {
				if (err) {
					next(err);
				} else {
					mod.cache = buffer;
					res.write(mod.cache);
					res.end();
				}
			});
		}
	} else {
		next();
	}
});

var port = process.env.PORT || 3000;

app.listen(port, function() {
	console.log('Started on http://localhost:' + port);
});
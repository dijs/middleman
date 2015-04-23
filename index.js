'use strict';

var express = require('express');
var bodyParser = require('body-parser');
var request = require('request');
var uuid = require('uuid');
var prefixer = require('html-prefixer');
var injector = require('./injector');

var mods = {};

var app = express();

app.use(bodyParser.json());

app.use(bodyParser.urlencoded({
	extended: true
}));

var verbose = false;

function log(o) {
	if (verbose) {
		console.log(o);
	}
}

app.use(express.static('./public'));

// TODO: Delete old cached pages every few mins
// TODO: Handle HTTPS also

// Web site testing tool is getting flagged by imperva (45.55.189.121)

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
			'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.8; rv:24.0) Gecko/20100101 Firefox/24.0'
		}
	});
	// Inject styles
	if (mod.css) {
		stream = stream.pipe(injector('head', '<style type="text/css">\n' + mod.css + '\n</style>\n'));
	}
	// Inject script
	if (mod.js) {
		stream = stream.pipe(injector('body', '<script type=\"text/javascript\">\n' + mod.js + '\n<\/script>\n'));
	}
	// Modify relative URL paths in response
	prefixer(stream, {
		prefix: mod.url
	}, callback);
}

app.get('/view/:modKey', function(req, res, next) {
	var mod = mods[req.params.modKey];
	if (mod) {
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
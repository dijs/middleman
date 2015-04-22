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

app.use(express.static('./public'));

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

app.get('/view/:modKey', function(req, res, next) {
	var mod = mods[req.params.modKey];
	if (mod) {
		// Get URL stream
		var stream = request(mod.url);
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
			},
			function(err, buffer) {
				if (err) {
					next(err);
				} else {
					res.write(buffer);
					res.end();
					delete mods[req.params.modKey];
				}
			}
		);
	} else {
		next();
	}
});

var port = process.env.PORT || 3000;

app.listen(port, function() {
	console.log('Started on http://localhost:' + port);
});
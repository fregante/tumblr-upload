#!/usr/bin/env node
'use strict';
var fs           = require("fs");
var meow         = require('meow');
var logSymbols   = require('log-symbols');
var tumblrUpload = require('./');

var cli = meow({
	help: [
		'Examples',
		'  $ tumblr-upload index.html',
		'  '+logSymbols.success+' Uploaded',
		'',
		'Options',
		'  --credentials   Specify comma-separed credentials in this order: tumblrId,anonId,pfe,pfp,pfs,pfu',
		'',
		'Usage',
		'  Read more on: <tbp>',
	].join('\n')
});

if (!cli.input.length) {
	cli.showHelp();
}

var template;
var filename = cli.input.pop();
try {
	template = fs.readFileSync(filename, 'utf8');
} catch (e) {
	console.error(logSymbols.error, 'File', filename, 'not found');
	process.exit(1);
	return;
}

function callback (err, success) {
	if (err) {
		console.error(logSymbols.error, 'Failed to upload:', err);
		process.exit(1);
		return;
	}
	if (success) {
		console.log(logSymbols.success, 'Uploaded');
		process.exit(0);
	}
	console.warn('The unexpected happened. I don\'t know whether it was uploaded.');
}

try {
	if (cli.flags.credentials) {
		new tumblrUpload.Blog(cli.flags.credentials.split(','))
			.upload(template, callback);
	} else {
		tumblrUpload(template, callback);
	}
} catch (e) {
	console.error(logSymbols.error, e.message);
	process.exit(1);
}

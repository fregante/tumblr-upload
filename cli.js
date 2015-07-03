#!/usr/bin/env node
'use strict';
var fs           = require('fs');
var meow         = require('meow');
var logSymbols   = require('log-symbols');
var tumblrUpload = require('./');

var cli = meow({
	help: [
		'Examples',
		'  $ tumblr-upload blog-name index.html',
		'  '+logSymbols.success+' Uploaded',
		'',
		'Options',
		'  --credentials   Specify comma-separed credentials in this order: anon_id,pfe,pfp,pfs,pfu',
		'',
		'Usage',
		'  Read more on: <tbp>',
	].join('\n')
});

if (!cli.input.length) {
	cli.showHelp();
}

var template;
var blogName = cli.input[0];
var filename = cli.input[1];
if (typeof filename !== 'string') {
	console.error(logSymbols.error, 'You must supply a Tumblr ID and a filename');
	process.exit(1);
	return;
}
try {
	template = fs.readFileSync(filename, 'utf8');
} catch (e) {
	console.error(logSymbols.error, 'File', filename, 'not found');
	process.exit(1);
	return;
}

function callback (err) {
	if (err) {
		console.error(logSymbols.error, 'Failed to upload:', err);
		process.exit(1);
		return;
	}
	console.log(logSymbols.success, 'Uploaded');
	process.exit(0);
}

try {
	if (cli.flags.credentials) {
		cli.flags.credentials = blogName + ',' + cli.flags.credentials;
		new tumblrUpload.Blog(cli.flags.credentials.split(','))
			.upload(template, callback);
	} else {
		tumblrUpload(template, blogName, callback);
	}
} catch (e) {
	console.error(logSymbols.error, e.message);
	process.exit(1);
}

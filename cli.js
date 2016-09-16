#!/usr/bin/env node
'use strict';
const fs = require('fs');
const meow = require('meow');
const logSymbols = require('log-symbols');
const tumblrUpload = require('./');

const cli = meow({
	help: [
		'Examples',
		'  $ tumblr-upload blog-name index.html',
		'  ' + logSymbols.success + ' Uploaded',
		'',
		'Options',
		'  --credentials   Specify comma-separed credentials in this order: anon_id,pfe,pfp,pfs,pfu',
		'',
		'Usage',
		'  Read more on: <tbp>'
	].join('\n')
});

if (!cli.input.length) {
	cli.showHelp();
}

let template;
const blogName = cli.input[0];
const filename = cli.input[1];
if (typeof filename !== 'string') {
	console.error(logSymbols.error, 'You must supply a Tumblr ID and a filename');
	process.exit(1);
}
try {
	template = fs.readFileSync(filename, 'utf8');
} catch (err) {
	console.error(logSymbols.error, 'File', filename, 'not found');
	process.exit(1);
}

function callback(err) {
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
} catch (err) {
	console.error(logSymbols.error, err.message);
	process.exit(1);
}

/* global describe, it */
'use strict';

var WILL_VERIFY_UPLOAD = !!process.env.VERIFY_UPLOAD;

// process.env.DEBUG = 'nock.*';
var nock = require('nock');
var fsMock = require('mock-fs');
var fs = require('fs');

var tumblrUpload = require('../');
var http = require('http');
require('should');

var credentialsIni = {
	valid: fs.readFileSync('fixtures/tumblr-upload.ini', 'utf8'),
	incomplete: fs.readFileSync('fixtures/tumblr-upload-incomplete.ini', 'utf8'),
	invalid: fs.readFileSync('fixtures/tumblr-upload-invalid.ini', 'utf8'),
	empty: fs.readFileSync('fixtures/tumblr-upload-empty.ini', 'utf8'),
};

var credentials = {
	tumblr_id: 'ultrasweetnachostudent',
	user_form_key: 'zV6hVQTJ9VId6Bm1WLHZSTpJcE',
	anon_id: 'WRZLKTSEBTTHTFHXWTYCULNQBAESAAWS',
	pfe: '1443671682',
	pfp: 'Z6ejAQF9HmJgjGdp7dMtIOpPzLiY2hzYdF3JP6su',
	pfs: 'awsHPTIk3RDfGHQINHBJw8m4ilo',
	pfu: '179409735',
};

var credentialsArray = [
	credentials.tumblr_id,
	credentials.user_form_key,
	credentials.anon_id,
	credentials.pfe,
	credentials.pfp,
	credentials.pfs,
	credentials.pfu,
];

var wrongCredentialsArray = ',,,,,,,';

function getRandomTemplate () {
	return Math.random().toString().substr(2);
}
var randomTemplate = getRandomTemplate();

function verifyCredentials (blog) {
	if (!blog.pwd ||
			!blog.pwd.tumblr_id ||
			!blog.pwd.user_form_key ||
			!blog.pwd.anon_id ||
			!blog.pwd.pfe ||
			!blog.pwd.pfp ||
			!blog.pwd.pfs ||
			!blog.pwd.pfu) {
		throw Error('Some or all credentials were not set');
	}
}

function verifyUpload (blog, template, callback) {
	var tryCount = 0;
	function verify () {
		tryCount += 1;
		http.get({
				host: blog.pwd.tumblr_id + '.tumblr.com'
			}, function(response) {
			// Continuously update stream with data
			var body = '';
			response.on('data', function(d) {
				body += d;
			});
			response.on('end', function() {
				if (body.indexOf(template) < 0) {
					console.log('Try '+ tryCount +': The new template is not yet on Tumblr:', template);
					setTimeout(verify, tryCount < 10 ? 500 : 1500);
				} else {
					callback();
				}
			});
		});
	}
	verify();
}

function mockNextUpload (tumblr_id, response) {
	var call = nock('https://www.tumblr.com')
	           .post('/customize_api/blog/'+tumblr_id);
	if (response === false) {
		call.replyWithError('something awful happened');
	} else if (response) {
		call.reply(http, response);
	}
}

describe('tumblrUpload.Blog', function(){
	describe('new tumblrUpload.Blog()', function(){

		it('should error when credentials are missing', function(){
			(function () {
				new tumblrUpload.Blog();
			}).should.throw('Credentials missing or incomplete!');
		});

		it('should error when credentials are incomplete', function(){
			(function () {
				new tumblrUpload.Blog({
					tumblr_id: 'something',
					pfs: 'more',
					pfu: 'else',
				});
			}).should.throw('Credentials missing or incomplete!');
		});

		it('should set all credentials from an object', function(){
			var blog = new tumblrUpload.Blog(credentials);
			verifyCredentials(blog);
		});

		it('should set all credentials from an array', function(){
			var blog = new tumblrUpload.Blog(credentialsArray);
			verifyCredentials(blog);
		});
	});

	describe('instance.upload()', function(){
	  it('should error when the template is not specified', function(){
			(function () {
				var blog = new tumblrUpload.Blog(credentials);
				blog.upload();
			}).should.throw('The parameter `htmlTemplate` should be a string.');
	  });

	  it('should not error when a callback is not specified', function(){
			mockNextUpload(credentials.tumblr_id);
			var blog = new tumblrUpload.Blog(credentials);
			blog.upload(randomTemplate);
	  });

	  it('should upload successfully', function(done){
			var blog = new tumblrUpload.Blog(credentials);
			blog.upload(randomTemplate, function (err) {
				if (err) {
					throw err;
				}
				done();
			});
	  });

	  it('should fail to upload because of credentials', function(done){
			var blog = new tumblrUpload.Blog(wrongCredentialsArray);
			blog.upload(randomTemplate, function (err) {
				(function () {
					if (err) {
						throw err;
					}
				}).should.throw('Authentication failed');
				done();
			});
	  });

	  it('should detect unsupported server responses', function(done){
			mockNextUpload(credentials.tumblr_id, 'gibberish');
			var blog = new tumblrUpload.Blog(credentials);
			blog.upload(randomTemplate, function (err) {
				err.should.be.Error(); // somehow ".should.throw" fails here…
				done();
			});
	  });

	  it('should detect a network error', function(done){
			mockNextUpload(credentials.tumblr_id, false);
			var blog = new tumblrUpload.Blog(credentials);
			blog.upload(randomTemplate, function (err) {
				err.should.be.Error();
				done();
			});
	  });

	  if (WILL_VERIFY_UPLOAD) {
		  it('should upload successfully and Tumblr should show the new theme', function(done){
		  	this.timeout(30000);
				var blog = new tumblrUpload.Blog(credentials);
				var template = getRandomTemplate(); // need to generate a unique one
				blog.upload(template, function (err) {
					if (err) {
						throw err;
					}
					verifyUpload(blog, template, done);
				});
		  });
	  } else {
	  	it.skip('Actual upload verification is run with `npm run test-all`');
	  }

	});
});

describe('tumblrUpload()', function(){

	it('should error when the template is not specified', function(){
		(function () {
			tumblrUpload();
		}).should.throw('The parameter `htmlTemplate` should be a string.');
	});

	it('should error when the tumblr_id is not specified', function(){
		(function () {
			tumblrUpload(randomTemplate);
		}).should.throw('The parameter `tumblr_id` should be a string.');
	});

	it('should error when the config file is not found', function(){
		fsMock();
		(function () {
			tumblrUpload(randomTemplate, credentials.tumblr_id);
		}).should.throw(/^Credentials missing! I looked for tumblr-upload\.ini/);
		fsMock.restore();
	});

	function testIniFile (iniId, error, tumblr_id) {
		return function () {
			fsMock({
				'tumblr-upload.ini': credentialsIni[iniId]
			});
			(function () {
				tumblrUpload(randomTemplate, tumblr_id || 'lololol');
			}).should.throw(error);
			fsMock.restore();
		};
	}

	it('should error when the config file is empty',
		testIniFile('empty', /^Blog `[^`]+` doesn\'t exist in the config file/)
	);

	it('should error when the config file is invalid',
		testIniFile('invalid', /^Blog `[^`]+` doesn\'t exist in the config file/)
	);

	it('should error when the config file is incomplete',
		testIniFile('incomplete', /^Credentials incomplete/, 'ultrasweetnachostudent')
	);

	it('should error when the tumblr_id is not found in the config',
		testIniFile('valid', /^Blog `[^`]+` doesn\'t exist in the config file/)
	);

	it('should set all credentials from the ini file', function(){
		mockNextUpload(credentials.tumblr_id);
		fsMock({
			'tumblr-upload.ini': credentialsIni.valid
		});
		var blog = tumblrUpload(randomTemplate, credentials.tumblr_id);
		fsMock.restore();
		verifyCredentials(blog);
	});

});

/* global describe, it */
'use strict';

const WILL_VERIFY_UPLOAD = Boolean(process.env.VERIFY_UPLOAD);

// process.env.DEBUG = 'nock.*';
const fs = require('fs');
const http = require('http');
const nock = require('nock');
const fsMock = require('mock-fs');

const tumblrUpload = require('../');
require('should');

const credentialsIni = {
	valid: fs.readFileSync('fixtures/tumblr-upload.ini', 'utf8'),
	incomplete: fs.readFileSync('fixtures/tumblr-upload-incomplete.ini', 'utf8'),
	invalid: fs.readFileSync('fixtures/tumblr-upload-invalid.ini', 'utf8'),
	empty: fs.readFileSync('fixtures/tumblr-upload-empty.ini', 'utf8')
};

const credentials = {
	tumblr_id: 'ultrasweetnachostudent',
	user_form_key: 'zV6hVQTJ9VId6Bm1WLHZSTpJcE',
	anon_id: 'WRZLKTSEBTTHTFHXWTYCULNQBAESAAWS',
	pfe: '1443671682',
	pfp: 'Z6ejAQF9HmJgjGdp7dMtIOpPzLiY2hzYdF3JP6su',
	pfs: 'awsHPTIk3RDfGHQINHBJw8m4ilo',
	pfu: '179409735'
};

const credentialsArray = [
	credentials.tumblr_id,
	credentials.user_form_key,
	credentials.anon_id,
	credentials.pfe,
	credentials.pfp,
	credentials.pfs,
	credentials.pfu
];

const wrongCredentialsArray = ',,,,,,,';

function getRandomTemplate() {
	return Math.random().toString().substr(2);
}
const randomTemplate = getRandomTemplate();

function verifyCredentials(blog) {
	if (!blog.pwd ||
			!blog.pwd.tumblr_id ||
			!blog.pwd.user_form_key ||
			!blog.pwd.anon_id ||
			!blog.pwd.pfe ||
			!blog.pwd.pfp ||
			!blog.pwd.pfs ||
			!blog.pwd.pfu) {
		throw new Error('Some or all credentials were not set');
	}
}

function verifyUpload(blog, template, callback) {
	let tryCount = 0;
	function verify() {
		tryCount += 1;
		http.get({
			host: blog.pwd.tumblr_id + '.tumblr.com'
		}, response => {
			// Continuously update stream with data
			let body = '';
			response.on('data', d => {
				body += d;
			});
			response.on('end', () => {
				if (body.indexOf(template) < 0) {
					console.log('Try ' + tryCount + ': The new template is not yet on Tumblr:', template);
					setTimeout(verify, tryCount < 10 ? 500 : 1500);
				} else {
					callback();
				}
			});
		});
	}
	verify();
}

function mockNextUpload(tumblr_id, response) {
	const call = nock('https://www.tumblr.com')
		.post('/customize_api/blog/' + tumblr_id);
	if (response === false) {
		call.replyWithError('something awful happened');
	} else if (response) {
		call.reply(http, response);
	}
}

describe('tumblrUpload.Blog', () => {
	describe('new tumblrUpload.Blog()', () => {
		it('should error when credentials are missing', () => {
			(() => {
				return new tumblrUpload.Blog();
			}).should.throw('Credentials missing or incomplete!');
		});

		it('should error when credentials are incomplete', () => {
			(() => {
				return new tumblrUpload.Blog({
					tumblr_id: 'something',
					pfs: 'more',
					pfu: 'else'
				});
			}).should.throw('Credentials missing or incomplete!');
		});

		it('should set all credentials from an object', () => {
			const blog = new tumblrUpload.Blog(credentials);
			verifyCredentials(blog);
		});

		it('should set all credentials from an array', () => {
			const blog = new tumblrUpload.Blog(credentialsArray);
			verifyCredentials(blog);
		});
	});

	describe('instance.upload()', () => {
		it('should error when the template is not specified', () => {
			(() => {
				const blog = new tumblrUpload.Blog(credentials);
				blog.upload();
			}).should.throw('The parameter `htmlTemplate` should be a string.');
		});

		it('should not error when a callback is not specified', () => {
			mockNextUpload(credentials.tumblr_id);
			const blog = new tumblrUpload.Blog(credentials);
			blog.upload(randomTemplate);
		});

		it('should upload successfully', done => {
			const blog = new tumblrUpload.Blog(credentials);
			blog.upload(randomTemplate, err => {
				if (err) {
					throw err;
				}
				done();
			});
		});

		it('should fail to upload because of credentials', done => {
			const blog = new tumblrUpload.Blog(wrongCredentialsArray);
			blog.upload(randomTemplate, err => {
				(() => {
					if (err) {
						throw err;
					}
				}).should.throw('Authentication failed');
				done();
			});
		});

		it('should detect unsupported server responses', done => {
			mockNextUpload(credentials.tumblr_id, 'gibberish');
			const blog = new tumblrUpload.Blog(credentials);
			blog.upload(randomTemplate, err => {
				err.should.be.Error(); // somehow ".should.throw" fails here…
				done();
			});
		});

		it('should detect a network error', done => {
			mockNextUpload(credentials.tumblr_id, false);
			const blog = new tumblrUpload.Blog(credentials);
			blog.upload(randomTemplate, err => {
				err.should.be.Error();
				done();
			});
		});

		if (WILL_VERIFY_UPLOAD) {
			it('should upload successfully and Tumblr should show the new theme', function (done) {
				this.timeout(30000);
				const blog = new tumblrUpload.Blog(credentials);
				const template = getRandomTemplate(); // need to generate a unique one
				blog.upload(template, err => {
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

describe('tumblrUpload()', () => {
	it('should error when the template is not specified', () => {
		(() => {
			tumblrUpload();
		}).should.throw('The parameter `htmlTemplate` should be a string.');
	});

	it('should error when the tumblr_id is not specified', () => {
		(() => {
			tumblrUpload(randomTemplate);
		}).should.throw('The parameter `tumblr_id` should be a string.');
	});

	it('should error when the config file is not found', () => {
		fsMock();
		(() => {
			tumblrUpload(randomTemplate, credentials.tumblr_id);
		}).should.throw(/^Credentials missing! I looked for tumblr-upload\.ini/);
		fsMock.restore();
	});

	function testIniFile(iniId, error, tumblr_id) {
		return () => {
			fsMock({
				'tumblr-upload.ini': credentialsIni[iniId]
			});
			(() => {
				tumblrUpload(randomTemplate, tumblr_id || 'lololol');
			}).should.throw(error);
			fsMock.restore();
		};
	}

	it('should error when the config file is empty',
		testIniFile('empty', /^Blog `[^`]+` doesn't exist in the config file/)
	);

	it('should error when the config file is invalid',
		testIniFile('invalid', /^Blog `[^`]+` doesn't exist in the config file/)
	);

	it('should error when the config file is incomplete',
		testIniFile('incomplete', /^Credentials incomplete/, 'ultrasweetnachostudent')
	);

	it('should error when the tumblr_id is not found in the config',
		testIniFile('valid', /^Blog `[^`]+` doesn't exist in the config file/)
	);

	it('should set all credentials from the ini file', () => {
		mockNextUpload(credentials.tumblr_id);
		fsMock({
			'tumblr-upload.ini': credentialsIni.valid
		});
		const blog = tumblrUpload(randomTemplate, credentials.tumblr_id);
		fsMock.restore();
		verifyCredentials(blog);
	});
});

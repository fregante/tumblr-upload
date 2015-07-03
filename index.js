//@todo: cancel upload if a new upload is requested (debounce, but better)
//@todo: prevent upload if file is empty. tumblr will fail silently
'use strict';
var https = require('https');
var path = require('path');
var ini = require('iniparser');
var appRoots = [
	process.cwd(),
	path.dirname(require.main.filename),
	require('app-root-path'),
];

/**
 * Set tumblr account to accept future uploads
 * @param {object|array} c  Credentials to use, object or array in this order: tumblr_id, user_form_key, anon_id, pfe, pfp, pfs, pfu
 */
function Blog (c) {
	var blog = this;
	if (c && c.length === 7) {
		c = {
			tumblr_id:     c[0],
			user_form_key: c[1],
			anon_id:       c[2],
			pfe:           c[3],
			pfp:           c[4],
			pfs:           c[5],
			pfu:           c[6],
		};
	}
	if (!c || !c.tumblr_id || !c.user_form_key || !c.anon_id || !c.pfe || !c.pfp || !c.pfs || !c.pfu) {
		throw Error('Credentials missing! Use tumblr-upload.ini or specify them when calling upload()');
	}

	blog.pwd = c;
}

/**
 * Upload the specified template using the previously-specified credentials
 * @param  {string}   htmlTemplate  Tumblr template to upload
 * @param  {Function} callback      Function to call after the upload is done or has failed
 * @return {ClientRequest}          Node ClientRequest method, can be .abort()'ed
 */
Blog.prototype.upload = function (htmlTemplate, callback) {
	var pwd = this.pwd;
	var options = {
		host: 'www.tumblr.com',
		port: 443,
		path: '/customize_api/blog/'+pwd.tumblr_id,
		method: 'POST',
		headers: {
			'x-requested-with': 'XMLHttpRequest',
			'x-for-issues': 'https://github.com/bfred-it/tumblr-upload',
			'pragma': 'no-cache',
			'content-type': 'application/json',
			'accept': 'application/json, text/j avascript, */*; q=0.01',
			'cache-control': 'no-cache',
			'Cookie': 'logged_in=1; pfp='+pwd.pfp +'; pfs='+pwd.pfs +'; pfe='+pwd.pfe +'; pfu='+pwd.pfu + '; anon_id='+pwd.anon_id+';',
			'referer': 'https://www.tumblr.com/customize/'+pwd.tumblr_id+'?redirect_to=/blog/'+pwd.tumblr_id
		}
	};
	var httpBody = JSON.stringify({
		'custom_theme': htmlTemplate,
		'id': pwd.tumblr_id,
		'user_form_key': pwd.user_form_key
	});

	// do request
	var request = https.request(options, function (res) {
		if (!callback || !callback.call) {
			return;
		}
		var response = '';
		res.on('data', function (chunk) {
		  response += chunk;
		});
		res.on('end', function () {
			if (/Authentication required|permission/i.test(response)) {
				callback('Authentication failed');
			} else  {
				try {
					//verify that it's a valid json response
					JSON.parse(response);

					callback(false);
				} catch (e) {
					callback('Failed parsing of response: ' + response);
				}
			}
		});
	});

	if (callback && callback.call) {
		request.on('error', function(e) {
			callback(e.message);
		});
	}

	request.write(httpBody);
	request.end();
};


/**
 * Upload specified template and use the settings in tumblr-upload.ini file
 * @see  Blog.prototype.upload
 */
function uploadWithIniConfig (htmlTemplate, tumblrId, callback) {
	var c, paths = [];

	if (typeof htmlTemplate !== 'string') {
		throw new TypeError('The parameter `htmlTemplate` should be a string.');
	}
	if (typeof tumblrId !== 'string') {
		throw new TypeError('The parameter `tumblrId` should be a string.');
	}


	// try to load config file from all the possible paths
	appRoots.some(function (appRoot) {
		try {
			var filename = appRoot + '/tumblr-upload.ini';
			paths.push(path.dirname(filename));
			c = ini.parseSync(filename);
			return true;
		} catch (e) {}
	});

	// were the credentials found?
	if (!c) {
		throw Error('Credentials missing! Use tumblr-upload.ini or specify them when calling upload(). I looked for that file in:\n'+paths.join('\n'));
	}

	// pick the right blog
	c = c[tumblr_id];
	if (!c) {
		throw Error('Blog `'+tumblr_id+'` doesn\'t exist in the config file '+paths.pop());
	}
	c.tumblr_id = tumblr_id;

	// cheaply verify credentials
	if (!c.user_form_key || !c.anon_id || !c.pfe || !c.pfp || !c.pfs || !c.pfu) {
		throw Error('Credentials incomplete:' + JSON.stringify(c));
	}

	// upload template
	return new Blog(c).upload(htmlTemplate, callback);
}

module.exports = uploadWithIniConfig;
module.exports.Blog = Blog;

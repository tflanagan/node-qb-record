'use strict';

/* Dependencies */
const exec = require('child_process').exec;
const gulp = require('gulp');
const join = require('path').join;
const Promise = require('bluebird');

/* Constants */
const BABEL = join('.', 'node_modules', 'babel-cli', 'bin', 'babel.js');
const BROWSERIFY = join('.', 'node_modules', 'browserify', 'bin', 'cmd.js');
const MINIFY = join('.', 'node_modules', 'minify', 'legacy', 'bin', 'minify.js');

const SRC_FILE = join('.', 'QBRecord.js');
const ES5_FILE = join('.', 'QBRecord.es5.js');
const BROWSERIFY_FILE = join('.', 'QBRecord.browserify.js');
const MINIFIED_FILE = join('.', 'QBRecord.browserify.min.js');

/* Tasks */
gulp.task('build', () => {
	return new Promise((resolve, reject) => {
		exec([
			'node ' + BROWSERIFY + ' ' + SRC_FILE + ' > ' + BROWSERIFY_FILE,
			'node ' + BABEL + ' --presets es2015 ' + BROWSERIFY_FILE + ' > ' + ES5_FILE,
			'node ' + MINIFY + ' ' + ES5_FILE + ' > ' + MINIFIED_FILE,
			'rm ' + ES5_FILE,
			'rm ' + BROWSERIFY_FILE
		].join(' && '), (err, stdout, stderr) => {
			if (err)
				return reject(new Error(err));

			return resolve();
		});
	});
});

'use strict';

/* Dependencies */
const fs = require('fs');
const cp = require('child_process');
const gulp = require('gulp');
const path = require('path');
const Promise = require('bluebird');

/* Constants */
const BABEL = path.join('.', 'node_modules', 'babel-cli', 'bin', 'babel.js');
const BROWSERIFY = path.join('.', 'node_modules', 'browserify', 'bin', 'cmd.js');
const MINIFY = path.join('.', 'node_modules', 'minify', 'bin', 'minify.js');

const SRC_FILE = path.join('.', 'QBRecord.js');
const ES5_FILE = path.join('.', 'QBRecord.es5.js');
const BROWSERIFY_FILE = path.join('.', 'QBRecord.browserify.js');
const MINIFIED_FILE = path.join('.', 'QBRecord.browserify.min.js');

/* Helpers */
const browserify = () => {
	console.log('Running Browserify...');

	return new Promise((resolve, reject) => {
		cp.exec([
			'node ' + BROWSERIFY + ' ' + ES5_FILE + ' > ' + BROWSERIFY_FILE + '',
			'node ' + MINIFY + ' ' + BROWSERIFY_FILE + ' > ' + MINIFIED_FILE,
			'rm ' + BROWSERIFY_FILE
		].join(' && '), (err, stdout, stderr) => {
			if (err)
				return reject(new Error(err));

			console.log('Browserify Complete');

			resolve();
		});
	});
};

const es5 = () => {
	console.log('Running ES5 Translation...');

	return new Promise((resolve, reject) => {
		cp.exec('node ' + BABEL + ' --presets es2015 ' + SRC_FILE + ' > ' + ES5_FILE + '', (err, stdout, stderr) => {
			if (err)
				return reject(new Error(err));

			console.log('ES5 Translation Complete');

			resolve();
		});
	});
};

/* Tasks */
gulp.task('browserify', browserify);

gulp.task('build', () => {
	return es5().then(browserify);
});

gulp.task('es5', ['eslint'], es5);

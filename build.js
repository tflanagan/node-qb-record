#!/usr/bin/env node

/* Dependencies */
const fs = require('fs');
const minify = require('minify');
const execNode = require('child_process').exec;
const Browserify = require('browserify');
const { transpileModule } = require('typescript');

/* Helpers */
const browserify = async (files, options) => {
	return new Promise((resolve, reject) => {
		const b = new Browserify(files, options);

		b.bundle((err, src) => {
			if(err){
				return reject(err);
			}

			resolve(src);
		});
	});
};

const exec = async (cmd) => {
	return new Promise((resolve, reject) => {
		execNode(cmd, (err, stdout, stderr) => {
			if(err){
				err.stdout = stdout;
				err.stderr = stderr;

				return reject(err);
			}

			if(stderr && !stderr.match(/ExperimentalWarning/)){
				err = new Error('Command failed: ' + cmd);

				err.stdout = stdout;
				err.stderr = stderr;

				return reject(err);
			}

			resolve(stdout);
		});
	});
};

const readFile = async (path) => {
	return new Promise((resolve, reject) => {
		fs.readFile(path, (err, buffer) => {
			if(err){
				return reject(err);
			}

			resolve(buffer);
		});
	});
};

const writeFile = async (path, data) => {
	return new Promise((resolve, reject) => {
		fs.writeFile(path, data, (err) => {
			if(err){
				return reject(err);
			}

			resolve();
		});
	});
};

/* Build */
(async () => {
	try {
		let searchStr, searchRgx;

		console.log('Compiling TypeScript for Node...');
		await exec('npx tsc');

		console.log('Injecting Promise polyfill...');
		const source = await readFile('./dist/qb-record.js');

		searchStr = 'const deepmerge_1 =';
		searchRgx = new RegExp(searchStr);

		await writeFile('./dist/qb-record.prep.js', source.toString().replace(searchRgx, [
			'const Promise = require(\'bluebird\');',
			'if(!global.Promise){ global.Promise = Promise; }',
			searchStr
		].join('\n')));

		console.log('Browserify...');
		const browserifiedPrep = await browserify([
			'./dist/qb-record.prep.js'
		]);

		console.log('Compiling for Browser...');
		const browserified = transpileModule(browserifiedPrep.toString(), {
			compilerOptions: {
				target: 'ES5',
				module: 'commonjs',
				lib: [
					'dom',
					'ES6'
				],
				allowJs: true,
				checkJs: false,
				sourceMap: false,
				declaration: false,
				removeComments: true
			}
		});

		await writeFile('./dist/qb-record.browserify.js', browserified.outputText);

		console.log('Minify...');
		const results = await minify('./dist/qb-record.browserify.js');
		const license = await readFile('./LICENSE');

		searchStr = '1\\:\\[function\\(e,t,n\\)\\{\\(function\\(t\\)\\{\\"use strict\\";';
		searchRgx = new RegExp(searchStr);

		await writeFile('./dist/qb-record.browserify.min.js', results.toString().replace(searchRgx, [
			license.toString().split('\n').map((line, i, lines) => {
				line = ' * ' + line;

				if(i === 0){
					line = '\n/*!\n' + line;
				}else
				if(i === lines.length - 1){
					line += '\n*/';
				}

				return line;
			}).join('\n'),
			searchStr.replace(/\\/g, '')
		].join('\n')));

		console.log('Cleanup...');
		await exec([
			'rm ./dist/qb-record.prep.js',
			'rm ./dist/qb-record.browserify.js'
		].join(' && '));

		console.log('Done building.');
	}catch(err){
		console.error(err);
	}
})();

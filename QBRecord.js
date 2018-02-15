'use strict';

/* Versioning */
const VERSION_MAJOR = 1;
const VERSION_MINOR = 4;
const VERSION_PATCH = 11;

/* Dependencies */
const merge = require('lodash.merge');
const RFC4122 = require('rfc4122');
const QuickBase = require('quickbase');

/* Default Settings */
const defaults = {
	quickbase: {
		realm: typeof global !== 'undefined' && typeof window !== 'undefined' && global === window ? global.location.host.split('.')[0] : '',
		appToken: ''
	},

	dbid: (function(){
		if(typeof global !== 'undefined' && typeof window !== 'undefined' && global === window){
			var dbid = global.location.pathname.match(/^\/db\/(?!main)(.*)$/);

			if(dbid){
				return dbid[1];
			}
		}

		return '';
	})(),
	fids: {
		recordid: 3,
		primaryKey: 3
	},

	recordid: null,
	primaryKey: null
};

/* Main Class */
class QBRecord {

	constructor(options){
		this.className = QBRecord.className;

		this._data = {};
		this._dbid = '';
		this._fids = {};
		this._fields = [];
		this._meta = {};

		if(options && options.quickbase.className && options.quickbase.className === 'QuickBase'){
			this._qb = options.quickbase;

			delete options.quickbase
		}

		const settings = merge({}, QBRecord.defaults, options || {});

		this._rfc4122 = new RFC4122();

		this._id = this._rfc4122.v4();

		this.setDBID(settings.dbid)
			.setFids(settings.fids)
			.set('recordid', settings.recordid)
			.set('primaryKey', settings.primaryKey);

		if(!this._qb){
			this._qb = new QuickBase(settings.quickbase);
		}

		return this;
	}

	clear(){
		this._data = {};
		this._fields = [];
		this._meta = {};

		return this;
	};

	delete(){
		return this._qb.api('API_DeleteRecord', {
			dbid: this.getDBID(),
			rid: this.get('recordid')
		}).then(() => {
			this.clear();

			return this;
		}).catch((err) => {
			if(err.code === 30){
				this.clear();

				return this;
			}

			throw err;
		});
	};

	get(field){
		if(!this._data.hasOwnProperty(field)){
			return null;
		}

		return this._data[field];
	};

	getDBID(){
		return this._dbid;
	};

	getFid(field, byId){
		const fids = this.getFids();
		let id = -1;

		if(byId !== true){
			if(fids.hasOwnProperty(field)){
				id = fids[field];
			}
		}else{
			field = +field;

			Object.keys(fids).some((name) => {
				if(fids[name] === field){
					id = name;

					return true;
				}

				return false;
			});
		}

		return id;
	};

	getFids(field){
		return this._fids;
	};

	getField(id){
		const fields = this.getFields();
		const i = indexOfObj(fields, 'id', +id);

		if(i === -1){
			return undefined;
		}

		return fields[i];
	};

	getFields(){
		return this._fields;
	};

	getTableName(){
		return this._meta.name;
	};

	load(localQuery, localClist){
		if(typeof(localQuery) === 'object'){
			localClist = localQuery.clist;
			localQuery = localQuery.query;
		}

		const fids = this.getFids();
		const rid = this.get('recordid');
		let query = [].concat(localQuery || []);

		if(rid){
			query.push("{'" + this.getFid('recordid') + "'.EX.'" + rid + "'}");
		}else{
			const pk = this.get('primaryKey');

			if(pk){
				query.push("{'" + this.getFid('primaryKey') + "'.EX.'" + pk + "'}");
			}
		}

		if(localClist && localClist.join){
			localClist = localClist.join('.');
		}

		return this._qb.api('API_DoQuery', {
			dbid: this._dbid,
			query: query.join('AND'),
			clist: localClist || Object.keys(fids).map((fid) => {
				return fids[fid];
			}),
			options: 'num-1'
		}).then((results) => {
			this._meta = merge({
				name: results.table.name,
				desc: results.table.desc,
			}, results.table.original);

			results.table.fields.forEach((field) => {
				const i = indexOfObj(this._fields, 'id', field.id);

				if(i === -1){
					this._fields.push(field);
				}else{
					this._fields[i] = field;
				}
			});

			if(results.table.records.length === 0){
				const err = new Error('Record not found');
				err.code = 101;

				throw err;
			}

			const record = results.table.records[0];

			if(localClist){
				('' + localClist).split('.').forEach((id) => {
					const name = this.getFid(+id, true);

					this.set(name, record[id]);
				});
			}else{
				Object.keys(fids).forEach((name) => {
					this.set(name, record[fids[name]]);
				});
			}

			if(record.hasOwnProperty('rid')){
				this.set('recordid', record.rid);
			}

			return this;
		});
	};

	loadSchema(){
		return this._qb.api('API_GetSchema', {
			dbid: this.getDBID()
		}).then((results) => {
			this._meta = merge({
				name: results.table.name,
				desc: results.table.desc,
			}, results.table.original);

			results.table.fields.forEach((field) => {
				const i = indexOfObj(this._fields, 'id', field.id);

				if(i === -1){
					this._fields.push(field);
				}else{
					this._fields[i] = field;
				}
			});

			return this.getFields();
		});
	};

	save(fidsToSave){
		const rid = this.get('recordid');
		const key = this.get('primaryKey');

		let action = 'API_AddRecord',
			options = {
				dbid: this._dbid,
				fields: []
			};

		if(rid){
			action = 'API_EditRecord';

			if(this.getFid('recordid') !== this.getFid('primaryKey')){
				options.key = key;
			}else{
				options.rid = rid;
			}
		}

		Object.keys(this.getFids()).forEach((name) => {
			const fid = this.getFid(name);
			const field = this.getField(fid);

			if(fid <= 5 || (field && ([
				'summary',
				'virtual',
				'lookup'
			].indexOf(field.mode) !== -1 || field.hasOwnProperty('snapfid') || [
				'ICalendarButton',
				'vCardButton'
			].indexOf(field.field_type) !== -1)) || (fidsToSave && fidsToSave.indexOf(fid) === -1 && fidsToSave.indexOf(name) === -1)){
				return;
			}

			let val = this.get(name);

			if([
				undefined,
				null
			].indexOf(val) !== -1){
				val = '';
			}

			if(typeof(val) === 'object' && val.filename){
				options.fields.push({
					fid: fid,
					filename: val.filename,
					value: val.data
				});
			}else{
				options.fields.push({
					fid: fid,
					value: val
				});
			}
		});

		return this._qb.api(action, options).then((results) => {
			const fids = this.getFids();
			const now = Date.now();

			this.set('recordid', results.rid);

			if(fids.dateCreated && action === 'API_AddRecord'){
				this.set('dateCreated', now);
			}

			if(fids.dateModified){
				this.set('dateModified', now);
			}

			if(fids.primaryKey){
				let fname = false;

				Object.keys(fids).some((fid) => {
					if(fid === 'primaryKey'){
						return false;
					}else
					if(fids.primaryKey === fids[fid]){
						fname = fid;

						return true;
					}

					return false;
				});

				if(fname !== false){
					this.set('primaryKey', this.get(fname));
				}
			}

			return this;
		});
	};

	set(field, value){
		this._data[field] = value;

		return this;
	};

	setDBID(dbid){
		this._dbid = dbid;

		return this;
	};

	setFid(name, id){
		this._fids[name] = +id;

		return this;
	};

	setFids(fields){
		Object.keys(fields).forEach((name) => {
			this.setFid(name, fields[name]);
		});

		return this;
	};

}

/* Expose Properties */
QBRecord.defaults = defaults;

/* Helpers */
const indexOfObj = function(obj, key, value){
	if(typeof(obj) !== 'object'){
		return -1;
	}

	let result,  i = 0, o = 0, k = 0;
	const l = obj.length;

	for(; i < l; ++i){
		if(typeof(key) === 'object'){
			result = new Array(key.length);
			result = setAll(result, false);

			for(o = 0, k = result.length; o < k; ++o){
				if(obj[i][key[o]] === value[o]){
					result[o] = true;
				}
			}

			if(result.indexOf(false) === -1){
				return i;
			}
		}else{
			if(obj[i][key] === value){
				return i;
			}
		}
	}

	return -1;
};

const setAll = function(arr, value){
	for(let i = 0; i < arr.length; ++i){
		arr[i] = value;
	}

	return arr;
};

/* Expose Properties */
QBRecord.className = 'QBRecord';

/* Expose Version */
QBRecord.VERSION = [ VERSION_MAJOR, VERSION_MINOR, VERSION_PATCH ].join('.');

/* Export Module */
if(typeof module !== 'undefined' && module.exports){
	module.exports = QBRecord;
}else
if(typeof define === 'function' && define.amd){
	define('QBRecord', [], function(){
		return QBRecord;
	});
}

if(typeof global !== 'undefined' && typeof window !== 'undefined' && global === window){
	global.QBRecord = QBRecord;
}

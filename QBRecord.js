'use strict';

/* Versioning */
const VERSION_MAJOR = 2;
const VERSION_MINOR = 0;
const VERSION_PATCH = 6;

/* Dependencies */
const merge = require('lodash.merge');
const RFC4122 = require('rfc4122');
const QBField = require('qb-field');
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

		if(options && options.quickbase && ((options.quickbase.className && options.quickbase.className === 'QuickBase') || typeof(options.quickbase.api) === 'function')){
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

		let i = 0, result = undefined;

		for(; result === undefined && i < fields.length; ++i){
			if(fields[i].getFid() === id){
				result = fields[i];
			}
		}

		return result;
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
				const fid = +field.id;

				let result = undefined;

				for(let i = 0; result === undefined && i < this._fields.length; ++i){
					if(this._fields[i].getFid() === fid){
						result = this._fields[i];
					}
				}

				if(!result){
					result = new QBField({
						quickbase: this._qb,
						dbid: this.getDBID(),
						fid: fid
					});

					this._fields.push(result);
				}

				Object.keys(field).forEach((attribute) => {
					result.set(attribute, field[attribute]);
				});
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
					const field = this.getField(+id);

					let value = record[id];

					if(field){
						value = QBField.ParseValue(field, value);
					}

					this.set(name, value);
				});
			}else{
				Object.keys(fids).forEach((name) => {
					const fid = +fids[name];
					const field = this.getField(fid);

					let value = record[fid];

					if(field){
						value = QBField.ParseValue(field, value);
					}

					this.set(name, value);
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
				const fid = +field.id;

				let result = undefined;

				for(let i = 0; result === undefined && i < this._fields.length; ++i){
					if(this._fields[i].getFid() === fid){
						result = this._fields[i];
					}
				}

				if(!result){
					result = new QBField({
						quickbase: this._qb,
						dbid: this.getDBID(),
						fid: fid
					});

					this._fields.push(result);
				}

				Object.keys(field).forEach((attribute) => {
					result.set(attribute, field[attribute]);
				});
			});

			return this.getFields();
		});
	};

	save(fidsToSave, reqHook){
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
			].indexOf(field.get('mode')) !== -1 || field.get('snapfid') || [
				'ICalendarButton',
				'vCardButton'
			].indexOf(field.get('field_type')) !== -1)) || (fidsToSave && fidsToSave.indexOf(fid) === -1 && fidsToSave.indexOf(name) === -1)){
				return;
			}

			let val = this.get(name);

			if([
				undefined,
				null
			].indexOf(val) !== -1){
				val = '';
			}

			if((field && field.get('field_type') === 'file') || (typeof(val) === 'object' && val.filename)){
				if(val && val.data){
					options.fields.push({
						fid: fid,
						filename: val.filename,
						value: val.data
					});
				}
			}else{
				if(field){
					val = QBField.FormatValue(field, val);
				}

				options.fields.push({
					fid: fid,
					value: val
				});
			}
		});

		return this._qb.api(action, options, null, reqHook).then((results) => {
			const fids = this.getFids();

			this.set('recordid', results.rid);

			if(fids.dateCreated && action === 'API_AddRecord'){
				this.set('dateCreated', results.update_id);
			}

			if(fids.dateModified){
				this.set('dateModified', results.update_id);
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

	toJson(fidsToConvert){
		var handleVal = function(val){
			if((typeof(jQuery) !== 'undefined' && val instanceof jQuery) || (typeof(HTMLElement) !== 'undefined' && val instanceof HTMLElement)){
				return '[DOM Object]';
			}else
			if(val instanceof QBRecord || (typeof(QBTable) !== 'undefined' && val instanceof QBTable)){
				return val.toJson();
			}else
			if((typeof(moment) !== 'undefined' && moment.isMoment(val)) || val instanceof Date){
				return val.toISOString();
			}else
			if(typeof(moment) !== 'undefined' && moment.isDuration(val)){
				return val.asMilliseconds();
			}else
			if(val instanceof Object){
				return convert(val);
			}else{
				return val;
			}
		};

		const convert = (obj, isFirstLevel) => {
			if(obj instanceof Array){
				return obj.map(handleVal);
			}

			const arr = {};

			Object.keys(obj).forEach((name) => {
				if(!isFirstLevel || !fidsToConvert || fidsToConvert.length === 0 || fidsToConvert.indexOf(name) !== -1){
					arr[name] = handleVal(obj[name]);
				}
			});

			return arr;
		};		

		return convert(this._data, true);
	};

}

/* Expose Properties */
QBRecord.defaults = defaults;

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

if((typeof global !== 'undefined' && typeof window !== 'undefined' && global === window) || (typeof global === 'undefined' && typeof window !== 'undefined')){
	(global || window).QBRecord = QBRecord;
}

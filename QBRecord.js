var QBRecord = (function(){

	'use strict';

	/* Versioning */
	var VERSION_MAJOR = 0;
	var VERSION_MINOR = 2;
	var VERSION_PATCH = 0;

	/* Dependencies */
	if(typeof(window.QuickBase) === 'undefined'){
		window.QuickBase = {};

		$('<script />', {
			type: 'text/javascript',
			src: 'https://cdn.datacollaborative.com/js/quickbase/quickbase.browserify.min.js'
		}).appendTo('head');
	}

	if(typeof(window.RFC4122) === 'undefined'){
		$('<script />', {
			type: 'text/javascript',
			src: 'https://cdn.datacollaborative.com/js/rfc4122/rfc4122.browserify.min.js'
		}).appendTo('head');
	}

	/* Defaults */
	var defaults = {
		quickbase: {
			realm: window.location.host.split('.')[0],
			appToken: ''
		},

		dbid: (function(){
			var dbid = window.location.pathname.match(/^\/db\/(?!main)(.*)$/);

			return dbid ? dbid[1] : '';
		})(),
		fids: {
			recordid: 3,
			primaryKey: 3
		},

		recordid: null,
		primaryKey: null
	};

	/* QBRecord */
	var QBRecord = function(options){
		this._data = {};
		this._dbid = '';
		this._fids = {};
		this._fields = [];

		var that = this,
			init = function(){
				if(options && options.quickbase instanceof QuickBase){
					that._qb = options.quickbase;

					delete options.quickbase
				}

				var settings = $.extend(true, {}, defaults, options || {});

				that._rfc4122 = new RFC4122();

				that._id = that._rfc4122.v4();

				that.setDBID(settings.dbid)
					.setFids(settings.fids)
					.set('recordid', settings.recordid)
					.set('primaryKey', settings.primaryKey);

				if(!that._qb){
					that._qb = new QuickBase(settings.quickbase);
				}
			};

		if(typeof(QuickBase) === 'function' && typeof(RFC4122) === 'function'){
			init();
		}else{
			var nS = setInterval(function(){
				if([
					typeof(QuickBase) === 'function',
					typeof(RFC4122) === 'function'
				].indexOf(false) !== -1){
					return false;
				}

				clearInterval(nS);

				init();
			});
		}

		return this;
	};

	QBRecord.prototype.clear = function(){
		this._data = {};

		return this;
	};

	QBRecord.prototype.delete = function(){
		var that = this;

		return this._qb.api('API_DeleteRecord', {
			dbid: this.getDBID(),
			rid: this.get('recordid')
		}).then(function(){
			that.clear();

			return that;
		});
	};

	QBRecord.prototype.get = function(field){
		if(!this._data.hasOwnProperty(field)){
			return null;
		}

		return this._data[field];
	};

	QBRecord.prototype.getDBID = function(){
		return this._dbid;
	};

	QBRecord.prototype.getFid = function(field, byId){
		var fids = this.getFids(),
			id = -1;

		if(byId !== true){
			if(fids.hasOwnProperty(field)){
				id = fids[field];
			}
		}else{
			field = +field;

			Object.keys(fids).some(function(name){
				if(fids[name] === field){
					id = name;

					return true;
				}

				return false;
			});
		}

		return id;
	};

	QBRecord.prototype.getFids = function(field){
		return this._fids;
	};

	QBRecord.prototype.getField = function(id){
		var fields = this.getFields(),
			i = indexOfObj(fields, 'id', +id);

		if(i === -1){
			return undefined;
		}

		return fields[i];
	};

	QBRecord.prototype.getFields = function(){
		return this._fields;
	};

	QBRecord.prototype.load = function(localQuery){
		var that = this,
			fids = this.getFids(),
			query = [].concat(localQuery || []),
			rid = this.get('recordid');

		if(rid){
			query.push("{'" + this.getFid('recordid') + "'.EX.'" + rid + "'}");
		}else{
			var pk = this.get('primaryKey');

			if(pk){
				query.push("{'" + this.getFid('primaryKey') + "'.EX.'" + pk + "'}");
			}
		}

		return this._qb.api('API_DoQuery', {
			dbid: this._dbid,
			query: query.join('AND'),
			clist: Object.keys(fids).map(function(fid){
				return fids[fid];
			}),
			options: 'num-1'
		}).then(function(results){
			that._fields = results.table.fields;

			if(results.table.records.length === 0){
				return that;
			}

			var record = results.table.records[0];

			Object.keys(fids).forEach(function(name){
				that.set(name, record[fids[name]]);
			});

			if(record.hasOwnProperty('rid')){
				that.set('recordid', record.rid);
			}

			return that;
		});
	};

	QBRecord.prototype.loadSchema = function(){
		var that = this;

		return this._qb.api('API_GetSchema', {
			dbid: this.getDBID()
		}).then(function(results){
			that._fields = results.table.fields;

			return that.getFields();
		});
	};

	QBRecord.prototype.save = function(){
		var that = this,
			action = 'API_AddRecord',
			options = {
				dbid: this._dbid,
				fields: []
			},
			rid = this.get('recordid');

		if(rid){
			action = 'API_EditRecord';
			options.rid = rid;
		}

		Object.keys(this.getFids()).forEach(function(name){
			var fid = that.getFid(name),
				field = that.getField(fid);

			if(fid <= 5 || (field && [
				'summary',
				'virtual',
				'lookup'
			].indexOf(field.mode) !== -1)){
				return;
			}

			var val = that.get(name);

			if([
				undefined,
				null
			].indexOf(val) !== -1){
				val = '';
			}

			options.fields.push({
				fid: fid,
				value: val
			});
		});

		return this._qb.api(action, options).then(function(results){
			var fids = that.getFids(),
				now = Date.now();

			that.set('recordid', results.rid);

			if(fids.dateCreated && action === 'API_AddRecord'){
				that.set('dateCreated', now);
			}

			if(fids.dateModified){
				that.set('dateModified', now);
			}

			if(fids.primaryKey){
				var fname = false;

				Object.keys(fids).some(function(fid){
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
					that.set('primaryKey', that.get(fname));
				}
			}

			return that;
		});
	};

	QBRecord.prototype.set = function(field, value){
		this._data[field] = value;

		return this;
	};

	QBRecord.prototype.setDBID = function(dbid){
		this._dbid = dbid;

		return this;
	};

	QBRecord.prototype.setFid = function(name, id){
		this._fids[name] = +id;

		return this;
	};

	QBRecord.prototype.setFids = function(fields){
		var that = this;

		Object.keys(fields).forEach(function(name){
			that.setFid(name, fields[name]);
		});

		return this;
	};

	/* Helpers */
	var indexOfObj = function(obj, key, value){
		if(typeof(obj) !== 'object'){
			return -1;
		}

		var result,
			i = 0, l = obj.length,
			o = 0, k = 0;

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

	var setAll = function(arr, value){
		for(var i = 0; i < arr.length; ++i){
			arr[i] = value;
		}

		return arr;
	};

	/* Expose Version */
	QBRecord.VERSION = [ VERSION_MAJOR, VERSION_MINOR, VERSION_PATCH ].join('.');

	return QBRecord;

})();

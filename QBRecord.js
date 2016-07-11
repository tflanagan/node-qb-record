var QBRecord = (function(){

	'use strict';

	/* Versioning */
	var VERSION_MAJOR = 0;
	var VERSION_MINOR = 0;
	var VERSION_PATCH = 2;

	/* Dependencies */
	if(typeof(window.QuickBase) === 'undefined'){
		window.QuickBase = {};

		$('<script />', {
			type: 'text/javascript',
			src: 'https://cdn.datacollaborative.com/js/quickbase/quickbase.browserify.min.js'
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

		recordid: -1,
		primaryKey: -1
	};

	/* QBRecord */
	var QBRecord = function(options){
		this._data = {};
		this._dbid = '';
		this._fids = {};

		var that = this,
			init = function(){
				if(options && options.quickbase instanceof QuickBase){
					that._qb = options.quickbase;

					delete options.quickbase
				}

				var settings = $.extend(true, {}, defaults, options || {});

				that.setDBID(settings.dbid)
					.setFids(settings.fids)
					.set('recordid', settings.recordid)
					.set('primaryKey', settings.primaryKey);

				if(!that._qb){
					that._qb = new QuickBase(settings.quickbase);
				}
			};

		if(typeof(QuickBase) === 'function'){
			init();
		}else{
			var nS = setInterval(function(){
				if([
					typeof(QuickBase) === 'function'
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
					id = fids[name];

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

	QBRecord.prototype.save = function(whitelistOfFields){
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
			if(whitelistOfFields && whitelistOfFields.indexOf(name) !== -1){
				return;
			}

			options.fields.push({
				fid: that.getFid(name),
				value: that.get(name)
			});
		});

		return this._qb.api(action, options).then(function(results){
			that.set('recordid', results.rid);

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

	/* Expose Version */
	QBRecord.VERSION = [ VERSION_MAJOR, VERSION_MINOR, VERSION_PATCH ].join('.');

	return QBRecord;

})();

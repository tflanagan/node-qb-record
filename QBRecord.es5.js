'use strict';

/* Versioning */

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var VERSION_MAJOR = 0;
var VERSION_MINOR = 2;
var VERSION_PATCH = 2;

/* Dependencies */
var merge = require('lodash.merge');
var RFC4122 = require('rfc4122');
var QuickBase = require('quickbase');

/* Default Settings */
var defaults = {
	quickbase: {
		realm: window ? window.location.host.split('.')[0] : '',
		appToken: ''
	},

	dbid: function () {
		if (!window) {
			return '';
		}

		var dbid = window.location.pathname.match(/^\/db\/(?!main)(.*)$/);

		return dbid ? dbid[1] : '';
	}(),
	fids: {
		recordid: 3,
		primaryKey: 3
	},

	recordid: null,
	primaryKey: null
};

/* Main Class */

var QBRecord = function () {
	function QBRecord(options) {
		_classCallCheck(this, QBRecord);

		this._data = {};
		this._dbid = '';
		this._fids = {};
		this._fields = [];

		if (options && options.quickbase instanceof QuickBase) {
			this._qb = options.quickbase;

			delete options.quickbase;
		}

		var settings = merge({}, QBRecord.defaults, options || {});

		this._rfc4122 = new RFC4122();

		this._id = this._rfc4122.v4();

		this.setDBID(settings.dbid).setFids(settings.fids).set('recordid', settings.recordid).set('primaryKey', settings.primaryKey);

		if (!this._qb) {
			this._qb = new QuickBase(settings.quickbase);
		}

		return this;
	}

	_createClass(QBRecord, [{
		key: 'clear',
		value: function clear() {
			this._data = {};

			return this;
		}
	}, {
		key: 'delete',
		value: function _delete() {
			var _this = this;

			return this._qb.api('API_DeleteRecord', {
				dbid: this.getDBID(),
				rid: this.get('recordid')
			}).then(function () {
				_this.clear();

				return _this;
			});
		}
	}, {
		key: 'get',
		value: function get(field) {
			if (!this._data.hasOwnProperty(field)) {
				return null;
			}

			return this._data[field];
		}
	}, {
		key: 'getDBID',
		value: function getDBID() {
			return this._dbid;
		}
	}, {
		key: 'getFid',
		value: function getFid(field, byId) {
			var fids = this.getFids();
			var id = -1;

			if (byId !== true) {
				if (fids.hasOwnProperty(field)) {
					id = fids[field];
				}
			} else {
				field = +field;

				Object.keys(fids).some(function (name) {
					if (fids[name] === field) {
						id = name;

						return true;
					}

					return false;
				});
			}

			return id;
		}
	}, {
		key: 'getFids',
		value: function getFids(field) {
			return this._fids;
		}
	}, {
		key: 'getField',
		value: function getField(id) {
			var fields = this.getFields();
			var i = indexOfObj(fields, 'id', +id);

			if (i === -1) {
				return undefined;
			}

			return fields[i];
		}
	}, {
		key: 'getFields',
		value: function getFields() {
			return this._fields;
		}
	}, {
		key: 'load',
		value: function load(localQuery) {
			var _this2 = this;

			var fids = this.getFids();
			var rid = this.get('recordid');
			var query = [].concat(localQuery || []);

			if (rid) {
				query.push("{'" + this.getFid('recordid') + "'.EX.'" + rid + "'}");
			} else {
				var pk = this.get('primaryKey');

				if (pk) {
					query.push("{'" + this.getFid('primaryKey') + "'.EX.'" + pk + "'}");
				}
			}

			return this._qb.api('API_DoQuery', {
				dbid: this._dbid,
				query: query.join('AND'),
				clist: Object.keys(fids).map(function (fid) {
					return fids[fid];
				}),
				options: 'num-1'
			}).then(function (results) {
				_this2._fields = results.table.fields;

				if (results.table.records.length === 0) {
					return _this2;
				}

				var record = results.table.records[0];

				Object.keys(fids).forEach(function (name) {
					_this2.set(name, record[fids[name]]);
				});

				if (record.hasOwnProperty('rid')) {
					_this2.set('recordid', record.rid);
				}

				return _this2;
			});
		}
	}, {
		key: 'loadSchema',
		value: function loadSchema() {
			var _this3 = this;

			return this._qb.api('API_GetSchema', {
				dbid: this.getDBID()
			}).then(function (results) {
				_this3._fields = results.table.fields;

				return _this3.getFields();
			});
		}
	}, {
		key: 'save',
		value: function save() {
			var _this4 = this;

			var rid = this.get('recordid');
			var action = 'API_AddRecord',
			    options = {
				dbid: this._dbid,
				fields: []
			};

			if (rid) {
				action = 'API_EditRecord';
				options.rid = rid;
			}

			Object.keys(this.getFids()).forEach(function (name) {
				var fid = _this4.getFid(name);
				var field = _this4.getField(fid);

				if (fid <= 5 || field && ['summary', 'virtual', 'lookup'].indexOf(field.mode) !== -1) {
					return;
				}

				var val = _this4.get(name);

				if ([undefined, null].indexOf(val) !== -1) {
					val = '';
				}

				if ((typeof val === 'undefined' ? 'undefined' : _typeof(val)) === 'object' && val.filename) {
					options.fields.push({
						fid: fid,
						filename: val.filename,
						value: val.data
					});
				} else {
					options.fields.push({
						fid: fid,
						value: val
					});
				}
			});

			return this._qb.api(action, options).then(function (results) {
				var fids = _this4.getFids();
				var now = Date.now();

				_this4.set('recordid', results.rid);

				if (fids.dateCreated && action === 'API_AddRecord') {
					_this4.set('dateCreated', now);
				}

				if (fids.dateModified) {
					_this4.set('dateModified', now);
				}

				if (fids.primaryKey) {
					var fname = false;

					Object.keys(fids).some(function (fid) {
						if (fid === 'primaryKey') {
							return false;
						} else if (fids.primaryKey === fids[fid]) {
							fname = fid;

							return true;
						}

						return false;
					});

					if (fname !== false) {
						_this4.set('primaryKey', _this4.get(fname));
					}
				}

				return _this4;
			});
		}
	}, {
		key: 'set',
		value: function set(field, value) {
			this._data[field] = value;

			return this;
		}
	}, {
		key: 'setDBID',
		value: function setDBID(dbid) {
			this._dbid = dbid;

			return this;
		}
	}, {
		key: 'setFid',
		value: function setFid(name, id) {
			this._fids[name] = +id;

			return this;
		}
	}, {
		key: 'setFids',
		value: function setFids(fields) {
			var _this5 = this;

			Object.keys(fields).forEach(function (name) {
				_this5.setFid(name, fields[name]);
			});

			return this;
		}
	}]);

	return QBRecord;
}();

/* Expose Properties */


QBRecord.defaults = defaults;

/* Helpers */
var indexOfObj = function indexOfObj(obj, key, value) {
	if ((typeof obj === 'undefined' ? 'undefined' : _typeof(obj)) !== 'object') {
		return -1;
	}

	var result = void 0,
	    i = 0,
	    o = 0,
	    k = 0;
	var l = obj.length;

	for (; i < l; ++i) {
		if ((typeof key === 'undefined' ? 'undefined' : _typeof(key)) === 'object') {
			result = new Array(key.length);
			result = setAll(result, false);

			for (o = 0, k = result.length; o < k; ++o) {
				if (obj[i][key[o]] === value[o]) {
					result[o] = true;
				}
			}

			if (result.indexOf(false) === -1) {
				return i;
			}
		} else {
			if (obj[i][key] === value) {
				return i;
			}
		}
	}

	return -1;
};

var setAll = function setAll(arr, value) {
	for (var i = 0; i < arr.length; ++i) {
		arr[i] = value;
	}

	return arr;
};

/* Expose Version */
QBRecord.VERSION = [VERSION_MAJOR, VERSION_MINOR, VERSION_PATCH].join('.');

/* Export Module */
if (typeof module !== 'undefined' && module.exports) {
	module.exports = QBRecord;
} else if (typeof define === 'function' && define.amd) {
	define('QBRecord', [], function () {
		return QBRecord;
	});
}

if (typeof global !== 'undefined' && typeof window !== 'undefined' && global === window) {
	global.QBRecord = QBRecord;
}


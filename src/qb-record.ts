'use strict';

/* Dependencies */
import merge from 'deepmerge';
import RFC4122 from 'rfc4122';
import {
	QuickBase,
	QuickBaseOptions,
	QuickBaseResponseDeleteRecords,
	QuickBaseRecord
} from 'quickbase';
import { QBField, QBFieldJSON } from 'qb-field';

/* Globals */
const VERSION = require('../package.json').version;
const IS_BROWSER = typeof(window) !== 'undefined';
const rfc4122 = new RFC4122();

/* Main Class */
export class QBRecord {

	/**
	 * The class name
	 *
	 * Loading multiple instances of this class results in failed `instanceof` checks.
	 * `Function.name` is corrupted by the browserify/minify processes.
	 * Allow code to check if an object is this class by look at this `CLASS_NAME`
	 * property. Code can further check `VERSION` to ensure correct versioning
	 */
	public readonly CLASS_NAME = 'QBRecord';
	static readonly CLASS_NAME = 'QBRecord';

	/**
	 * The loaded library version
	 */
	static readonly VERSION: string = VERSION;

	/**
	 * The default settings of a `QuickBase` instance
	 */
	static defaults: QBRecordOptions = {
		quickbase: {
			realm: IS_BROWSER ? window.location.host.split('.')[0] : ''
		},

		tableId: (() => {
			if(IS_BROWSER){
				const tableId = window.location.pathname.match(/^\/db\/(?!main)(.*)$/);

				if(tableId){
					return tableId[1];
				}
			}

			return '';
		})(),
		fids: {
			recordid: 3,
			primaryKey: 3
		},

		recordid: undefined,
		primaryKey: undefined
	};

	/**
	 * An internal id (guid) used for tracking/managing object instances
	 */
	public id: string;

	private _qb: QuickBase;
	private _tableId: string = '';
	private _fids: QBRecordFids = {};
	private _fields: QBField[] = [];
	private _data: QBRecordData = {};

	constructor(options?: Partial<QBRecordOptions>){
		this.id = rfc4122.v4();

		if(options){
			const {
				quickbase,
				...classOptions
			} = options || {};

			if(quickbase){
				// @ts-ignore
				if(quickbase && quickbase.CLASS_NAME === 'QuickBase'){
					this._qb = quickbase as QuickBase;
				}else{
					this._qb = new QuickBase(quickbase as QuickBaseOptions);
				}
			}else{
				this._qb = new QuickBase();
			}

			const settings = merge(QBRecord.defaults, classOptions);

			this.setTableId(settings.tableId)
				.setFids(settings.fids)
				.set('recordid', settings.recordid)
				.set('primaryKey', settings.primaryKey);
		}else{
			this._qb = new QuickBase();
		}

		return this;
	}

	clear(): QBRecord {
		this._data = {};
		this._fields = [];

		return this;
	}

	async delete(): Promise<QuickBaseResponseDeleteRecords> {
		const recordid = this.get('recordid');

		if(recordid){
			const results = await this._qb.deleteRecords({
				tableId: this.getTableId(),
				where: `{'${this.getFid('recordid')}'.EX.'${recordid}'}`
			});

			if(results.numberDeleted !== 0){
				this.clear();
			}

			return results;
		}else{
			this.clear();

			return {
				numberDeleted: 0
			};
		}
	}

	get(field: string | number): any {
		return this._data[field];
	}

	getTableId(): string {
		return this._tableId;
	}

	getFid(field: number, byId: true): string;
	getFid(field: string | number, byId?: false): number;
	getFid(field: string | number, byId: boolean = false): string | number {
		const fids = this.getFids();
		let id: string | number = -1;

		if(byId !== true){
			if(fids.hasOwnProperty(field)){
				id = fids[field];
			}
		}else{
			id = '';
			field = +field;

			getObjectKeys(fids).some((name) => {
				if(fids[name] === field){
					id = name;

					return true;
				}

				return false;
			});
		}

		return id;
	}

	getFids(): QBRecordFids {
		return this._fids;
	}

	getField(id: number): QBField | undefined {
		const fields = this.getFields();

		let i = 0, result = undefined;

		for(; result === undefined && i < fields.length; ++i){
			if(fields[i].getFid() === id){
				result = fields[i];
			}
		}

		return result;
	}

	getFields(): QBField[] {
		return this._fields;
	}

	async load(options?: string): Promise<QBRecordData>;
	async load(options?: QBRecordLoad): Promise<QBRecordData>;
	async load(query?: string | QBRecordLoad, clist?: string|number[]): Promise<QBRecordData> {
		const where = [];

		let fids = this.getFids();
		let select = [];

		if(typeof(query) === 'object'){
			clist = query.clist;
			query = query.query;
		}

		if(query){
			where.push(`(${query})`);
		}

		if(this.get('recordid')){
			where.push(`{'${this.getFid('recordid')}'.EX.'${this.get('recordid')}'}`);
		}else
		if(this.get('primaryKey')){
			where.push(`{'${this.getFid('primaryKey')}'.EX.'${this.get('primaryKey')}'}`);
		}

		if(clist){
			if(typeof(clist) === 'string'){
				select = clist.split('.').map((val: string) => +val);
			}else{
				select = clist;
			}

			fids = select.reduce((fids: QBRecordFids, fid) => {
				let name: string | number = this.getFid(fid, true);

				if(!name){
					name = fid;

					this.setFid(fid, fid);
				}

				fids[name] = fid;

				return fids;
			}, {});
		}else{
			select = getObjectKeys(fids).map((name) => {
				return fids[name];
			});
		}

		const results = await this._qb.runQuery({
			tableId: this.getTableId(),
			where: where.join('AND'),
			select: select
		});

		results.fields.forEach((field) => {
			let result = this.getField(field.id);

			if(!result){
				result = new QBField({
					quickbase: this._qb,
					tableId: this.getTableId(),
					fid: field.id
				});

				this._fields.push(result);
			}

			getObjectKeys(field).forEach((attribute) => {
				result!.set(attribute, (field as Indexable)[attribute]);
			});
		});

		if(results.metadata.totalRecords === 0){
			throw new Error('Record not found');
		}

		const record = results.data[0];

		getObjectKeys(fids).forEach((name) => {
			const fid = this.getFid(name);

			this.set(name, record[fid].value);
		});

		return this._data;
	}

	async loadSchema(): Promise<QBField[]> {
		const results = await this._qb.getFields({
			tableId: this.getTableId()
		});

		results.forEach((field) => {
			let result = this.getField(field.id);

			if(result === undefined){
				result = new QBField({
					quickbase: this._qb,
					tableId: this.getTableId(),
					fid: field.id
				});

				this._fields.push(result);
			}

			getObjectKeys(field).forEach((attribute) => {
				result!.set(attribute, (field as Indexable)[attribute]);
			});
		});

		return this.getFields();
	}

	async save(fidsToSave?: (string|number)[], mergeFieldId?: number): Promise<QBRecordData> {
		const fids = this.getFids();
		const names = getObjectKeys(fids);

		const results = await this._qb.upsertRecords({
			tableId: this.getTableId(),
			mergeFieldId: mergeFieldId || this.getFid('recordid'),
			data: [names.filter((name) => {
				const fid = fids[name];

				return !fidsToSave || fidsToSave.indexOf(fid) !== -1 || fidsToSave.indexOf(name) !== -1 || fid === this.getFid('recordid');
			}).reduce((record: QuickBaseRecord, name) => {
				const fid = fids[name];

				if(fid){
					const value = this.get(name);

					record[fid] = {
						value: value === undefined ? '' : value
					};
				}

				return record;
			}, {})],
			fieldsToReturn: names.map((name) => {
				return fids[name];
			}).filter((val, i, arr) => {
				return arr.indexOf(val) === i;
			})
		});

		const record = results.data[0];

		names.forEach((name) => {
			let value = undefined;
			const fid = fids[name];

			if(fid){
				const field = record[fid];

				if(field){
					value = field.value;
				}
			}

			this.set(name, value);
		});

		return this._data;
	}

	set(fid: string | number, value: any): QBRecord {
		this._data[fid] = value;

		return this;
	}

	setTableId(tableId: string): QBRecord {
		this._tableId = tableId;

		return this;
	}

	setFid(name: string | number, id: number): QBRecord {
		this._fids[name] = +id;

		return this;
	}

	setFids(fields: QBRecordFids): QBRecord {
		getObjectKeys(fields).forEach((name) => {
			this.setFid(name, fields[name]);
		});

		return this;
	}

	/**
	 * Rebuild the QBRecord instance from serialized JSON
	 *
	 * @param json QBRecord serialized JSON
	 */
	fromJSON(json: string | QBRecordJSON): QBRecord {
		if(typeof(json) === 'string'){
			json = JSON.parse(json);
		}

		if(typeof(json) !== 'object'){
			throw new TypeError('json argument must be type of object or a valid JSON string');
		}

		if(json.quickbase){
			this._qb = new QuickBase(json.quickbase);
		}

		if(json.tableId){
			this.setTableId(json.tableId);
		}

		if(json.fids){
			this.setFids(json.fids);
		}

		if(json.recordid){
			this.set('recordid', json.recordid);
		}

		if(json.primaryKey){
			this.set('primaryKey', json.primaryKey);
		}

		if(json.fields){
			json.fields.forEach((fieldJSON) => {
				this._fields.push(QBField.fromJSON(fieldJSON));
			});
		}

		if(json.data){
			getObjectKeys(json.data).forEach((name) => {
				this.set(name, (json as QBRecordJSON).data![name]);
			});
		}

		return this;
	}

	/**
	 * Serialize the QBRecord instance into JSON
	 */
	toJSON(fidsToConvert?: (string | number)[]): QBRecordJSON {
		return {
			quickbase: this._qb.toJSON(),
			tableId: this.getTableId(),
			fids: this.getFids(),
			recordid: this.get('recordid'),
			primaryKey: this.get('primaryKey'),
			fields: this.getFields().map((field) => {
				return field.toJSON();
			}),
			data: getObjectKeys(this._data).filter((name) => {
				return !fidsToConvert || fidsToConvert.indexOf(name) !== -1;
			}).reduce((data: QBRecordData, name) => {
				data[name] = this._data[name];

				return data;
			}, {})
		};
	}

	/**
	 * Create a new QBRecord instance from serialized JSON
	 *
	 * @param json QBRecord serialized JSON
	 */
	static fromJSON(json: string | QBRecordJSON): QBRecord {
		if(typeof(json) === 'string'){
			json = JSON.parse(json);
		}

		if(typeof(json) !== 'object'){
			throw new TypeError('json argument must be type of object or a valid JSON string');
		}

		const newRecord = new QBRecord();

		return newRecord.fromJSON(json);
	}

	/**
	 * Returns a new QBRecord instance built off of `options`, that inherits configuration data from the passed in `data` argument.
	 *
	 * @param options QBRecord instance options
	 * @param data Quick Base Record data
	 */
	static newRecord(options: Partial<QBRecordOptions>, data?: QBRecordData): QBRecord {
		const newRecord = new QBRecord(options);

		if(data){
			getObjectKeys(data).forEach((property) => {
				newRecord.set(property, data[property]);
			});
		}

		return newRecord;
	};

}

/* Helpers */
function getObjectKeys<O>(obj: O): (keyof O)[] {
    return Object.keys(obj) as (keyof O)[];
}

/* Interfaces */
interface Indexable {
	[index: string]: any;
}

export interface QBRecordLoad {
	query?: string;
	clist?: string|number[];
}

export interface QBRecordOptions {
	quickbase: QuickBase | QuickBaseOptions;
	tableId: string;
	fids: QBRecordFids,
	recordid?: number;
	primaryKey?: number;
}

export interface QBRecordJSON {
	quickbase?: QuickBaseOptions;
	tableId?: string;
	fids?: QBRecordFids;
	recordid?: string | number;
	primaryKey?: string | number;
	fields?: QBFieldJSON[];
	data?: QBRecordData;
}

export type QBRecordData = {
	[index in string | number]: any;
}

export type QBRecordFids = {
	[index in string | number]: number;
}

/* Export to Browser */
if(IS_BROWSER){
	// @ts-ignore
	window.QBRecord = QBRecord;
}

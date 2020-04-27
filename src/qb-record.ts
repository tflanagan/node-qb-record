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
import { QBField } from 'qb-field';

/* Globals */
const VERSION = require('../package.json').version;
const IS_BROWSER = typeof(window) !== 'undefined';
const rfc4122 = new RFC4122();

/* Main Class */
export class QBRecord {

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
	
		dbid: (() => {
			if(IS_BROWSER){
				const dbid = window.location.pathname.match(/^\/db\/(?!main)(.*)$/);
	
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

		recordid: undefined,
		primaryKey: undefined
	};

	public id: string;

	private _qb: QuickBase;
	private _dbid: string = '';
	private _fids: QBRecordFids = {};
	private _fields: QBField[] = [];
	private _data: QBRecordData = {};

	constructor(options?: QBRecordOptions){
		this.id = rfc4122.v4();

		if(options){
			if(options.quickbase instanceof QuickBase){
				this._qb = options.quickbase;
			}else{
				this._qb = new QuickBase(options.quickbase);
			}

			delete options.quickbase;

			const settings = merge(QBRecord.defaults, options || {});

			this.setDBID(settings.dbid)
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
		const results = await this._qb.deleteRecords({
			tableId: this.getDBID(),
			where: `{'${this.getFid('recordid')}'.EX.'${this.get('recordid')}'}`
		});

		if(results.numberDeleted !== 0){
			this.clear();
		}

		return results;
	}

	get(field: string | number): any {
		if(!this._data.hasOwnProperty(field)){
			return null;
		}

		return this._data[field];
	}

	getDBID(): string {
		return this._dbid;
	}

	getFid(field: string, byId?: false): number;
	getFid(field: number, byId?: true): string;
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

			Object.keys(fids).some((name) => {
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
			select = Object.keys(fids).map((name) => {
				return fids[name];
			});
		}

		const results = await this._qb.runQuery({
			tableId: this.getDBID(),
			where: where.join('AND'),
			select: select
		});

		results.fields.forEach((field) => {
			let result = this.getField(field.id);

			if(!result){
				result = new QBField({
					quickbase: this._qb,
					dbid: this.getDBID(),
					fid: field.id
				});

				this._fields.push(result);
			}

			Object.keys(field).forEach((attribute) => {
				result!.set(attribute, (field as Indexable)[attribute]);
			});
		});

		if(results.metadata.totalRecords === 0){
			throw new Error('Record not found');
		}

		const record = results.data[0];

		Object.keys(fids).forEach((name) => {
			const fid = this.getFid(name);

			this.set(name, record[fid].value);
		});

		return this._data;
	}

	async loadSchema(): Promise<QBField[]> {
		const results = await this._qb.getFields({
			tableId: this.getDBID()
		});

		results.forEach((field) => {
			let result = this.getField(field.id);

			if(!result){
				result = new QBField({
					quickbase: this._qb,
					dbid: this.getDBID(),
					fid: field.id
				});

				this._fields.push(result);
			}

			Object.keys(field).forEach((attribute) => {
				result!.set(attribute, (field as Indexable)[attribute]);
			});
		});

		return this.getFields();
	}

	async save(fidsToSave?: (string|number)[]): Promise<QBRecordData> {
		const fids = this.getFids();
		const names = Object.keys(fids);

		const results = await this._qb.upsertRecords({
			tableId: this.getDBID(),
			mergeFieldId: this.getFid('primaryKey'),
			data: [names.filter((name) => {
				const fid = fids[name];
	
				return !fidsToSave || fidsToSave.indexOf(fid) !== -1 || fidsToSave.indexOf(name) !== -1;
			}).reduce((record: QuickBaseRecord, name) => {
				const fid = fids[name];

				if(fid){
					record[fid] = {
						value: this.get(name)
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
			this.set(name, record[fids[name]].value);
		});

		return this._data;
	}

	set(fid: string | number, value: any): QBRecord {
		this._data[fid] = value;

		return this;
	}

	setDBID(dbid: string): QBRecord {
		this._dbid = dbid;

		return this;
	}

	setFid(name: string | number, id: number): QBRecord {
		if(typeof(id) === 'object'){
			this._fids[name] = id;

			Object.keys(id).forEach((key, i) => {
				this._fids[('' + name) + (i + 1)] = +id[key];
			});
		}else{
			this._fids[name] = +id;
		}

		return this;
	}

	setFids(fields: QBRecordFids): QBRecord {
		Object.keys(fields).forEach((name) => {
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

		if(json.dbid){
			this.setDBID(json.dbid);
		}

		if(json.recordid){
			this.set('recordid', json.recordid);
		}

		if(json.primaryKey){
			this.set('primaryKey', json.primaryKey);
		}

		if(json.data){
			Object.keys(json.data).forEach((name) => {
				// @ts-ignore
				this.set(name, json.data[name]);
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
			dbid: this.getDBID(),
			recordid: this.get('recordid'),
			primaryKey: this.get('primaryKey'),
			data: Object.keys(this._data).filter((name) => {
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
	quickbase?: QuickBase | QuickBaseOptions;
	dbid?: string;
	fids?: QBRecordFids,
	recordid?: string | number;
	primaryKey?: string | number;
}

export interface QBRecordJSON {
	quickbase?: QuickBaseOptions;
	dbid?: string;
	fids?: QBRecordFids;
	recordid?: string | number;
	primaryKey?: string | number;
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


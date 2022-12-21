'use strict';

/* Dependencies */
import merge from 'deepmerge';
import RFC4122 from 'rfc4122';
import {
	QuickBase,
	QuickBaseOptions,
	QuickBaseRequest,
	QuickBaseResponseDeleteRecords
} from 'quickbase';
import {
	QBField,
	QBFieldJSON
} from 'qb-field';

/* Globals */
const VERSION = require('../package.json').version;
const IS_BROWSER = typeof(window) !== 'undefined';
const rfc4122 = new RFC4122();

/* Main Class */
export class QBRecord<RecordData extends QBRecordData = QBRecordData> {

	public readonly CLASS_NAME = 'QBRecord';
	static readonly CLASS_NAME = 'QBRecord';

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
	private _fids: Record<any, number> = {};
	private _fields: QBField[] = [];
	private _data: Record<any, any> = {};

	constructor(options?: Partial<QBRecordOptions<RecordData>>){
		this.id = rfc4122.v4();

		const {
			quickbase,
			...classOptions
		} = options || {};

		if(QuickBase.IsQuickBase(quickbase)){
			this._qb = quickbase;
		}else{
			this._qb = new QuickBase(merge.all([
				QBRecord.defaults.quickbase,
				quickbase || {}
			]));
		}

		const settings = merge(QBRecord.defaults, classOptions);

		this.setTableId(settings.tableId)
			.setFids(settings.fids as Record<any, number>)
			// @ts-ignore - my typescript skills fail me for now, tests are fine though
			.set('recordid', settings.recordid)
			// @ts-ignore - my typescript skills fail me for now, tests are fine though
			.set('primaryKey', settings.primaryKey);

		return this;
	}

	clear(): this {
		this._data = {};
		this._fields = [];

		return this;
	}

	async delete({ requestOptions }: QuickBaseRequest = {}): Promise<QuickBaseResponseDeleteRecords> {
		const recordid = this.get('recordid');

		if(recordid){
			const results = await this._qb.deleteRecords({
				tableId: this.getTableId(),
				where: `{'${this.getFid('recordid')}'.EX.'${recordid}'}`,
				requestOptions
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

	get<F extends keyof RecordData>(field: F): RecordData[F];
	get<F extends string>(field: F): F extends keyof RecordData ? RecordData[F] : any;
	get(field: any): any {
		return this._data[field];
	}

	getFid<T extends keyof RecordData>(field: T): number;
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

			Object.entries(fids).some(([ name, fid ]) => {
				if(fid === field){
					id = name;

					return true;
				}

				return false;
			});
		}

		return id;
	}

	getFids(): QBFids<RecordData> {
		return this._fids as QBFids<RecordData>;
	}

	getField(id: number, returnIndex: true): number | undefined;
	getField(id: number, returnIndex?: false): QBField | undefined;
	getField(id: number, returnIndex: boolean = false): number | QBField | undefined {
		const fields = this.getFields();

		let result = undefined;

		for(let i = 0; result === undefined && i < fields.length; ++i){
			if(fields[i].getFid() === id){
				result = returnIndex ? i : fields[i];
			}
		}

		return result;
	}

	getFields(): QBField[] {
		return this._fields;
	}

	getTableId(): string {
		return this._tableId;
	}

	async getTempToken({ requestOptions }: QuickBaseRequest = {}): Promise<void> {
		await this._qb.getTempTokenDBID({
			dbid: this.getTableId(),
			requestOptions
		});
	}

	async load({ clist, query, requestOptions }: QBRecordLoad = {}): Promise<Record<any, any>> {
		const where = [];

		let fids = this.getFids() as Record<any, any>;
		let select = [];

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

			fids = select.reduce((fids, fid) => {
				let name: string | number = this.getFid(fid, true);

				if(!name){
					name = fid;

					this.setFid(fid, fid);
				}

				fids[name] = fid;

				return fids;
			}, {} as Record<any, any>);
		}else{
			select = Object.entries(fids).map((fid) => {
				return fid[1];
			});
		}

		const results = await this._qb.runQuery({
			tableId: this.getTableId(),
			where: where.join('AND'),
			select: select,
			requestOptions
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

			Object.entries(field).forEach(([ attribute, property ]) => {
				result!.set(attribute, property);
			});
		});

		if(results.metadata.totalRecords === 0){
			throw new Error('Record not found');
		}

		const record = results.data[0];

		Object.entries(fids).forEach(([ name, fid ]) => {
			this.set(name, record[fid].value);
		});

		return this._data;
	}

	async loadSchema({ requestOptions }: QuickBaseRequest = {}): Promise<QBField[]> {
		const results = await this._qb.getFields({
			tableId: this.getTableId(),
			requestOptions
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

			Object.entries(field).forEach(([ property, value ]) => {
				result!.set(property, value);
			});
		});

		return this.getFields();
	}

	async save({
		fidsToSave,
		mergeFieldId,
		requestOptions
	}: QuickBaseRequest & {
		fidsToSave?: (keyof RecordData | number)[];
		mergeFieldId?: number;
	} = {}): Promise<Record<any, any>> {
		const fids = this.getFids();
		const names = Object.entries(fids).map(([ name ]) => name);
		const mergeField = mergeFieldId || this.getFid('primaryKey');

		const results = await this._qb.upsert({
			tableId: this.getTableId(),
			mergeFieldId: mergeField,
			data: [names.filter((name) => {
				const fid = fids[name];
				const filtered = !fidsToSave || fidsToSave.indexOf(fid) !== -1 || fidsToSave.indexOf(name) !== -1 || fid === mergeField;

				if(!filtered){
					return false;
				}

				const field = this.getField(fid);

				if(field && [
					'lookup',
					'summary',
					'formula'
				].indexOf(field.get('mode') || '') !== -1){
					return false;
				}

				return true;
			}).reduce((record, name) => {
				const fid = fids[name];

				if(fid){
					const value = this.get(name);

					record[fid] = {
						value: value === undefined ? '' : value
					};
				}

				return record;
			}, {} as Record<string, { value: any }>)],
			fieldsToReturn: names.map((name) => {
				return fids[name];
			}).filter((val, i, arr) => {
				return arr.indexOf(val) === i;
			}),
			requestOptions
		});

		const error = typeof(results.metadata.lineErrors) !== 'undefined' ? results.metadata.lineErrors[1] : false;

		if(error){
			throw new Error(error[1]);
		}

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

	set<F extends keyof RecordData>(field: F, value: RecordData[F]): this;
	set<F extends string>(field: F, value: F extends keyof RecordData ? RecordData[F] : any): this;
	set(field: any, value: any): this {
		this._data[field] = value;

		return this;
	}

	setTableId(tableId: string): this {
		this._tableId = tableId;

		return this;
	}

	setFid<T extends keyof RecordData>(name: T, id: number): this;
	setFid(name: string | number, id: number): this;
	setFid(name: string | number, id: number): this {
		this._fids[name] = +id;

		return this;
	}

	setFids(fields: Record<any, number>): this {
		Object.entries(fields).forEach(([ name, fid ]) => {
			this.setFid(name, fid);
		});

		return this;
	}

	setFields(fields: QBField[]): this {
		this._fields = fields;

		return this;
	}

	/**
	 * Rebuild the QBRecord instance from serialized JSON
	 *
	 * @param json QBRecord serialized JSON
	 */
	fromJSON(json: string | QBRecordJSON<RecordData>): this {
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
			// @ts-ignore - my typescript skills fail me for now, tests are fine though
			this.set('recordid', json.recordid);
		}

		if(json.primaryKey){
			// @ts-ignore - my typescript skills fail me for now, tests are fine though
			this.set('primaryKey', json.primaryKey);
		}

		if(json.fields){
			json.fields.forEach((fieldJSON) => {
				this._fields.push(QBField.fromJSON(fieldJSON));
			});
		}

		if(json.data){
			Object.entries(json.data).forEach(([ property, value ]) => {
				this.set(property, value);
			});
		}

		return this;
	}

	/**
	 * Serialize the QBRecord instance into JSON
	 */
	toJSON(fidsToConvert?: (string | number)[]): QBRecordJSON<RecordData> {
		return {
			quickbase: this._qb.toJSON(),
			tableId: this.getTableId(),
			fids: this.getFids(),
			recordid: this.get('recordid'),
			primaryKey: this.get('primaryKey'),
			fields: this.getFields().map((field) => {
				return field.toJSON();
			}),
			data: Object.entries(this._data).filter(([ name ]) => {
				return !fidsToConvert || fidsToConvert.indexOf(name) !== -1;
			}).reduce((data, [ name, value ]) => {
				data[name] = value;

				return data;
			}, {} as Record<any, any>)
		};
	}

	/**
	 * Create a new QBRecord instance from serialized JSON
	 *
	 * @param json QBRecord serialized JSON
	 */
	static fromJSON<T extends QBRecordData = QBRecordData>(json: string | QBRecordJSON<T>): QBRecord<T> {
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
	 * Test if a variable is a `qb-record` object
	 *
	 * @param obj A variable you'd like to test
	 */
	static IsQBRecord<T extends QBRecordData = QBRecordData>(obj: any): obj is QBRecord<T> {
		return ((obj || {}) as QBRecord).CLASS_NAME === QBRecord.CLASS_NAME;
	}

	/**
	 * Returns a new QBRecord instance built off of `options`, that inherits configuration data from the passed in `data` argument.
	 *
	 * @param options QBRecord instance options
	 * @param data Quick Base Record data
	 */
	static NewRecord<T extends QBRecordData = QBRecordData>(options: Partial<QBRecordOptions<T>>, data?: Partial<T>): QBRecord<T> {
		const newRecord = new QBRecord<T>(options);

		if(data){
			Object.entries(data).forEach(([ property, value ]) => {
				newRecord.set(property, value);
			});
		}

		return newRecord;
	};

}

/* Types */
export type QBRecordLoad = QuickBaseRequest & {
	query?: string;
	clist?: string|number[];
}

export type QBRecordData = Record<any, any>;
export type QBFids<T extends QBRecordData> = {
	[K in keyof T]: number;
};

export type QBRecordOptions<RecordData extends QBRecordData = {
	recordid: number;
	primaryKey: number;
}> = {
	quickbase: QuickBase | QuickBaseOptions;
	tableId: string;
	fids: Partial<QBFids<RecordData>>,
	recordid?: number;
	primaryKey?: number;
}

export type QBRecordJSON<RecordData extends QBRecordData = {
	recordid: number;
	primaryKey: number;
}>  = {
	quickbase?: QuickBaseOptions;
	tableId?: string;
	fids?: QBFids<RecordData>;
	recordid?: string | number;
	primaryKey?: string | number;
	fields?: QBFieldJSON[];
	data?: RecordData;
}

/* Export to Browser */
if(IS_BROWSER){
	window.QBRecord = exports;
}

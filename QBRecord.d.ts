import http from 'http';
import Promise from 'bluebird';
import QBField from 'qb-field';
import QuickBase, { QueryBuilder } from 'quickbase';

type ReqHook = (this: typeof QueryBuilder, request: http.ClientRequest) => void;

export = QBRecord;

declare class QBRecord<R = Record<string, any>> {
    constructor(options: Partial<QBRecordSettings<Record<keyof R, number>>>);
    _id: string;
	_data: R;
	_dbid: string;
	_fids: Record<keyof R, number>;
	_fields: QBField[];
	_meta: Record<string, any>;
	_qb: QuickBase;
	_rfc4122: any;
    className: string;
    settings: QBRecordSettings<Record<keyof R, number>>;
	clear(): this;
	delete(): Promise<this>;
	get<T extends keyof R>(field: T): R[T];
	getDBID(): string;
	getFid(field: number, byId: true): keyof R;
	getFid(field: keyof R, byId?: false): number;
	getFids(): Record<keyof R, number>;
	getField(id: number): QBField;
	getFields(): QBField[];
	getTableName(): string;
	load(localQuery: string, localClist: string | (keyof R)[]): Promise<this>;
	loadSchema(): Promise<QBField[]>;
	save(fidsToSave?: (keyof R)[], reqHook?: ReqHook): Promise<this>;
	set<T extends keyof R>(field: T, value?: R[T]): this;
	setDBID(dbid: string): this;
	setFid(name: keyof R, id: number): this;
	setFids(fields: { name: keyof R; id: number; }[]): this;
	toJson(fidsToConvert?: (keyof R)[]): R;
}

declare namespace QBRecord {
	export const QBRecord: QBRecord;
    export const className: string;
    export const defaults: QBRecordSettings<Record<string, number>>;
}

declare interface QBRecordSettings<T> {
	quickbase: QuickBase | typeof QuickBase.defaults;
	dbid: string;
	fids: T;
	recordid: null | number;
	primaryKey: null | number;
}

import http from 'http';
import Promise from 'bluebird';
import QBField from 'qb-field';
import QuickBase, { QueryBuilder } from 'quickbase';

type ReqHook = (this: typeof QueryBuilder, request: http.ClientRequest) => void;

export = QBRecord;

declare class QBRecord<R = Record<string, any>> {
    constructor(options: Partial<QBRecordSettings<Record<keyof R, number>>>);
    _id: string;
	_data: any;
	_dbid: string;
	_fids: Record<keyof R, number>;
	_fields: QBField[];
	_meta: Record<string, any>;
	_qb: QuickBase;
	_rfc4122: any;
    className: string;
    settings: QBRecordSettings<Record<keyof R, number>>;
	clear(): void;
	delete(): Promise<QBRecord>;
	get<T extends keyof R>(field: T): R[T];
	getDBID(): string;
	getFid(field: number, byId: true): keyof R;
	getFid(field: keyof R, byId: false): number;
	getFid(field: keyof R | number, byId: boolean): keyof R | number;
	getFids(): Record<keyof R, number>;
	getField(id: number): QBField;
	getFields(): QBField[];
	getTableName(): string;
	load(localQuery: string, localClist: string | (keyof R)[]): Promise<QBRecord>;
	loadSchema(): Promise<QBField[]>;
	save(fidsToSave?: (keyof R)[], reqHook?: ReqHook): Promise<QBRecord>;
	set<T extends keyof R>(field: T, value?: R[T]): QBRecord;
	setDBID(dbid: string): QBRecord;
	setFid(name: keyof R, id: number): QBRecord;
	setFids(fields: { name: keyof R; id: number; }[]): QBRecord;
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

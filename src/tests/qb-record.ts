'use strict';

/* Dependencies */
import * as dotenv from 'dotenv';
import { serial as test } from 'ava';
import { QuickBase, QuickBaseOptions } from 'quickbase';
import { QBField } from 'qb-field';
import { QBRecord, QBRecordOptions } from '../qb-record';

/* Tests */
dotenv.config();

const QB_REALM = process.env.QB_REALM!;
const QB_USERTOKEN = process.env.QB_USERTOKEN!;

const qbOptions: QuickBaseOptions = {
	server: 'api.quickbase.com',
	version: 'v1',

	realm: QB_REALM,
	userToken: QB_USERTOKEN,
	tempToken: '',

	userAgent: 'Testing',

	connectionLimit: 10,
	connectionLimitPeriod: 1000,
	errorOnConnectionLimit: false,

	proxy: false
};

const qb = new QuickBase(qbOptions);
const qbField = new QBField({
	quickbase: qb,
	dbid: '',
	fid: -1
});

const qbFieldOptions: QBRecordOptions = {
	quickbase: qb
};

const qbRecord = new QBRecord(qbFieldOptions);

let newAppId: string;
let newDbid: string;
let newFid: number;

test.after.always('deleteFields()', async (t) => {
	if(!newFid){
		return t.pass();
	}

	const results = await qb.deleteFields({
		tableId: newDbid,
		fieldIds: [ newFid ]
	});

	t.truthy(results.deletedFieldIds[0] === newFid);
});

test.after.always('deleteTable()', async (t) => {
	if(!newDbid){
		return t.pass();
	}

	const results = await qb.deleteTable({
		appId: newAppId,
		tableId: newDbid
	});

	t.truthy(results.deletedTableId === newDbid);
});

test.after.always('deleteApp()', async (t) => {
	if(!newAppId){
		return t.pass();
	}

	const results = await qb.deleteApp({
		appId: newAppId,
		name: 'Test Node Quick Base Application'
	});

	t.truthy(results.deletedAppId === newAppId);
});

test('QuickBase:createApp()', async (t) => {
	const results = await qb.createApp({
		name: 'Test Node Quick Base Application',
		assignToken: true
	});

	newAppId = results.id;

	t.truthy(newAppId && results.name === 'Test Node Quick Base Application');
});
	
test('QuickBase:createTable()', async (t) => {
	const results = await qb.createTable({
		appId: newAppId,
		name: 'Test Name'
	});

	qbField.setDBID(results.id);
	qbRecord.setDBID(results.id);

	newDbid = qbRecord.getDBID();

	t.truthy(qbRecord.getDBID());
});

test('QBField:save() - create', async (t) => {
	qbField.set('fieldType', 'text');
	qbField.set('label', 'Test Field');

	const results = await qbField.save();

	newFid = qbField.get('fid');
	qbRecord.setFid('test', newFid);

	t.truthy(qbField.get('fid') > 0 && qbField.get('label') === 'Test Field' && results.label === 'Test Field');
});

test('save() - create', async (t) => {
	qbRecord.set('test', 'test value');

	const results = await qbRecord.save();

	t.truthy(qbRecord.get('recordid') === results.recordid && qbRecord.get('test') === 'test value');
});

test('toJSON() -> fromJSON()', async (t) => {
	const json = qbRecord.toJSON();

	let pass = !!JSON.stringify(json);

	if(pass){
		qbRecord.fromJSON(json);

		pass = JSON.stringify(qbRecord.toJSON()) === JSON.stringify(json);
	}

	if(pass){
		t.pass();
	}else{
		t.fail();
	}
});

test('QBRecord.fromJSON()', async (t) => {
	const json = qbRecord.toJSON();
	const newQBRecord = QBRecord.fromJSON(json);

	t.truthy(JSON.stringify(newQBRecord.toJSON()) === JSON.stringify(json));
});

test('load()', async (t) => {
	const results = await qbRecord.load();

	t.truthy(qbRecord.get('recordid') === results.recordid);
});

test('save() - update', async (t) => {
	qbRecord.set('test', 'New Test Value');

	const results = await qbRecord.save();

	t.truthy(qbRecord.get('test') === 'New Test Value' && results.test === 'New Test Value');
});

test('delete()', async (t) => {
	const results = await qbRecord.delete();

	t.truthy(results.numberDeleted === 1);
});

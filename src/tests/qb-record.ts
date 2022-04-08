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
	tableId: '',
	fid: -1
});

const qbFieldOptions: Partial<QBRecordOptions> = {
	quickbase: qb
};

const qbRecord = new QBRecord(qbFieldOptions);

let newAppId: string;
let newTableId: string;
let newFid: number;

test('QuickBase instance match', async (t) => {
	// @ts-ignore
	return t.truthy(qb === qbField._qb && qb === qbRecord._qb);
});

test.after.always('deleteFields()', async (t) => {
	if(!newFid){
		return t.pass();
	}

	const results = await qb.deleteFields({
		tableId: newTableId,
		fieldIds: [ newFid ]
	});

	t.truthy(results.deletedFieldIds[0] === newFid);
});

test.after.always('deleteTable()', async (t) => {
	if(!newTableId){
		return t.pass();
	}

	const results = await qb.deleteTable({
		appId: newAppId,
		tableId: newTableId
	});

	t.truthy(results.deletedTableId === newTableId);
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

test.before('QuickBase:createApp()', async (t) => {
	const results = await qb.createApp({
		name: 'Test Node Quick Base Application',
		assignToken: true
	});

	newAppId = results.id;

	t.truthy(newAppId && results.name === 'Test Node Quick Base Application');
});
	
test.before('QuickBase:createTable()', async (t) => {
	const results = await qb.createTable({
		appId: newAppId,
		name: 'Test Name'
	});

	qbField.setTableId(results.id);
	qbRecord.setTableId(results.id);

	newTableId = qbRecord.getTableId();

	t.truthy(qbRecord.getTableId());
});

test.before('QBField:save() - create', async (t) => {
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

test(`load("{'3'.GT.'0'}")`, async (t) => {
	const results = await qbRecord.load("{'3'.GT.'0'}");

	t.truthy(qbRecord.get('recordid') === results.recordid);
});

test(`load({ query: "{'3'.GT.'0'}" })`, async (t) => {
	const results = await qbRecord.load({
		query: "{'3'.GT.'0'}"
	});

	t.truthy(qbRecord.get('recordid') === results.recordid);
});

test('load({})', async (t) => {
	const results = await qbRecord.load({});

	t.truthy(qbRecord.get('recordid') === results.recordid);
});

test('load()', async (t) => {
	const results = await qbRecord.load();

	t.truthy(qbRecord.get('recordid') === results.recordid);
});

test('loadSchema()', async (t) => {
	const results = await qbRecord.loadSchema();

	t.truthy(results.length === 6);
});

test("get('_doesntExist')", (t) => {
	t.truthy(qbRecord.get('_doesntExist') === undefined);
});

test("get/set('_randomValue')", (t) => {
	const newValue = 'New Random Value';

	qbRecord.set('_randomValue', newValue);

	t.truthy(qbRecord.get('_randomValue') === newValue);
});

test("get/set('test')", (t) => {
	const newValue = 'New Test Value';

	qbRecord.set('test', newValue);

	t.truthy(qbRecord.get('test') === newValue);
});

test('getFid(6, true)', (t) => {
	const fidName = qbRecord.getFid(6, true);

	t.truthy(fidName === 'test');
});

test("getFid('test')", (t) => {
	const fid = qbRecord.getFid('test');

	t.truthy(fid === 6);
});

test('getFid(7, true)', (t) => {
	const fidName = qbRecord.getFid(7, true);

	t.truthy(fidName === '');
});

test('getFid(7)', (t) => {
	const fidName = qbRecord.getFid(7);

	t.truthy(fidName === -1);
});

test("getFid('_doesntExist')", (t) => {
	const fidName = qbRecord.getFid('_doesntExist');

	t.truthy(fidName === -1);
});

test('getFids()', (t) => {
	t.truthy(qbRecord.getFids().test === 6);
});

test('getField(6)', (t) => {
	const field = qbRecord.getField(6);

	if(field !== undefined){
		return t.truthy(field.get('label') === 'Test Field');
	}

	t.fail();
});

test('getFields()', (t) => {
	const fields = qbRecord.getFields();

	t.truthy(fields.length === 6);
});

test("save([ 'test' ]) - update", async (t) => {
	const results = await qbRecord.save([
		'test'
	]);

	t.truthy(qbRecord.get('test') === 'New Test Value' && results.test === 'New Test Value');
});

test("save([ 6 ]) - update", async (t) => {
	const results = await qbRecord.save([
		6
	]);

	t.truthy(qbRecord.get('test') === 'New Test Value' && results.test === 'New Test Value');
});

test('save() - update', async (t) => {
	const results = await qbRecord.save();

	t.truthy(qbRecord.get('test') === 'New Test Value' && results.test === 'New Test Value');
});

test('delete()', async (t) => {
	const results = await qbRecord.delete();

	t.truthy(results.numberDeleted === 1);
});

test('delete() - empty', async (t) => {
	const results = await qbRecord.delete();

	t.truthy(results.numberDeleted === 0);
});

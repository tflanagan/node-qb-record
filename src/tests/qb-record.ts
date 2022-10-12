'use strict';

/* Dependencies */
import * as dotenv from 'dotenv';
import ava from 'ava';
import { QuickBase, QuickBaseOptions } from 'quickbase';
import { QBField } from 'qb-field';
import { QBRecord } from '../qb-record';

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

const qbRecord = new QBRecord<{
	test: string;
}>({
	quickbase: qb
});

let newAppId: string;
let newTableId: string;
let newFid: number;

ava.serial('QuickBase instance match', async (t) => {
	// @ts-ignore
	return t.truthy(qb === qbField._qb && qb === qbRecord._qb);
});

ava.serial.after.always('deleteFields()', async (t) => {
	if(!newFid){
		return t.pass();
	}

	const results = await qb.deleteFields({
		tableId: newTableId,
		fieldIds: [ newFid ]
	});

	return t.truthy(results.deletedFieldIds[0] === newFid);
});

ava.serial.after.always('deleteTable()', async (t) => {
	if(!newTableId){
		return t.pass();
	}

	const results = await qb.deleteTable({
		appId: newAppId,
		tableId: newTableId
	});

	return t.truthy(results.deletedTableId === newTableId);
});

ava.serial.after.always('deleteApp()', async (t) => {
	if(!newAppId){
		return t.pass();
	}

	const results = await qb.deleteApp({
		appId: newAppId,
		name: 'Test Node Quick Base Application'
	});

	return t.truthy(results.deletedAppId === newAppId);
});

ava.serial.before('QuickBase:createApp()', async (t) => {
	const results = await qb.createApp({
		name: 'Test Node Quick Base Application',
		assignToken: true
	});

	newAppId = results.id;

	return t.truthy(newAppId && results.name === 'Test Node Quick Base Application');
});
	
ava.serial.before('QuickBase:createTable()', async (t) => {
	const results = await qb.createTable({
		appId: newAppId,
		name: 'Test Name'
	});

	qbField.setTableId(results.id);
	qbRecord.setTableId(results.id);

	newTableId = qbRecord.getTableId();

	return t.truthy(qbRecord.getTableId());
});
``
ava.serial.before('QBField:save() - create', async (t) => {
	qbField.set('fieldType', 'text');
	qbField.set('label', 'Test Field');

	const results = await qbField.save();

	newFid = qbField.get('fid');
	qbRecord.setFid('test', newFid);

	return t.truthy(qbField.get('fid') > 0 && qbField.get('label') === 'Test Field' && results.label === 'Test Field');
});

ava.serial('save() - create', async (t) => {
	qbRecord.set('test', 'test value');

	const results = await qbRecord.save();

	return t.truthy(qbRecord.get('recordid') === results.recordid && qbRecord.get('test') === 'test value');
});

ava.serial('toJSON() -> fromJSON()', async (t) => {
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

ava.serial('QBRecord.fromJSON()', async (t) => {
	const json = qbRecord.toJSON();
	const newQBRecord = QBRecord.fromJSON(json);

	return t.truthy(JSON.stringify(newQBRecord.toJSON()) === JSON.stringify(json));
});

ava.serial(`load({ query: "{'3'.GT.'0'}" })`, async (t) => {
	const results = await qbRecord.load({
		query: "{'3'.GT.'0'}"
	});

	return t.truthy(qbRecord.get('recordid') === results.recordid);
});

ava.serial('load({})', async (t) => {
	const results = await qbRecord.load({});

	return t.truthy(qbRecord.get('recordid') === results.recordid);
});

ava.serial('load()', async (t) => {
	const results = await qbRecord.load();

	return t.truthy(qbRecord.get('recordid') === results.recordid);
});

ava.serial('loadSchema()', async (t) => {
	const results = await qbRecord.loadSchema();

	return t.truthy(results.length === 6);
});

ava.serial("get('_doesntExist')", (t) => {
	const val = qbRecord.get('_doesntExist');

	return t.truthy(val === undefined);
});

ava.serial("get/set('_randomValue')", (t) => {
	const newValue = 'New Random Value';

	qbRecord.set('_randomValue', newValue);

	return t.truthy(qbRecord.get('_randomValue') === newValue);
});

ava.serial("get/set('test')", (t) => {
	const newValue = 'New Test Value';

	qbRecord.set('test', newValue);

	return t.truthy(qbRecord.get('test') === newValue);
});

ava.serial('getFid(6, true)', (t) => {
	const fidName = qbRecord.getFid(6, true);

	return t.truthy(fidName === 'test');
});

ava.serial("getFid('test')", (t) => {
	const fid = qbRecord.getFid('test');

	return t.truthy(fid === 6);
});

ava.serial('getFid(7, true)', (t) => {
	const fidName = qbRecord.getFid(7, true);

	return t.truthy(fidName === '');
});

ava.serial('getFid(7)', (t) => {
	const fidName = qbRecord.getFid(7);

	return t.truthy(fidName === -1);
});

ava.serial("getFid('_doesntExist')", (t) => {
	const fidName = qbRecord.getFid('_doesntExist');

	return t.truthy(fidName === -1);
});

ava.serial('getFids()', (t) => {
	return t.truthy(qbRecord.getFids().test === 6);
});

ava.serial('getField(6)', (t) => {
	const field = qbRecord.getField(6);

	if(field !== undefined){
		return t.truthy(field.get('label') === 'Test Field');
	}

	return t.fail();
});

ava.serial('getFields()', (t) => {
	const fields = qbRecord.getFields();

	return t.truthy(fields.length === 6);
});

ava.serial("save([ 'test' ]) - update", async (t) => {
	const results = await qbRecord.save({
			fidsToSave: [
				'test'
			]
		});

	return t.truthy(qbRecord.get('test') === 'New Test Value' && results.test === 'New Test Value');
});

ava.serial("save([ 6 ]) - update", async (t) => {
	const results = await qbRecord.save({
			fidsToSave: [
				6
			]
		});

	return t.truthy(qbRecord.get('test') === 'New Test Value' && results.test === 'New Test Value');
});

ava.serial('save() - update', async (t) => {
	const results = await qbRecord.save();

	return t.truthy(qbRecord.get('test') === 'New Test Value' && results.test === 'New Test Value');
});

ava.serial('delete()', async (t) => {
	const results = await qbRecord.delete();

	return t.truthy(results.numberDeleted === 1);
});

ava.serial('delete() - empty', async (t) => {
	const results = await qbRecord.delete();

	return t.truthy(results.numberDeleted === 0);
});

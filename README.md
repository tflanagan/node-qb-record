# QBRecord
========

### Initialization
--------------

```js
var record = new QBRecord({
	quickbase: {
		realm: '',
		appToken: ''
	},
	// quickbase: QuickBase Instance
	dbid: '' // defaults to dbid in url if found
	fids: {
		recordid: 3,
		primaryKey: 3,
		...
	},

	// If this is an existing record, then set the record id and primary key:
	// record: 123
	// primaryKey: 123
});
```

### Methods
-------

#### `.clear()`
This method clears the QBRecord instance of any trace of the existing record,
but preserves defined settings

#### `.delete()`
This method deletes the record from QuickBase, then calls `.clear()`.

#### `.get(name)`
 - `name`: string, required

This method returns the stored value associated with the `name` argument,
defined in the `fids` object in the inialization of the instance.

Example:
```js
var record = new QBRecord({
	quickbase: {
		realm: 'data',
		appToken: ''
	},
	dbid: 'abcdefg'
	fids: {
		recordid: 3,
		primaryKey: 3,
		name: 6
	},
	record: 123
	primaryKey: 123
});

// load the record, then at some point request the 'name' value...

var name = record.get('name');
```

#### `.getDBID()`
This method returns the stored DBID.

#### `.getFid(field, byId)`
 - `field`: string or integer, required
 - `byId`: boolean, default: `true`

If `byId` is `true`, then this returns the Field Id of the passed in `field` (string).
If `byId` is `false`, then this returns the Field Name of the passed in `field` (integer).

#### `.getFids()`
Returns the configured `fids` object.

#### `.getField(id)`
 - `id`: integer, required

If a record has been loaded, then returns the field object from the DoQuery with the Field ID of `id`.

#### `.getFields()`
If a record has been loaded, then returns the `fields` object from the DoQuery.

#### `.load(localQuery)`
 - `localQuery`: string

This method executes an API_DoQuery for the stored Record ID value. Will
automatically map all values defined in the `fids` object.

#### `.save()`
This method executes either an API_AddRecord or an API_EditRecord depending on
the set Record ID. If a Record ID is stored, then it executes an API_EditRecord
otherwise, an API_AddRecord.

If this executes an API_AddRecord, the newly assigned Record ID is
automatically stored internally. If the defined primaryKey FID is also a
defined field in the `fids` object, then this is also automatically stored
internally.

#### `.set(name, value)`
 - `name`: string, required
 - `value`: mixed, required

This method sets the passed in value associated with the `name` argument,
defined in the `fids` object in the inialization of the instance.

Example:
```js
var record = new QBRecord({
	quickbase: {
		realm: 'data',
		appToken: ''
	},
	dbid: 'abcdefg'
	fids: {
		recordid: 3,
		primaryKey: 3,
		name: 6
	},
	record: 123
	primaryKey: 123
});

record.set('name', 'This is the name!');
```

#### `.setDBID(dbid)`
 - `dbid`: string, required

Sets the `dbid` setting.

#### `.setFid(name, id)`
 - `name`: string, required
 - `id`: integer, required

Adds/Updates configured field with the name of `name` and the field id of `id`.

#### `.setFids(fields)`
 - `fields`: array, required

`fields` is an array of `.setFid()` arguments.

IE:
```js
record.setFids([
	{ name: 'label', id: 6 },
	{ name: 'total', id: 7 }
]);
```

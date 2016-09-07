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
#### `.getFids()`
#### `.getField(id)`
#### `.getFields()`

#### `.load(localQuery)`
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
#### `.setFid(name, id)`
#### `.setFids(fields)`

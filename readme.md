Redis wrapper adding suspend module support.

### Features

* Exposes all REDIS commands and wraps them with generator/yield async control flows.
* Provides two helper methods for searching and looping through values:  getSearch and delSearch.
* Allows direct access to the underlying redis client.

### install

<pre>
npm install redis-suspend
</pre>


### Requirements

* ECMAScript 2015 (ES6)
* Node.JS 6.2.2 or later (tested on 6.2.2)


### Basic Example

<pre>
let suspend = require("suspend"),
	resume = suspend.resume;

let RedisSuspend = require("redis-suspend");

let config = {
	host: "127.0.0.1"
};

let rs = new RedisSuspend(resume,config);

//expose "redis" module client directly:
rs.client.on("error", function (err) {
	console.log("Error " + err);
});

suspend(function*() {
    yield rs.set("key","test");
    console.log("set key!");

    //get key value and return to value after async operation completes
    let keyvalue = yield rs.get("key");
    console.log("key=",keyvalue);

    //no callbacks needed!
})();

</pre>

### Helper Methods exclusive to this module:


#### getDefault(key,defaultValue)

Just like the standard .get(key) method, but instead will allow you to provide a default value if the key is not found or is null.

<pre>
let value = yield rs.getDefault("undefined key","not found");
console.log(value); //outputs "not found"
</pre>


#### getJson(key)

Will attempt to automatically parse the JSON and return the object.

<pre>
yield rs.set("an object",JSON.stringify({foo:"bar"}));

let obj = yield rs.getJson("an object");
console.log(obj.foo); //outputs: "bar"
</pre>


#### setJson(key, object)

Will attempt to convert passed in object to JSON and save to key.

<pre>
yield rs.setJson("key",{foo:"bar"});

// .. later ..

let obj = yield rs.getJson("key");
console.log(obj.foo); //outputs: "bar"
</pre>


#### getSearch(key, callback(key,value,cbnext) )

This method allows you to loop over key/values that match your search criteria.
Internally it uses the SCAN redis command.

<pre>
	//lets add a whole bunch of keys
	yield rs.set("chara_a",1);
	yield rs.set("chara_b",2);
	yield rs.set("chara_c",3);
	yield rs.set("chara_d",4);
	yield rs.set("chara_e",5);
	yield rs.set("chara_f",6);

	yield rs.getSearch("chara_*",function(key,value,cbNext) {
		console.log("   ",key,value);
		cbNext();
	});

	console.log("search complete");
</pre>

#### delSearch(key)

This method is similar to the getSearch method, but instead of allowing you to loop
through the results, it deletes them, and then returns the delete count.

<pre>
	var delcount = yield rs.delSearch("chara_*");
	console.log("deleted " + delcount + " keys");
</pre>


### multi() Functionality

Multi allows commands to be queued together, and ensures that all commands succeed or all fail.

.mutli() chaining functionality is not supported by this module.
You may access its functionality by not chaining it. Such as:

<pre>
	let multi = rs.multi();

	multi.dbsize();
	multi.set("test","blah");
	multi.set("sesom","loves IDEs");
	multi.dbsize();

    let results = yield multi.exec();
    console.log(results);
</pre>

And you may access its functionality by accessing the node_redis client directly by
 using the rs.client property.

### Based on node_redis

This module wraps the <a href="https://github.com/NodeRedis/node_redis">node_redis</a> module.
Please review this module for more information about what methods and commands are available to you.

let suspend = require("suspend"),
	resume = suspend.resume;

let RedisSuspend = require("./RedisSuspend.js");
//to test using npm package (npm install redis-suspend):
//let RedisSuspend = require("redis-suspend");

let config = {
	host: "192.168.1.6"
};

let rs = new RedisSuspend(resume,config);

//expose "redis" module client directly:
rs.client.on("error", function (err) {
	console.log("Error " + err);
});

suspend(function*() {

	console.log("starting test...");

	//set a key and wait until async operation is complete
	yield rs.set("key","test");
	console.log("set key!");

	//get key value and return to value after async operation completes
	let keyvalue = yield rs.get("key");
	console.log("key=",keyvalue);

	//any method can be used with yield
	let dbsize = yield rs.dbsize();
	console.log("dbsize=",dbsize);

	//lets add a whole bunch of keys
	yield rs.set("chara_a",1);
	yield rs.set("chara_b",2);
	yield rs.set("chara_c",3);
	yield rs.set("chara_d",4);
	yield rs.set("chara_e",5);
	yield rs.set("chara_f",6);


/*
	rs.client.scan(0,"MATCH","chara_*",function(err,cursor,results)  {
		console.log("err",err);
		console.log("cursor",cursor);
		console.log("results",results);
	});

	return;
*/
	/*
	Loop through keys using my "getSearch" helper method.
	It uses the redis.SCAN internally
	*/
	console.log("------");
	yield rs.getSearch("chara_*",function(key,value,cbNext) {
		console.log("   ",key,value);
		cbNext();
	});

	console.log("------");

	//remove the key
	console.log("delete result:",yield rs.del("key"));


	dbsize = yield rs.dbsize();
	console.log("dbsize=",dbsize);

	var delcount = yield rs.delSearch("chara_*");
	console.log("deleted",delcount,"keys");

	dbsize = yield rs.dbsize();
	console.log("dbsize=",dbsize);

	console.log("end of test!!");

	/*
	NOTE: multi chaining does not work with this module.
	 You can however use multi by writing one command at a time (not chaining) see below...

	If all else fails, you can still use it by calling it directly from the exposed client object.
	 
	 */

	console.log("MULTI TEST");

	let multi = rs.multi();

	multi.dbsize();
	multi.set("test","blah");
	multi.set("sesom","loves IDEs");
	multi.dbsize();

	let replies = yield multi.exec();
	console.log(replies);


	console.log("---------");

	//doesn't work!
	/*
	rs.multi()
		.dbsize()
		.set("minikeb","welcome")
		.dbsize()
		.exec(function(err,result) {
			console.log(result);
		});
	*/


})();

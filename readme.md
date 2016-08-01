A Dictionary (Associative Array like) Class for ES6. Now supporting dot and bracket access through proxy, and generator/yield control flows.

### Features

* Stores key/value pairs within a Associative Array like collections (Dictionaries).
* NEW! Use dot operator and brackets to access keys.
* NEW! Remove key using the DELETE operator.
* NEW! Iterator to support for..of looping.
* NEW! hasOwnProperty method
* NEW! Generator/yield async control flow (via suspend module) support.
* Set and Get methods for accessing keys.
* GetDefault method with default value if value is not found.
* Remove method to remove key from collection.
* Size method to get total key count within collection.
* Built-in forEach and asyncForEach methods for looping.
* Empty and asyncEmpty to remove all entries from collection.
* Has method checking if key is within collection.

### install

<pre>
npm install dictionaryjs-es6
</pre>


### Requirements

* ECMAScript 2015 (ES6)
* Node.JS 6.2.2 or later (tested on 6.2.2)

You may find the older version (with less features) but will work with older version of Node.js:
<a href="https://www.npmjs.com/package/dictionaryjs">dictionaryjs</a>

### Basic Example

<pre>
var Dictionary = require("dictionaryjs-es6");
var collection = new Dictionary();

collection.set("bob.smith","bob.smith@email.com");
collection.["john.doe"] = "john.doe@email.com";

console.log(collection["bob.smith"]);

collection.empty();
</pre>

### Accessing Keys

You may access keys using the get/set methods, but also using the dot operator and brackets.

<pre>
//standard get/set methods:
collection.set("key","value");
console.log(collection.get("key"));

//dot operator:
collection.key = "value";
console.log(collection.key);

//bracket operators:
collection["key"] = "value";
console.log(collection["key"]);
</pre>

You may also use the getDefault method to return the default value if key was not found (or is null):

<pre>
console.log(collection.getDefault("test","not found"));
//will return "not found" if the key "test" was null.
</pre>

### Checking if Key exists

<pre>
if (collection.has("key")) {
    //..
}

if (collection.hasOwnProperty("key")) {
    //..
}
</pre>

### Deleting Keys

To remove a key, you may use the remove method, or the "delete" operator command:

<pre>
//using the method:
collection.remove("key");

//using the delete operator command:
delete collection.key;
//or...
delete collection["key"];
</pre>

To empty out the collection:

<pre>
//blocking:
collection.empty();

//non-blocking:
collection.asyncEmpty();

</pre>

### Looping through keys

#### ForEach (Blocking)

<pre>
collection.forEach(function(key,value) {
    console.log(key,value);
});
</pre>

#### AsyncForEach (Non-Blocking)

<pre>
collection.asyncForEach(function(key,value,cbNext) {
    console.log(key,value);
    cbNext();
});
</pre>

#### Using the (for...of) loop:

Each item (as just the value) within the collection can be accessed in a for...of loop.
This is blocking.
This will not return the key, if you need the key use another looping method.

<pre>
for (let item of collection) {
    console.log(item);
}
</pre>

### Getting the Collection Size:

<pre>
//using the size method:
console.log("Collection size:", collection.size());

//using the length property:
console.log("Collection size:", collection.length);
</pre>


### Generator/yield Async control flow using Suspend (recommended)

Using the suspend module you may write async code using the new yield command.
Here is an example that will show how you can write async code in a very clean manner:

<pre>
var Dictionary = require("dictionaryjs-es6");

var suspend = require("suspend"),
	resume = suspend.resume;

var collection = new Dictionary(resume);

//setup collection with some test values:
collection["foo"] = "bar";
collection["its a me"] = "mario";
collection["hello"] = "bye";

suspend(function*() {

	console.log("Collection contains:");

	//looping (non blocking)
	yield collection.asyncForEach(function(index,item,cbNext) {
		console.log("   ",index,item);
		cbNext();
	});

	console.log("Looping complete...");


	console.log("Emptying collection:");

	//emptying (non blocking)
	yield collection.asyncEmpty();

	console.log("Empty complete...");


})();

</pre>

### Other methods

These methods you may not find useful, but are documented in case you do:

* getKeys() - Returns an array of keys
* invalidate() - Invalidates the keys, used internally.
* setResume(resume) - used to set the suspend.resume reference, usually set in the constructor.


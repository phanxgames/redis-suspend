
class RedisSuspend {


    constructor(resume,config) {

        let client = redis.createClient(config);

        Object.defineProperty(client, "__private__", {
            value: {},
            enumerable: false
        });

        let self = client.__private__;

        self.client = client;
        self.resume = resume;
        self.resume_next = null;
        self.last_error = null;


        this.__setupMethods(client,this);

        return client;
    }


    getDefault(key,defaultValue,cb) {

        this._initHandleCallback();

        this.get(key, (err,result) => {
            if (err) {
                this._handleCallback(cb,null, null);
                return;
            }

            if (result==null) {
                this._handleCallback(cb, null, defaultValue);
                return;
            }

            this._handleCallback(cb, null, result);


        });

    }

    setJson(key,obj,cb) {

        this._initHandleCallback();

        let json = null;

        try {
            json = JSON.stringify(obj);
        } catch(e) {
            json = null;
        }

        this.set(key,json, (err, result) => {
            this._handleCallback(cb,err,null);
        });

    }

    getJson(key,cb) {

        this._initHandleCallback();

        this.get(key,(err,result)  => {
            if (err) {
                this._handleCallback(cb,null,null);
                return;
            }

            if (result==null) {

                this._handleCallback(cb,null,null);
                return;
            }

            try {
                var obj = JSON.parse(result);

                this._handleCallback(cb,null,obj);
                return;
            } catch (e) {

            }

            this._handleCallback(cb,null,null);

        });
    }

    getSearch(search,cbIterator,cbFinal) {

        let self = this;

        this._initHandleCallback();

        let cursor = 0;
        let results = [];

        let counter;
        let len;

        function searchStep() {
            self.scan(cursor,"MATCH",search, (err,reply) => {

                if (err) {
                    self._handleCallback(cbFinal,err);
                    return;
                }
                if (reply==null || reply.length!=2) {
                    self._handleCallback(cbFinal,new Error("No reply"));
                    return;
                }

                results = results.concat(reply[1]);

                if (reply[0]!=0) {
                    //not done, keep going!!
                    cursor = reply[0];
                    searchStep();
                } else {
                    //done
                    counter = 0;
                    len = results.length;
                    loopStep();
                }

            });
        }
        searchStep();


        function loopNext() {
            if (counter < len) {
                process.nextTick(loopStep);
            } else {
                self._handleCallback(cbFinal);
                return;
            }
        }
        function loopStep() {
            if (counter < len ) {
                let key = results[counter++];

                self.get(key,function(err,result) {
                    if (err) {
                        self._handleCallback(cbFinal,err);
                        return;
                    }

                    if (cbIterator(key, result, loopNext) == false) {
                        self._handleCallback(cbFinal);
                        return;
                    }
                });
            } else {
                self._handleCallback(cbFinal);
                return;
            }
        }



    }


    delSearch(search,cbFinal) {
        this._initHandleCallback();

        let self = this;

        let cursor = 0;
        let results = [];

        let counter;
        let len;
        let delCount = 0;

        function searchStep() {
            self.scan(cursor,"MATCH",search, (err,reply) => {

                if (err) {
                    self._handleCallback(cbFinal,err);
                    return;
                }
                if (reply==null || reply.length!=2) {
                    self._handleCallback(cbFinal,new Error("No reply"));
                    return;
                }

                results = results.concat(reply[1]);

                if (reply[0]!=0) {
                    //not done, keep going!!
                    cursor = reply[0];
                    searchStep();
                } else {
                    //done
                    counter = 0;
                    len = results.length;
                    loopStep();
                }

            });
        }
        searchStep();

        function loopNext() {
            if (counter < len) {
                process.nextTick(loopStep);
            } else {
                self._handleCallback(cbFinal,null,delCount);
                return;
            }
        }
        function loopStep() {
            if (counter < len ) {
                let key = results[counter++];

                self.del(key,function(err,result) {
                    if (err) {
                        self._handleCallback(cbFinal,err);
                        return;
                    }
                    delCount+=result;
                    loopNext();
                });
            } else {
                self._handleCallback(cbFinal,null,delCount);
                return;
            }
        }


    }


    __mapperMethod(client, functionRef, functionName, ...args) {

        //console.log("powerfear:"+functionName);

        if (functionName=="multi" || functionName=="MULTI") {
            return new MultiRedis(client,functionRef.call(client,...args));
        }


        try {
            this._initHandleCallback();
        } catch (e) {

        }

        let argLength = 0;
        if (args!=null) argLength = args.length;

        let lastArgReplaced = false;

        if (argLength>=1) {
            let lastArg = args[argLength - 1];
            if (lastArg != null && typeof(lastArg) === "function") {
                lastArgReplaced = true;
                args[argLength - 1] = (...innerargs) => {
                    this._handleCallback(lastArg, ...innerargs);
                }
            }
        }

        if (!lastArgReplaced) {
            args.push((...innerargs) => {
                this._handleCallback(null, ...innerargs);
            });
        }

        functionRef.call(client,...args);

    }


    __setupMethods(client,obj) {

        client.__private__.clientMulti = client.multi;

        //copy methods from redis (client) class for wrapping

        function setMapping(commandName) {
            let functionRef = client.__proto__[commandName];

            if (functionRef==null) return;

            let name = functionRef.name;
            //console.log(name);

            // internal_send_command
            if (typeof(functionRef) == "function" && name.indexOf("internal")===-1) {
                client[commandName] = obj.__mapperMethod.bind(client, client, functionRef, name);
                //console.log(name + " remapped");
            }
        }

        //get command list from redis-commands module
        for (let command of commands.list) {
            let commandName = command.replace(/(?:^([0-9])|[^a-zA-Z0-9_$])/g, '_$1');

            setMapping(commandName);

            commandName = commandName.toUpperCase();

            setMapping(commandName);
        }


        //copy methods from our class
        let arr2 = Object.getOwnPropertyNames(obj.__proto__);
        for (let item of arr2) {
            if (item != "constructor" && item.indexOf("__")!==0) {
                client[item] = obj[item];
            }
        }
    }

    _initHandleCallback() {
        if (this.__private__.resume)
            this.__private__.resume_next = this.__private__.resume();
        else
            this.__private__.resume_next = null;
    }

    _handleCallback(cb, err, result) {
        if (err)
            this.__private__.last_error = err;
        else
            this.__private__.last_error = null;

        if (cb)
            cb(err, result, this.__private__.resume_next);
        else if (this.__private__.resume_next)
            this.__private__.resume_next(err, result);
    }


}

module.exports = RedisSuspend;


class MultiRedis {


    constructor(client,  multi) {

        Object.defineProperty(multi, "__private__", {
            value: {},
            enumerable: false
        });

        var self = multi.__private__;

        self.client = client;
        self.resume = client.__private__.resume;
        self.resume_next = null;
        self.last_error = null;


        this.__setupMethods(multi,this);



        return multi;
    }


    __mapperMethod(multi, functionRef, functionName, ...args) {

        console.log("multi:"+functionName);

        if (functionName=="exec_batch" || functionName=="exec" || functionName=="EXEC") {

            //console.log("...");

            try {
                this._initHandleCallback();
            } catch (e) {

            }

            let argLength = 0;
            if (args != null) argLength = args.length;

            let lastArgReplaced = false;

            if (argLength >= 1) {
                let lastArg = args[argLength - 1];
                if (lastArg != null && typeof(lastArg) === "function") {
                    lastArgReplaced = true;
                    args[argLength - 1] = (...innerargs) => {
                        this._handleCallback(lastArg, ...innerargs);
                    }
                }
            }

            if (!lastArgReplaced) {
                args.push((...innerargs) => {
                    this._handleCallback(null, ...innerargs);
                });
            }

        }
        functionRef.call(multi,...args);


    }

    __setupMethods(multi,obj) {


        //copy methods from redis (client) class for wrapping
        function setMapping(commandName) {
            let functionRef = multi.__proto__[commandName];

            if (functionRef==null) return;

            let name = functionRef.name;
            //console.log(name);

            // internal_send_command
            if (typeof(functionRef) == "function" && name.indexOf("internal")===-1) {
                multi[commandName] = obj.__mapperMethod.bind(multi, multi, functionRef, name);
                //console.log(name + " remapped");
            }
        }

        //get command list from redis-commands module
        for (let command of multiCommands) {
            let commandName = command.replace(/(?:^([0-9])|[^a-zA-Z0-9_$])/g, '_$1');

            setMapping(commandName);

            commandName = commandName.toUpperCase();

            setMapping(commandName);
        }


        //copy methods from our class
        let arr2 = Object.getOwnPropertyNames(obj.__proto__);
        for (let item of arr2) {
            if (item != "constructor" && item.indexOf("__")!==0) {
                multi[item] = obj[item];
            }
        }
    }

    _initHandleCallback() {
        if (this.__private__.resume)
            this.__private__.resume_next = this.__private__.resume();
        else
            this.__private__.resume_next = null;
    }

    _handleCallback(cb, err, result) {
        if (err)
            this.__private__.last_error = err;
        else
            this.__private__.last_error = null;

        if (cb)
            cb(err, result, this.__private__.resume_next);
        else if (this.__private__.resume_next)
            this.__private__.resume_next(err, result);
    }
}


let redis = require("redis");
let commands = require('redis-commands');
let multiCommands = ["exec_atomic","exec_transaction","exec"];
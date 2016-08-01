
class RedisSuspend {

    constructor(resume,config) {

        this.target = {
            client: redis.createClient(config),
            resume: resume,
            resume_next: null,
            last_error: null,
            proxy: null
        };

        let target = this.target;

        this.target.initHandleCallback = () => {
            if (target.resume)
                target.resume_next = target.resume();
            else
                target.resume_next = null;
        };
        this.target.handleCallback = (cb, ...args) => {
            if (args!=null && args.length>=1 && args[0]!=null) {
                target.last_error = args[0];
            } else {
                target.last_error = null;
            }
            if (cb)
                cb(...args, target.resume_next);
            else if (target.resume_next)
                target.resume_next(...args);
        };

        target.methods = {
            "client": target.client,
            "multi": () => {
                return new MultiProxy(this, target.client.multi())
            },
             "getSearch": (search,cbIterator,cbFinal) => {

                target.initHandleCallback();

                let cursor = 0;
                let results = [];

                let counter;
                let len;

                function searchStep() {
                    target.client.scan(cursor,"MATCH",search, (err,reply) => {

                        if (err) {
                            target.handleCallback(cbFinal,err);
                            return;
                        }
                        if (reply==null || reply.length!=2) {
                            target.handleCallback(cbFinal,new Error("No reply"));
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
                        target.handleCallback(cbFinal);
                        return;
                    }
                }
                function loopStep() {
                    if (counter < len ) {
                        let key = results[counter++];

                        target.client.get(key,function(err,result) {
                            if (err) {
                                target.handleCallback(cbFinal,err);
                                return;
                            }

                            if (cbIterator(key, result, loopNext) == false) {
                                target.handleCallback(cbFinal);
                                return;
                            }
                        });
                    } else {
                        target.handleCallback(cbFinal);
                        return;
                    }
                }


            },
            "delSearch": (search,cbFinal) => {
                target.initHandleCallback();

                let cursor = 0;
                let results = [];

                let counter;
                let len;
                let delCount = 0;

                function searchStep() {
                    target.client.scan(cursor,"MATCH",search, (err,reply) => {

                        if (err) {
                            target.handleCallback(cbFinal,err);
                            return;
                        }
                        if (reply==null || reply.length!=2) {
                            target.handleCallback(cbFinal,new Error("No reply"));
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
                        target.handleCallback(cbFinal,null,delCount);
                        return;
                    }
                }
                function loopStep() {
                    if (counter < len ) {
                        let key = results[counter++];

                        target.client.del(key,function(err,result) {
                            if (err) {
                                target.handleCallback(cbFinal,err);
                                return;
                            }
                            delCount+=result;
                            loopNext();
                        });
                    } else {
                        target.handleCallback(cbFinal,null,delCount);
                        return;
                    }
                }

            }
        };

        this.handler = {
            get: this._getHandler,
            set: this._setHandler
        };

        target.proxy = new Proxy(this.target,this.handler);
        return target.proxy;

    }

    //-------------------------------------------------------
    // Proxy Handlers
    //-------------------------------------------------------

    _getHandler(target,key) {

        if (target.methods.hasOwnProperty(key))
            return target.methods[key];

        return (...args) => {
           // console.log("key",key);
           // console.log("Args",args);


            try {
                target.initHandleCallback();
            } catch (err) {

            }

            let argLength = 0;
            if (args!=null) argLength = args.length;

            let lastArgReplaced = false;
            /*
            Replace last arg if it is a function, and wrap it with our
            handleCallback so it may go through suspend.
             */
            if (argLength>=1) {
                let lastArg = args[argLength - 1];
                if (lastArg != null && typeof(lastArg) === "function") {
                    lastArgReplaced = true;
                    args[argLength - 1] = (...innerargs) => {
                       target.handleCallback(lastArg, ...innerargs);
                    }
                }
            }

            //no cb replaced, so add one
            if (!lastArgReplaced) {
                args.push((...innerargs) => {
                  //  console.log("final cb");
                  //  console.log("inner args",innerargs);
                    target.handleCallback(null, ...innerargs);
                });
            }

           //console.log("final args",args);

            target.client[key](...args);

        };
    }

    _setHandler(target,key,value) {

        if (target.methods.hasOwnProperty(key))
            throw new Error("Property '"+key+"' is a reserved name and cannot be used.");

        target.client[key] = value;
        return true;
    }

}

module.exports = RedisSuspend;

let redis = require("redis");


/*
//TODO //IDEA

 multi = client.multi();
 multi.incr("incr thing", redis.print);
 multi.incr("incr other thing", redis.print);
 multi.exec(function (err, replies) {
    console.log(replies); // 101, 2
 });

 We can try to wrap the multi object that is returned with a second proxy,
 and then allow the multi also support the generator/yield async control flow.



 */

class MultiProxy {

    constructor(parent,multi) {

        this.target = {
            parent: parent,
            multi: multi,
            resume: parent.target.resume,
            resume_next: null
        };

        let target = this.target;

        this.target.initHandleCallback = () => {
            if (target.resume)
                target.resume_next = target.resume();
            else
                target.resume_next = null;
        };
        this.target.handleCallback = (cb, ...args) => {
            if (args!=null && args.length>=1 && args[0]!=null) {
                target.last_error = args[0];
            } else {
                target.last_error = null;
            }
            if (cb)
                cb(...args, target.resume_next);
            else if (target.resume_next)
                target.resume_next(...args);
        };

        this.handler = {
            get: this._getHandler,
            set: this._setHandler
        };


        return new Proxy(this.target,this.handler);
    }


    //-------------------------------------------------------
    // Proxy Handlers
    //-------------------------------------------------------

    _getHandler(target,key) {

        return (...args) => {
            // console.log("key",key);
            // console.log("Args",args);

            if (key=="exec") {


                try {
                    target.initHandleCallback();
                } catch (err) {

                }

                let argLength = 0;
                if (args != null) argLength = args.length;

                let lastArgReplaced = false;
                /*
                 Replace last arg if it is a function, and wrap it with our
                 handleCallback so it may go through suspend.
                 */
                if (argLength >= 1) {
                    let lastArg = args[argLength - 1];
                    if (lastArg != null && typeof(lastArg) === "function") {
                        lastArgReplaced = true;
                        args[argLength - 1] = (...innerargs) => {
                            target.handleCallback(lastArg, ...innerargs);
                        }
                    }
                }

                //no cb replaced, so add one
                if (!lastArgReplaced) {
                    args.push((...innerargs) => {
                        //  console.log("final cb");
                        //  console.log("inner args",innerargs);
                        target.handleCallback(null, ...innerargs);
                    });
                }

                //console.log("final args",args);
            }

            target.multi[key](...args);

        };
    }

    _setHandler(target,key,value) {

        target.multi[key] = value;
        return true;
    }
}

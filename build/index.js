(function (global){


var ym = {
	"project": {
		"preload": [],
		"namespace": "ym",
		"jsonpPrefix": "",
		"loadLimit": 500
	},
	"ns": {},
	"env": {},
	"envCallbacks": []
};

(function () {
var module = { exports: {} }, exports = module.exports;
/**
 * Modules
 *
 * Copyright (c) 2013 Filatov Dmitry (dfilatov@yandex-team.ru)
 * Dual licensed under the MIT and GPL licenses:
 * http://www.opensource.org/licenses/mit-license.php
 * http://www.gnu.org/licenses/gpl.html
 *
 * @version 0.1.0
 */

(function(global) {

var undef,

    DECL_STATES = {
        NOT_RESOLVED : 'NOT_RESOLVED',
        IN_RESOLVING : 'IN_RESOLVING',
        RESOLVED     : 'RESOLVED'
    },

    /**
     * Creates a new instance of modular system
     * @returns {Object}
     */
    create = function() {
        var curOptions = {
                trackCircularDependencies : true,
                allowMultipleDeclarations : true
            },

            modulesStorage = {},
            waitForNextTick = false,
            pendingRequires = [],

            /**
             * Defines module
             * @param {String} name
             * @param {String[]} [deps]
             * @param {Function} declFn
             */
            define = function(name, deps, declFn) {
                if(!declFn) {
                    declFn = deps;
                    deps = [];
                }

                var module = modulesStorage[name];
                if(!module) {
                    module = modulesStorage[name] = {
                        name : name,
                        decl : undef
                    };
                }

                module.decl = {
                    name       : name,
                    prev       : module.decl,
                    fn         : declFn,
                    state      : DECL_STATES.NOT_RESOLVED,
                    deps       : deps,
                    dependents : [],
                    exports    : undef
                };
            },

            /**
             * Requires modules
             * @param {String|String[]} modules
             * @param {Function} cb
             * @param {Function} [errorCb]
             */
            require = function(modules, cb, errorCb) {
                if(typeof modules === 'string') {
                    modules = [modules];
                }

                if(!waitForNextTick) {
                    waitForNextTick = true;
                    nextTick(onNextTick);
                }

                pendingRequires.push({
                    deps : modules,
                    cb   : function(exports, error) {
                        error?
                            (errorCb || onError)(error) :
                            cb.apply(global, exports);
                    }
                });
            },

            /**
             * Returns state of module
             * @param {String} name
             * @returns {String} state, possible values are NOT_DEFINED, NOT_RESOLVED, IN_RESOLVING, RESOLVED
             */
            getState = function(name) {
                var module = modulesStorage[name];
                return module?
                    DECL_STATES[module.decl.state] :
                    'NOT_DEFINED';
            },

            /**
             * Returns dependencies of module
             * @param {String} name
             * @returns {String[]|null}
             */
            getDependencies = function (name) {
                var module = modulesStorage[name];
                return module ? module.decl.deps : null;
            },

            /**
             * Returns whether the module is defined
             * @param {String} name
             * @returns {Boolean}
             */
            isDefined = function(name) {
                return !!modulesStorage[name];
            },

            /**
             * Sets options
             * @param {Object} options
             */
            setOptions = function(options) {
                for(var name in options) {
                    if(options.hasOwnProperty(name)) {
                        curOptions[name] = options[name];
                    }
                }
            },

            onNextTick = function() {
                waitForNextTick = false;
                applyRequires();
            },

            applyRequires = function() {
                var requiresToProcess = pendingRequires,
                    i = 0, require;

                pendingRequires = [];

                while(require = requiresToProcess[i++]) {
                    requireDeps(null, require.deps, [], require.cb);
                }
            },

            requireDeps = function(fromDecl, deps, path, cb) {
                var unresolvedDepsCnt = deps.length;
                if(!unresolvedDepsCnt) {
                    cb([]);
                }

                var decls = [],
                    onDeclResolved = function(_, error) {
                        if(error) {
                            cb(null, error);
                            return;
                        }

                        if(!--unresolvedDepsCnt) {
                            var exports = [],
                                i = 0, decl;
                            while(decl = decls[i++]) {
                                exports.push(decl.exports);
                            }
                            cb(exports);
                        }
                    },
                    i = 0, len = unresolvedDepsCnt,
                    dep, decl;

                while(i < len) {
                    dep = deps[i++];
                    if(typeof dep === 'string') {
                        if(!modulesStorage[dep]) {
                            cb(null, buildModuleNotFoundError(dep, fromDecl));
                            return;
                        }

                        decl = modulesStorage[dep].decl;
                    }
                    else {
                        decl = dep;
                    }

                    decls.push(decl);

                    startDeclResolving(decl, path, onDeclResolved);
                }
            },

            startDeclResolving = function(decl, path, cb) {
                if(decl.state === DECL_STATES.RESOLVED) {
                    cb(decl.exports);
                    return;
                }
                else if(decl.state === DECL_STATES.IN_RESOLVING) {
                    curOptions.trackCircularDependencies && isDependenceCircular(decl, path)?
                        cb(null, buildCircularDependenceError(decl, path)) :
                        decl.dependents.push(cb);
                    return;
                }

                decl.dependents.push(cb);

                if(decl.prev && !curOptions.allowMultipleDeclarations) {
                    provideError(decl, buildMultipleDeclarationError(decl));
                    return;
                }

                curOptions.trackCircularDependencies && (path = path.slice()).push(decl);

                var isProvided = false,
                    deps = decl.prev? decl.deps.concat([decl.prev]) : decl.deps;

                decl.state = DECL_STATES.IN_RESOLVING;
                requireDeps(
                    decl,
                    deps,
                    path,
                    function(depDeclsExports, error) {
                        if(error) {
                            provideError(decl, error);
                            return;
                        }

                        depDeclsExports.unshift(function(exports, error) {
                            if(isProvided) {
                                cb(null, buildDeclAreadyProvidedError(decl));
                                return;
                            }

                            isProvided = true;
                            error?
                                provideError(decl, error) :
                                provideDecl(decl, exports);
                        });

                        decl.fn.apply(
                            {
                                name   : decl.name,
                                deps   : decl.deps,
                                global : global
                            },
                            depDeclsExports);
                    });
            },

            provideDecl = function(decl, exports) {
                decl.exports = exports;
                decl.state = DECL_STATES.RESOLVED;

                var i = 0, dependent;
                while(dependent = decl.dependents[i++]) {
                    dependent(exports);
                }

                decl.dependents = undef;
            },

            provideError = function(decl, error) {
                decl.state = DECL_STATES.NOT_RESOLVED;

                var i = 0, dependent;
                while(dependent = decl.dependents[i++]) {
                    dependent(null, error);
                }

                decl.dependents = [];
            };

        return {
            create          : create,
            define          : define,
            require         : require,
            getState        : getState,
            getDependencies : getDependencies,
            isDefined       : isDefined,
            setOptions      : setOptions,
            flush           : onNextTick,
            nextTick        : nextTick
        };
    },

    onError = function(e) {
        nextTick(function() {
            throw e;
        });
    },

    buildModuleNotFoundError = function(name, decl) {
        return Error(decl?
            'Module "' + decl.name + '": can\'t resolve dependence "' + name + '"' :
            'Required module "' + name + '" can\'t be resolved');
    },

    buildCircularDependenceError = function(decl, path) {
        var strPath = [],
            i = 0, pathDecl;
        while(pathDecl = path[i++]) {
            strPath.push(pathDecl.name);
        }
        strPath.push(decl.name);

        return Error('Circular dependence has been detected: "' + strPath.join(' -> ') + '"');
    },

    buildDeclAreadyProvidedError = function(decl) {
        return Error('Declaration of module "' + decl.name + '" has already been provided');
    },

    buildMultipleDeclarationError = function(decl) {
        return Error('Multiple declarations of module "' + decl.name + '" have been detected');
    },

    isDependenceCircular = function(decl, path) {
        var i = 0, pathDecl;
        while(pathDecl = path[i++]) {
            if(decl === pathDecl) {
                return true;
            }
        }
        return false;
    },

    nextTick = (function() {
        var fns = [],
            enqueueFn = function(fn) {
                return fns.push(fn) === 1;
            },
            callFns = function() {
                var fnsToCall = fns, i = 0, len = fns.length;
                fns = [];
                while(i < len) {
                    fnsToCall[i++]();
                }
            };

        if(typeof process === 'object' && process.nextTick) { // nodejs
            return function(fn) {
                enqueueFn(fn) && process.nextTick(callFns);
            };
        }

        if(global.setImmediate) { // ie10
            return function(fn) {
                enqueueFn(fn) && global.setImmediate(callFns);
            };
        }

        if(global.postMessage && !global.opera) { // modern browsers
            var isPostMessageAsync = true;
            if(global.attachEvent) {
                var checkAsync = function() {
                        isPostMessageAsync = false;
                    };
                global.attachEvent('onmessage', checkAsync);
                global.postMessage('__checkAsync', '*');
                global.detachEvent('onmessage', checkAsync);
            }

            if(isPostMessageAsync) {
                var msg = '__modules' + (+new Date()),
                    onMessage = function(e) {
                        if(e.data === msg) {
                            e.stopPropagation && e.stopPropagation();
                            callFns();
                        }
                    };

                global.addEventListener?
                    global.addEventListener('message', onMessage, true) :
                    global.attachEvent('onmessage', onMessage);

                return function(fn) {
                    enqueueFn(fn) && global.postMessage(msg, '*');
                };
            }
        }

        var doc = global.document;
        if('onreadystatechange' in doc.createElement('script')) { // ie6-ie8
            var head = doc.getElementsByTagName('head')[0],
                createScript = function() {
                    var script = doc.createElement('script');
                    script.onreadystatechange = function() {
                        script.parentNode.removeChild(script);
                        script = script.onreadystatechange = null;
                        callFns();
                    };
                    head.appendChild(script);
                };

            return function(fn) {
                enqueueFn(fn) && createScript();
            };
        }

        return function(fn) { // old browsers
            enqueueFn(fn) && setTimeout(callFns, 0);
        };
    })();

if(typeof exports === 'object') {
    module.exports = create();
}
else {
    global.modules = create();
}

})(this);

ym['modules'] = module.exports;
})();
ym.modules.setOptions({
   trackCircularDependencies: true,
   allowMultipleDeclarations: false
});
ym.ns.modules = ym.modules;

(function () {
var module = { exports: {} }, exports = module.exports;
var define, modules;/**
 * @module vow
 * @author Filatov Dmitry <dfilatov@yandex-team.ru>
 * @version 0.4.7
 * @license
 * Dual licensed under the MIT and GPL licenses:
 *   * http://www.opensource.org/licenses/mit-license.php
 *   * http://www.gnu.org/licenses/gpl.html
 */

(function(global) {

var undef,
    nextTick = (function() {
        var fns = [],
            enqueueFn = function(fn) {
                return fns.push(fn) === 1;
            },
            callFns = function() {
                var fnsToCall = fns, i = 0, len = fns.length;
                fns = [];
                while(i < len) {
                    fnsToCall[i++]();
                }
            };

        if(typeof setImmediate === 'function') { // ie10, nodejs >= 0.10
            return function(fn) {
                enqueueFn(fn) && setImmediate(callFns);
            };
        }

        if(typeof process === 'object' && process.nextTick) { // nodejs < 0.10
            return function(fn) {
                enqueueFn(fn) && process.nextTick(callFns);
            };
        }

        if(global.postMessage) { // modern browsers
            var isPostMessageAsync = true;
            if(global.attachEvent) {
                var checkAsync = function() {
                        isPostMessageAsync = false;
                    };
                global.attachEvent('onmessage', checkAsync);
                global.postMessage('__checkAsync', '*');
                global.detachEvent('onmessage', checkAsync);
            }

            if(isPostMessageAsync) {
                var msg = '__promise' + +new Date,
                    onMessage = function(e) {
                        if(e.data === msg) {
                            e.stopPropagation && e.stopPropagation();
                            callFns();
                        }
                    };

                global.addEventListener?
                    global.addEventListener('message', onMessage, true) :
                    global.attachEvent('onmessage', onMessage);

                return function(fn) {
                    enqueueFn(fn) && global.postMessage(msg, '*');
                };
            }
        }

        var doc = global.document;
        if('onreadystatechange' in doc.createElement('script')) { // ie6-ie8
            var createScript = function() {
                    var script = doc.createElement('script');
                    script.onreadystatechange = function() {
                        script.parentNode.removeChild(script);
                        script = script.onreadystatechange = null;
                        callFns();
                };
                (doc.documentElement || doc.body).appendChild(script);
            };

            return function(fn) {
                enqueueFn(fn) && createScript();
            };
        }

        return function(fn) { // old browsers
            enqueueFn(fn) && setTimeout(callFns, 0);
        };
    })(),
    safeExec = function(func, onError, ctx) {
        if (vow.debug) {
            ctx ? func.call(ctx) : func();
        } else {
            try {
                ctx ? func.call(ctx) : func();
            } catch (e) {
                ctx ? onError.call(ctx, e) : onError(e);
                return false;
            }
        }

        return true;
    },
    throwException = function(e) {
        nextTick(function() {
            throw e;
        });
    },
    isFunction = function(obj) {
        return typeof obj === 'function';
    },
    isObject = function(obj) {
        return obj !== null && typeof obj === 'object';
    },
    toStr = Object.prototype.toString,
    isArray = Array.isArray || function(obj) {
        return toStr.call(obj) === '[object Array]';
    },
    getArrayKeys = function(arr) {
        var res = [],
            i = 0, len = arr.length;
        while(i < len) {
            res.push(i++);
        }
        return res;
    },
    getObjectKeys = Object.keys || function(obj) {
        var res = [];
        for(var i in obj) {
            obj.hasOwnProperty(i) && res.push(i);
        }
        return res;
    },
    defineCustomErrorType = function(name) {
        var res = function(message) {
            this.name = name;
            this.message = message;
        };

        res.prototype = new Error();

        return res;
    },
    wrapOnFulfilled = function(onFulfilled, idx) {
        return function(val) {
            onFulfilled.call(this, val, idx);
        };
    };

/**
 * @class Deferred
 * @exports vow:Deferred
 * @description
 * The `Deferred` class is used to encapsulate newly-created promise object along with functions that resolve, reject or notify it.
 */

/**
 * @constructor
 * @description
 * You can use `vow.defer()` instead of using this constructor.
 *
 * `new vow.Deferred()` gives the same result as `vow.defer()`.
 */
var Deferred = function() {
    this._promise = new Promise();
};

Deferred.prototype = /** @lends Deferred.prototype */{
    /**
     * Returns corresponding promise.
     *
     * @returns {vow:Promise}
     */
    promise : function() {
        return this._promise;
    },

    /**
     * Resolves corresponding promise with given `value`.
     *
     * @param {*} value
     *
     * @example
     * ```js
     * var defer = vow.defer(),
     *     promise = defer.promise();
     *
     * promise.then(function(value) {
     *     // value is "'success'" here
     * });
     *
     * defer.resolve('success');
     * ```
     */
    resolve : function(value) {
        this._promise.isResolved() || this._promise._resolve(value);
    },

    /**
     * Rejects corresponding promise with given `reason`.
     *
     * @param {*} reason
     *
     * @example
     * ```js
     * var defer = vow.defer(),
     *     promise = defer.promise();
     *
     * promise.fail(function(reason) {
     *     // reason is "'something is wrong'" here
     * });
     *
     * defer.reject('something is wrong');
     * ```
     */
    reject : function(reason) {
        if(this._promise.isResolved()) {
            return;
        }

        if(vow.isPromise(reason)) {
            reason = reason.then(function(val) {
                var defer = vow.defer();
                defer.reject(val);
                return defer.promise();
            });
            this._promise._resolve(reason);
        }
        else {
            this._promise._reject(reason);
        }
    },

    /**
     * Notifies corresponding promise with given `value`.
     *
     * @param {*} value
     *
     * @example
     * ```js
     * var defer = vow.defer(),
     *     promise = defer.promise();
     *
     * promise.progress(function(value) {
     *     // value is "'20%'", "'40%'" here
     * });
     *
     * defer.notify('20%');
     * defer.notify('40%');
     * ```
     */
    notify : function(value) {
        this._promise.isResolved() || this._promise._notify(value);
    }
};

var PROMISE_STATUS = {
    PENDING   : 0,
    RESOLVED  : 1,
    FULFILLED : 2,
    REJECTED  : 3
};

/**
 * @class Promise
 * @exports vow:Promise
 * @description
 * The `Promise` class is used when you want to give to the caller something to subscribe to,
 * but not the ability to resolve or reject the deferred.
 */

/**
 * @constructor
 * @param {Function} resolver See https://github.com/domenic/promises-unwrapping/blob/master/README.md#the-promise-constructor for details.
 * @description
 * You should use this constructor directly only if you are going to use `vow` as DOM Promises implementation.
 * In other case you should use `vow.defer()` and `defer.promise()` methods.
 * @example
 * ```js
 * function fetchJSON(url) {
 *     return new vow.Promise(function(resolve, reject, notify) {
 *         var xhr = new XMLHttpRequest();
 *         xhr.open('GET', url);
 *         xhr.responseType = 'json';
 *         xhr.send();
 *         xhr.onload = function() {
 *             if(xhr.response) {
 *                 resolve(xhr.response);
 *             }
 *             else {
 *                 reject(new TypeError());
 *             }
 *         };
 *     });
 * }
 * ```
 */
var Promise = function(resolver) {
    this._value = undef;
    this._status = PROMISE_STATUS.PENDING;

    this._fulfilledCallbacks = [];
    this._rejectedCallbacks = [];
    this._progressCallbacks = [];

    if(resolver) { // NOTE: see https://github.com/domenic/promises-unwrapping/blob/master/README.md
        var _this = this,
            resolverFnLen = resolver.length;

        resolver(
            function(val) {
                _this.isResolved() || _this._resolve(val);
            },
            resolverFnLen > 1?
                function(reason) {
                    _this.isResolved() || _this._reject(reason);
                } :
                undef,
            resolverFnLen > 2?
                function(val) {
                    _this.isResolved() || _this._notify(val);
                } :
                undef);
    }
};

Promise.prototype = /** @lends Promise.prototype */ {
    /**
     * Returns value of fulfilled promise or reason in case of rejection.
     *
     * @returns {*}
     */
    valueOf : function() {
        return this._value;
    },

    /**
     * Returns `true` if promise is resolved.
     *
     * @returns {Boolean}
     */
    isResolved : function() {
        return this._status !== PROMISE_STATUS.PENDING;
    },

    /**
     * Returns `true` if promise is fulfilled.
     *
     * @returns {Boolean}
     */
    isFulfilled : function() {
        return this._status === PROMISE_STATUS.FULFILLED;
    },

    /**
     * Returns `true` if promise is rejected.
     *
     * @returns {Boolean}
     */
    isRejected : function() {
        return this._status === PROMISE_STATUS.REJECTED;
    },

    /**
     * Adds reactions to promise.
     *
     * @param {Function} [onFulfilled] Callback that will to be invoked with the value after promise has been fulfilled
     * @param {Function} [onRejected] Callback that will to be invoked with the reason after promise has been rejected
     * @param {Function} [onProgress] Callback that will to be invoked with the value after promise has been notified
     * @param {Object} [ctx] Context of callbacks execution
     * @returns {vow:Promise} A new promise, see https://github.com/promises-aplus/promises-spec for details
     */
    then : function(onFulfilled, onRejected, onProgress, ctx) {
        var defer = new Deferred();
        this._addCallbacks(defer, onFulfilled, onRejected, onProgress, ctx);
        return defer.promise();
    },

    /**
     * Adds rejection reaction only. It is shortcut for `promise.then(undefined, onRejected)`.
     *
     * @param {Function} onRejected Callback to be called with the value after promise has been rejected
     * @param {Object} [ctx] Context of callback execution
     * @returns {vow:Promise}
     */
    'catch' : function(onRejected, ctx) {
        return this.then(undef, onRejected, ctx);
    },

    /**
     * Adds rejection reaction only. It is shortcut for `promise.then(null, onRejected)`. It's alias for `catch`.
     *
     * @param {Function} onRejected Callback to be called with the value after promise has been rejected
     * @param {Object} [ctx] Context of callback execution
     * @returns {vow:Promise}
     */
    fail : function(onRejected, ctx) {
        return this.then(undef, onRejected, ctx);
    },

    /**
     * Adds resolving reaction (to fulfillment and rejection both).
     *
     * @param {Function} onResolved Callback that to be called with the value after promise has been rejected
     * @param {Object} [ctx] Context of callback execution
     * @returns {vow:Promise}
     */
    always : function(onResolved, ctx) {
        var _this = this,
            cb = function() {
                return onResolved.call(this, _this);
            };

        return this.then(cb, cb, ctx);
    },

    /**
     * Adds progress reaction.
     *
     * @param {Function} onProgress Callback to be called with the value when promise has been notified
     * @param {Object} [ctx] Context of callback execution
     * @returns {vow:Promise}
     */
    progress : function(onProgress, ctx) {
        return this.then(undef, undef, onProgress, ctx);
    },

    /**
     * Like `promise.then`, but "spreads" the array into a variadic value handler.
     * It is useful with `vow.all` and `vow.allResolved` methods.
     *
     * @param {Function} [onFulfilled] Callback that will to be invoked with the value after promise has been fulfilled
     * @param {Function} [onRejected] Callback that will to be invoked with the reason after promise has been rejected
     * @param {Object} [ctx] Context of callbacks execution
     * @returns {vow:Promise}
     *
     * @example
     * ```js
     * var defer1 = vow.defer(),
     *     defer2 = vow.defer();
     *
     * vow.all([defer1.promise(), defer2.promise()]).spread(function(arg1, arg2) {
     *     // arg1 is "1", arg2 is "'two'" here
     * });
     *
     * defer1.resolve(1);
     * defer2.resolve('two');
     * ```
     */
    spread : function(onFulfilled, onRejected, ctx) {
        return this.then(
            function(val) {
                return onFulfilled.apply(this, val);
            },
            onRejected,
            ctx);
    },

    /**
     * Like `then`, but terminates a chain of promises.
     * If the promise has been rejected, throws it as an exception in a future turn of the event loop.
     *
     * @param {Function} [onFulfilled] Callback that will to be invoked with the value after promise has been fulfilled
     * @param {Function} [onRejected] Callback that will to be invoked with the reason after promise has been rejected
     * @param {Function} [onProgress] Callback that will to be invoked with the value after promise has been notified
     * @param {Object} [ctx] Context of callbacks execution
     *
     * @example
     * ```js
     * var defer = vow.defer();
     * defer.reject(Error('Internal error'));
     * defer.promise().done(); // exception to be thrown
     * ```
     */
    done : function(onFulfilled, onRejected, onProgress, ctx) {
        this
            .then(onFulfilled, onRejected, onProgress, ctx)
            .fail(throwException);
    },

    /**
     * Returns a new promise that will be fulfilled in `delay` milliseconds if the promise is fulfilled,
     * or immediately rejected if promise is rejected.
     *
     * @param {Number} delay
     * @returns {vow:Promise}
     */
    delay : function(delay) {
        var timer,
            promise = this.then(function(val) {
                var defer = new Deferred();
                timer = setTimeout(
                    function() {
                        defer.resolve(val);
                    },
                    delay);

                return defer.promise();
            });

        promise.always(function() {
            clearTimeout(timer);
        });

        return promise;
    },

    /**
     * Returns a new promise that will be rejected in `timeout` milliseconds
     * if the promise is not resolved beforehand.
     *
     * @param {Number} timeout
     * @returns {vow:Promise}
     *
     * @example
     * ```js
     * var defer = vow.defer(),
     *     promiseWithTimeout1 = defer.promise().timeout(50),
     *     promiseWithTimeout2 = defer.promise().timeout(200);
     *
     * setTimeout(
     *     function() {
     *         defer.resolve('ok');
     *     },
     *     100);
     *
     * promiseWithTimeout1.fail(function(reason) {
     *     // promiseWithTimeout to be rejected in 50ms
     * });
     *
     * promiseWithTimeout2.then(function(value) {
     *     // promiseWithTimeout to be fulfilled with "'ok'" value
     * });
     * ```
     */
    timeout : function(timeout) {
        var defer = new Deferred(),
            timer = setTimeout(
                function() {
                    defer.reject(new vow.TimedOutError('timed out'));
                },
                timeout);

        this.then(
            function(val) {
                defer.resolve(val);
            },
            function(reason) {
                defer.reject(reason);
            });

        defer.promise().always(function() {
            clearTimeout(timer);
        });

        return defer.promise();
    },

    _vow : true,

    _resolve : function(val) {
        if(this._status > PROMISE_STATUS.RESOLVED) {
            return;
        }

        if(val === this) {
            this._reject(TypeError('Can\'t resolve promise with itself'));
            return;
        }

        this._status = PROMISE_STATUS.RESOLVED;

        if(val && !!val._vow) { // shortpath for vow.Promise
            val.isFulfilled()?
                this._fulfill(val.valueOf()) :
                val.isRejected()?
                    this._reject(val.valueOf()) :
                    val.then(
                        this._fulfill,
                        this._reject,
                        this._notify,
                        this);
            return;
        }

        if(isObject(val) || isFunction(val)) {
            var then,
                callSuccess = safeExec(function() {
                    then = val.then;
                }, function (e) {
                    this._reject(e);
                }, this);

            if (!callSuccess) {
                return;
            }

            if(isFunction(then)) {
                var _this = this,
                    isResolved = false;

                safeExec(function() {
                    then.call(
                        val,
                        function(val) {
                            if(isResolved) {
                                return;
                            }

                            isResolved = true;
                            _this._resolve(val);
                        },
                        function(err) {
                            if(isResolved) {
                                return;
                            }

                            isResolved = true;
                            _this._reject(err);
                        },
                        function(val) {
                            _this._notify(val);
                        });
                }, function(e) {
                    isResolved || this._reject(e);
                }, this);

                return;
            }
        }

        this._fulfill(val);
    },

    _fulfill : function(val) {
        if(this._status > PROMISE_STATUS.RESOLVED) {
            return;
        }

        this._status = PROMISE_STATUS.FULFILLED;
        this._value = val;

        this._callCallbacks(this._fulfilledCallbacks, val);
        this._fulfilledCallbacks = this._rejectedCallbacks = this._progressCallbacks = undef;
    },

    _reject : function(reason) {
        if(this._status > PROMISE_STATUS.RESOLVED) {
            return;
        }

        this._status = PROMISE_STATUS.REJECTED;
        this._value = reason;

        this._callCallbacks(this._rejectedCallbacks, reason);
        this._fulfilledCallbacks = this._rejectedCallbacks = this._progressCallbacks = undef;
    },

    _notify : function(val) {
        this._callCallbacks(this._progressCallbacks, val);
    },

    _addCallbacks : function(defer, onFulfilled, onRejected, onProgress, ctx) {
        if(onRejected && !isFunction(onRejected)) {
            ctx = onRejected;
            onRejected = undef;
        }
        else if(onProgress && !isFunction(onProgress)) {
            ctx = onProgress;
            onProgress = undef;
        }

        var cb;

        if(!this.isRejected()) {
            cb = { defer : defer, fn : isFunction(onFulfilled)? onFulfilled : undef, ctx : ctx };
            this.isFulfilled()?
                this._callCallbacks([cb], this._value) :
                this._fulfilledCallbacks.push(cb);
        }

        if(!this.isFulfilled()) {
            cb = { defer : defer, fn : onRejected, ctx : ctx };
            this.isRejected()?
                this._callCallbacks([cb], this._value) :
                this._rejectedCallbacks.push(cb);
        }

        if(this._status <= PROMISE_STATUS.RESOLVED) {
            this._progressCallbacks.push({ defer : defer, fn : onProgress, ctx : ctx });
        }
    },

    _callCallbacks : function(callbacks, arg) {
        var len = callbacks.length;
        if(!len) {
            return;
        }

        var isResolved = this.isResolved(),
            isFulfilled = this.isFulfilled();

        nextTick(function() {
            var i = 0, cb, defer, fn;
            while(i < len) {
                cb = callbacks[i++];
                defer = cb.defer;
                fn = cb.fn;

                if(fn) {
                    var ctx = cb.ctx,
                        res,
                        callSuccess = safeExec(function() {
                            res = ctx? fn.call(ctx, arg) : fn(arg);
                        }, function(e) {
                            defer.reject(e);
                        });

                    if (!callSuccess) {
                        continue;
                    }

                    isResolved?
                        defer.resolve(res) :
                        defer.notify(res);
                }
                else {
                    isResolved?
                        isFulfilled?
                            defer.resolve(arg) :
                            defer.reject(arg) :
                        defer.notify(arg);
                }
            }
        });
    }
};

/** @lends Promise */
var staticMethods = {
    /**
     * Coerces given `value` to a promise, or returns the `value` if it's already a promise.
     *
     * @param {*} value
     * @returns {vow:Promise}
     */
    cast : function(value) {
        return vow.cast(value);
    },

    /**
     * Returns a promise to be fulfilled only after all the items in `iterable` are fulfilled,
     * or to be rejected when any of the `iterable` is rejected.
     *
     * @param {Array|Object} iterable
     * @returns {vow:Promise}
     */
    all : function(iterable) {
        return vow.all(iterable);
    },

    /**
     * Returns a promise to be fulfilled only when any of the items in `iterable` are fulfilled,
     * or to be rejected when the first item is rejected.
     *
     * @param {Array} iterable
     * @returns {vow:Promise}
     */
    race : function(iterable) {
        return vow.anyResolved(iterable);
    },

    /**
     * Returns a promise that has already been resolved with the given `value`.
     * If `value` is a promise, returned promise will be adopted with the state of given promise.
     *
     * @param {*} value
     * @returns {vow:Promise}
     */
    resolve : function(value) {
        return vow.resolve(value);
    },

    /**
     * Returns a promise that has already been rejected with the given `reason`.
     *
     * @param {*} reason
     * @returns {vow:Promise}
     */
    reject : function(reason) {
        return vow.reject(reason);
    }
};

for(var prop in staticMethods) {
    staticMethods.hasOwnProperty(prop) &&
        (Promise[prop] = staticMethods[prop]);
}

var vow = /** @exports vow */ {
    /**
     * @property {boolean}
     * @default
     * Disables rejection of promises by throwing exceptions. Will cause all exceptions be thrown during runtime.
     */
    debug : false,

    Deferred : Deferred,

    Promise : Promise,

    /**
     * Creates a new deferred. This method is a factory method for `vow:Deferred` class.
     * It's equivalent to `new vow.Deferred()`.
     *
     * @returns {vow:Deferred}
     */
    defer : function() {
        return new Deferred();
    },

    /**
     * Static equivalent to `promise.then`.
     * If given `value` is not a promise, then `value` is equivalent to fulfilled promise.
     *
     * @param {*} value
     * @param {Function} [onFulfilled] Callback that will to be invoked with the value after promise has been fulfilled
     * @param {Function} [onRejected] Callback that will to be invoked with the reason after promise has been rejected
     * @param {Function} [onProgress] Callback that will to be invoked with the value after promise has been notified
     * @param {Object} [ctx] Context of callbacks execution
     * @returns {vow:Promise}
     */
    when : function(value, onFulfilled, onRejected, onProgress, ctx) {
        return vow.cast(value).then(onFulfilled, onRejected, onProgress, ctx);
    },

    /**
     * Static equivalent to `promise.fail`.
     * If given `value` is not a promise, then `value` is equivalent to fulfilled promise.
     *
     * @param {*} value
     * @param {Function} onRejected Callback that will to be invoked with the reason after promise has been rejected
     * @param {Object} [ctx] Context of callback execution
     * @returns {vow:Promise}
     */
    fail : function(value, onRejected, ctx) {
        return vow.when(value, undef, onRejected, ctx);
    },

    /**
     * Static equivalent to `promise.always`.
     * If given `value` is not a promise, then `value` is equivalent to fulfilled promise.
     *
     * @param {*} value
     * @param {Function} onResolved Callback that will to be invoked with the reason after promise has been resolved
     * @param {Object} [ctx] Context of callback execution
     * @returns {vow:Promise}
     */
    always : function(value, onResolved, ctx) {
        return vow.when(value).always(onResolved, ctx);
    },

    /**
     * Static equivalent to `promise.progress`.
     * If given `value` is not a promise, then `value` is equivalent to fulfilled promise.
     *
     * @param {*} value
     * @param {Function} onProgress Callback that will to be invoked with the reason after promise has been notified
     * @param {Object} [ctx] Context of callback execution
     * @returns {vow:Promise}
     */
    progress : function(value, onProgress, ctx) {
        return vow.when(value).progress(onProgress, ctx);
    },

    /**
     * Static equivalent to `promise.spread`.
     * If given `value` is not a promise, then `value` is equivalent to fulfilled promise.
     *
     * @param {*} value
     * @param {Function} [onFulfilled] Callback that will to be invoked with the value after promise has been fulfilled
     * @param {Function} [onRejected] Callback that will to be invoked with the reason after promise has been rejected
     * @param {Object} [ctx] Context of callbacks execution
     * @returns {vow:Promise}
     */
    spread : function(value, onFulfilled, onRejected, ctx) {
        return vow.when(value).spread(onFulfilled, onRejected, ctx);
    },

    /**
     * Static equivalent to `promise.done`.
     * If given `value` is not a promise, then `value` is equivalent to fulfilled promise.
     *
     * @param {*} value
     * @param {Function} [onFulfilled] Callback that will to be invoked with the value after promise has been fulfilled
     * @param {Function} [onRejected] Callback that will to be invoked with the reason after promise has been rejected
     * @param {Function} [onProgress] Callback that will to be invoked with the value after promise has been notified
     * @param {Object} [ctx] Context of callbacks execution
     */
    done : function(value, onFulfilled, onRejected, onProgress, ctx) {
        vow.when(value).done(onFulfilled, onRejected, onProgress, ctx);
    },

    /**
     * Checks whether the given `value` is a promise-like object
     *
     * @param {*} value
     * @returns {Boolean}
     *
     * @example
     * ```js
     * vow.isPromise('something'); // returns false
     * vow.isPromise(vow.defer().promise()); // returns true
     * vow.isPromise({ then : function() { }); // returns true
     * ```
     */
    isPromise : function(value) {
        return isObject(value) && isFunction(value.then);
    },

    /**
     * Coerces given `value` to a promise, or returns the `value` if it's already a promise.
     *
     * @param {*} value
     * @returns {vow:Promise}
     */
    cast : function(value) {
        return vow.isPromise(value)?
            value :
            vow.resolve(value);
    },

    /**
     * Static equivalent to `promise.valueOf`.
     * If given `value` is not an instance of `vow.Promise`, then `value` is equivalent to fulfilled promise.
     *
     * @param {*} value
     * @returns {*}
     */
    valueOf : function(value) {
        return value && isFunction(value.valueOf)? value.valueOf() : value;
    },

    /**
     * Static equivalent to `promise.isFulfilled`.
     * If given `value` is not an instance of `vow.Promise`, then `value` is equivalent to fulfilled promise.
     *
     * @param {*} value
     * @returns {Boolean}
     */
    isFulfilled : function(value) {
        return value && isFunction(value.isFulfilled)? value.isFulfilled() : true;
    },

    /**
     * Static equivalent to `promise.isRejected`.
     * If given `value` is not an instance of `vow.Promise`, then `value` is equivalent to fulfilled promise.
     *
     * @param {*} value
     * @returns {Boolean}
     */
    isRejected : function(value) {
        return value && isFunction(value.isRejected)? value.isRejected() : false;
    },

    /**
     * Static equivalent to `promise.isResolved`.
     * If given `value` is not a promise, then `value` is equivalent to fulfilled promise.
     *
     * @param {*} value
     * @returns {Boolean}
     */
    isResolved : function(value) {
        return value && isFunction(value.isResolved)? value.isResolved() : true;
    },

    /**
     * Returns a promise that has already been resolved with the given `value`.
     * If `value` is a promise, returned promise will be adopted with the state of given promise.
     *
     * @param {*} value
     * @returns {vow:Promise}
     */
    resolve : function(value) {
        var res = vow.defer();
        res.resolve(value);
        return res.promise();
    },

    /**
     * Returns a promise that has already been fulfilled with the given `value`.
     * If `value` is a promise, returned promise will be fulfilled with fulfill/rejection value of given promise.
     *
     * @param {*} value
     * @returns {vow:Promise}
     */
    fulfill : function(value) {
        var defer = vow.defer(),
            promise = defer.promise();

        defer.resolve(value);

        return promise.isFulfilled()?
            promise :
            promise.then(null, function(reason) {
                return reason;
            });
    },

    /**
     * Returns a promise that has already been rejected with the given `reason`.
     * If `reason` is a promise, returned promise will be rejected with fulfill/rejection value of given promise.
     *
     * @param {*} reason
     * @returns {vow:Promise}
     */
    reject : function(reason) {
        var defer = vow.defer();
        defer.reject(reason);
        return defer.promise();
    },

    /**
     * Invokes a given function `fn` with arguments `args`
     *
     * @param {Function} fn
     * @param {...*} [args]
     * @returns {vow:Promise}
     *
     * @example
     * ```js
     * var promise1 = vow.invoke(function(value) {
     *         return value;
     *     }, 'ok'),
     *     promise2 = vow.invoke(function() {
     *         throw Error();
     *     });
     *
     * promise1.isFulfilled(); // true
     * promise1.valueOf(); // 'ok'
     * promise2.isRejected(); // true
     * promise2.valueOf(); // instance of Error
     * ```
     */
    invoke : function(fn, args) {
        var len = Math.max(arguments.length - 1, 0),
            callArgs,
            res;
        if(len) { // optimization for V8
            callArgs = Array(len);
            var i = 0;
            while(i < len) {
                callArgs[i++] = arguments[i];
            }
        }

        safeExec(function () {
            res = vow.resolve(callArgs?
                fn.apply(global, callArgs) :
                fn.call(global));
        }, function(e) {
            res = vow.reject(e);
        });

        return res;
    },

    /**
     * Returns a promise to be fulfilled only after all the items in `iterable` are fulfilled,
     * or to be rejected when any of the `iterable` is rejected.
     *
     * @param {Array|Object} iterable
     * @returns {vow:Promise}
     *
     * @example
     * with array:
     * ```js
     * var defer1 = vow.defer(),
     *     defer2 = vow.defer();
     *
     * vow.all([defer1.promise(), defer2.promise(), 3])
     *     .then(function(value) {
     *          // value is "[1, 2, 3]" here
     *     });
     *
     * defer1.resolve(1);
     * defer2.resolve(2);
     * ```
     *
     * @example
     * with object:
     * ```js
     * var defer1 = vow.defer(),
     *     defer2 = vow.defer();
     *
     * vow.all({ p1 : defer1.promise(), p2 : defer2.promise(), p3 : 3 })
     *     .then(function(value) {
     *          // value is "{ p1 : 1, p2 : 2, p3 : 3 }" here
     *     });
     *
     * defer1.resolve(1);
     * defer2.resolve(2);
     * ```
     */
    all : function(iterable) {
        var defer = new Deferred(),
            isPromisesArray = isArray(iterable),
            keys = isPromisesArray?
                getArrayKeys(iterable) :
                getObjectKeys(iterable),
            len = keys.length,
            res = isPromisesArray? [] : {};

        if(!len) {
            defer.resolve(res);
            return defer.promise();
        }

        var i = len;
        vow._forEach(
            iterable,
            function(value, idx) {
                res[keys[idx]] = value;
                if(!--i) {
                    defer.resolve(res);
                }
            },
            defer.reject,
            defer.notify,
            defer,
            keys);

        return defer.promise();
    },

    /**
     * Returns a promise to be fulfilled only after all the items in `iterable` are resolved.
     *
     * @param {Array|Object} iterable
     * @returns {vow:Promise}
     *
     * @example
     * ```js
     * var defer1 = vow.defer(),
     *     defer2 = vow.defer();
     *
     * vow.allResolved([defer1.promise(), defer2.promise()]).spread(function(promise1, promise2) {
     *     promise1.isRejected(); // returns true
     *     promise1.valueOf(); // returns "'error'"
     *     promise2.isFulfilled(); // returns true
     *     promise2.valueOf(); // returns "'ok'"
     * });
     *
     * defer1.reject('error');
     * defer2.resolve('ok');
     * ```
     */
    allResolved : function(iterable) {
        var defer = new Deferred(),
            isPromisesArray = isArray(iterable),
            keys = isPromisesArray?
                getArrayKeys(iterable) :
                getObjectKeys(iterable),
            i = keys.length,
            res = isPromisesArray? [] : {};

        if(!i) {
            defer.resolve(res);
            return defer.promise();
        }

        var onResolved = function() {
                --i || defer.resolve(iterable);
            };

        vow._forEach(
            iterable,
            onResolved,
            onResolved,
            defer.notify,
            defer,
            keys);

        return defer.promise();
    },

    allPatiently : function(iterable) {
        return vow.allResolved(iterable).then(function() {
            var isPromisesArray = isArray(iterable),
                keys = isPromisesArray?
                    getArrayKeys(iterable) :
                    getObjectKeys(iterable),
                rejectedPromises, fulfilledPromises,
                len = keys.length, i = 0, key, promise;

            if(!len) {
                return isPromisesArray? [] : {};
            }

            while(i < len) {
                key = keys[i++];
                promise = iterable[key];
                if(vow.isRejected(promise)) {
                    rejectedPromises || (rejectedPromises = isPromisesArray? [] : {});
                    isPromisesArray?
                        rejectedPromises.push(promise.valueOf()) :
                        rejectedPromises[key] = promise.valueOf();
                }
                else if(!rejectedPromises) {
                    (fulfilledPromises || (fulfilledPromises = isPromisesArray? [] : {}))[key] = vow.valueOf(promise);
                }
            }

            if(rejectedPromises) {
                return vow.reject(rejectedPromises);
            }

            return fulfilledPromises;
        });
    },

    /**
     * Returns a promise to be fulfilled only when any of the items in `iterable` is fulfilled,
     * or to be rejected when all the items are rejected (with the reason of the first rejected item).
     *
     * @param {Array} iterable
     * @returns {vow:Promise}
     */
    any : function(iterable) {
        var defer = new Deferred(),
            len = iterable.length;

        if(!len) {
            defer.reject(Error());
            return defer.promise();
        }

        var i = 0, reason;
        vow._forEach(
            iterable,
            defer.resolve,
            function(e) {
                i || (reason = e);
                ++i === len && defer.reject(reason);
            },
            defer.notify,
            defer);

        return defer.promise();
    },

    /**
     * Returns a promise to be fulfilled only when any of the items in `iterable` is fulfilled,
     * or to be rejected when the first item is rejected.
     *
     * @param {Array} iterable
     * @returns {vow:Promise}
     */
    anyResolved : function(iterable) {
        var defer = new Deferred(),
            len = iterable.length;

        if(!len) {
            defer.reject(Error());
            return defer.promise();
        }

        vow._forEach(
            iterable,
            defer.resolve,
            defer.reject,
            defer.notify,
            defer);

        return defer.promise();
    },

    /**
     * Static equivalent to `promise.delay`.
     * If given `value` is not a promise, then `value` is equivalent to fulfilled promise.
     *
     * @param {*} value
     * @param {Number} delay
     * @returns {vow:Promise}
     */
    delay : function(value, delay) {
        return vow.resolve(value).delay(delay);
    },

    /**
     * Static equivalent to `promise.timeout`.
     * If given `value` is not a promise, then `value` is equivalent to fulfilled promise.
     *
     * @param {*} value
     * @param {Number} timeout
     * @returns {vow:Promise}
     */
    timeout : function(value, timeout) {
        return vow.resolve(value).timeout(timeout);
    },

    _forEach : function(promises, onFulfilled, onRejected, onProgress, ctx, keys) {
        var len = keys? keys.length : promises.length,
            i = 0;

        while(i < len) {
            vow.when(
                promises[keys? keys[i] : i],
                wrapOnFulfilled(onFulfilled, i),
                onRejected,
                onProgress,
                ctx);
            ++i;
        }
    },

    TimedOutError : defineCustomErrorType('TimedOut')
};

var defineAsGlobal = true;
if(typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = vow;
    defineAsGlobal = false;
}

if(typeof modules === 'object') {
    modules.define('vow', function(provide) {
        provide(vow);
    });
    defineAsGlobal = false;
}

if(typeof define === 'function') {
    define(function(require, exports, module) {
        module.exports = vow;
    });
    defineAsGlobal = false;
}

defineAsGlobal && (global.vow = vow);

})(this);

ym['vow'] = module.exports;
})();

ym.modules.define('vow', [], function (provide) { provide(ym.vow); });
ym.ns.vow = ym.vow;
var _backup_modules = this['modules'];
/**
 * Специальная прослойка, которая добавляет промисы, фоллбеки, динамические зависимости и алиасы в модульную систему.
 */
(function (global, modulesSystem, undef) {
    var WATCH_RESOLVING_TIMEOUT = 10; // sec.

    var vow = ym.vow,

        slice = Array.prototype.slice,
    
        moduleByAliases = {},
        entries = {},
        
        keyNotFoundError = function (storage, key) { 
            return new Error("The key \"" + key + "\" isn't declared in \"" + storage + "\" storage."); 
        },
        dynamicDependNotFoundError = function (dynamicDepend) {
            return new Error("The dynamic depend \"" + dynamicDepend + "\" not found.");
        },
        noFallbackError = function (moduleName) {
            return new Error('Undefined module `' + moduleName + '` with no matching fallback.');
        },

        api;

    api = {
        fallbacks: new FallbackManager(),

        define: function (moduleName, depends, callback, context) {
            var _this = this,
                storage, key, dynamicDepends;

            if (typeof depends == 'function' && typeof callback != 'function') {
                callback = depends;
                context = callback;
                depends = [];
            } else if (typeof moduleName == 'object') {
                var data = moduleName;

                moduleName = data.name;
                depends = data.depends;
                callback = data.declaration;
                context = data.context;
                dynamicDepends = data.dynamicDepends;

                storage = data.storage;
                key = data.key;
            }

            if (!entries.hasOwnProperty(moduleName)) {
                entries[moduleName] = { name: moduleName };
            }

            if (typeof depends == 'function') {
                depends = depends.call({ name: moduleName }, ym);
            }

            entries[moduleName].callback = callback;
            entries[moduleName].context = context;

            if (storage && key) {
                if (typeof key != 'string') {
                    for (var i = 0, l = key.length; i < l; i++) {
                        this._createKeyStorageRef(moduleName, key[i], storage);
                    }
                } else {
                    this._createKeyStorageRef(moduleName, key, storage);
                }

                entries[moduleName].key = key;
                entries[moduleName].storage = storage;
            }

            if (dynamicDepends) {
                entries[moduleName].dynamicDepends = dynamicDepends;
            }

            var onModuleLoad = api._createPatchedCallback(moduleName);

            if (depends != null) {
                var deps = [];
                for (var i = 0, l = depends.length; i < l; i++) {
                    deps[i] = this._processModuleName(depends[i]);
                }

                deps = this.fallbacks.addRetrievers(deps);
                // Often dependecy module is simply defined after its dependant so we don't need fallbacks anymore.
                this.nextTick(function () {
                    _this.fallbacks.removeRetrievers(modulesSystem.getDependencies(moduleName));
                });

                modulesSystem.define(moduleName, deps, onModuleLoad);
            } else {
                modulesSystem.define(moduleName, onModuleLoad);
            }

            return this;
        },

        require: function (moduleNames, successCallback, errorCallback, context, afterRetrieve) {
            var deferred = vow.defer(),
                promise = deferred.promise(),
                data = undef;

            if (arguments.length == 3 && typeof errorCallback != 'function') {
                context = errorCallback;
                errorCallback = null;
            } else if (!moduleNames.hasOwnProperty('length') && typeof moduleNames == 'object') {
                var obj = moduleNames;
                moduleNames = obj.modules;
                successCallback = obj.successCallback;
                errorCallback = obj.errorCallback;
                context = obj.context;
                if (obj.hasOwnProperty('data')) {
                    data = obj.data;
                }
            }

            moduleNames = (typeof moduleNames == 'string' || !moduleNames.hasOwnProperty('length')) ? [moduleNames] : moduleNames;

            var moduleNamesLength = moduleNames.length,
                result = this._processModuleList(moduleNames, data);

            moduleNames = result.list;

            if (ym.env.debug && !afterRetrieve) {
                this.watchResolving(moduleNames);
            }

            if (!result.error) {
                modulesSystem.require(moduleNames, function () {
                    // TODO потенцально опасный код.
                    // Для сокращения ожидания и кол-ва кода основной запрос и все динамические зависимости обрабатываются одним require.
                    // Чтобы модули из динамических зависимостей отрабатывали раньше, чем явно запрощенные модули, они добалявляются в начало массива.
                    // Если вдруг в модульной системе измениться порядок выполнения модулей, то что-то может сломаться.
                    var array = slice.call(arguments, arguments.length - moduleNamesLength);
                    deferred.resolve(array);
                    successCallback && successCallback.apply(context || global, array);
                }, function (err) {
                    if (!afterRetrieve) {
                        api.fallbacks.retrieve(moduleNames).then(function () {
                            deferred.resolve(api.require(moduleNames, successCallback, errorCallback, context, true));
                        }).fail(function (err) {
                            deferred.reject(err);
                        });
                    } else {
                        deferred.reject(err);
                    }
                });
            } else {
                deferred.reject(result.error);
            }

            if (errorCallback && !afterRetrieve) {
                promise.fail(function (err) {
                    errorCallback.call(context || global, err);
                });
            }

            return promise;
        },

        defineSync: function (moduleName, module) {
            // Этот метод пока не светится наружу.
            var storage, key;
            if (typeof moduleName == 'object') {
                var data = moduleName;
                module = data.module;
                storage = data.storage;
                key = data.key;
                moduleName = data.name;
            }

            if (api.isDefined(moduleName)) {
                var entry = entries[moduleName];
                entry.name = moduleName;
                entry.module = module;
                entry.callback = function (provide) {
                    provide(module);
                };
                entry.context = null;
            } else {
                entries[moduleName] = {
                    name: moduleName,
                    module: module
                };
                // Добавляем в модульную систему, чтобы можно было обращатьсяв зависимостях.
                api.define(moduleName, function (provide) {
                    provide(module);
                });
            }

            if (key && storage) {
                entries[moduleName].key = key;
                entries[moduleName].storage = storage;
                this._createKeyStorageRef(moduleName, key, storage);
            }
        },

        requireSync: function (name, data) {
            // Этот метод пока не светится наружу.
            var definition = this.getDefinition(name),
                result = null;
            if (definition) {
                result = definition.getModuleSync.apply(definition, slice.call(arguments, 1));
            }
            return result;
        },

        // This method is being called with context of a module.
        providePackage: function (provide) {
            var module = this,
                depsValues = Array.prototype.slice.call(arguments, 1);

            api.require(['system.mergeImports']).spread(function (mergeImports) {
                provide(mergeImports.joinImports(module.name, {}, module.deps, depsValues));
            });
        },

        getDefinition: function (name) {
            var result = null;
            name = this._processModuleName(name);

            if (entries.hasOwnProperty(name)) {
                result = new Definition(entries[name]);
            }

            return result;
        },

        getState: function (name) {
            return modulesSystem.getState(this._processModuleName(name));
        },

        isDefined: function (name) {
            return modulesSystem.isDefined(this._processModuleName(name));
        },

        setOptions: function (options) {
            return modulesSystem.setOptions(options);
        },

        flush: function () {
            return modulesSystem.flush();
        },

        nextTick: function (func) {
            return modulesSystem.nextTick(func);
        },

        watchResolving: function (moduleNames) {
            if (!(typeof console == 'object' && typeof console.warn == 'function')) {
                return;
            }

            var _this = this;

            if (typeof this._failCounter == 'undefined') {
                this._failCounter = 0;
            }

            setTimeout(function () {
                if (_this._failCounter == 0) {
                    setTimeout(function () {
                        _this._failCounter = 0;
                    }, 150);
                }

                for (var i = 0, l = moduleNames.length; i < l; i++) {
                    if (_this.getState(moduleNames[i]) != 'RESOLVED') {
                        _this._failCounter++;

                        if (_this._failCounter == 5) {
                            setTimeout(function () {
                                console.warn('Timeout: Totally ' + _this._failCounter +
                                    ' modules were required but not resolved within ' + WATCH_RESOLVING_TIMEOUT + ' sec.');
                            }, 100);
                        } else if (_this._failCounter > 5) {
                            continue;
                        }

                        console.warn('Timeout: Module `' + moduleNames[i] + '` was required ' +
                            'but is still ' + _this.getState(moduleNames[i]) + ' within ' + WATCH_RESOLVING_TIMEOUT + ' sec.');
                    }
                }
            }, WATCH_RESOLVING_TIMEOUT * 1000);
        },

        _createPatchedCallback: function (moduleName) {
            var _modulesPlus = this;

            return function () {
                var entry = entries[moduleName],
                    array = slice.call(arguments, 0),
                    callback = entry.callback,
                    context = entry.context;

                if (ym.env.debug) {
                    _modulesPlus.watchResolving([moduleName]);
                }

                array[0] = api._patchProvideFunction(array[0], moduleName);

                callback && callback.apply(context || this, array);
            };
        },

        _processModuleList: function (moduleList, data, ignoreCurrentNode) {
            var state = {
                list: []
            };

            for (var i = 0, l = moduleList.length; i < l; i++) {
                var moduleName = this._processModuleName(moduleList[i]);

                if (!moduleName) {
                    state.error = keyNotFoundError(moduleList[i].storage, moduleList[i].key);
                    break;
                }

                if (typeof data != 'undefined') {
                    var depends = modulesSystem.getDependencies(moduleName),
                        entry = entries[moduleName];
                    if (depends) {
                        var dependsResult = this._processModuleList(depends, data, true);
                        if (dependsResult.error) {
                            state.error = dependsResult.error;
                            break;
                        } else {
                            state.list = state.list.concat(dependsResult.list);
                        }
                    }

                    if (entry && entry.dynamicDepends) {
                        var dynamicDepends = [];
                        for (var key in entry.dynamicDepends) {
                            var depend = entry.dynamicDepends[key](data);
                            // TOOD обсудить в ревью
                            if (this._isDepend(depend)) {
                                dynamicDepends.push(depend);
                            }
                        }
                        var dependsResult = this._processModuleList(dynamicDepends, data);
                        if (dependsResult.error) {
                            state.error = dependsResult.error;
                            break;
                        } else {
                            state.list = state.list.concat(dependsResult.list);
                        }
                    }

                    if (this.fallbacks.isRetriever(moduleName)) {
                        this.fallbacks.addRetrieverData(moduleName, data);
                    }
                }

                if (!ignoreCurrentNode) {
                    state.list.push(moduleName);
                }
            }

            return state;
        },

        _createKeyStorageRef: function (moduleName, key, storage) {
            if (!moduleByAliases.hasOwnProperty(storage)) {
                moduleByAliases[storage] = {};
            }
            moduleByAliases[storage][key] = moduleName;
        },

        _processModuleName: function (moduleName) {
            if (typeof moduleName != 'string') {
                var storage = moduleName.storage;
                if (moduleByAliases.hasOwnProperty(storage)) {
                    moduleName = moduleByAliases[storage][moduleName.key] || null;
                } else {
                    moduleName = null;
                }
            }
            return moduleName;
        },

        _patchProvideFunction: function (provide, moduleName) {
            var patchedProvide = function (module, error) {
                var entry = entries[moduleName];
                entry.module = module;
                provide(module, error);
                if (!error) {
                    delete entry.callback;
                    delete entry.context;
                }
            };
            patchedProvide.provide = patchedProvide;
            patchedProvide.dynamicDepends = {
                getValue: function (key, data) {
                    var deferred = vow.defer(),
                        entry = entries[moduleName];
                    if (entry.dynamicDepends && entry.dynamicDepends.hasOwnProperty(key)) {
                        var depend = entry.dynamicDepends[key](data);
                        deferred.resolve(
                            api._isDepend(depend) ?
                                api.getDefinition(depend).getModule(data) :
                                [depend]
                        );
                    } else {
                        deferred.reject(dynamicDependNotFoundError(key));
                    }
                    return deferred.promise();
                },

                getValueSync: function (key, data) {
                    var result = undef,
                        entry = entries[moduleName];
                    if (entry.dynamicDepends && entry.dynamicDepends.hasOwnProperty(key)) {
                        var depend = entry.dynamicDepends[key](data);
                        result = api._isDepend(depend) ?
                            api.getDefinition(depend).getModuleSync(data) :
                            depend;
                    }
                    return result;
                }
            };
            return patchedProvide;
        },

        _isDepend: function (depend) {
            return (typeof depend == 'string') || (depend && depend.key && depend.storage);
        }
    };
    
    function Definition (entry) {
        this.entry = entry; 
    }
    
    Definition.prototype.getModuleKey = function () {
        return this.entry.key;
    };
    
    Definition.prototype.getModuleStorage = function () {
        return this.entry.storage;
    };
    
    Definition.prototype.getModuleName = function () {
        return this.entry.name;
    };
    
    Definition.prototype.getModuleSync = function (data) {
        if (arguments.length > 0) {
            var dynamicDepends = this.entry.dynamicDepends;
            for (var key in dynamicDepends) {
                var depend = dynamicDepends[key](data);
                if (api._isDepend(depend) && !api.getDefinition(depend).getModuleSync(data)) {
                    return undef;
                }
            }
        }
        return this.entry.module;
    };
    
    Definition.prototype.getModule = function (data) {
        var params = {
                modules: [
                    this.entry.name
                ]
            };
        if (data) {
            params.data = data;
        }
        return api.require(params);
    };
    
    var RETRIEVER_PREFIX = '_retriever@';

    function FallbackManager () {
        this._fallbacks = [];
        this._retrieversData = {};
    }

    FallbackManager.prototype.register = function (filter, fallback) {
        if (!filter || filter == '*') {
            this._fallbacks.push({
                filter: filter || '*',
                func: fallback
            });
        } else {
            this._fallbacks.unshift({
                filter: filter,
                func: fallback
            });
        }
    };

    FallbackManager.prototype.retrieve = function (moduleNames) {
        if (typeof moduleNames == 'string') {
            moduleNames = [moduleNames];
        }

        var definePromises = [];

        for (var i = 0, l = moduleNames.length; i < l; i++) {
            var deferred = vow.defer(),
                moduleName = moduleNames[i];

            definePromises[i] = deferred.promise();

            if (api.isDefined(moduleName)) {
                deferred.resolve(true);

                continue;
            }

            var fallback = this.find(moduleName);

            if (!fallback) {
                deferred.reject(noFallbackError(moduleName));

                break;
            }

            deferred.resolve(fallback.func(moduleName, fallback.filter));
        }

        return vow.all(definePromises);
    };

    FallbackManager.prototype.find = function (moduleName) {
        for (var i = 0, l = this._fallbacks.length; i < l; i++) {
            var filter = this._fallbacks[i].filter;

            if (filter === '*') {
                return this._fallbacks[i];
            }

            if (typeof filter == 'function' && filter(moduleName)) {
                return this._fallbacks[i];
            }

            if (moduleName.match(filter)) {
                return this._fallbacks[i];
            }
        }

        return null;
    };

    FallbackManager.prototype.addRetrievers = function (moduleNames) {
        var res = [];

        for (var i = 0, l = moduleNames.length, moduleName, retrieverName; i < l; i++) {
            moduleName = moduleNames[i];

            if (api.isDefined(moduleName)) {
                res.push(moduleName);
                continue;
            }

            retrieverName = RETRIEVER_PREFIX + moduleName;
            res.push(retrieverName);

            if (!api.isDefined(retrieverName)) {
                this._defineRetriever(retrieverName);
            }
        }

        return res;
    };

    FallbackManager.prototype.removeRetrievers = function (deps) {
        for (var i = 0, l = deps.length, moduleName; i < l; i++) {
            if (this.isRetriever(deps[i]) && !this._retrieversData[deps[i]]) {
                moduleName = deps[i].replace(RETRIEVER_PREFIX, '');

                if (api.isDefined(moduleName)) {
                    deps[i] = moduleName;
                }
            }
        }
    };
    
    FallbackManager.prototype.isRetriever = function (moduleName) {
        return moduleName.indexOf(RETRIEVER_PREFIX) === 0;
    };
    
    FallbackManager.prototype.addRetrieverData = function (retrieverName, data) {
        if (!this._retrieversData[retrieverName]) {
            this._retrieversData[retrieverName] = [];
        }

        this._retrieversData[retrieverName].push(data);
    };

    FallbackManager.prototype._defineRetriever = function (retrieverName) {
        var _this = this;
        
        api.define(retrieverName, [], function (provide) {
            var moduleName = this.name.replace(RETRIEVER_PREFIX, '');

            _this.retrieve(moduleName)
                .then(function () { return _this._requireAfterRetrieve(moduleName); })
                .spread(provide)
                .fail(provide);
        });
    };
    
    FallbackManager.prototype._requireAfterRetrieve = function (moduleName) {
        var data = this._retrieversData[RETRIEVER_PREFIX + moduleName];

        if (!data) {
            return api.require(moduleName);
        }

        // Same module with different data could be required in parallel so we must handle all available data each time.
        var multipleRequires = [];

        for (var i = 0, l = data.length; i < l; i++) {
            multipleRequires.push(api.require({
                modules: [moduleName],
                data: data[i]
            }));
        }

        return vow.all(multipleRequires)
            .then(function (multiple) { return multiple[0]; });
    };

    global.modules = api;
})(this, ym.modules);

ym['modules'] = this['modules'];
this['modules'] = _backup_modules;
_backup_modules = undefined;
ym.ns.modules = ym.modules;

(function (global) {
    if (!ym.project.namespace) {
        return;
    }

    if (typeof setupAsync == 'function') {
        ym.envCallbacks.push(function (env) {
            if (env.namespace !== false) {
                registerNamespace(global, env.namespace || ym.project.namespace, ym.ns);
            }
        });
    } else {
        registerNamespace(global, ym.project.namespace, ym.ns);
    }

    function registerNamespace (parentNs, path, data) {
        if (path) {
            var subObj = parentNs;
            path = path.split('.');
            var i = 0, l = path.length - 1, name;
            for (; i < l; i++) {
                if (path[i]) {
                    subObj = subObj[name = path[i]] || (subObj[name] = {});
                }
            }
            subObj[path[l]] = data;
            return subObj[path[l]];
        } else {
            return data;
        }
    }
})(this);

ym.modules.define('shri2017.ImageViewer', [
    'shri2017.imageViewer.View',
    'shri2017.imageViewer.GestureController',
    'util.extend'
], function (provide, View, GestureController, extend) {

    function ImageViewer(params) {
        params = this._validateParams(params);
        this._view = new View(params);
        this._controller = new GestureController(this._view);
    }

    extend(ImageViewer.prototype, {
        destroy: function () {
            this._controller.destroy();
            this._view.destroy();
            return this;
        },

        _validateParams: function (params) {
            if (!params.url) {
                throw new Error('URL parameter is required');
            }

            if (!params.elem) {
                throw new Error('Elem parameter is required');
            }

            return extend({
                size: {
                    width: 800,
                    height: 600
                }
            }, params);
        }
    });

    provide(ImageViewer);
});

/* global console */

ym.modules.define('error', ['util.defineClass', 'util.extend'], function (provide, defineClass, extend) {
    var errors = {
        /**
         * Вспомогательная функция для создания ошибки.
         * @function
         * @name error.create
         * @static
         * @param {String} errorType Тип ошибки (из пространства имен error.*).
         * @param {String} [message] Текст ошибки.
         */
        create: function (errorType, message) {
            if (!errors[errorType]) {
                errors.log('ProcessError', errorType + ': is undefined error type');
            } else {
                return new errors[errorType](message);
            }
        },

        /**
         * Бросает исключение в режиме `debug`.
         * @function
         * @name error.throwException
         * @static
         * @param {String|Error} errorType Тип ошибки (из пространства имен error.*) или объект ошибки.
         * @param {String} [message] Текст ошибки.
         */
        throwException: function (errorType, message) {
            if (ym.env.debug) {
                throw (typeof errorType == 'object' ? errorType : errors.create(errorType, message));
            }
        },

        /**
         * Бросает исключение в режиме `debug`, если условие выполняется.
         * @function
         * @name error.throwExceptionIf
         * @static
         * @param {Boolean} condition Условие бросания исключения.
         * @param {String|Error} errorType Тип ошибки (из пространства имен error.*) или объект ошибки.
         * @param {String} [message] Текст ошибки.
         */
        throwExceptionIf: function (condition, errorType, message) {
            if (condition) {
                errors.throwException(errorType, message);
            }
        },

        /**
         * Выводит в `console.warn` предупреждение в режиме `debug`.
         * @function
         * @name error.warn
         * @static
         * @param {String|Error} errorType Тип ошибки (из пространства имен error.*) или объект ошибки.
         * @param {String} [message] Текст предупреждения.
         */
        warn: function (errorType, message) {
            if (ym.env.debug && typeof console == 'object' && console.warn) {
                var originalError = typeof errorType == 'object' ? errorType : errors.create(errorType, message),
                    err = new Error(originalError.name + ': ' + originalError.message);

                err.stack = originalError.stack;

                // `console.warn` does not show stack for custom errors.
                console.warn(err);
            }
        },

        /**
         * Выводит в `console.warn` предупреждение в режиме `debug`, если условие выполняется.
         * @function
         * @name error.warnIf
         * @static
         * @param {Boolean} condition Условие отображения предупреждения.
         * @param {String|Error} errorType Тип ошибки (из пространства имен error.*) или объект ошибки.
         * @param {String} [message] Текст ошибки.
         */
        warnIf: function (condition, errorType, message) {
            if (condition) {
                errors.warn(errorType, message);
            }
        }
    };

    function createErrorClass (name, errorClass) {
        function YMError (message) {
            if (Error.captureStackTrace) {
                Error.captureStackTrace(this, this.constructor);
            } else {
                this.stack = (new Error()).stack;
            }

            this.name = name;
            this.message = message;
        }

        if (errorClass) {
            YMError.errorClass = errorClass;
        }

        errors[name] = YMError;

        return YMError;
    }
    /**
     * Базовая ошибка карт
     * @ignore
     * @class
     * @auments Error
     */
    var YMError = createErrorClass('_YMError');
    defineClass(YMError, Error);


    /**
     * Критические ошибки при выполнении операций.
     * Эти ошибки вызваны некорректным использованием API и должны быть исправлены разработчиком.
     * @class Расширяет <xref scope="external" href="https://developer.mozilla.org/ru/docs/Web/JavaScript/Reference/Global_Objects/Error">Error</xref>.
     * @name error.ClientError
     */

    var ClientError = createErrorClass('ClientError');
    defineClass(ClientError, YMError);
    if (1) {
        /**
         * Некорректные входные данные (аргументы, параметры, опции).
         * - Отсутствующий DOM-элемент контейнера карты
         * - Несуществующий тип геометрии
         * - Некорректные значения опций strokeColor, fillRule и т.д.
         * @class
         * @name error.InputError
         * @augments error.ClientError
         */
        var InputError = createErrorClass('InputError', 'ClientError');
        defineClass(InputError, ClientError);

        /**
         * Неподходящее состояние.
         * - Попытка расчета вхождения точки в геометрию, когда она не добавлена на карту
         * - Запрос оверлея у геообъекта, когда он не добавлен на карту
         * - Открытие "задестроенного" балуна
         * - Вызов метода showResult контрола поиска до того, как были загружены данные
         * @class
         * @name error.StateError
         * @augments error.ClientError
         */
        var StateError = createErrorClass('StateError', 'ClientError');
        defineClass(StateError, ClientError);

        /**
         * Ошибки доступа к компонентам, их методам и данным.
         * - Нет шейпа при автопане, хотя балун открыт
         * - Невозможность получить проекцию из опций карты
         * - У менеджера балуна отсутствует метод capture
         * - У координатной системы отсутствует метод solveDirectProblem
         * @class
         * @name error.ProcessError
         * @augments error.ClientError
         */
        var ProcessError = createErrorClass('ProcessError', 'ClientError');
        defineClass(ProcessError, ClientError);

        /**
         * Отсутствие элемента или ключа в хранилище.
         * @class
         * @name error.StorageItemAccessError
         * @augments error.ClientError
         */
        var StorageItemAccessError = createErrorClass('StorageItemAccessError', 'ClientError');
        defineClass(StorageItemAccessError, ClientError);

        /**
         * Функциональность больше не доступна в текущей версии.
         * @class
         * @name error.FeatureRemovedError
         * @augments error.ClientError
         */
        var FeatureRemovedError = createErrorClass('FeatureRemovedError', 'ClientError');
        defineClass(FeatureRemovedError, ClientError);

    }
    /**
     * Ошибки внешних ресурсов или окружения.
     * Эти ошибки не связаны с кодом приложения, использующего API, но они могут и должны правильно обрабатываться разработчиком.
     * @class Расширяет <xref scope="external" href="https://developer.mozilla.org/ru/docs/Web/JavaScript/Reference/Global_Objects/Error">Error</xref>.
     * @name error.ExternalError
     */
    var ExternalError = createErrorClass('ExternalError');
    defineClass(ExternalError, YMError);
    if (1) {
        /**
         * Ошибка асинхронного запроса. Например, отказ или таймаут удаленного сервера
         * @class
         * @name error.RequestError
         * @augments error.ExternalError
         */
        var RequestError = createErrorClass('RequestError', 'ExternalError');
        defineClass(RequestError, ExternalError);

        /**
         * Некорректный ответ сервера.
         * @class
         * @name error.DataProcessingError
         * @augments error.ExternalError
         */
        var DataProcessingError = createErrorClass('DataProcessingError', 'ExternalError');
        defineClass(DataProcessingError, ExternalError);

        /**
         * Закрыт доступ к действию.
         * @class
         * @name error.AccessError
         * @augments error.ExternalError
         */
        var AccessError = createErrorClass('AccessError', 'ExternalError');
        defineClass(AccessError, ExternalError);

        /**
         * Действие нельзя выполнить в текущем окружении.
         * @class
         * @name error.NotSupportedError
         * @augments error.ExternalError
         */
        var NotSupportedError = createErrorClass('NotSupportedError', 'ExternalError');
        defineClass(NotSupportedError, ExternalError);


    }
    /**
     * Ожидаемые причины отмены promise-ов.
     * @class Расширяет <xref scope="external" href="https://developer.mozilla.org/ru/docs/Web/JavaScript/Reference/Global_Objects/Error">Error</xref>.
     * @name error.Reject
     */
    var Reject = createErrorClass('Reject');
    defineClass(Reject, YMError);
    if (1) {
        /**
         * Действие не должно быть выполнено.
         * - Не нужно открывать пустой балун
         * - Менеджер запретил выполнение метода разделяемой сущности
         * - Не нужно закрывать хинт, если над ним находится курсор
         * @class
         * @name error.OperationUnallowedReject
         * @augments error.Reject
         */
        var OperationUnallowedReject = createErrorClass('OperationUnallowedReject', 'Reject');
        defineClass(OperationUnallowedReject, Reject);

        /**
         * Действие было отменено.
         * - Сначала спросили оверлей геообъекта, а затем задали ему опцию visible: false
         * - Сначала спросили макет контрола, а затем удалили его с карты
         * - Начали рисовать в режиме 'drawing', переключились на режим 'editing'
         * @class
         * @name error.OperationCanceledReject
         * @augments error.Reject
         */
        var OperationCanceledReject = createErrorClass('OperationCanceledReject', 'Reject');
        defineClass(OperationCanceledReject, Reject);

        /**
         * Пустой результат.
         * @class
         * @name error.EmptyResultReject
         * @augments error.Reject
         */
        var EmptyResultReject = createErrorClass('EmptyResultReject', 'Reject');
        defineClass(EmptyResultReject, Reject);

        /**
         * Недоступная интерфейсная функциональность.
         * @class
         * @name error.OperationUnavailableReject
         * @augments error.Reject
         */
        var OperationUnavailableReject = createErrorClass('OperationUnavailableReject', 'Reject');
        defineClass(OperationUnavailableReject, Reject);
    }

    /**
     * Предупреждения.
     * Предупреждения не являются критическими ошибками, тем не менее должны быть исправлены разработчиком. Они не кидаются как исключения, а только выводятся в консоль в debug-режиме.
     * @class Расширяет <xref scope="external" href="https://developer.mozilla.org/ru/docs/Web/JavaScript/Reference/Global_Objects/Error">Error</xref>.
     * @name error.Warning
     */
    var Warning = createErrorClass('Warning');
    defineClass(Warning, YMError);
    if (1) {
        /**
         * Функция запланирована к удалению.
         * - Вместо отдельных пакетов необходимо подключать package.full
         * - Модуль hotspot.ObjectSource заменен на hotspot.layer.ObjectSource
         * @class
         * @name error.DeprecationWarning
         * @augments error.Warning
         */
        var DeprecationWarning = createErrorClass('DeprecationWarning', 'Warning');
        defineClass(DeprecationWarning, Warning);

        /**
         * Операция не имеет смысла.
         * - Удаляемый элемент не найден в коллекции
         * - Объект уже был удален с карты/уничтожен
         * - Метод setType задаёт в карту тот же тип, что отображается в настоящий момент
         * - Уже был добавлен контрол с таким ключом на карту
         * - Уже был навешен обработчик такого события по умолчанию
         * @class
         * @name error.OveruseWarning
         * @augments error.Warning
         */
        var OveruseWarning = createErrorClass('OveruseWarning', 'Warning');
        defineClass(OveruseWarning, Warning);

    }

    provide(errors);
});

ym.modules.define('shri2017.imageViewer.EventManager', [
    'util.extend',
    'shri2017.imageViewer.PointerCollection'
], function (provide, extend, PointerCollection) {

    var EVENTS = {
        mousedown: 'start',
        mousemove: 'move',
        mouseup: 'end',
        touchstart: 'start',
        touchmove: 'move',
        touchend: 'end',
        touchcancel: 'end',
        pointerdown: 'start',
        pointermove: 'move',
        pointerup: 'end',
        wheelup: 'zoomin',
        wheeldown: 'zoomout'
    };

    var pointers = new PointerCollection();

    function EventManager(elem, callback) {
        this._elem = elem;
        this._callback = callback;
        this._setupListeners();
    }

    extend(EventManager.prototype, {
        destroy: function () {
            this._teardownListeners();
        },

        _setupListeners: function () {

          this._wheelListener = this._wheelEventHandler.bind(this);
          this._addEventListeners('wheel', this._elem, this._wheelListener);

          if(window.PointerEvent) {
            this._pointerListener = this._pointerEventHandler.bind(this);
            this._addEventListeners('pointerdown', this._elem, this._pointerListener);
          }
          else {
            this._mouseListener = this._mouseEventHandler.bind(this);
            this._touchListener = this._touchEventHandler.bind(this);
            this._addEventListeners('mousedown', this._elem, this._mouseListener);
            this._addEventListeners('touchstart touchmove touchend touchcancel', this._elem, this._touchListener);
          }
        },

        _teardownListeners: function () {
            this._removeEventListeners('mousedown', this._elem, this._mouseListener);
            this._removeEventListeners('mousemove mouseup', document.documentElement, this._mouseListener);
            this._removeEventListeners('touchstart touchmove touchend touchcancel', this._elem, this._touchListener);
        },

        _addEventListeners: function (types, elem, callback) {
            types.split(' ').forEach(function (type) {
                elem.addEventListener(type, callback);
            }, this);
        },

        _removeEventListeners: function (types, elem, callback) {
            types.split(' ').forEach(function (type) {
                elem.removeEventListener(type, callback);
            }, this);
        },

        _mouseEventHandler: function (event) {
            event.preventDefault();

            if (event.type === 'mousedown') {
                this._addEventListeners('mousemove mouseup', document.documentElement, this._mouseListener);
            } else if (event.type === 'mouseup') {
                this._removeEventListeners('mousemove mouseup', document.documentElement, this._mouseListener);
            }

            var elemOffset = this._calculateElementOffset(this._elem);

            this._callback({
                type: EVENTS[event.type],
                targetPoint: {
                    x: event.clientX - elemOffset.x,
                    y: event.clientY - elemOffset.y
                },
                distance: 1,
                device: 'mouse'
            });
        },

        _touchEventHandler: function (event) {
            event.preventDefault();

            var touches = event.touches;
            // touchend/touchcancel
            if (touches.length === 0) {
                touches = event.changedTouches;
            }

            var targetPoint;
            var distance = 1;
            var elemOffset = this._calculateElementOffset(this._elem);

            if (touches.length === 1) {
                targetPoint = {
                    x: touches[0].clientX,
                    y: touches[0].clientY
                };
            } else {
                var firstTouch = touches[0];
                var secondTouch = touches[1];
                targetPoint = this._calculateTargetPoint(firstTouch, secondTouch);
                distance = this._calculateDistance(firstTouch, secondTouch);
            }

            targetPoint.x -= elemOffset.x;
            targetPoint.y -= elemOffset.y;

            this._callback({
                type: EVENTS[event.type],
                targetPoint: targetPoint,
                distance: distance,
                device: 'touch'
            });
        },

        _pointerEventHandler: function(event) {
          event.preventDefault();

          if (event.type === 'pointerdown') {
              this._addEventListeners('pointermove pointerup pointercancel', this._elem, this._pointerListener);
              event.target.setPointerCapture(event.pointerId);
              if (!pointers.exists(event)) {
                pointers.add(event);
              }
          } else if (event.type === 'pointerup') {
            if (pointers.exists(event)) {
              pointers.remove(event);
              pointers.clear();
            }
              this._removeEventListeners('pointermove pointerup', this._elem, this._pointerListener);
              event.target.releasePointerCapture(event.pointerId);
          } else if (event.type === 'pointermove') {
            if (pointers.exists(event)) {
    					pointers.update(event);
    				}
          } else if (pointers.isMultiTouch() && (event.type === 'pointerdown' || event.type === 'pointermove')) {
            pointers.each(function (pointer) {
              pointers.remove(pointer);
            });
          }

          var targetPoint;
          var distance = 1;
          var elemOffset = this._calculateElementOffset(this._elem);

          var pointersArr = pointers.getArray();

          if (pointersArr.length === 1) {
            targetPoint = {
              x: pointersArr[0].clientX,
              y: pointersArr[0].clientY
            }
          }
          else {
            var firstTouch = pointersArr[0];
            var secondTouch = pointersArr[1];
            if (pointersArr.length){
              targetPoint = this._calculateTargetPoint(firstTouch, secondTouch);
              distance = this._calculateDistance(firstTouch, secondTouch);
            }
            else {
              targetPoint = {
                x: 0,
                y: 0
              };
            }
          };

          targetPoint.x -= elemOffset.x;
          targetPoint.y -= elemOffset.y;

          this._callback({
              type: EVENTS[event.type],
              targetPoint: targetPoint,
              distance: distance,
              device: event.pointerType
          });
        },

        _wheelEventHandler: function(event) {
          var elemOffset = this._calculateElementOffset(this._elem);

          this._callback({
            type: EVENTS[event.deltaY > 0 ? 'wheeldown' : 'wheelup'],
            targetPoint: {
              x: event.clientX - elemOffset.x,
              y: event.clientY - elemOffset.y
            },
            distance: 0
          })
        },

        _calculateTargetPoint: function (firstTouch, secondTouch) {
            return {
                x: (secondTouch.clientX + firstTouch.clientX) / 2,
                y: (secondTouch.clientY + firstTouch.clientY) / 2
            };
        },

        _calculateDistance: function (firstTouch, secondTouch) {
            return Math.sqrt(
                Math.pow(secondTouch.clientX - firstTouch.clientX, 2) +
                Math.pow(secondTouch.clientY - firstTouch.clientY, 2)
            );
        },

        _calculateElementOffset: function (elem) {
            var bounds = elem.getBoundingClientRect();
            return {
                x: bounds.left,
                y: bounds.top
            };
        }
    });

    provide(EventManager);
});

ym.modules.define('shri2017.imageViewer.GestureController', [
    'shri2017.imageViewer.EventManager',
    'util.extend'
], function (provide, EventManager, extend) {

    var DBL_TAP_STEP = 0.2;
    var WHEEL_STEP = 0.02;

    var Controller = function (view) {
        this._view = view;
        this._eventManager = new EventManager(
            this._view.getElement(),
            this._eventHandler.bind(this)
        );
        this._lastEventTypes = '';
        this._oneTouchEventTypes = '';
        this._lastStartEvent = {};
    };

    extend(Controller.prototype, {
        destroy: function () {
            this._eventManager.destroy();
        },

        _eventHandler: function (event) {
            var state = this._view.getState();

            // dblclick
            if (!this._lastEventTypes) {
                setTimeout(function () {
                    this._lastEventTypes = '';
                }.bind(this), 1000);
            }
            this._lastEventTypes += ' ' + event.type;


            if ((/(start) ((move) ){0,2}(end )(start) ((move ){0,2}(end))/g).test(this._lastEventTypes)) {
                this._lastEventTypes = '';
                this._processDbltap(this._lastStartEvent);
                return;
            }

            // One Touch Zoom

            // Добавляем в строку жеста информацию о его начале из this._lastEventTypes
            if (event.type === 'start') {
              this._lastStartEvent = event;
            }

            if ((/(start) ((move) ){0,2}(end )(start) ((move) ?)+/g).test(this._lastEventTypes) && event.device === 'touch') {
              if(!this._oneTouchEventTypes) {
                this._oneTouchEventTypes = this._lastEventTypes;
              }
            }
            // Добавляем информацию о текущем событии (если таковое происходит)

            if(this._oneTouchEventTypes !== ''){
              this._oneTouchEventTypes += ' ' + event.type;
            }

            if((/(start) ((move) ){0,2}(end )(start) ((move )+)/g).test(this._oneTouchEventTypes) &&
                event.type !== 'end')  {
              // Вызываем OneTouchZoom
              this._processOneTouchZoom(this._lastStartEvent, event);
            }

            if ((/(start) ((move) ){0,2}(end )(start) ((move )+(end))/g).test(this._oneTouchEventTypes) && event.type === 'end'){
              this._oneTouchEventTypes = '';
              return;
            }





            if (event.type.indexOf('zoom') != -1) {
              this._processWheel(event);
            }

            if (event.type === 'move' && this._oneTouchEventTypes === '') {
                if (event.distance > 1 && event.distance !== this._initEvent.distance) {
                    this._processMultitouch(event);
                } else {
                    this._processDrag(event);
                }
            } else {
                this._initState = this._view.getState();
                this._initEvent = event;
            }

        },

        _processDrag: function (event) {
            this._view.setState({
                positionX: this._initState.positionX + (event.targetPoint.x - this._initEvent.targetPoint.x),
                positionY: this._initState.positionY + (event.targetPoint.y - this._initEvent.targetPoint.y)
            });
        },

        _processMultitouch: function (event) {
            this._scale(
                event.targetPoint,
                this._initState.scale * (event.distance / this._initEvent.distance)
            );
        },

        _processDbltap: function (event) {
            var state = this._view.getState();
            this._scale(
                event.targetPoint,
                state.scale + DBL_TAP_STEP
            );
        },

        _processOneTouchZoom: function (startEvent, moveEvent) {
          var state = this._view.getState();

          var targetPoint = {
              x: startEvent.targetPoint.x,
              y: startEvent.targetPoint.y
          };

          distance = moveEvent.targetPoint.y - startEvent.targetPoint.y;

          this._scale(
            targetPoint,
            state.scale + (distance / 50000)
          );
        },

        _processWheel: function (event) {
          var state = this._view.getState();

          var currentStep = 0;

          if (event.type === 'zoomout') {
            currentStep -= WHEEL_STEP;
          }
          else if (event.type === 'zoomin') {
            currentStep += WHEEL_STEP;
          }

          this._scale(
            event.targetPoint,
            state.scale + currentStep
          )
        },

        _scale: function (targetPoint, newScale) {
            newScale = Math.max(Math.min(newScale, 10), 0.02);
            var imageSize = this._view.getImageSize();
            var state = this._view.getState();
            // Позиция прикосновения на изображении на текущем уровне масштаба
            var originX = targetPoint.x - state.positionX;
            var originY = targetPoint.y - state.positionY;
            // Размер изображения на текущем уровне масштаба
            var currentImageWidth = imageSize.width * state.scale;
            var currentImageHeight = imageSize.height * state.scale;
            // Относительное положение прикосновения на изображении
            var mx = originX / currentImageWidth;
            var my = originY / currentImageHeight;
            // Размер изображения с учетом нового уровня масштаба
            var newImageWidth = imageSize.width * newScale;
            var newImageHeight = imageSize.height * newScale;
            // Рассчитываем новую позицию с учетом уровня масштаба
            // и относительного положения прикосновения
            state.positionX += originX - (newImageWidth * mx);
            state.positionY += originY - (newImageHeight * my);
            // Устанавливаем текущее положение мышки как "стержневое"
            state.pivotPointX = targetPoint.x;
            state.pivotPointY = targetPoint.y;
            // Устанавливаем масштаб и угол наклона
            state.scale = newScale;
            this._view.setState(state);
        }
    });

    provide(Controller);
});

ym.modules.define('shri2017.imageViewer.PointerCollection', [], function(provide) {

  var PointerCollection = function () {
    this._pointers = {};
  };

  PointerCollection.prototype.add = function (event) {
    this._pointers[event.pointerId] = event;
  };

  PointerCollection.prototype.update = function (event) {
    this.add(event);
  };

  PointerCollection.prototype.get = function (event) {
    return this._pointers[event.pointerId];
  };

  PointerCollection.prototype.remove = function (event) {
    delete this._pointers[event.pointerId];
  };

  PointerCollection.prototype.clear = function() {
    this._pointers = {};
  }

  PointerCollection.prototype.exists = function (event) {
    return this._pointers.hasOwnProperty(event.pointerId);
  };

  PointerCollection.prototype.each = function (callback, thisArg) {
    if (this._pointers) {
      for (var key in this._pointers) {
        callback.call(thisArg, this._pointers[key]);
      }
    }
  };

  PointerCollection.prototype.getArray = function () {
    var array = [];
    this.each(function(pointer) {
      array.push(pointer);
    });
    return array;
  }

  PointerCollection.prototype.isMultiTouch = function() {
    var quantity = 0;
    console.log(this._pointers);
    this.each(function(pointer) {
      quantity++;
    });
    return quantity >= 2;
  };

  provide(PointerCollection);

});

ym.modules.define('system.createNs', [], function (provide) {
    provide(function (parentNs, path, data) {
        if (path) {
            var subObj = parentNs;
            path = path.split('.');
            var i = 0, l = path.length - 1, name;
            for (; i < l; i++) {
                if (path[i]) {
                    subObj = subObj[name = path[i]] || (subObj[name] = {});
                }
            }
            subObj[path[l]] = data;
            return subObj[path[l]];
        } else {
            return data;
        }
    });
});
// TODO refactoring

ym.modules.define('system.mergeImports', [], function (provide) {
    function createNS (parentNs, path, data) {
        if (path) {
            var subObj = parentNs;
            path = path.split('.');
            var i = 0, l = path.length - 1, name;
            for (; i < l; i++) {
                if (path[i]) {//в начале может быть точка
                    subObj = subObj[name = path[i]] || (subObj[name] = {});
                }
            }
            subObj[path[l]] = data;
            return subObj[path[l]];
        } else {
            return data;
        }
    }


    function depsSort (a, b) {
        return a[2] - b[2];
    }

    function _isPackage (name) {
        return name.indexOf('package.') === 0;
    }

    function packageExtend (imports, ns) {
        for (var i in ns) {
            if (ns.hasOwnProperty(i)) {
                if (imports.hasOwnProperty(i)) {
                    //console.log('deep', i, typeof imports[i], typeof ns[i], ns[i] === imports[i]);
                    if (typeof imports[i] == 'object') {
                        packageExtend(imports[i], ns[i]);
                    }
                } else {
                    imports[i] = ns[i];
                }
            }
        }
    }

    function joinPackage (imports, deps, args) {
        var modules = [],
            checkList = {};
        for (var i = 0, l = deps.length; i < l; ++i) {
            var packageInfo = args[i].__package;
            if (!packageInfo) {
                createNS(imports, deps[i], args[i]);
                if (!checkList[deps[i]]) {
                    modules.push([deps[i], args[i]]);
                    checkList[deps[i]] = 1;
                }
            } else {
                for (var j = 0; j < packageInfo.length; ++j) {
                    if (!checkList[packageInfo[j][0]]) {
                        createNS(imports, packageInfo[j][0], packageInfo[j][1]);
                        modules.push([packageInfo[j][0], packageInfo[j][1]]);
                        checkList[packageInfo[j][0]] = 1;
                    }
                }
            }
        }
        imports.__package = modules;
        return imports;
    }

    function joinImports (thisName, imports, deps, args) {
        var ordered = [];
        var iAmPackage = _isPackage(thisName);
        if (iAmPackage) {
            return joinPackage(imports, deps, args);
        } else {
            for (var i = 0, l = deps.length; i < l; ++i) {
                ordered.push([deps[i], i, deps[i].length]);
            }
            ordered.sort(depsSort);
            for (var i = 0, l = ordered.length; i < l; ++i) {
                var order = ordered[i][1],
                    depName = deps[order];
                if (_isPackage(depName)) {
                    var packageInfo = args[order].__package;
                    for (var j = 0; j < packageInfo.length; ++j) {
                        createNS(imports, packageInfo[j][0], packageInfo[j][1]);
                    }
                    //console.error(thisName, 'loads', depName, '(its not good idea to load package from module)');
                    //depName = '';
                    //packageExtend(imports, args[order]);
                } else {
                    createNS(imports, depName, args[order]);
                }
            }
        }
        return imports;
    }

    provide({
        isPackage: _isPackage,
        joinImports: joinImports,
        createNS: createNS
    });
});
ym.modules.define('system.provideCss', [
    'system.nextTick',
    'system.supports.csp'
], function (provide, nextTick, cspSupport) {
    var newCssText = '',
    /*
     в слайсах IE 7 нельзя читать содержимое тега link MAPSAPI-4755
     поэтому аккумулируем весь css в одной переменной
     */
        cssText = '',
        callbacks = [],
    /*
     Для IE используем один тег под все стили
     http://dean.edwards.name/weblog/2010/02/bug85/
     */
        tag,
        waitForNextTick = false,
        URL = window.URL || window.webkitURL || window.mozURL,
        csp = cspSupport.isSupported && ym.env.server && ym.env.server.params.csp,
        nonceSupported = cspSupport.isNonceSupported,
        pasteAsLink = csp && (!csp.style_nonce || !nonceSupported);


    provide(function (cssText, callback) {
        newCssText += cssText + '\n/**/\n';
        if (callback) {
            callbacks.push(callback);
        }

        if (!waitForNextTick) {
            nextTick(writeCSSModules);
            waitForNextTick = true;
        }
    });

    function writeCSSModules () {
        waitForNextTick = false;
        if (!callbacks.length) {
            return;
        }

        if (!tag) {
            tag = document.createElement(pasteAsLink ? "link" : "style");
            tag.type = "text/css";
            tag.rel = "stylesheet";
            tag.setAttribute && tag.setAttribute('data-ymaps', 'css-modules');
            if (csp && nonceSupported && csp.style_nonce) {
                tag.setAttribute && tag.setAttribute('nonce', csp.style_nonce);
            }
        }

        if (tag.styleSheet) {
            cssText += newCssText;
            tag.styleSheet.cssText = cssText;
            if (!tag.parentNode) {
                document.getElementsByTagName("head")[0].appendChild(tag);
            }
        } else {
            if (pasteAsLink) {
                var blob = new Blob([newCssText], {type: 'text/css'}),
                    tempUrl = URL.createObjectURL(blob);
                tag.setAttribute("href", tempUrl);
            } else {
                tag.appendChild(document.createTextNode(newCssText));
            }
            document.getElementsByTagName("head")[0].appendChild(tag);
            tag = null;
        }
        newCssText = '';
        var cb = callbacks;
        callbacks = [];
        for (var i = 0, l = cb.length; i < l; ++i) {
            cb[i]();
        }
    }
});

ym.modules.define('system.supports.csp', [], function (provide) {
    // Нельзя явно определить, поддерживается ли в браузере CSP.
    // Поэтому проверяем косвенно по наличию объекта Blob (для старых IE) и URL (для Opera 12).
    // TODO: убрать проверки после MAPSAPI-12836
    var browser = ym.env ? ym.env.browser : null;
    provide({
        isSupported: (typeof Blob != 'undefined') && (typeof URL != 'undefined'),
        isNonceSupported: browser && browser.name && browser.version ?
            !(browser.name.search('Safari') != -1 && parseInt(browser.version) < 10) :
            null
    });
});

ym.modules.define('system.supports.css', [], function (provide) {
    var testDiv,
        transitableProperties = {
            'transform': 'transform',
            'opacity': 'opacity',
            'transitionTimingFunction': 'transition-timing-function',
            //TODO - нет никакой реакции на эти значения
            'userSelect': 'user-select',
            'height': 'height'
        },
        transitionPropertiesCache = {},
        cssPropertiesCache = {},
        browser = ym.env.browser,
        browserPrefix = browser.cssPrefix.toLowerCase();

    function checkCssProperty (name) {
        return typeof cssPropertiesCache[name] == 'undefined' ?
            cssPropertiesCache[name] = checkDivStyle(name) :
            cssPropertiesCache[name];
    }


    function checkDivStyle (name) {
        return checkTestDiv(name) || //names
               checkTestDiv(browserPrefix + upperCaseFirst(name)) || //mozNames
               checkTestDiv(browser.cssPrefix + upperCaseFirst(name)); //MozNames
    }

    function checkTestDiv (name) {
        return typeof getTestDiv().style[name] != 'undefined' ? name : null;
    }

    function getTestDiv () {
        return testDiv || (testDiv = document.createElement('div'));
    }

    function upperCaseFirst (str) {
        return str ? str.substr(0, 1).toUpperCase() + str.substr(1) : str;
    }

    function checkCssTransitionProperty (name) {
        var cssProperty = checkCssProperty(name);
        if (cssProperty && cssProperty != name) {
            cssProperty = '-' + browserPrefix + '-' + name;
        }
        return cssProperty;
    }

    function checkTransitionAvailability (name) {
        if (transitableProperties[name] && checkCssProperty('transitionProperty')) {
            return checkCssTransitionProperty(transitableProperties[name]);
        }
        return null;
    }

    provide({
        checkProperty: checkCssProperty,

        checkTransitionProperty: function (name) {
            return typeof transitionPropertiesCache[name] == 'undefined' ?
                transitionPropertiesCache[name] = checkTransitionAvailability(name) :
                transitionPropertiesCache[name];
        },

        checkTransitionAvailability: checkTransitionAvailability
    });
});
ym.modules.define('system.supports.graphics', [], function (provide) {

    var webGlContextSettings = {
            failIfMajorPerformanceCaveat: true, // just to be sure
            antialias: false                    // Firefox does not like offscreen canvas with AA
        },
        tests = {};

    function isWebGlCapable () {
        // Test system support
        if (window.WebGLRenderingContext) {
            // test blacklists
            var browser = ym.env.browser,
                webglBrowserBlacklist = {
                    'Samsung Internet': true, // unstable
                    'AndroidBrowser': true    // unstable
                },
                isOldAndroid = browser.engine == "Webkit" && (+browser.engineVersion < +537); // unstable

            if (isOldAndroid || webglBrowserBlacklist[browser.name]) {
                return false;
            }
        } else {
            // No system support
            return false;
        }
        return true;
    }

    function detectWebGl () {
        if (!isWebGlCapable()) {
            return null;
        }

        var contextName;
        try {
            var canvas = document.createElement("canvas"),
                context = canvas.getContext(contextName = "webgl", webGlContextSettings);
            if (!context) {
                context = canvas.getContext(contextName = "experimental-webgl", webGlContextSettings); // IE
                if (!context) {
                    contextName = null;
                }
            }
        } catch (e) {
            // suppress warnings at FF
            contextName = null;
        }

        return contextName ? {
            contextName: contextName
        } : null;

    }

    // Test globalCompositeOperation to work properly
    function testCanvas (sandbox, ctx) {
        sandbox.width = 226;
        sandbox.height = 256;

        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, 150, 150);

        ctx.globalCompositeOperation = "xor";

        ctx.fillStyle = "#f00";
        ctx.fillRect(10, 10, 100, 100);

        ctx.fillStyle = "#0f0";
        ctx.fillRect(50, 50, 100, 100);

        var data = ctx.getImageData(49, 49, 2, 2),
            test = [];
        for (var i = 0; i < 16; i++) {
            test.push(data.data[i]);
        }
        return test.join('x') == '0x0x0x0x0x0x0x0x0x0x0x0x0x255x0x255';
    }

    provide({
        hasSvg: function () {
            if (!('svg' in tests)) {
                tests.svg = document.implementation &&
                    document.implementation.hasFeature("http://www.w3.org/TR/SVG11/feature#BasicStructure", "1.1");
            }
            return tests.svg;
        },

        hasCanvas: function () {
            if (!('canvas' in tests)) {
                var sandbox = document.createElement('canvas'),
                    canvas = ('getContext' in sandbox) ? sandbox.getContext('2d') : null;
                tests.canvas = canvas ? testCanvas(sandbox, canvas) : false;
            }
            return tests.canvas;
        },

        hasWebGl: function () {
            if (!('webgl' in tests)) {
                tests.webgl = detectWebGl();
            }
            return tests.webgl;
        },

        hasVml: function () {
            if (!('vml' in tests)) {
                var supported = false,
                    topElement = document.createElement('div'),
                    testElement;
                topElement.innerHTML = '<v:shape id="yamaps_testVML"  adj="1" />';
                testElement = topElement.firstChild;
                if (testElement && testElement.style) {
                    testElement.style.behavior = 'url(#default#VML)';
                    supported = testElement ? typeof testElement.adj == 'object' : true;
                    topElement.removeChild(testElement);
                }
                tests.vml = supported;
            }
            return tests.vml;
        },

        redetect: function () {
            tests = {};
        },

        getWebGlContextName: function () {
            return tests.webgl && tests.webgl.contextName;
        }
    });
});

/**
 * @fileOverview
 * Парсер шаблонов.
 */
ym.modules.define("template.Parser", [
    "util.id",
    "system.supports.csp"
], function (provide, utilId, cspSupport) {

    // TODO хорошо бы перенести в отдельный модуль.
    // Главное не забыть в билдере подключить файл.
    // TODO util.string
    var trimRegExp = /^\s+|\s+$/g,
        nativeTrim = typeof String.prototype.trim == 'function';

    function trim (str) {
        return nativeTrim ? str.trim() : str.replace(trimRegExp, '');
    }

    function escape (str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/'/g, '&#39;')
            .replace(/"/g, '&quot;');
    }

    function getKeyValuePairs (str) {
        var pairs = [],
            parts = trim(str).replace(/\s*=\s*/g, '=').replace(/\s+/g, ' ').split(' ');

        for (var i = 0, l = parts.length; i < l; i++) {
            pairs.push(parts[i].split('=', 2));
        }

        return pairs;
    }

    function removeQuotes (string) {
        var firstSymbol = string.charAt(0);
        if (firstSymbol == "'" || firstSymbol == '"') {
            return string.slice(1, string.length - 1);
        }
        return string;
    }

    function parseExpression (expression) {
        var parenthesesRegExp = /'|"/g,
            l = 0,
            tokens = [],
            match;

        while (match = parenthesesRegExp.exec(expression)) {
            var pos = match.index;

            if (pos >= l) {
                var endPos = expression.indexOf(match[0], pos + 1);
                if (l != pos) {
                    parseExpressionSubstitutes(tokens, expression.slice(l, pos));
                }
                tokens.push(expression.slice(pos, endPos + 1));
                l = endPos + 1;
            }
        }

        if (l < expression.length) {
            parseExpressionSubstitutes(tokens, expression.slice(l));
        }

        return tokens.join('');
    }

    var DataLogger = function (dataManager) {
        this._dataManager = dataManager;
        this._renderedValues = {};
        this._contexts = {};
    };

    DataLogger.prototype.get = function (key) {
        if (this._renderedValues.hasOwnProperty(key)) {
            return this._renderedValues[key].value;
        }

        var dotIndex = key.indexOf('.'),
            keyPart = (dotIndex > -1) ? trim(key.substring(0, dotIndex)) : trim(key);
        if (this._contexts.hasOwnProperty(keyPart)) {
            key = key.replace(keyPart, this._contexts[keyPart]);
        }

        var value = this._dataManager.get(key);
        this.set(key, value);
        return value;
    };

    DataLogger.prototype.setContext = function (key1, key2) {
        this._contexts[key1] = key2;
    };

    DataLogger.prototype.set = function (key, value) {
        // http://jsperf.com/split-vs-indexof
        if (key.indexOf('.') > -1) {
            var parts = key.split('.'),
                currentKey = "";
            // Записываем все промежуточные значения.
            for (var i = 0, l = parts.length - 1; i < l; i++) {
                currentKey += ((i === 0) ? "" : ".") + parts[i];
                this._renderedValues[currentKey] = {value: this._dataManager.get(currentKey)};
            }
        }
        this._renderedValues[key] = {value: value};
    };

    DataLogger.prototype.getRenderedValues = function () {
        return this._renderedValues;
    };

    var stopWords = {
        'true': true,
        'false': true,
        'undefined': true,
        'null': true,
        'typeof': true
    };

    function parseExpressionSubstitutes (tokens, expression) {
        var variablesRegExp = /(^|[^\w\$])([A-Za-z_\$][\w\$\.]*)(?:[^\w\d_\$]|$)/g,
            l = 0,
            match;

        while (match = variablesRegExp.exec(expression)) {
            var pos = match.index + match[1].length,
                key = match[2],
                endPos = pos + key.length;

            if (pos > l) {
                tokens.push(expression.slice(l, pos));
            }

            if (stopWords[key]) {
                tokens.push(key);
            } else {
                tokens.push('data.get("' + key + '")');
            }

            l = endPos;
        }

        if (l < expression.length) {
            tokens.push(expression.slice(l));
        }
    }

    function evaluateExpression (expression, data) {
        var result;
        eval('result = ' + expression);
        return result;
    }

    // Токен контента
    var CONTENT = 0,
        startTokenRegExp = new RegExp([
            '\\$\\[\\[', '\\$\\[(?!\\])', '\\[if',
            '\\[else\\]', '\\[endif\\]', '\\{\\{', '\\{%'].join('|'), 'g');

    /**
     * @ignore
     * @class Парсер шаблонов.
     */
    var Parser = function (filtersStorage) {
        this.filtersStorage = filtersStorage;
    };

    /**
     * @ignore
     * @class Парсер шаблонов.
     */

    Parser.prototype.scanners = {};
    Parser.prototype.builders = {};

    Parser.prototype.parse = function (text) {
        var tokens = [],
            pos = 0, startTokenPos, endTokenPos, contentPos,
            match;

        startTokenRegExp.lastIndex = 0;

        while (match = startTokenRegExp.exec(text)) {
            if (match.index >= pos) {
                startTokenPos = match.index;
                contentPos = startTokenPos + match[0].length;

                if (pos != startTokenPos) {
                    tokens.push(CONTENT, text.slice(pos, startTokenPos));
                }

                var scanner = this.scanners[match[0]];

                if (scanner.token) {
                    tokens.push(scanner.token, null);
                    pos = contentPos;
                } else {
                    endTokenPos = text.indexOf(scanner.stopToken, contentPos);
                    scanner.scan(tokens, text.slice(contentPos, endTokenPos));
                    pos = endTokenPos + scanner.stopToken.length;
                }
            }
        }

        if (pos < text.length) {
            tokens.push(CONTENT, text.slice(pos));
        }

        return tokens;
    };

    Parser.prototype.build = function (tree, data) {
        var result = {
            nodes: tree,
            left: 0,
            right: tree.length,
            empty: true,
            flags: {},
            subnodes: [],
            sublayouts: [],
            strings: [],
            data: new DataLogger(data)
        };
        this._buildTree(result);
        result.renderedValues = result.data.getRenderedValues();
        return result;
    };

    Parser.prototype._buildTree = function (tree) {
        var nodes = tree.nodes,
            strings = tree.strings;
        while (tree.left < tree.right) {
            var node = nodes[tree.left];
            if (node == CONTENT) {
                strings.push(nodes[tree.left + 1]);
                tree.empty = false;
                tree.left += 2;
            } else {
                this.builders[node](tree, this);
            }
        }
    };

    // Токены старого синтаксиса
    var OLD_SUBSTITUTE = 1001,
        OLD_SUBLAYOUT = 1002,
        OLD_IF = 1003,
        OLD_ELSE = 1004,
        OLD_ENDIF = 1005;

    Parser.prototype.scanners['$[['] = {
        stopToken: ']]',
        scan: function (tokens, text) {
            var parts = text.match(/^(\S+)\s*(\S.*)?$/);
            tokens.push(OLD_SUBLAYOUT, [parts[1], parts[2] ? getKeyValuePairs(parts[2]) : []]);
        }
    };

    Parser.prototype.scanners['$['] = {
        stopToken: ']',
        scan: function (tokens, text) {
            var parts = text.split('|', 2);
            tokens.push(OLD_SUBSTITUTE, parts);
        }
    };

    Parser.prototype.scanners['[if'] = {
        stopToken: ']',
        scan: function (tokens, text) {
            var parts = text.match(/^(def)? (.+)$/),
                substitutes = parseExpression(parts[2]);

            tokens.push(OLD_IF, [parts[1], substitutes]);
        }
    };

    Parser.prototype.scanners['[else]'] = {
        token: OLD_ELSE
    };

    Parser.prototype.scanners['[endif]'] = {
        token: OLD_ENDIF
    };

    Parser.prototype.builders[OLD_SUBSTITUTE] = function (tree, parser) {
        var key = tree.nodes[tree.left + 1][0],
            value = tree.data.get(key);

        if (typeof value == 'undefined') {
            value = tree.nodes[tree.left + 1][1];
        }

        tree.strings.push(value);
        tree.left += 2;
        tree.empty = tree.empty && !value;
    };

    Parser.prototype.builders[OLD_SUBLAYOUT] = function (tree, parser) {
        var id = utilId.prefix() + utilId.gen(),
            key = tree.nodes[tree.left + 1][0];

        tree.strings.push('<ymaps id="' + id + '"></ymaps>');

        var sublayoutInfo = {
                id: id,
                key: key,
                value: tree.data.get(key) || key
            },
            monitorValues = [],
            splitDefault = [];

        var params = tree.nodes[tree.left + 1][1];

        for (var i = 0, l = params.length; i < l; i++) {
            var pair = params[i],
                k = pair[0],
                v = pair[1] || "true",
                end = v.length - 1,
                val;

            // если значение в кавычках, парсим как строку
            if (
                (v.charAt(0) == '"' && v.charAt(end) == '"') ||
                (v.charAt(0) == '\'' && v.charAt(end) == '\'')
            ) {
                val = v.substring(1, end);

                // если цифра или true|false - как есть
            } else if (!isNaN(Number(v))) {
                val = v;

            } else if (v == "true") {
                val = true;

            } else if (v == "false") {
                val = false;

                // иначе - ищем в данных
            } else {
                splitDefault = v.split('|');
                val = tree.data.get(splitDefault[0], splitDefault[1]);
                monitorValues.push(splitDefault[0]);
            }

            sublayoutInfo[k] = val;
        }

        sublayoutInfo.monitorValues = monitorValues;

        tree.sublayouts.push(sublayoutInfo);
        tree.left += 2;
    };

    Parser.prototype.builders[OLD_IF] = function (tree, parser) {
        var nodes = tree.nodes,
            left = tree.left,
            ifdef = nodes[left + 1][0],
            expression = nodes[left + 1][1],
            result = evaluateExpression(expression, tree.data),
            isTrue = ifdef ? typeof result != "undefined" : !!result,
            l,
            i = tree.left + 2,
            r = tree.right,
            counter = 1,
            elsePosition,
            endIfPosition;

        while (i < r) {
            if (nodes[i] == OLD_IF) {
                counter++;
            } else if (nodes[i] == OLD_ELSE) {
                if (counter == 1) {
                    elsePosition = i;
                }
            } else if (nodes[i] == OLD_ENDIF) {
                if (!--counter) {
                    endIfPosition = i;
                }
            }
            if (endIfPosition) {
                break;
            }
            i += 2;
        }

        if (isTrue) {
            l = tree.left + 2;
            r = elsePosition ? elsePosition : endIfPosition;
        } else {
            l = elsePosition ? elsePosition + 2 : endIfPosition;
            r = endIfPosition;
        }

        if (l != r) {
            var oldRight = tree.right,
                oldEmpty = tree.empty;

            tree.left = l;
            tree.right = r;

            parser._buildTree(tree);

            tree.empty = tree.empty && oldEmpty;
            tree.right = oldRight;
        }

        tree.left = endIfPosition + 2;
    };

    // Токены нового синтаксиса
    var SUBSTITUTE = 2001,
        INCLUDE = 2002,
        IF = 2003,
        ELSE = 2004,
        ENDIF = 2005,
        FOR = 2006,
        ENDFOR = 2007,
        ELSEIF = 2008,
        STYLE = 2009,
        ENDSTYLE = 2010;

    Parser.prototype.scanners['{{'] = {
        stopToken: '}}',
        scan: function (tokens, text) {
            var parts = text.split('|'),
                filters = [];
            for (var i = 1, l = parts.length; i < l; i++) {
                var match = parts[i].split(':', 2),
                    filter = trim(match[0]),
                    filterValue = match[1];//null;

                if (match[1]) {
                    if (filter != 'default') {
                        filterValue = parseExpression(removeQuotes(match[1]));
                    } else {
                        filterValue = trim(match[1]);
                    }
                }
                filters.push([filter, filterValue]);
            }
            tokens.push(SUBSTITUTE, [trim(parts[0]), filters]);
        }
    };

    Parser.prototype.scanners['{%'] = {
        stopToken: '%}',
        scan: function (tokens, text) {
            var match = trim(text).match(/^([A-Za-z]+)(\s+\S.*)?$/),
                operator = match[1],
                expression = match[2] ? trim(match[2]) : null;

            switch (operator) {
                case 'if':
                    tokens.push(IF, parseExpression(expression));
                    break;
                case 'else':
                    tokens.push(ELSE, null);
                    break;
                case 'elseif':
                    tokens.push(ELSEIF, parseExpression(expression));
                    break;
                case 'endif':
                    tokens.push(ENDIF, null);
                    break;
                case 'include':
                    var conditions = getKeyValuePairs(expression);
                    tokens.push(INCLUDE, [removeQuotes(conditions[0][0]), conditions.slice(1)]);
                    break;
                case 'for':
                    tokens.push(FOR, expression);
                    break;
                case 'endfor':
                    tokens.push(ENDFOR, null);
                    break;
                case 'style':
                    tokens.push(STYLE, expression);
                    break;
                case 'endstyle':
                    tokens.push(ENDSTYLE, expression);
            }
        }
    };

    Parser.prototype.builders[SUBSTITUTE] = function (tree, parser) {
        // Для ключей вида object[0], object["test"][0] и т.д.
        var keyWithSquareBracketsRegExp = /\[\s*(\d+|\'[^\']+\'|\"[^\"]+\")\s*\]/g,
            treeValue = tree.nodes[tree.left + 1],
            key = treeValue[0],
            value,
            needEscape = true,
            filters = treeValue[1],
            i,
            l;

        if (!keyWithSquareBracketsRegExp.test(key)) {
            value = tree.data.get(key);
        } else {
            var path = key.match(keyWithSquareBracketsRegExp),
                residue = key.split(path[0]),
                query;

            l = path.length;
            key = residue[0];

            query = key + '.' + removeQuotes(trim(path[0].replace('[', '').replace(']', '')));
            residue = residue[1];

            if (l > 1) {
                for (i = 1; i < l; i++) {
                    var segment = path[i];

                    residue = residue.split(segment);

                    segment = trim(segment.replace('[', '').replace(']', ''));
                    segment = removeQuotes(segment);

                    if (residue[0].length) {
                        query += residue[0];
                    }
                    query += '.' + segment;
                    residue = residue[1];
                }
            } else {
                query += residue;
            }

            value = tree.data.get(query);
        }

        for (i = 0, l = filters.length; i < l; i++) {
            var filter = filters[i],
                filterHandler;

            if (parser.filtersStorage && (filterHandler = parser.filtersStorage.get(filter[0]))) {
                value = filterHandler(tree.data, value, filter[1]);
            } else if (filter[0] == 'raw') {
                needEscape = false;
            }
        }

        if (needEscape && typeof value == 'string') {
            value = escape(value);
        }

        tree.strings.push(value);
        tree.left += 2;
        tree.empty = tree.empty && !value;
    };

    Parser.prototype.builders[INCLUDE] = Parser.prototype.builders[OLD_SUBLAYOUT];

    Parser.prototype.builders[FOR] = function (tree, parser) {
        var nodes = tree.nodes,
            i = tree.left + 2,
            left,
            right = tree.right,
            counter = 1,
            endForPosition;

        // Определяем область действия for.
        while (i < right) {
            if (nodes[i] == FOR) {
                counter++;
            } else if (nodes[i] == ENDFOR) {
                if (!--counter) {
                    endForPosition = i;
                }
            }
            if (endForPosition) {
                break;
            }
            i += 2;
        }

        left = tree.left + 2;
        right = endForPosition;

        if (left != right) {
            var expressionParts = nodes[tree.left + 1].split(/\sin\s/),
                beforeIn = trim(expressionParts[0]),
                afterIn = trim(expressionParts[1]),
                list = tree.data.get(afterIn),
                params = beforeIn.split(','),
                paramsLength = params.length;

            // Создаем временное дерево для обработки блока.
            var originRight = tree.right,
                originEmpty = tree.empty,
                originLogger = tree.data,
                tmpDataLogger = new DataLogger(originLogger);

            tree.data = tmpDataLogger;

            for (var property in list) {
                tree.left = left;
                tree.right = right;

                if (list.hasOwnProperty(property)) {
                    if (paramsLength == 1) {
                        tmpDataLogger.setContext(beforeIn, afterIn + "." + property);
                    } else {
                        tmpDataLogger.set(trim(params[0]), property);
                        tmpDataLogger.setContext(trim(params[1]), afterIn + "." + property);
                    }
                    parser._buildTree(tree);
                }
            }

            // Восстанавливаем состоянение оригинального блока с учетом данных временного дерева.
            tree.empty = tree.empty && originEmpty;
            tree.right = originRight;
            tree.data = originLogger;
        }

        tree.left = endForPosition + 2;
    };

    Parser.prototype.builders[IF] =
        Parser.prototype.builders[ELSEIF] = function (tree, parser) {
            var nodes = tree.nodes,
                left = tree.left,
                expression = nodes[left + 1],
                result = evaluateExpression(expression, tree.data),
                isTrue = !!result,
                l,
                i = tree.left + 2,
                r = tree.right,
                depth = 1,
                elsePosition,
                elseIfPosition,
                endIfPosition,
                node;

            while (i < r) {
                node = nodes[i];
                if (node == IF) {
                    depth++;
                } else if (node == ELSEIF) {
                    if (depth == 1 && !elseIfPosition) {
                        elseIfPosition = i;
                    }
                } else if (node == ELSE) {
                    if (depth == 1) {
                        elsePosition = i;
                    }
                } else if (node == ENDIF) {
                    if (!--depth) {
                        endIfPosition = i;
                    }
                }
                if (endIfPosition) {
                    break;
                }
                i += 2;
            }

            if (isTrue) {
                l = tree.left + 2;
                r = elseIfPosition || elsePosition || endIfPosition;
            } else {
                if (elseIfPosition) {
                    l = elseIfPosition;
                    r = endIfPosition + 1;
                } else {
                    l = elsePosition ? elsePosition + 2 : endIfPosition;
                    r = endIfPosition;
                }
            }

            if (l != r) {
                var oldRight = tree.right,
                    oldEmpty = tree.empty;

                tree.left = l;
                tree.right = r;

                parser._buildTree(tree);

                tree.empty = tree.empty && oldEmpty;
                tree.right = oldRight;
            }

            tree.left = endIfPosition + 2;
        };


    Parser.prototype.builders[STYLE] = function (tree, parser) {
        var nodes = tree.nodes,
            l,
            i = tree.left + 2,
            r = tree.right,
            depth = 1,
            endStylePosition,
            node;

        while (i < r) {
            node = nodes[i];
            if (node == STYLE) {
                depth++;
            } else if (node == ENDSTYLE) {
                if (depth == 1) {
                    endStylePosition = i;
                    break;
                }
            }
            i += 2;
        }

        l = tree.left + 2;
        r = endStylePosition;

        if (l != r) {
            var oldRight = tree.right,
                oldEmpty = tree.empty;

            tree.left = l;
            tree.right = r;

            if (cspSupport.isSupported && ym.env.server && ym.env.server.params.csp) {
                tree.strings.push('data-ymaps-style="');
                tree.flags.containsInlineStyle = true;
            } else {
                tree.strings.push('style="');
            }

            parser._buildTree(tree);
            tree.strings.push('"');

            tree.empty = tree.empty && oldEmpty;
            tree.right = oldRight;
        }

        tree.left = endStylePosition + 2;
    };

    provide(Parser);
});

ym.modules.define('util.defineClass', ['util.extend'], function (provide, extend) {
    function augment (childClass, parentClass, override) {
        childClass.prototype = (Object.create || function (obj) {
            function F () {}

            F.prototype = obj;
            return new F();
        })(parentClass.prototype);

        childClass.prototype.constructor = childClass;
        childClass.superclass = parentClass.prototype;
        childClass.superclass.constructor = parentClass;

        if (override) {
            extend(childClass.prototype, override);
        }

        return childClass.prototype;
    }

    function createClass (childClass, parentClass, override) {
        var baseClassProvided = typeof parentClass == 'function';

        if (baseClassProvided) {
            augment(childClass, parentClass);
        }

        for (var i = baseClassProvided ? 2 : 1, l = arguments.length; i < l; i++) {
            extend(childClass.prototype, arguments[i]);
        }

        return childClass;
    }

    provide(createClass);
});
ym.modules.define("util.extend", [
    "util.objectKeys"
], function (provide, objectKeys) {
    /**
     * Функция, копирующая свойства из одного или нескольких
     * JavaScript-объектов в другой JavaScript-объект.
     * @param {Object} target Целевой JavaScript-объект. Будет модифицирован
     * в результате работы функции.
     * @param {Object} source JavaScript-объект - источник. Все его свойства
     * будут скопированы. Источников может быть несколько (функция может иметь
     * произвольное число параметров), данные копируются справа налево (последний
     * аргумент имеет наивысший приоритет при копировании).
     * @name util.extend
     * @function
     * @static
     *
     * @example
     * var options = ymaps.util.extend({
     *      prop1: 'a',
     *      prop2: 'b'
     * }, {
     *      prop2: 'c',
     *      prop3: 'd'
     * }, {
     *      prop3: 'e'
     * });
     * // Получим в итоге: {
     * //     prop1: 'a',
     * //     prop2: 'c',
     * //     prop3: 'e'
     * // }
     */

    function extend (target) {
        if (ym.env.debug) {
            if (!target) {
                throw new Error("util.extend: не передан параметр target");
            }
        }
        for (var i = 1, l = arguments.length; i < l; i++) {
            var arg = arguments[i];
            if (arg) {
                for (var prop in arg) {
                    if (arg.hasOwnProperty(prop)) {
                        target[prop] = arg[prop];
                    }
                }
            }
        }
        return target;
    }

    // этот вариант функции использует Object.keys для обхода обьектов
    function nativeExtend (target) {
        if (ym.env.debug) {
            if (!target) {
                throw new Error("util.extend: не передан параметр target");
            }
        }
        for (var i = 1, l = arguments.length; i < l; i++) {
            var arg = arguments[i];
            if (arg) {
                var keys = objectKeys(arg);
                for (var j = 0, k = keys.length; j < k; j++) {
                    target[keys[j]] = arg[keys[j]];
                }
            }
        }
        return target;
    }

    provide((typeof Object.keys == "function") ? nativeExtend : extend);
});
ym.modules.define("util.id", [], function (provide) {
    /**
     * @ignore
     * @name util.id
     */

    var id = new function () {
        /* Префикс, имеет три применения:
         * как префикс при генерации уникальных id, он призван давать уникальность при каждом запуске страницы
         * как имя свойства в котором хранятся id выданный объекту
         * как id для window
         */
        // http://jsperf.com/new-date-vs-date-now-vs-performance-now/6
        var prefix = ('id_' + (+(new Date())) + Math.round(Math.random() * 10000)).toString(),
            counterId = Math.round(Math.random() * 10000);

        function gen () {
            return (++counterId).toString();
        }

        /**
         * @ignore
         * Возвращает префикс, который используется как имя поля.
         * @return {String}
         */
        this.prefix = function () {
            return prefix;
        };

        /**
         * @ignore
         * Генерирует случайный ID. Возвращает результат в виде строки символов.
         * @returns {String} ID
         * @example
         * util.id.gen(); // -> '45654654654654'
         */
        this.gen = gen;

        /**
         * @ignore
         * Генерирует id и присваивает его свойству id переданного объекта. Если свойство id объекта существует,
         * то значение этого свойства не изменяется. Возвращает значение id в виде строки.
         * @param {Object} object Объект
         * @returns {String} ID
         */
        this.get = function (object) {
            return object === window ? prefix : object[prefix] || (object[prefix] = gen());
        };
    };

    provide(id);
});
ym.modules.define('shri2017.imageViewer.util.imageLoader', [
    'vow'
], function (provide, vow) {
    var imgLoader = function (url) {
        return new vow.Promise(
            function (resolve, reject) {
                var img = new Image();
                img.onload = function () {
                    resolve({
                        url: url,
                        image: img
                    });
                };
                img.onerror = img.onabort = reject;
                img.src = url;
            }
        );
    };
    provide(imgLoader);
});

ym.modules.define("util.jsonp", [
    "util.id",
    "util.querystring",
    "util.script"
], function (provide, utilId, querystring, utilScript) {
    var exceededError = { message: 'timeoutExceeded' },
        scriptError = { message: 'scriptError' },
        undefFunc = function () {},
        removeCallbackTimeouts = {};

    /**
     * @ignore
     * @function
     * @name util.jsonp Загружает скрипт по указанному url и подает ответ на вход функции-обработчика.
     * @param {Object} options Опции.
     * @param {String} options.url Адрес загрузки скрипта.
     * @param {String} [options.paramName = 'callback'] Название параметра для функции-обработчика.
     * @param {String} [options.padding] Имя пользовательской функции-обработчика (функция не создаётся автоматически).
     * @param {String} [options.paddingKey] Имя функции-обработчика (функция с указанным именем будет создана автоматически).
     * @param {Boolean} [options.noCache] Флаг, запрещающий кэширование скрипта. Добавляет случайное число
     * как параметр.
     * @param {Number} [options.timeout = 30000] Количество миллисекунд, в течение которых должен быть загружен скрипт.
     * Иначе удалять скрипт по истечении этого времени.
     * @param {Object} [options.requestParams] Параметры GET запроса.
     * @param {Boolean} [options.checkResponse = true] Флаг, определяющий нужно ли проверять ответ от сервера.
     * Если true, то при отсутствии поля error в ответе или равного null, promise будет зарезолвен
     * со значением res.response или res (если поле response отсутствует), где res - ответ сервера.
     * Иначе promise будет отклонен со значением res.error.
     * @param {String} [options.responseFieldName = 'response'] Имя поля ответа сервера, содержащее
     * данные.
     * @param {Function|Function[]} [options.postprocessUrl] Функция или массив функций для обработки URL перед отправкой запроса.
     * @returns {vow.Promise} Объект-promise.
     */
    function jsonp (options) {
        if (jsonp.handler) {
            return jsonp.handler(options, makeRequest);
        }

        return makeRequest(options);
    }

    function makeRequest (options) {
        var callbackName,
            tag,
            checkResponse = typeof options.checkResponse == 'undefined' ?
                true : options.checkResponse,
            responseFieldName = options.responseFieldName || 'response',
            requestParamsStr = options.requestParams ?
                '&' + querystring.stringify(options.requestParams, null, null, { joinArrays: true }) :
                '',
            deferred = ym.vow.defer(),
            promise = deferred.promise(),
            timeout = options.timeout || 30000,
            exceededTimeout = setTimeout(function () {
                deferred.reject(exceededError);
            }, timeout),
            clearRequest = function () {
                clear(tag, callbackName);
                clearTimeout(exceededTimeout);
                exceededTimeout = null;
            };

        if (!options.padding) {
            callbackName = options.paddingKey || (utilId.prefix() + utilId.gen());

            if (typeof window[callbackName] == 'function' && window[callbackName].promise) {
                return window[callbackName].promise;
            }

            cancelCallbackRemove(callbackName);
            window[callbackName] = function (res) {
                if (checkResponse) {
                    var error = !res || res.error ||
                        (res[responseFieldName] && res[responseFieldName].error);
                    if (error) {
                        deferred.reject(error);
                    } else {
                        deferred.resolve(res && res[responseFieldName] || res);
                    }
                } else {
                    deferred.resolve(res);
                }
            };

            window[callbackName].promise = promise;
        }

        var url = options.url +
            (/\?/.test(options.url) ? "&" : "?") + (options.paramName || 'callback') + '=' + (options.padding || callbackName) +
            (options.noCache ? '&_=' + Math.floor(Math.random() * 10000000) : '') + requestParamsStr;

        if (options.postprocessUrl) {
            if (typeof options.postprocessUrl == 'function') {
                url = options.postprocessUrl(url);
            } else {
                while (options.postprocessUrl.length) {
                    url = (options.postprocessUrl.shift())(url);
                }
            }
        }

        tag = utilScript.create(url);
        tag.onerror = function () {
            deferred.reject(scriptError);
        };

        promise.always(clearRequest);

        return promise;
    }

    /**
     * @ignore
     * Удаляет тэг script.
     */
    function clear (tag, callbackName) {
        if (callbackName) {
            removeCallback(callbackName);
        }
        // Удаляем тег по таймауту, чтобы не нарваться на синхронную обработку,
        // в странных разных браузерах (IE, Опера старая, Сафари, Хром, ФФ4 ),
        // когда содержимое запрошенного скрипта исполняется прямо на строчке head.appendChild(tag)
        // и соответственно, при попытке удалить тэг кидается исключение.
        setTimeout(function () {
            if (tag && tag.parentNode) {
                tag.parentNode.removeChild(tag);
            }
        }, 0);
    }

    /**
     * @ignore
     * удаляем функцию-обработчик
     */
    function removeCallback (callbackName) {
        // Удаляем jsonp-функцию
        window[callbackName] = undefFunc;
        // удаляем функцию через большой интервал, т.к. содержимое удаленного тэга script может попытаться обратится
        // к этой функции, для этого и делаем заглушку undefFunc
        removeCallbackTimeouts[callbackName] = setTimeout(function () {
            // IE не дает делать delete объектов window
            window[callbackName] = undefined;
            try {
                delete window[callbackName];
            } catch (e) {
            }
        }, 500);
    }

    function cancelCallbackRemove (callbackName) {
        if (removeCallbackTimeouts[callbackName]) {
            clearTimeout(removeCallbackTimeouts[callbackName]);
            removeCallbackTimeouts[callbackName] = null;
        }
    }

    provide(jsonp);
});

ym.modules.define('system.nextTick', [], function (provide) {
    var nextTick = (function() {
        var fns = [],
            enqueueFn = function(fn) {
                return fns.push(fn) === 1;
            },
            callFns = function() {
                var fnsToCall = fns, i = 0, len = fns.length;
                fns = [];
                while(i < len) {
                    fnsToCall[i++]();
                }
            };

        if(typeof process === 'object' && process.nextTick) { // nodejs
            return function(fn) {
                enqueueFn(fn) && process.nextTick(callFns);
            };
        }

        if(global.setImmediate) { // ie10
            return function(fn) {
                enqueueFn(fn) && global.setImmediate(callFns);
            };
        }

        if(global.postMessage && !global.opera) { // modern browsers
            var isPostMessageAsync = true;
            if(global.attachEvent) {
                var checkAsync = function() {
                    isPostMessageAsync = false;
                };
                global.attachEvent('onmessage', checkAsync);
                global.postMessage('__checkAsync', '*');
                global.detachEvent('onmessage', checkAsync);
            }

            if(isPostMessageAsync) {
                var msg = '__ym' + (+new Date()),
                    onMessage = function(e) {
                        if(e.data === msg) {
                            e.stopPropagation && e.stopPropagation();
                            callFns();
                        }
                    };

                global.addEventListener?
                    global.addEventListener('message', onMessage, true) :
                    global.attachEvent('onmessage', onMessage);

                return function(fn) {
                    enqueueFn(fn) && global.postMessage(msg, '*');
                };
            }
        }

        var doc = global.document;
        if('onreadystatechange' in doc.createElement('script')) { // ie6-ie8
            var head = doc.getElementsByTagName('head')[0],
                createScript = function() {
                    var script = doc.createElement('script');
                    script.onreadystatechange = function() {
                        script.parentNode.removeChild(script);
                        script = script.onreadystatechange = null;
                        callFns();
                    };
                    head.appendChild(script);
                };

            return function(fn) {
                enqueueFn(fn) && createScript();
            };
        }

        return function(fn) { // old browsers
            enqueueFn(fn) && setTimeout(callFns, 0);
        };
    })();

    provide(nextTick);
});
ym.modules.define("util.objectKeys", [], function (provide) {
    var objectKeys = (typeof Object.keys == 'function') ? Object.keys : function (object) {
        var keys = [];
        for (var name in object) {
            if (object.hasOwnProperty(name)) {
                keys.push(name);
            }
        }
        return keys;
    };
    provide(function (object) {
        var typeofObject = typeof object,
            result;
        if (typeofObject == 'object' || typeofObject == 'function') {
            result = objectKeys(object);
        } else {
            throw new TypeError('Object.keys called on non-object');
        }
        return result;
    });
});
ym.modules.define('util.providePackage', ['system.mergeImports'], function (provide, mergeImports) {
    provide(function (srcPackage, packageArgs) {
        var packageProvide = packageArgs[0],
            packageModules = Array.prototype.slice.call(packageArgs, 1),
            ns = mergeImports.joinImports(srcPackage.name, {}, srcPackage.deps, packageModules);

        packageProvide(ns);
    });
});
/**
 * @fileOverview
 * Query string library. Original code by Azat Razetdinov <razetdinov@ya.ru>.
 */
ym.modules.define('util.querystring', [], function (provide) {
    function isArray (x) {
        return Object.prototype.toString.call(x) === '[object Array]';
    }

    provide({
        /**
         * Parse query string.
         *
         * @function
         * @static
         * @name util.querystring.parse
         * @param {String} string Query string.
         * @param {String} [sep = '&'] Param-param delimiter.
         * @param {String} [eq = '='] Name-value delimiter.
         * @param {Object} [options] Options.
         * @param {Function} [options.decodeURIComponent = decodeURIComponent] Unescape function.
         * @returns {Object} Query params.
         */
        parse: function (string, sep, eq, options) {
            sep = sep || '&';
            eq = eq || '=';
            options = options || {};
            var unescape = options.decodeURIComponent || decodeURIComponent,
                result = {},
                stringTokens = string.split(sep),
                param, name, value;

            for (var i = 0; i < stringTokens.length; ++i) {
                param = stringTokens[i].split(eq);
                name = unescape(param[0]);
                value = unescape(param.slice(1).join(eq));

                if (isArray(result[name])) {
                    result[name].push(value);
                } else if (result.hasOwnProperty(name)) {
                    result[name] = [result[name], value];
                } else {
                    result[name] = value;
                }
            }

            return result;
        },

        /**
         * Stringify query params.
         *
         * @ignore
         * @function
         * @static
         * @name util.queryString.stringify
         * @param {Object} params Query params.
         * @param {String} [sep = '&'] Param-param delimiter.
         * @param {String} [eq = '='] Name-value delimiter.
         * @param {Object} [options] Options.
         * @param {Function} [options.encodeURIComponent = encodeURIComponent] Escape function.
         * @param {Function} [options.joinArrays = false] Concatenate array values in single parameter with ',' as delimiter.
         * @returns {String} Query string.
         */
        stringify: function (params, sep, eq, options) {
            sep = sep || '&';
            eq = eq || '=';
            options = options || {};
            var escape = options.encodeURIComponent || encodeURIComponent,
                result = [],
                name, value;

            for (name in params) {
                if (params.hasOwnProperty(name)) {
                    value = params[name];
                    if (isArray(value)) {
                        if (options.joinArrays) {
                            result.push(escape(name) + eq + escape(value.join(',')));
                        } else {
                            for (var i = 0; i < value.length; ++i) {
                                if (typeof value[i] != 'undefined') {
                                    result.push(escape(name) + eq + escape(value[i]));
                                }
                            }
                        }
                    } else {
                        if (typeof value != 'undefined') {
                            result.push(escape(name) + eq + escape(value));
                        }
                    }
                }
            }

            return result.join(sep);
        }
    });
});

ym.modules.define("util.script", [], function (provide) {
    var head = document.getElementsByTagName("head")[0];
    provide({
        create: function (url, charset) {
            var tag = document.createElement('script');
            // кодировку выставляем прежде src, дабы если файл берется из кеша, он брался не в кодировке страницы
            // эта подобная проблема наблюдалась во всех IE до текущей (восьмой)
            tag.charset = charset || 'utf-8';
            tag.src = url;
            // т.к. head на данный момент может быть не закрыт, добавляем через insertBefore.
            // так как файл может быть взят из кеша и выполнение начнется в тот же момент - timeout
            setTimeout(function () {
                head.insertBefore(tag, head.firstChild);
            }, 0);
            return tag;
        }
    });
});
ym.modules.define('view.css', ['system.provideCss'], function (provide, provideCss) {
provideCss(".image-viewer__view{display:block;background-color:#333}canvas{touch-action:none}", provide);
});
ym.modules.define('shri2017.imageViewer.View', [
    'shri2017.imageViewer.util.imageLoader',
    'util.extend',
    'view.css'
], function (provide, imageLoader, extend) {
    var View = function (params) {
        this._resetData();
        this._setupDOM(params);
        this.setURL(params.url);
    };

    extend(View.prototype, {
        setURL: function (url) {
            this._curURL = url;
            if (this._holderElem) {
                imageLoader(url).then(this._onImageLoaded, this);
            }
        },

        getElement: function () {
            return this._holderElem.parentElement;
        },

        getImageSize: function () {
            return {
                width: this._properties.image.width,
                height: this._properties.image.height
            };
        },

        getState: function () {
            // !
            return extend({}, this._state);
        },

        setState: function (state) {
            // !
            this._state = extend({}, this._state, state);
            this._setTransform(this._state);
        },

        destroy: function () {
            this._teardownDOM();
            this._resetData();
        },

        _onImageLoaded: function (data) {
            if (this._curURL === data.url) {
                var image = data.image;
                this._properties.image = image;
                // Рассчитываем такой масштаб,
                // чтобы сразу все изображение отобразилось
                var containerSize = this._properties.size;
                var zoom = (image.width > image.height) ?
                    containerSize.width / image.width :
                    containerSize.height / image.height;
                this.setState({
                    positionX: - (image.width * zoom - containerSize.width) / 2,
                    positionY: - (image.height * zoom - containerSize.height) / 2,
                    scale: zoom
                });
            }
        },

        _setTransform: function (state) {
            var ctx = this._holderElem.getContext('2d');
            // Сбрасываем текущую трансформацию холста.
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, this._properties.size.width, this._properties.size.height);
            // Устаналиваем новую
            ctx.translate(state.pivotPointX, state.pivotPointY);
            ctx.scale(state.scale, state.scale);
            // Отрисовываем изображение с учетом текущей "стержневой" точки
            ctx.drawImage(
                this._properties.image,
                (state.positionX - state.pivotPointX) / state.scale,
                (state.positionY - state.pivotPointY) / state.scale
            );
        },

        _setupDOM: function (params) {
            this._properties.size.width = params.size.width;
            this._properties.size.height = params.size.height;

            var containerElem = document.createElement('image-viewer');
            containerElem.className = 'image-viewer__view';
            containerElem.style.width = params.size.width + 'px';
            containerElem.style.height = params.size.height + 'px';

            this._holderElem = document.createElement('canvas');
            this._holderElem.setAttribute('width', params.size.width);
            this._holderElem.setAttribute('height', params.size.height);

            containerElem.appendChild(this._holderElem);
            params.elem.appendChild(containerElem);
        },

        _teardownDOM: function () {
            var containerElem = this._holderElem.parentElement;
            containerElem.parentElement.removeChild(containerElem);
            this._holderElem = null;
            this._curURL = null;
        },

        _resetData: function () {
            this._properties = {
                size: {
                    width: 0,
                    height: 0
                },
                image: {
                    width: 0,
                    height: 0
                }
            };

            this._state = {
                positionX: 0,
                positionY: 0,
                scale: 1,
                pivotPointX: 0,
                pivotPointY: 0
            };
        }
    });

    provide(View);
});


})(this);
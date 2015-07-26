/**
 * Generators in an ES5-style. A sort of streamable promise.
 * 
 * These are promises which always deliver many results, but also support returning each 
 * individual item as they are obtained in addition to all once the promise is finally resolved.
 * They are similar to ES6 generators, but are asynchronous via callbacks instead of co-routines.
 * 
 * These have limited support for ES6 generators as well -- You can pass an ES6 generator instance 
 * or generator function (as long as it takes no arguments) into the Generator constructor and then
 * can use the ES5-style API.
 * 
 * The reverse (using ES5 generators as ES6 generators when running ES6) is not currently possible, 
 * though if a good way to implement it is found, it may be added later. This is unlikely though.
 * 
 * @param function(done,reject,emit)|function* cb
 * @returns {Generator}
 */
function Generator(cb) {
	
	
	var self = this;
	
	self._registeredEmits = [];
	self._registeredCatches = [];
	self._registeredDones = [];
	
	var onEmit = function(item) {
		var yields = self._emitters;
		for (var i = 0, max = yields.length; i < max; ++i) {
			var cb = yields[i];
			
			cb.assign();
		}
	};
	
	var callback = function(fns, args) {
		for (var i = 0, max = fns.length; i < max; ++i) {
			fns[i].apply(null, args);
		}
	};
	
	var done = function() {
		callback(self._registeredDones, []);
	};
	
	var reject = function(error) {
		callback(self._registeredCatches, [error]);
	};
	
	var emit = function(item) {
		callback(self._registeredEmits, [item]);
	};
	
	// Unlike promises, callbacks to generator functions _must_ be asynchronous
	// to ensure anyone even has a chance to register for the first item in some cases.
	// Since this is done on a timeout, it ensures that you have until control is released
	// from your function to register emits, dones, and thens before the first item is generated.
	// Items are NOT stored after they are emitted, if you miss it you won't get it.
	
	setTimeout(function() {
		
		// Can't iterate over a generator function, only
		// a generator instance. Start the generator, assuming 
		// it takes no arguments as there is no other option.
		// We'll act as if that instance was passed in.

		if (cb.constructor.name == 'GeneratorFunction') {
			cb = cb();
		}
		
		// We can wrap ES6 generators too.
		
		if (cb.constructor.name == 'GeneratorFunctionPrototype') {
			var item;
			while (!(item = cb.next()).done) {
				emit(item.value);
			}
			done();
			
			return;
		} 
		
		// We can wrap arrays
		
		if (cb.constructor.name == 'Array') { 
			var items = cb;
			var position = 0;
			
			for (var i = 0, max = items.length; i < max; ++i) {
				emit(items[i]);
			}

			done();
			
			return;
		}
		
		// Standard ES5 route.
		
		cb(done, reject, emit);
	}, 1);
}

// Integrate with the environment.

if (typeof window !== 'undefined')
	window.Generator = Generator;

if (typeof module !== 'undefined')
	module.exports = Generator;

// Errors thrown from generators

Generator.InvalidResolution = {
	error: 'streamablePromise-invalid-resolution',
	message: 'You cannot resolve() a Generator with a value. '+
			 'The value of a streamable promise is always the array of yielded items'
};
Generator.InvalidSubpromiseResolution = {
	error: 'streamablePromise-invalid-subresolution',
	message: 'While attempting to combine the results of multiple promises, '+
			 'one of the (non-streamable) promises returned an item which was not an array.'
};

// Static methods

/**
 * Union the results of the promises into a single Generator
 * 
 * @param {type} promises
 * @returns {undefined}
 */
Generator.union = function(promises) {
	return new Generator(function(resolve, reject, emit) {
		for (var i = 0, max = promises.length; i < max; ++i) {
			var promise = promises[i];

			if (promise.emit) {
				promise.emit(function(item) {
					emit(item);
				});
			} else {
				promise.then(function(items) {
					if (typeof items !== 'object' || items.length === undefined) {
						throw Generator.InvalidSubpromiseResolution;
					}
					
					for (var j = 0, jMax = items.length; j < jMax; ++j) {
						emit(items[j]);
					}
				});
			}
		}
	});
};

/**
 * Return items which occur in setA but not in setB.
 * Equality is determined via strict equals (===).
 * Pass a comparator function to override this behavior.
 * 
 * @param {type} promiseForBigSet
 * @param {type} promiseForItemsToExclude
 * @returns {undefined}
 */
Generator.exclude = function(setA, setB, comparator)
{
	if (comparator === undefined) {
		comparator = function(a, b) {
			return a === b;
		}
	}
	
	return new Generator(function(resolve, reject, emit) {
		var itemsA = [];
		var itemsB = [];

		Promise.all([
			setA.then(function(items) {
				itemsA = items;
			}),

			setB.then(function(items) {
				itemsB = items;
			})
		]).then(function() {
			for (var i = 0, max = itemsA.length; i < max; ++i) {
				var itemA = itemsA[i];
				var skip = false;

				for (var j = 0, jMax = itemsB.length; j < jMax; ++j) {
					var itemB = itemsB[j];

					if (comparator(itemA, itemB)) {
						skip = true;
						break;
					}
				}

				if (skip)
					continue;

				emit(itemA);
			}
			
			resolve();
		});
	});
}

/**
 * Intersects the given set of streamable promises, using the given "hasher" function
 * to produce an ID string for each object. This approach is much more efficient than intersecting
 * by comparison (intersectByComparison()), so this should be used instead whenever possible.
 * Efficiency: ?
 * 
 * @param {type} promises
 * @param {type} hasher
 * @returns {undefined}
 */
Generator.intersectByHash = function(promises, hasher) {
	
	return new Generator(function(resolve, reject, emit) {
		var map = {};
		var handlers = [];
		
		for (var i = 0, max = promises.length; i < max; ++i) {
			var promise = promises[i];
			
			var handleEmit = function(item) {
				var id = identify(item);
				var count = 0;
				if (map[id])
					count = map[id];
				
				count += 1;
				map[id] = count;
				
				if (count == promises.length) {
					emit(item);
				}
			}
			
			if (promise.emit) {
				handlers.push(new Promise(function(resolve, reject) {
					handlers.emit(handleEmit).then(function() {
						resolve();
					});
				}));
			} else {
				handlers.push(promise.then(function(items) {
					for (var j = 0, jMax = items.length; j < jMax; ++j) {
						handleEmit(items[j]);
					}
				}));
			}
		}
		
		Promise.all(handlers).then(function() {
			resolve();
		});
	});
}

/**
 * Intersects the given set of streamable promises, using the given "comparator" function
 * to determine if two objects are equal. This form of intersect operation can be much 
 * less efficient than intersection by identity (intersectByIdentity). Efficiency n^2
 * 
 * @param {type} promises
 * @param {type} identify
 * @returns {undefined}
 */
Generator.intersectByComparison = function(promises, comparator) {
	
	return new Generator(function(resolve, reject, emit) {
		var handlers = [];
		var distinctItems = [];
		
		for (var i = 0, max = promises.length; i < max; ++i) {
			var promise = promises[i];
			
			var handleEmit = function(item) {
				var found = false;
				
				for (var j = 0, jMax = distinctItems.length; j < jMax; ++j) {
					var distinctItem = distinctItems[j];
					
					if (comparator(distinctItem.item, item)) {
						distinctItem.count += 1;
						
						if (!distinctItem.emitted && distinctItem.count == promises.length) {
							distinctItem.emitted = true;
							emit(distinctItem.item);
						}
						
						found = true;
						break;
					}
				}
				
				if (found)
					return;
				
				var distinctItem = {
					item: item,
					count: 1,
					emitted: false
				};
				
				if (distinctItem.count == promises.length) {
					emit(distinctItem.item);
					distinctItem.emitted = true;
				}
				
				distinctItems.push(distinctItem);
			}
			
			if (promise.emit) {
				handlers.push(new Promise(function(resolve, reject) {
					promise.emit(handleEmit).then(function() {
						resolve();
					});
				}));
			} else {
				handlers.push(promise.then(function(items) {
					for (var j = 0, jMax = items.length; j < jMax; ++j) {
						handleEmit(items[j]);
					}
				}));
			}
		}
		
		Promise.all(handlers).then(function() {
			resolve();
		});
	});
}

// Instance methods

/**
 * Register a callback for the emit event, when the streamable promise
 * emits an item.
 * 
 * @param {type} cb
 * @returns {Generator.prototype}
 */
Generator.prototype.emit = function(cb) {
	this._registeredEmits.push(cb);
	return this;
};

Generator.prototype.catch = function(cb) {
	this._registeredCatches.push(cb);
	return this;
};

Generator.prototype.done = function(cb) {
	this._registeredDones.push(cb);
	return this;
};

/**
 * To blend nicely with Promises, Generators can start an actual Promise chain.
 * NOTE that this will cause the Generator to store an array of all results emitted 
 * between the registration of this function and when the generator complets (.done()).
 * 
 * This will cause O(N) memory usage instead of O(1), so only use this if you don't 
 * mind storing all generator results into an array (very very bad idea for an 
 * infinite set for example).
 * 
 * @param {type} cb
 * @returns {Promise}
 */
Generator.prototype.then = function(cb) {
	var self = this;
	return new Promise(function(resolve, reject) {
		var items = [];
		
		self.emit(function(item) {
			items.push(item);
		}).done(function() {
			try {
				var result = cb(items);
				resolve(result);
			} catch (e) {
				reject(e);
			}
		});
	});
};
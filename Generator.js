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
	
	var callback = function(fns, args) {
		for (var i = 0, max = fns.length; i < max; ++i) {
			fns[i].apply(null, args);
		}
	};
	
	var done = function() {
		setTimeout(function() {
			callback(self._registeredDones, []);
		}, 1);
	};
	
	var reject = function(error) {
		setTimeout(function() {
			callback(self._registeredCatches, [error]);
		}, 1);
	};
	
	var emit = function(item, cancel) {
		setTimeout(function() {
			callback(self._registeredEmits, [item, cancel]);
		}, 1);
	};
	
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
		var cancelled = false;
		
		while (!cancelled && !(item = cb.next()).done) {
			emit(item.value, function() {
				cancelled = true;
			});
		}
		done();

		return;
	} 

	// We can wrap arrays

	if (cb.constructor.name == 'Array') { 
		var items = cb;
		var position = 0;
		var cancelled = false;
		for (var i = 0, max = items.length; i < max; ++i) {
			emit(items[i], function() {
				cancelled = true;
			});
		}

		done();

		return;
	}

	// We can wrap promises

	if (cb.constructor.name == 'Promise') {
		cb.then(function(result) {
			emit(result, function() { });
			done();
		});
		return;
	}

	// Standard ES5 route.

	cb(done, reject, emit);
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
			 'The Promise value of a generator is always an array of yielded items'
};
Generator.InvalidSubpromiseResolution = {
	error: 'streamablePromise-invalid-subresolution',
	message: 'While attempting to combine the results of multiple promises, '+
			 'one of the promises returned an item which was not an array.'
};

// Static methods

/**
 * Create a generator to emit a single value as given.
 * @param {type} value
 * @returns {Generator}
 */
Generator.resolve = function(value) {
	return new Generator(function(done, reject, emit) {
		emit(value);
		done();
	});
}
	
/**
 * Create a generator which emits for each item of the promise's array result.
 * If the promise does not provide an array, this will break.
 */
Generator.splitPromise = function(promise) {
	return new Generator(function(done, reject, emit) {
		promise.then(function(result) {
			for (var i = 0, max = result.length; i < max; ++i)
				emit(result[i]);
			done();
		});
	});
};

/**
 * Union the results of the given generators into a single generator
 * 
 * @param {type} promises
 * @returns {undefined}
 */
Generator.union = function(generators) {
	return new Generator(function(done, reject, emit) {
		var promises = [];
		
		for (var i = 0, max = generators.length; i < max; ++i) {
			var generator = generators[i];

			if (generator.emit) {
				generator.emit(function(item) {
					emit(item);
				});
				
				promises.push(generator.done());
				
			} else {
				Console.log('WARNING: Passing promises directly to Generator.union() is deprecated. Please wrap the promise in a Generator first.');
				
				promises.push(generator.then(function(items) {
					if (typeof items !== 'object' || items.length === undefined) {
						throw Generator.InvalidSubpromiseResolution;
					}
					
					for (var j = 0, jMax = items.length; j < jMax; ++j) {
						emit(items[j]);
					}
				}));
			}
		}
		
		Promise.all(promises).then(function() {
			done();
		});
		
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
 * Intersects the given set of generators, using the given "hasher" function
 * to produce an ID string for each object. This approach is much more efficient than intersecting
 * by comparison (intersectByComparison()), so this should be used instead whenever possible.
 * Efficiency: ?
 * 
 * @param {type} promises
 * @param {type} hasher
 * @returns {undefined}
 */
Generator.intersectByHash = function(generators, hasher) {
	
	return new Generator(function(resolve, reject, emit) {
		var map = {};
		var handlers = [];
		
		for (var i = 0, max = generators.length; i < max; ++i) {
			var generator = generators[i];
			
			var handleEmit = function(item) {
				var id = hasher(item);
				var count = 0;
				if (map[id])
					count = map[id];
				
				count += 1;
				map[id] = count;
				
				if (count == generators.length) {
					emit(item);
				}
			}
			
			if (generator.emit) {
				handlers.push(new Promise(function(resolve, reject) {
					generator.emit(handleEmit).done(function() {
						resolve();
					});
				}));
			} else {
				console.log('WARNING: Passing promises to Generator.intersectByHash() is deprecated. Please wrap it in a Generator first.');
				
				handlers.push(generator.then(function(items) {
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
 * Intersects the given set of generators, using the given "comparator" function
 * to determine if two objects are equal. This form of intersect operation can be much 
 * less efficient than intersection by identity (intersectByIdentity). Efficiency n^2
 * 
 * @param {type} promises
 * @param {type} identify
 * @returns {undefined}
 */
Generator.intersectByComparison = function(generators, comparator) {
	
	return new Generator(function(resolve, reject, emit) {
		var handlers = [];
		var distinctItems = [];
		
		for (var i = 0, max = generators.length; i < max; ++i) {
			var generator = generators[i];
			
			var handleEmit = function(item) {
				var found = false;
				
				for (var j = 0, jMax = distinctItems.length; j < jMax; ++j) {
					var distinctItem = distinctItems[j];
					
					if (comparator(distinctItem.item, item)) {
						distinctItem.count += 1;
						
						if (!distinctItem.emitted && distinctItem.count == generators.length) {
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
				
				if (distinctItem.count == generators.length) {
					emit(distinctItem.item);
					distinctItem.emitted = true;
				}
				
				distinctItems.push(distinctItem);
			}
			
			if (generator.emit) {
				handlers.push(new Promise(function(resolve, reject) {
					generator.emit(handleEmit).then(function() {
						resolve();
					});
				}));
			} else {
				handlers.push(generator.then(function(items) {
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
 * Register a callback for the emit event, when the generator
 * emits an item.
 * 
 * You may also omit the callback and be returned a promise.
 * This promise will resolve when the next item is emitted from the 
 * Generator, but will not be resolved again, because promises only
 * resolve once.
 * 
 * To instead have a recurring handler, you must pass a callback.
 * 
 * @param {type} cb
 * @returns {Generator.prototype}
 */
Generator.prototype.emit = function(cb) {
	if (!cb) {
		var self = this;
		return new Promise(function(resolve, reject) {
			var handler;
			self.emit(handler = function(item) {
				resolve(item);
				
			});
		});
	}
	this._registeredEmits.push(cb);
	return this;
};

Generator.prototype.deregister = function(event, cb) {
	var map = {
		emit: this._registeredEmits,
		catch: this._registeredCatches,
		done: this._registeredDones
	};
	
	if (map[event].indexOf(cb) >= 0)
		map[event].splice(map[event].indexOf(cb), 1);
};

/**
 * Register a callback for the catch event, when the generator encounters
 * an exception or error.
 * 
 * You may also omit the callback and be returned a promise.
 * This promise will either resolve to an error or never resolve.
 * The promise will never reject.
 * 
 * @param {type} cb
 * @returns {Generator.prototype}
 */
Generator.prototype.catch = function(cb) {
	if (!cb) {
		var self = this;
		return new Promise(function(resolve) {
			self.catch(function(err) {
				resolve(err);
			});
		});
	}
	this._registeredCatches.push(cb);
	return this;
};

/**
 * Pass a callback function or pass no arguments to receive
 * a Promise for completion of the generator.
 * 
 * @param {type} cb
 * @returns {Promise|Generator.prototype}
 */
Generator.prototype.done = function(cb) {
	
	if (!cb) {
		var self = this;
		return new Promise(function(resolve, reject) {
			self.done(function() {
				resolve();
			}).catch(function(err) {
				reject(err);
			});
		});
	}
	
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

describe("Generator", function() {
	it("provides done, reject, emit to its generator function", function(_done) {
		new Generator(function(done, reject, emit) {
			expect(typeof done).toBe('function');
			expect(typeof reject).toBe('function');
			expect(typeof emit).toBe('function');
			_done();
		});
	});

	it("can be cancelled", function(_done) {
		var count = 0;
		new Generator(function(done, reject, emit) {
			var cancelled = false;
			function cancel() {
				cancelled = true;
			}
			var next = 1;
			var interval = setInterval(function() {
				if (!cancelled) {
					emit(next++, cancel);
				}
				
				if (cancelled || next >= 4) {
					done();
					clearInterval(interval);
				}
				
			}, 100);
			
		}).emit(function(item, cancel) {
			count++;
			expect(item).toBe(1); 
			cancel();
		}).done(function() {
			expect(count).toBe(1);
			_done();
		});
	});
	
	it("calls emit listeners for each item emitted", function(_done) {
		var generator = new Generator(function(done, reject, emit) {
			emit(1);
			emit(2);
			emit(3);
			done();
		});
		
		var ix = 1;
		generator.emit(function(item) {
			expect(item).toBe(ix);
			ix += 1;
			
			if (ix == 3)
				_done();
		});
	});
	
	it("calls emit listeners for each item emitted", function(_done) {
		var generator = new Generator(function(done, reject, emit) {
			emit(1);
			emit(2);
			emit(3);
			done();
		});
		
		var i = 1;
		generator.emit(function(item) {
			expect(item).toBe(i);
			i += 1;
			
			if (i == 3)
				_done();
		});
	});
	
	it("can deregister a listener", function(_done) {
		var generator = new Generator(function(done, reject, emit) {
			emit(1);
			emit(2);
			emit(3);
			done();
		});
		var cb;
		var count = 0;
		generator.emit(cb = function(item) {
			expect(item).toBe(1);
			++count;
			generator.deregister('emit', cb);
		}).done(function() {
			expect(count).toBe(1);
			_done();
		});
	});
	
	it("calls both emit listeners and done listeners properly", function(_done) {
		var generator = new Generator(function(done, reject, emit) {
			emit(1);
			emit(2);
			emit(3);
			done();
		});
		
		var i = 1;
		
		generator.emit(function(item) {
			expect(item).toBe(i);
			i += 1;
		}).done(function() {
			expect(i == 4).toBe(true);
			_done();
		});
	});
	
	it("lets you start a promise chain", function(_done) {
		var generator = new Generator(function(done, reject, emit) {
			emit(1);
			emit(2);
			emit(3);
			done();
		});
		
		var i = 1;
		
		generator.then(function(allResults) {
			expect(allResults.length).toBe(3);
			return 'foo';
		}).then(function(shouldBeFoo) {
			expect(shouldBeFoo).toBe('foo');
			_done(); 
		});
	});
	
	it("should accept an array and emit its items", function(_done) {
		var generator = new Generator([1,2,3]);
		
		var i = 1;
		
		generator.emit(function(item) {
			expect(item).toBe(i++);
		}).done(function() {
			_done();
		});
	});
	
	it("should accept a promise and emit its result", function(_done) {
		var generator = new Generator(Promise.resolve(123));
		
		var i = 0; 
		
		generator.emit(function(item) {
			i += item;
		}).done(function() {
			expect(i).toBe(123);
			_done();
		});
	});
});

describe("Generator.resolve()", function() {
	it("provides a Generator which emits the value passed", function(_done) {
		Generator.resolve(123).emit(function(value) {
			expect(value).toBe(123);
		}).done(function() {
			_done();
		});
	});
});
describe('Generator.splitPromise()', function() {
	it("emits each item of a promise's array result", function(_done) {
		var expectedItems = [1,2,3];
		var index = 0;
		
		Generator.splitPromise(Promise.resolve([1,2,3])).emit(function(item) {
			expect(item).toBe(expectedItems[index++]);
		}).done(function() {
			expect(index).toBe(expectedItems.length);
			_done();
		});
	});
});
describe("Generator.union()", function() {
	it("provides a Generator which emits the values of all given generators", function(_done) {
		var items = {};
		for (var i = 1, max = 6; i <= max; ++i) {
			items[i] = true;
		}
		
		Generator.union([
			new Generator([1,2,3]),
			new Generator([4,5,6])
		]).emit(function(value) {
			expect(typeof items[value]).not.toBe('undefined');
			delete items[value];
		}).done(function() {
			for (var i = 1, max = 6; i <= max; ++i)
				expect(typeof items[i]).toBe('undefined');
			_done();
		});
	});
});
describe("Generator.exclude()", function() {
	it("provides a Generator which emits the values of setA which are not in setB", function(_done) {
		var count = 0;
		Generator.exclude(
			new Generator([1,2,3]),
			new Generator([1,3])
		).emit(function(value) {
			++count;
			expect(value).toBe(2);
		}).done(function() {
			expect(count).toBe(1);
			_done();
		});
	});
	it("can take a comparator function", function(_done) {
		var count = 0;
		Generator.exclude(
			new Generator([{id:1},{id:2},{id:3}]),
			new Generator([{id:1},{id:3}]),
			function(a,b) {
				return a.id == b.id;
			}
		).emit(function(item) {
			++count;
			expect(item.id).toBe(2);
		}).done(function() {
			expect(count).toBe(1);
			_done();
		});
	});
});

describe('Generator.intersectByHash()', function() {
	it('provides a Generator of A intersected with B', function(_done) {
		
		var expectedItems = [2,3,6];
		var index = 0;
		
		Generator.intersectByHash(
			[
				new Generator([{id:6},{id:1},{id:2},{id:3}              ]),
				new Generator([              {id:2},{id:3},{id:5},{id:6}])
			],
			function(item) {
				return item.id
			}
		).emit(function(item) {
			//console.log('emitted '+item.id);
			expect(index < expectedItems.length).toBe(true);
			expect(item.id).toBe(expectedItems[index]);
			++index;
		}).done(function() {
			expect(index).toBe(expectedItems.length);
			_done();
		});
	
	});
});
describe('Generator.intersectByComparison()', function() {
	it('provides a Generator of A intersected with B', function(_done) {
		
		var expectedItems = [2,3,6];
		var index = 0;
		
		Generator.intersectByComparison(
			[
				new Generator([{id:6},{id:1},{id:2},{id:3}              ]),
				new Generator([              {id:2},{id:3},{id:5},{id:6}])
			],
			function(a, b) {
				return a.id == b.id;
			}
		).emit(function(item) {
			//console.log('emitted '+item.id);
			expect(index < expectedItems.length).toBe(true);
			expect(item.id).toBe(expectedItems[index]);
			++index;
		}).done(function() {
			expect(index).toBe(expectedItems.length);
			_done();
		});
	
	});
});
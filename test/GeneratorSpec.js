
describe("Generator", function() {
	it("provides done, reject, emit to its generator function", function(_done) {
		new Generator(function(done, reject, emit) {
			expect(typeof done).toBe('function');
			expect(typeof reject).toBe('function');
			expect(typeof emit).toBe('function');
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
	
	it("calls done listeners after the generator function finishes", function(_done) {
		var generator = new Generator(function(done, reject, emit) {
			emit(1);
			emit(2);
			emit(3);
			done();
		});
		
		generator.done(function() {
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
});
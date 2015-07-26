# Generators for ES5

This package provides Promise-like generators which fit natively in ES5. If you are targeting ES6 directly or using transpilation to ES5, you might consider using the standard generators instead. However these generators will work within ES5 runtimes without any transpilation dependencies, which might be useful.

These do not use ES6 iterators or generators, so they are useful where wider compatibility is required.

### Installation

Node (server-side):
```sh
npm install es5-generators
```

Now use ```require('es5-generators')``` to obtain the Generator class.

Bower (client-side, browser):
```sh
bower install es5-generators
```

Now include ```bower_components/es5-generators/Generator.js``` either directly on your page, within your Javascript build step, or using ```require('./bower_components/es5-generators/Generator.js')``` if you are using Browserify.

### Usage

You can create a Generator in a similar way as a Promise:

```js
new Generator(function(done, reject, emit) {
	emit(1);
	emit(2);
	emit(3);
	done();
});
```

### Wrapping other data types
Generators can wrap other data types.
```js
new Generator([1,2,3]); // emits 1, 2, 3
new Generator(Promise.resolve(123)); // emits 123
```

### Consuming a Generator
You can iterate over a Generator as follows:
```js
var generator = someKindOfQuery();
generator.emit(function(item) {
	console.log(item);
}).done(function() {
	console.log('--finished--');
});
```

### Exceptions/Rejections
Exceptions and rejections work like they do with Promises:
```js
var generator = aFailingQuery();
generator.catch(function(err) {
	console.log('The generator faulted');
});

var generator = new Generator(function(done, reject, emit) {
    reject({message:"Rejection message"});
    // Generator also catches exceptions
    throw {message: "Exception message"};
});

```

### Promise Chaining
You can get all items at once in an array, and even start a 
promise chain off of a generator's completion:

```js
var generator = someKindOfQuery();
generator.then(function(items) {
	console.log(items);
	return new Promise(...);
}).then(function(result) {
	console.log(result);
});
```

Note that using Generator.then() will cause O(N) memory usage instead of O(1),
which would be very bad for infinite sets, for instance.

### Testing
To test this package:
```npm test```

### Authors
- William Lahti <<wilahti@gmail.com>>

### License
This software is provided under the terms of the MIT License. See COPYING for details.




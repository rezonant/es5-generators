# Generators for ES5

This package provides Promise-like generators which fit natively in ES5. If you are targeting ES6 directly or using transpilation to ES5, you might consider using the standard generators instead. However these generators will work within ES5 runtimes without any transpilation dependencies, which might be useful.

### Version
0.0.1

### Installation

Node (server-side):
```sh
npm install es5generators
```

Now use ```require('es5generators')``` to obtain the Generator class.

Bower (client-side, browser):
```sh
bower install es5generators
```

Now include ```bower_components/es5generators/Generator.js``` either directly on your page, within your Javascript build step, or using ```require('./bower_components/es5generators/Generator.js')``` if you are using Browserify.

### Testing
To test this package:
```npm test```

### Authors
- William Lahti <<wilahti@gmail.com>>

### License
This software is provided under the terms of the MIT License. See COPYING for details.



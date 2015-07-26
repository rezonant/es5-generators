module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    watch: {
    	main: {
			files: [
				'Gruntfile.js',
				'**/*.js'
			],
			tasks: ['default'],
			options: {
				reload: true
			}
		}
    },

	bump: {
		options: {
			files: ["package.json", "bower.json"],
			updateConfigs: ["pkg"],
			commitFiles: ['package.json', 'bower.json', 'dist/Generator.min.js'],
			commitMessage: 'Release v%VERSION%',
			createTag: true,
			tagName: 'v%VERSION%',
			tagMessage: 'Version %VERSION%',
			push: true,
			pushTo: 'origin',
			gitDescribeOptions: '--tags --always --abbrev=1 --dirty=-d'
		}
	},

	karma: {
	  unit: {
        configFile: 'karma.conf.js',
		singleRun: true
      }
	},

	publish: {
		
	},

    uglify: {
      options: {
        banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n',
        compress: true,
        mangle: false,
        beautify: false
      },

      dist: {
        src: [
            'Generator.js',
        ],
        dest: 'dist/Generator.min.js'
      }
    }
  });

  // Load the plugin that provides the "uglify" task.
  grunt.loadNpmTasks('grunt-bump');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-karma');
  grunt.loadNpmTasks('grunt-publish');

  // Default task(s).
  grunt.registerTask('default', ['uglify']);
  grunt.registerTask('test', ['karma']);

  grunt.registerTask('tag-patch', ['default', 'test', 'bump:patch']);
  grunt.registerTask('tag-minor', ['default', 'test', 'bump:minor']);
  grunt.registerTask('tag-major', ['default', 'test', 'bump:major']);
  grunt.registerTask('tag-git', ['default', 'test', 'bump:git']);
  grunt.registerTask('tag-prepatch', ['default', 'test', 'bump:prepatch']);
  grunt.registerTask('tag-prerelease', ['default', 'test', 'bump:prerelease']);
 
};

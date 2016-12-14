'use strict';

const gulp = require('gulp');
const browserify = require('browserify');
const source = require('vinyl-source-stream');

const PORT = 9000;
const $ = require('gulp-load-plugins')();

let production = false;


gulp.task('html', () => {
	return gulp.src(['app/**/*.html'])
		.pipe(gulp.dest('.tmp'));
});


gulp.task('sass', () => {
	return gulp.src('app/styles/main.scss')
		.pipe($.debug())
		.pipe($.plumber(function onError(error) {
			$.util.log($.util.colors.red(error.message));
			this.emit('end');
		}))
		.pipe($.sass())
		.pipe(gulp.dest('.tmp/styles'));
});


gulp.task('connect', ['html','browserify', 'sass'], () => {
	let serveStatic = require('serve-static');
	let serveIndex = require('serve-index');
	let app = require('connect')()
		.use(require('connect-livereload')({
			port: 35729
		}))
		.use('/node_modules', serveStatic('./node_modules'))
		.use(serveStatic('.tmp'))
		.use(serveStatic('app'))
		.use(serveIndex('.tmp'));

	let http = require('http').createServer(app)
		.listen(PORT)
		.on('listening', () => {
			console.log('Started connect web server on http://localhost:' + PORT);
		});
});


gulp.task('watch', [], () => {
	$.livereload.listen();
	gulp.watch([
			'.tmp/*.html',
			'.tmp/styles/**/*.css',
			'.tmp/scripts/**/*.js',
			'{app}/images/**/*'
		]).on('change', $.livereload.changed);

	gulp.watch(['app/**/*.html'], ['html']);
	gulp.watch(['app/styles/**/*.{css,scss}'], ['sass']);
	gulp.watch(['app/scripts/**/*.js'], ['browserify']);
});


gulp.task('images', [], () => {
	return gulp.src([
			'app/{images, favicons}/**/*.{jpg,png,gif,jpeg,svg}'
		], { base: '.' })
		// imagemin
		.pipe($.rename((path) => {
			var regex = /^win/.test(process.platform) ? /^app\\/ : /^app\//;
			path.dirname =  path.dirname.replace(regex, '');
			//path.dirname =  path.dirname.replace(/^(.*)\/images/, 'modules/$1/images');
		}))
		.pipe($.if(production, $.imagemin({
			progressive: true
		})))
		.pipe(gulp.dest('dist'));
});


gulp.task('useref', ['sass', 'html'], () => {
	const cssFilter = $.filter('.tmp/**/*.css', {restore: true});
	const htmlFilter = $.filter('.tmp/*.html', {restore: true});

	return gulp.src('.tmp/*.html')
		.pipe($.useref({
			searchPath: ['.tmp', 'app']
		}))
		.pipe($.debug({title: 'Debug:before cssFilter'}))
		
		// css
		.pipe(cssFilter)
		.pipe($.debug({title: 'Debug:after cssFilter'}))
		.pipe($.if(production, $.cleanCss()))
		.pipe(cssFilter.restore)

		// hmtl
		.pipe(htmlFilter)
		.pipe($.htmlmin({
			collapseWhitespace: true,
			removeComments: true,
			removeAttributeQuotes: true
		}))
		.pipe(htmlFilter.restore)
		.pipe(gulp.dest('dist'));
});


gulp.task('browserify', [], () => {
	return browserify({
			entries: './app/scripts/main.js',
			debug: !production
		})
		.bundle()
		.on('error', function(err) {
			console.log(err.toString());
			this.emit('end');
		})
		.pipe(source('main.js'))
		.pipe($.buffer())
		.pipe($.if(!production, $.sourcemaps.init({
			loadMaps: true
		})))
		.pipe($.if(production, $.uglify().on('error',(e) => { 
			console.log('Error in uglify !\n',e);
		})))
		.pipe($.if(!production, $.sourcemaps.write('./')))
		.pipe($.debug())
		.pipe(gulp.dest($.if(production,
			'dist/scripts/',
			'.tmp/scripts/')));
});




gulp.task('clean', require('del').bind(null, ['dist', '.tmp']));

gulp.task('serve', ['connect', 'watch'], () => {
	require('opn')('http://localhost:' + PORT);
});

gulp.task('build-node', ['browserify', 'useref', 'images']);

gulp.task('build', ['clean'], () => {
	production = true;
	gulp.start('build-node');
});

gulp.task('default', ['build']);

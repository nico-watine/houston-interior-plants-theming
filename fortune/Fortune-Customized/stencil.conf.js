var path = require('path');
var webpack = require('webpack');

var webpackConfig = {
  bail: false,
  context: __dirname,
  devtool: 'eval-cheap-module-source-map',
  entry: { main: path.resolve(__dirname, 'assets/js/app.js') },
  module: {
    rules: [
      {
        test: /\.js$/,
        include: [
          path.resolve(__dirname, 'assets/js'),
          path.resolve(__dirname, 'node_modules/@bigcommerce/stencil-utils'),
        ],
        use: {
          loader: 'babel-loader',
          options: {
            compact: true,
            cacheDirectory: true,
            minified: true,
            presets: [ ['es2015', {loose: true}] ],
            plugins: ['transform-object-rest-spread']
          }
        }
      }
    ]
  },
  output: {
    path: path.resolve(__dirname, 'assets/js'),
    filename: 'bundle.js'
  },
  plugins: [],
  watch: false
};

/**
 * Watch any custom files and trigger a rebuild
 */
function development() {
  // Rebuild the bundle once at bootup
  webpack(webpackConfig).watch({}, err => {
    if (err) {
      console.error(err.message, err.details);
    }

    // Interface with stencil-cli
    process.send('reload');
  });
}

/**
 * Hook into the `stencil bundle` command and build your files before they are packaged as a .zip
 */
function production() {
  webpackConfig.devtool = false;
  webpackConfig.plugins.push(new webpack.optimize.UglifyJsPlugin({
    comments: false,
    compress: {
        warnings: true,
    },
    sourceMap: false, // Toggle to turn on source maps.
  }));

  webpack(webpackConfig).run(err => {
    if (err) {
      console.error(err.message, err.details);
      throw err;
    }

    // Interface with stencil-cli
    process.send('done');
  });
}

if (process.send) {
  // running as a forked worker
  process.on('message', message => {
    if (message === 'development') {
      development();
    }

    if (message === 'production') {
      production();
    }
  });

  // Interface with stencil-cli
  process.send('ready');
}

/**
 * Watch options for the core watcher
 * @type {{files: string[], ignored: string[]}}
 */
module.exports = {
  // If files in these directories change, reload the page.
  files: [
    '/templates',
    '/lang',
  ],

  //Do not watch files in these directories
  ignored: [
    '/assets/scss',
    '/assets/css',
  ]
};

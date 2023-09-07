var webpack = require('webpack')
var _ = require('lodash')
const { mergeWithCustomize } = require('webpack-merge')
const baseConfig = require('./webpack.addon.config.base')("chrome")
var ZipPlugin = require('zip-webpack-plugin')
const TerserPlugin = require('terser-webpack-plugin')
const WebpackExtensionManifestPlugin = require('webpack-extension-manifest-plugin');
const manifestVersion = "3";
const baseManifest = require('./baseManifest.js');
const package = require('./package.json');
const { config } = require('dotenv')
const { parsed } = config({ path: `./.env.${process.env.BUILD_ENV}` })

console.log("parsed:",parsed)

const isProd = process.env.BUILD_ENV === 'production'
const computedVersion= semiCleverComputeVersion();

function semiCleverComputeVersion(){
  let packageVersion = package.version
  let lastDigits = parseInt((Date.now()-1665497117452)/100000);
  let beforeLastDigits = parseInt(lastDigits / 65000);
  lastDigits = lastDigits % 65000;
  if (beforeLastDigits > 0){
    packageVersion = packageVersion.split(".").slice(0,-1).join(".")
  }
  const computed=packageVersion+"."+beforeLastDigits+"."+lastDigits;
  return computed;
}

module.exports = mergeWithCustomize({
  customizeArray(a, b, key) {
    if (key === 'module.rules') {
      let _u = _.uniq([...a, ...b])
      return _u
    }

    // Fall back to default merging
    return undefined
  },
  customizeObject(a, b, key) {
    if (key === 'module') {
      // Custom merging
      return _.merge({}, a, b)
    }

    // Fall back to default merging
    return undefined
  }
})(baseConfig, {
  mode: "development",
  devtool: 'cheap-module-source-map',
  optimization: {
    splitChunks: {
      cacheGroups: {
        backgroundGroup: {
          test: /[\\/]background\.js$/,
          name: 'background',
          chunks: 'all',
          enforce: true,
        },
      },
    },
    minimize: true,
    minimizer: [new TerserPlugin(
      {
        exclude: /background\.[^.]*\.js$/
      }
    )],
  },
  plugins: [
    new webpack.ProvidePlugin({
      process: 'process/browser',
    }),
    new webpack.optimize.LimitChunkCountPlugin({
      maxChunks: 1,
    }),
    new webpack.ProvidePlugin({
      "React": "react",
    }),
    new WebpackExtensionManifestPlugin({
      config: {
        base: baseManifest,
        extend: {
          "version": computedVersion,
          "key": undefined,
          "manifest_version":parseInt(manifestVersion)
        }
      }
    }),
    new ZipPlugin({
      // OPTIONAL: defaults to the Webpack output path (above)
      // can be relative (to Webpack output path) or absolute
      path: '../deliveries',

      // OPTIONAL: defaults to the Webpack output filename (above) or,
      // if not present, the basename of the path
      filename: `${baseManifest.name}.${computedVersion}.prod.zip`,

      // OPTIONAL: defaults to 'zip'
      // the file extension to use instead of 'zip'
      extension: 'zip',

      // OPTIONAL: defaults to excluding nothing
      // can be a string, a RegExp, or an array of strings and RegExps
      // if a file matches both include and exclude, exclude takes precedence
      exclude: [/delivery/],

      // OPTIONAL: defaults to the empty string
      // the prefix for the files included in the zip file
      //pathPrefix: 'relative/path',

      // OPTIONAL: see https://github.com/thejoshwolfe/yazl#endoptions-finalsizecallback
      zipOptions: {
        forceZip64Format: false
      }
    })
  ]
})
var webpack = require('webpack')
var _ = require('lodash')
const { mergeWithCustomize } = require('webpack-merge')
const baseConfig = require('./webpack.addon.config.base')("chrome")
var ZipPlugin = require('zip-webpack-plugin')
const TerserPlugin = require('terser-webpack-plugin')
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

module.exports = (env) => {
  return mergeWithCustomize({
    customizeArray(a, b, key) {
      if (key === 'module.rules') {
        let _u = _.uniq([...a, ...b]);
        return _u;
      }
      
      // Fall back to default merging
      return undefined;
    },
    customizeObject(a, b, key) {
      if (key === 'module') {
        // Custom merging
        return _.merge({}, a, b);
      }
      
      // Fall back to default merging
      return undefined;
    }
  })(baseConfig, {
    mode:  "production",
    devtool: 'cheap-module-source-map', 
    optimization: {
      minimize: env.minimize=="true"?true:false,
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
      new ZipPlugin({
        path: '../deliveries',
        filename: `${baseManifest.name}.${computedVersion}.prod.zip`,
        extension: 'zip',
        exclude: [/delivery/],
        zipOptions: {
          forceZip64Format: false
        }
      })
    ]
  });
};
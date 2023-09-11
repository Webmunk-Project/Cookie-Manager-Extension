const path = require('path')
const CopyPlugin = require('copy-webpack-plugin')
const fs = require("fs")
var _ = require('lodash')

const webpack = require('webpack')
const { config } = require('dotenv')
const { parsed } = config({ path: `./.env.${process.env.BUILD_ENV}` })
const WebpackExtensionManifestPlugin = require('webpack-extension-manifest-plugin');
const ESLintPlugin = require('eslint-webpack-plugin');

const baseManifest = require("./baseManifest.js");
const manifestVersion = "3";

module.exports = function config(browser){
  return {
    entry: {
      background: [
        './vendor/js/nacl.js',
        './vendor/js/nacl-util.js',
        './js/lib/passive-data-kit.js',
        './js/app/background.js'
      ].concat(buildScriptList(true)),
      contentScript: ["./js/app/content-script.js"].concat(buildScriptList(false)),
      main: ["./js/app/main.js"]
    },
    output: {
      path: path.join(__dirname, 'dist/'),
      filename: '[name].bundle.js',
      publicPath: "."
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js'],
      fallback: { 
        "crypto": require.resolve("crypto-browserify"),
        "stream": require.resolve("stream-browserify"),
        "buffer": require.resolve("buffer/") 
      }
    },
    module: {
      rules: [ 
        {
          test: /\.(woff(2)?|ttf|eot)(\?v=\d+\.\d+\.\d+)?$/,
          use: [
            {
              loader: 'file-loader',
              options: {
                name: '[name].[ext]',
                outputPath: 'fonts/'
              }
            }
          ]
        },
        {
          test: /\.tsx?$/,
          use: [
            {
              loader: 'ts-loader',
            },
            {
              loader: 'webpack-preprocessor-loader',
              options: {
                params: {
                  target: 'addon',
                  mode: 'development'
                }
              }
            }
          ],
          exclude: /node_modules/
        },
        {
          test: /\.(js|jsx)$/,
          use: [
            'babel-loader',
            {
              loader: 'babel-loader',
              options: {
                plugins: [
                  '@babel/plugin-proposal-class-properties',
                  '@babel/plugin-proposal-optional-chaining'
                ]
              }
            },
            {
              loader: 'webpack-preprocessor-loader',
              options: {
                directives: {
                  secret: true
                },
                params: {
                  target: 'addon',
                  mode: 'development',
                  manifestVersion
                }
              }
            }
          ],
          exclude: /node_modules/
        },
        {
          test: /\.css$/,
          loader: 'style-loader',
          exclude: /node_modules/
        },
        {
          test: /\.css$/,
          loader: 'css-loader',
          exclude: /node_modules/,
          options: {
            url: url => {
              // resourcePath - path to css file
              // Don't handle `chosen` urls
              if (url.includes('chosen.min.css')) {
                return false
              }
              return true
            }
          }
        },
        {
          test: /\.(jpe?g|png|gif|woff|woff(2)|eot|ttf|svg)(\?[a-z0-9=.]+)?$/,
          exclude: /node_modules/,
          use: [
            {
              loader: 'url-loader',
              options: {
                limit: 10000,
                esModule: false
              }
            }
          ]
        },
       
      ]
    },
    plugins: [
      new webpack.optimize.LimitChunkCountPlugin({
        maxChunks: 1,
      }),
      new ESLintPlugin({
        failOnError: true,
        failOnWarning: true
      }),
      new CopyPlugin({
        patterns: [
          { from: './images', to: './images' },
          { from: './vendor', to: './vendor' },
          { from: 'index.html', to: '.' },
          ...buildImageList(),
          ...buildRulesList(),
        ]
      }),
      new webpack.EnvironmentPlugin({
        ...parsed,
        BUILD_ENV: process.env.BUILD_ENV,
      }),
      new webpack.ProvidePlugin({
        process: 'process/browser',
      }),
      new WebpackExtensionManifestPlugin({
        config: {
          base: baseManifest,
          extend: {
            "name":baseManifest.name+"_"+(process.env.BUILD_ENV=="development"?"dev":""),
            "manifest_version":parseInt(manifestVersion),
            "permissions": buildPermissionsList(baseManifest.permissions,"permissions"),
            "host_permissions": buildPermissionsList(baseManifest.host_permissions,"host_permissions"),
            "modules": process.env.BUILD_ENV=="production"? undefined: baseManifest.key,
            "key": undefined,
          }
        }
      })
    ]
  }
}
function buildPermissionsList(basePermissions,field){
  let permissionsSet = new Set();
  baseManifest.modules.forEach(m => {
    let moduleManifest = require("./"+m+"/module.json");
    moduleManifest[field].forEach(p => {
      !basePermissions.includes(p) && permissionsSet.add(p)
    })
  });
  console.log("final Permissions ",Array.from(permissionsSet))
  return Array.from(permissionsSet);

}
// read files to be copied
function buildImageList(){
  let fileList = [];
  baseManifest.modules.forEach(m => {
    [{type:"images"},{type:"js",ext:".json"}].forEach(dir => {
      //console.log("Dir "+`./${m}/${type}`+" "+fs.existsSync(`./${m}/${type}`))
      if (fs.existsSync(`./${m}/${dir.type}`))
      fileList = getFilesFromDirectory(`./${m}/${dir.type}`,`./dist/${m}/${dir.type}`,dir.ext, fileList);
    })
  });
  console.log("buildImageList",fileList)
  return fileList.map(f => { return {from: f,to:"./images"}})
}
function buildRulesList(){
  let fileList = [];
  baseManifest.modules.forEach(m => {
    if (fs.existsSync(`./${m}/js/rules.json`)) {
      fileList.push({from: `./${m}/js/rules.json`, to: `./${m}/js/rules.json`})
    }
  });
  console.log("buildRulesList",fileList)
  return fileList;
}
// read manifest file and process each module to be imported
function buildScriptList(takeWorkerType){
  let scriptList = [];
  baseManifest.modules.forEach(m => {
    let moduleManifest = require("./"+m+"/module.json");
    console.log(`Bundling ${moduleManifest.name}...`);
    scriptList = scriptList.concat(createContentScriptList(m, takeWorkerType));
  })
  console.log("scriptList",scriptList)

  return scriptList;
}

function createContentScriptList(module, takeWorkerType){
  console.log(`Appending ${module}`)
  let mainName = takeWorkerType ? `./${module}/js/worker.js`:`./${module}/js/content.js`;
  let data = [];
  if (fs.existsSync(mainName)) data = [mainName];
  data = data.concat(concatenateFileList(`./${module}/js/sites`,takeWorkerType));
  console.log('File list concatenation completed',data);
  return data;
}

function concatenateFileList(srcDir, takeWorkerType){
  try {
    // Check if source directory exists
    if (!fs.existsSync(srcDir)) {
      console.error(`Source directory [${srcDir}]does not exist.`);
      return [];
    }
    
    const entries = fs.readdirSync(srcDir, { withFileTypes: true });
    let data = [];
    for (const entry of entries) {
      const entryExt = path.extname(entry.name);
      if (entry.isFile() &&
      ((takeWorkerType && entry.name.endsWith('_worker.js')) ||
      (!takeWorkerType && !entry.name.endsWith('_worker.js'))
      )
      ) {
        const srcPath = srcDir + "/"+entry.name;
        data = data.concat(srcPath);
      }
    }
    return data;
  } catch (err) {
    console.error(`An error occurred: ${err}`);
  }
};

function getFilesFromDirectory(src, dest, ext, fileList) {
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
       getFilesFromDirectory(srcPath, destPath, ext, fileList);
    } else {
      const entryExt = path.extname(entry.name);
      if (!ext || entryExt==ext) fileList.push(srcPath);
    }
  }
  return fileList;
};
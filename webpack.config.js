const path = require('path');
const webpack = require('webpack');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
const TerserJs = require("terser-webpack-plugin");

// path
const appName = 'APP';
const pathJS = './src/js/main.js';
const pathSCSS = './src/scss/style.js';
const pathJSOutput = 'dist/lib';
const pathCSSOutput = 'dist/lib';

module.exports = [{
  entry: {'app.min': pathJS},
  output: {
    library: appName,
    libraryTarget: 'var',
    path: path.resolve(__dirname, pathJSOutput),
    filename: '[name].js'
  },
  module: {
    rules: [{
      test: /\.(js|jsx)$/,
      exclude: /node_modules/,
      use: {
        loader: "babel-loader",
        options: {
          presets: [
            [
              "@babel/preset-env",
              { targets: { chrome: 53, ie: 11 } }
            ]
          ]
        }
      }
    }]
  },
  optimization: {
    minimizer: [
      new TerserJs({
        test: /\.js(\?.*)?$/i,
        terserOptions: {
          mangle: true,
          keep_fnames: true,
        },
      }),
    ],
  },
  stats: {colors: true, warnings: false},
  experiments: {
    asyncWebAssembly: true,
    syncWebAssembly: true,
  },
  resolve: {
    alias: {
      engine: path.resolve(__dirname, './../engine/src/index.js'),
      three: path.resolve(__dirname, './../engine/node_modules/three'),
      postprocessing: path.resolve(__dirname, './../engine/node_modules/postprocessing'),
    }
  },
}, {
  entry: {'style.min': pathSCSS},
  output: {
    path: path.resolve(__dirname, pathCSSOutput),
    filename: '[name].js'
  },
  module: {
    rules: [
      {
        test: /.s?css$/,
        use: [ MiniCssExtractPlugin.loader, "css-loader", "sass-loader" ],
      },
    ],
  },
  optimization: {
    minimizer: [ new CssMinimizerPlugin() ],
    minimize: true,
  },
  plugins: [new MiniCssExtractPlugin()],
  resolve: {
    alias: {
      engine: path.resolve(__dirname, './../engine/style/index.js'),
    }
  }
}]

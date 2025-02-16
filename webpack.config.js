// webpack.config.js
const path = require('path');

module.exports = {
  mode: 'production',         // or 'development'
  entry: './src/init.js',    // Your main file, which imports everything else
  output: {
    filename: 'main.js',    // Final bundled file
    path: path.resolve(__dirname, 'dist')
    
    // Make sure NOT to set libraryTarget: 'module' if you don't want ESM output
    // e.g., libraryTarget: 'var' or just omit libraryTarget altogether
  },
  module: {
    rules: [
      {
        test: /\.m?js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          // If you don't want to use .babelrc, you can inline options here:
          // options: {
          //   presets: [
          //     ['@babel/preset-env', { modules: 'auto' }]
          //   ]
          // }
        }
      }
    ]
  }
};

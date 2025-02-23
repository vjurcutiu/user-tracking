const path = require('path');

module.exports = {
  mode: 'production', // or 'development'
  entry: {
    main: './src/init.js',
    background: './background.js'
  },
  output: {
    filename: '[name].js',  // This will output "main.js" and "background.js"
    path: path.resolve(__dirname, 'dist')
  },
  module: {
    rules: [
      {
        test: /\.m?js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader'
        }
      }
    ]
  }
};

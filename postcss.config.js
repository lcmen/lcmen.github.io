const production = process.env.JEKYLL_ENV == 'production'

module.exports = {
  plugins: [
    require('tailwindcss'),
    require('autoprefixer'),
    ...(production ? [require('cssnano')({ preset: 'default' })] : [])
  ]
}

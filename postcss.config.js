const production = process.env.JEKYLL_ENV == 'production'

module.exports = {
  plugins: [
    require('@tailwindcss/postcss'),
    ...(production ? [require('cssnano')({ preset: 'default' })] : [])
  ]
}

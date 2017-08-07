require('babel-polyfill');

const environment = {
  development: {
    isProduction: false
  },
  production: {
    isProduction: true
  }
}[process.env.NODE_ENV || 'development'];

module.exports = Object.assign({
  host: process.env.HOST || '0.0.0.0',
  port: process.env.PORT,
  devApi: 'http://localhost:8089',
  prodApi: 'https://webrecorder.io',
  apiPath: '/api/v1',
  internalApiHost: process.env.INTERNAL_HOST,
  internalApiPort: process.env.INTERNAL_PORT,
  product: 'Webrecorder',
  app: {
    title: 'Webrecorder',
    description: '',
    head: {
      titleTemplate: 'Webrecorder | %s',
      meta: [
        { name: 'description', content: '' },
        { charset: 'utf-8' },
        { property: 'og:site_name', content: 'Webrecorder' },
        // { property: 'og:image', content: '' },
        { property: 'og:locale', content: 'en_US' },
        { property: 'og:title', content: 'Webrecorder' },
        { property: 'og:description', content: '' }
        // { property: 'og:card', content: 'summary' },
        // { property: 'og:site', content: '@erikras' },
        // { property: 'og:creator', content: '@erikras' },
        // { property: 'og:image:width', content: '200' },
        // { property: 'og:image:height', content: '200' }
      ]
    }
  },

}, environment);

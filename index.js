require('dotenv').config()
const port = process.env.PORT

const API = require('./api')
const DNS = require('./dns')

DNS.open(port)

module.exports = API

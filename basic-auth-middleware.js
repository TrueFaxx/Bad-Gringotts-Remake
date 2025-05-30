// feel free to uncomment this if you want to have it poassword protected
/*
require('dotenv').config()
module.exports = (req, res, next) => {
  const auth = req.headers.authorization
  const expectedUser = 'username here'
  const expectedPass = 'password here'

  if (!auth || !auth.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="Restricted Area"')
    return res.status(401).send('Authentication required.')
  }

  const credentials = Buffer.from(auth.split(' ')[1], 'base64').toString()
  const [user, pass] = credentials.split(':')

  if (user === expectedUser && pass === expectedPass) {
    return next()
  }

  res.set('WWW-Authenticate', 'Basic realm="Restricted Area"')
  res.status(401).send('Access denied.')
}
*/
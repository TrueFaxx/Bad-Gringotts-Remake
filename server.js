const express = require('express')
const bodyParser = require('body-parser')
const { Client } = require('pg')
const Vec3 = require('vec3')
const bot = require('./bot')
const app = express()
require('dotenv').config()
const port = 3000

app.use(bodyParser.json())
app.use(express.static('public'))

const db = new Client({
  user: 'postgres',
  host: 'localhost',
  database: 'shulker_db',
  password: 'postgres',
  port: 5432
})
db.connect()

app.post('/move-shulker', async (req, res) => {
  const { id } = req.body

  const result = await db.query(
    'SELECT x, y, z, slot FROM public.shulker_inventory WHERE id = $1',
    [id]
  )

  if (result.rows.length === 0) return res.status(404).send('Shulker not found.')

  const { x, y, z, slot } = result.rows[0]
  const source = { x, y, z, slot }
  const destination = new Vec3('destination chest coords')

  bot.moveShulker(source, destination, id)
  res.send('Moving shulker...')
})

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`)
})

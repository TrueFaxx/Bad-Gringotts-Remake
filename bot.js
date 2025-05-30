const mineflayer = require('mineflayer')
const { pathfinder, Movements, goals: { GoalNear } } = require('mineflayer-pathfinder')
const Vec3 = require('vec3')
const { Client } = require('pg')
require('dotenv').config()

const db = new Client({
  user: 'user goes here',
  host: 'the ip of your postgres server goes here (typically localhost unless it is on a separate device)',
  database: 'shulker_db',
  password: 'postgres',
  port: 5432
})
db.connect()
  .then(() => console.log('[DB] Connected'))
  .catch(console.error)

const bot = mineflayer.createBot({
  host: 'the ip of the server to connect to',
  port: 25565,
  username: 'username to use',
  auth: 'microsoft',
  version: '1.21.1'
})

bot.loadPlugin(pathfinder)

function getNearbyChest(center, range = 0) {
  for (let dx = -range; dx <= range; dx++) {
    for (let dy = -range; dy <= range; dy++) {
      for (let dz = -range; dz <= range; dz++) {
        const pos = center.offset(dx, dy, dz)
        const block = bot.blockAt(pos)
        if (block && block.name.includes('chest')) return block
      }
    }
  }
  return null
}

async function safeOpenContainer(block, timeout = 40000) {
  const faceVec = new Vec3(0, 1, 0)
  try {
    return await bot.openBlock(block, faceVec)
  } catch (e) {
    console.warn('openBlock failed, retrying...')
    await bot.waitForTicks(20)
    return await bot.openBlock(block, faceVec)
  }
}

const taskQueue = []
let isProcessing = false

async function nextTask() {
  if (taskQueue.length === 0) {
    isProcessing = false
    return
  }

  isProcessing = true
  const task = taskQueue.shift()
  try {
    await processTask(task.source, task.destination, task.id)
  } catch (err) {
    console.error('Error processing task:', err)
  }
  nextTask()
}

async function processTask(source, destination, id) {
  const chestCenter = new Vec3(source.x, source.y, source.z)
  const chestBlock = getNearbyChest(chestCenter)
  if (!chestBlock) {
    console.error('No chest found near position', chestCenter)
    return
  }

  const movements = new Movements(bot)
  bot.pathfinder.setMovements(movements)

  const goalSource = new GoalNear(chestBlock.position.x, chestBlock.position.y, chestBlock.position.z, 1)
  console.log(`Moving to source chest at ${chestBlock.position}`)
  await bot.pathfinder.goto(goalSource)

  const chest = await safeOpenContainer(chestBlock)
  const item = chest.slots[source.slot]
  if (!item) {
    console.error(`No item found in slot ${source.slot} at source chest.`)
    chest.close()
    return
  }

  console.log(`Withdrawing ${item.name} x${item.count} from slot ${source.slot}`)
  await chest.withdraw(item.type, item.metadata, item.count)
  chest.close()

  const destCenter = new Vec3(destination.x, destination.y, destination.z)
  const destBlock = getNearbyChest(destCenter)
  if (!destBlock) {
    console.error('No chest found near destination position', destCenter)
    return
  }

  const goalDest = new GoalNear(destBlock.position.x, destBlock.position.y, destBlock.position.z, 1)
  console.log(`Moving to destination chest at ${destBlock.position}`)
  await bot.pathfinder.goto(goalDest)

  const destChest = await safeOpenContainer(destBlock)
  console.log(`Depositing ${item.name} x${item.count}`)
  await destChest.deposit(item.type, item.metadata, item.count)
  destChest.close()

  await db.query('DELETE FROM shulker_inventory WHERE id = $1', [id])
  console.log(`[DB] Deleted order with ID ${id}`)

  bot.chat(`Order ${id} completed.`)
}

bot.once('spawn', () => {
  console.log('Bot spawned and ready to process tasks')
  if (taskQueue.length > 0) nextTask()
})

/**
 * @param {Object} source - {x, y, z, slot} of the shulker box
 * @param {Object} destination - {x, y, z} where to move the shulker box
 * @param {string} id - unique ID of the shulker order
 */
function moveShulker(source, destination, id) {
  taskQueue.push({ source, destination, id })
  if (!isProcessing) nextTask()
}

module.exports = { moveShulker }

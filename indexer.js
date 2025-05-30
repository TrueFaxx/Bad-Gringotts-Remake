const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { GoalBlock } = goals;
const Vec3 = require('vec3');
const { Client } = require('pg');

const bot = mineflayer.createBot({
  host: process.env.SVRIP,
  port: 25565,
  username: process.env.USR,
  auth: 'microsoft',
  version: '1.21.4'
});

const db = new Client({
  user: 'put ur postgres user here',
  host: 'localhost',
  database: 'shulker_db',
  password: 'password here',
  port: 5432
});

db.connect().then(() => console.log('[DB] Connected')).catch(console.error);
bot.loadPlugin(pathfinder);

async function generateUniqueId() {
  while (true) {
    let id = '';
    for (let i = 0; i < 16; i++) {
      id += Math.floor(Math.random() * 10);
    }
    const res = await db.query('SELECT COUNT(*) FROM shulker_inventory WHERE id = $1', [id]);
    if (res.rows[0].count === '0') return id;
  }
}

function findAllUniqueChests(origin, radius = 30) {
  const visited = new Set();
  const chestBlocks = [];

  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dz = -radius; dz <= radius; dz++) {
        const pos = origin.offset(dx, dy, dz);
        const block = bot.blockAt(pos);
        if (!block || !block.name.includes("chest")) continue;

        const key = `${pos.x},${pos.y},${pos.z}`;
        if (visited.has(key)) continue;

        const neighbors = [
          pos.offset(1, 0, 0),
          pos.offset(-1, 0, 0),
          pos.offset(0, 0, 1),
          pos.offset(0, 0, -1),
        ];

        let skip = false;
        for (const n of neighbors) {
          const nBlock = bot.blockAt(n);
          if (nBlock && nBlock.name.includes("chest")) {
            const nKey = `${n.x},${n.y},${n.z}`;
            if (visited.has(nKey)) {
              skip = true;
              break;
            }
          }
        }

        if (!skip) {
          chestBlocks.push(block);
          visited.add(key);
        }
      }
    }
  }

  return chestBlocks;
}

async function indexChest(chestBlock) {
  const goal = new GoalBlock(chestBlock.position.x, chestBlock.position.y + 1, chestBlock.position.z);
  await bot.pathfinder.goto(goal);
  await bot.lookAt(chestBlock.position.offset(0.5, 0.5, 0.5));

  console.log(`[Bot] Indexing chest at ${chestBlock.position}`);
  try {
    const chest = await bot.openContainer(chestBlock);
    const items = chest.containerItems();

    for (const item of items) {
      if (!item) continue;
      const itemName = item.customName || item.displayName || item.name;
      const slot = item.slot;
      const id = await generateUniqueId();

      await db.query(
        "INSERT INTO shulker_inventory (id, shulker_name, x, y, z, slot) VALUES ($1, $2, $3, $4, $5, $6)",
        [id, itemName, chestBlock.position.x, chestBlock.position.y, chestBlock.position.z, slot]
      );

      console.log(`[DB] Stored "${itemName}" at (${chestBlock.position.x}, ${chestBlock.position.y}, ${chestBlock.position.z}), slot ${slot}, ID ${id}`);
    }

    chest.close();
  } catch (err) {
    console.error(`[Bot] Failed to index chest at ${chestBlock.position}:`, err.message);
  }
}

bot.once("spawn", async () => {
  console.log(`[Bot] Searching for all unique chests within 30 blocks...`);

  const origin = bot.entity.position.floored();
  const chestBlocks = findAllUniqueChests(origin, 30);
  console.log(`[Bot] Found ${chestBlocks.length} unique chests.`);

  if (chestBlocks.length === 0) {
    bot.chat("No chests found.");
    return;
  }

  const move = new Movements(bot);
  bot.pathfinder.setMovements(move);

  for (const chestBlock of chestBlocks) {
    await indexChest(chestBlock);
  }

  console.log("[Bot] All chests indexed.");
  bot.chat("Finished indexing all chests.");
  bot.quit();
});

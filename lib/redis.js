let config = {}
config.host = process.env.REDIS_HOST ? process.env.REDIS_HOST : 'localhost'
process.env.REDIS_KEY ? (config.password = process.env.REDIS_KEY) : null
const redis = require('redis')
const client = redis.createClient(config)

client.on('error', function(error) {
  console.error(error)
})

const hexists = async (hash, key) => {
  return new Promise((resolve, reject) => {
    client.hexists(hash, key, (err, value) => {
      if (err) reject(err)
      else resolve(value)
    })
  })
}

const exists = async hash => {
  return new Promise((resolve, reject) => {
    client.exists(hash, (err, value) => {
      if (err) reject(err)
      else resolve(value)
    })
  })
}

const hmset = async (hash, key, value) => {
  return new Promise((resolve, reject) => {
    client.hmset(
      hash,
      key,
      typeof value === 'string' ? value : JSON.stringify(value),
      (err, value) => {
        if (err) reject(err)
        else resolve(value)
      }
    )
  })
}

const hmget = async (hash, key) => {
  return new Promise((resolve, reject) => {
    client.hmget(hash, key, (err, value) => {
      if (err) reject(err)
      else {
        let data = {}
        try {
          data = JSON.parse(value)
        } catch (e) {
          data = value
        }
        resolve(data)
      }
    })
  })
}

const hgetall = async hash => {
  return new Promise((resolve, reject) => {
    client.hgetall(hash, (err, value) => {
      if (err) reject(err)
      else resolve(value)
    })
  })
}

const hdel = async (hash, key) => {
  return new Promise((resolve, reject) => {
    client.hdel(hash, key, (err, value) => {
      if (err) reject(err)
      else resolve(value)
    })
  })
}

const del = async hash => {
  return new Promise((resolve, reject) => {
    client.del(hash, (err, value) => {
      if (err) reject(err)
      else resolve(value)
    })
  })
}

module.exports = { hexists, hmset, hmget, hgetall, hdel, del, exists }

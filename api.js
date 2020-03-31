const { send, json } = require('micro')
const { router, get, post } = require('microrouter')
const cors = require('micro-cors')()
const crypto = require('crypto')

const DNS = require('./dns')
const Redis = require('./lib/redis')

//// Redis Layout
// user:token         - list of all zones owned by the token TODO
// zone               - top level list of zones
// zone:name          - token & txt record
// zone:records:name  - list of records
////

/// INIT server on startup
const run = async () => {
  let zones = await Redis.hgetall('zone')
  const allRecords = await getZones(zones)

  Object.keys(allRecords).map(zone => {
    // Re-init Zones
    DNS.addZone(zone)
    // Re-init Records
    Object.keys(allRecords[zone]).map(item =>
      DNS.addRecord(zone, allRecords[zone][item])
    )
  })
}

run()

//// ROUTES
// Returns all zone records
const zoneGet = async (req, res) => {
  const response = await json(req)

  // Validate name
  if (response.zone.slice(-1) === '.')
    return sendError(res, 'Please provide Zone without trailing period (.)')

  // Validate token
  if (!response.token)
    return sendError(res, 'Please make sure to provide your token!')
  try {
    // Verify Domain & Token
    await verifyOwnership(response.zone, response.token)
    console.log('authd')

    // RM settings
    const obj = { [response.zone]: true }
    const records = await getZones(obj)

    return send(res, 201, {
      success: true,
      records
    })
  } catch (e) {
    return sendError(res, e)
  }
}

// Creates a new zone
const zoneAdd = async (req, res) => {
  const response = await json(req)

  // Validate name
  if (response.zone.slice(-1) === '.' || response.zone.slice(0) === '.')
    return sendError(res, 'Please provide Zone without periods')

  // Validate token
  if (!response.token)
    return sendError(res, 'Please make sure to provide your token!')

  // Check if name is fully setup
  if ((await Redis.hexists('zone:' + response.zone, 'token')) === 1)
    return sendError(res, 'This name is already managed by this server')

  try {
    // Get pre-existing claims on the name
    let challengeObject = await Redis.hmget(
      'zone:' + response.zone,
      'challenge'
    )
    // If no challenges then provision now object
    if (challengeObject[0] === null) challengeObject = []
    // check if user has already tried to add domain
    const alreadyChallenged = challengeObject.find(
      item => item.token === response.token
    )
    if (alreadyChallenged)
      return send(res, 201, { success: true, record: alreadyChallenged.txt })

    // Create challenge object
    const userObject = {
      token: response.token,
      txt: 'hsdns-' + crypto.randomBytes(20).toString('hex')
    }
    challengeObject.push(userObject)
    // Save challenge
    const setObject = await Redis.hmset(
      'zone:' + response.zone,
      'challenge',
      challengeObject
    )

    return send(res, 201, { success: true, record: userObject.txt })
  } catch (e) {
    return sendError(res, e)
  }
}

// Removes a zone
const zoneRemove = async (req, res) => {
  const response = await json(req)

  // Validate name
  if (response.zone.slice(-1) === '.')
    return sendError(res, 'Please provide Zone without trailing period (.)')

  // Validate token
  if (!response.token)
    return sendError(res, 'Please make sure to provide your token!')

  // Don't delete a name that doesn't exist
  if ((await Redis.exists('zone:' + response.zone)) === 0)
    return sendError(
      res,
      "This zone doesn't exist. Try adding it before deleting it"
    )

  try {
    // Verify Domain & Token
    await verifyOwnership(response.zone, response.token)
    // RM settings
    DNS.removeZone(response.zone)
    await Redis.del('zone:' + response.zone)
    await Redis.del('zone:records:' + response.zone)
    await Redis.hdel('zone', response.zone)

    return send(res, 201, { success: true })
  } catch (e) {
    return sendError(res, e)
  }
}

// Adds a record to a zone
const add = async (req, res) => {
  const response = await json(req)

  // Validate name
  if (response.zone.slice(-1) === '.')
    return sendError(res, 'Please provide Zone without trailing period (.)')

  // Validate token
  if (!response.token)
    return sendError(res, 'Please make sure to provide your token!')

  // Validate Record
  if (!response.record) return sendError(res, 'Please make you add a record!')

  try {
    // Validate ownership
    await verifyOwnership(response.zone, response.token)

    const recordID = crypto.randomBytes(10).toString('hex')

    // Add record to zone
    const result = await DNS.addRecord(response.zone, response.record)

    // Add record to zone
    await Redis.hmset(
      'zone:records:' + response.zone,
      recordID,
      response.record
    )

    return send(res, 201, { success: true, record: recordID })
  } catch (e) {
    return sendError(res, e)
  }
}

// Removes a record from a zone
const remove = async (req, res) => {
  const response = await json(req)

  // Validate name
  if (response.zone.slice(-1) === '.')
    return sendError(res, 'Please provide Zone without trailing period (.)')

  // Validate token
  if (!response.token)
    return sendError(res, 'Please make sure to provide your token!')

  // Validate token
  if (!response.record)
    return sendError(res, 'Please make sure to provide the record ID!')
  try {
    // Validate ownership
    await verifyOwnership(response.zone, response.token)

    // Remove all records
    const rmChallenge = await Redis.hdel(
      'zone:records:' + response.zone,
      response.record
    )

    // Fetch all records
    const fetchRecords = await Redis.hgetall('zone:records:' + response.zone)

    // Clear Zone
    // BNS Zone() should really have an rm option
    DNS.clearZone(response.zone)

    // Re-init all records
    Object.keys(fetchRecords).map(item =>
      DNS.addRecord(response.zone, fetchRecords[item])
    )

    return send(res, 201, { success: true })
  } catch (e) {
    return sendError(res, e)
  }
}

// Resolve a HNS query
const resolve = async (req, res) => {
  const success = await DNS.resolve(req.params.name, req.params.type)
  send(res, 201, { success })
}

/////////////// HELPERS ////////////////////

const verifyOwnership = async (zone, token) => {
  // Get name's info
  const zoneInfo = await Redis.hgetall('zone:' + zone)

  // Resolve zone's TXT
  const resolved = await DNS.resolve(zone + '.', 'TXT') // Change this to TXT

  // Get the challenge TXT
  let record = null
  if (resolved.answer[0]) {
    resolved.answer.map(object => {
      if (object.data.txt) {
        object.data.txt.map(item => {
          if (item.substring(0, 5) === 'hsdns') record = item
        })
      }
    })
  }

  // Check if the HSD has the verifcation TXT (CHANGE ME)
  if (!record)
    throw 'Unable to verify you own the domain. \nMake your record was entered in the Urkle tree.'

  // If there is challenge info check to see if there is a rightful owner
  if (zoneInfo.challenge) {
    const owner = JSON.parse(zoneInfo.challenge).find(
      items => items.txt === record
    )

    if (owner) {
      console.log('Owner Found')
      const setZoneRecord = await Redis.hmset('zone', zone, true)
      const setUserRecord = await Redis.hmset('user:' + owner.token, zone, true)
      const setToken = await Redis.hmset('zone:' + zone, 'token', owner.token)
      const setTxt = await Redis.hmset('zone:' + zone, 'txt', owner.txt)
      const rmChallenge = await Redis.hdel('zone:' + zone, 'challenge')
      // Finally add the award
      DNS.addZone(zone)
    } else {
      throw "Record found, its just that you don't own it 😬"
    }
  }

  // Check if the user token matches the owner's token
  const zoneToken = await Redis.hmget('zone:' + zone, 'token')
  if (zoneToken[0] !== token) throw 'Invalid token.'

  return
}

const getZones = async zones => {
  let result = {}
  const zone = Object.keys(zones).map(async key => {
    result[key] = {}
    console.log
    const records = await Redis.hgetall('zone:records:' + key)
    for (let [id, value] of Object.entries(records)) {
      result[key][id] = value
    }
  })
  await Promise.all(zone)
  return result
}
const sendError = (res, error) => {
  return send(res, 400, { error })
}

module.exports = cors(
  router(
    post('/zone-info', zoneGet), // Get zone info
    post('/zone-add', zoneAdd), // Add a new zone
    post('/zone-remove', zoneRemove), // Remove a whole zone
    post('/record-add', add), // Add a new record
    post('/record-remove', remove), // Remove a record
    get('/resolve/:name/:type', resolve) // Resolve a HSD name
  )
)

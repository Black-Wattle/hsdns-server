const bns = require('bns')
const MultiZone = require('./lib/multizone')
const { StubResolver } = bns

////////////////////////////
/////// STUB RESOLVER //////
////////////////////////////

const resolver = new StubResolver({
  tcp: true,
  inet6: true,
  edns: true,
  dnssec: true
})

// Set HSD Tools as the Stub Resolver
resolver.setServers(['188.166.79.165'])
resolver.open()

// Resolve a Query
const resolve = async (domain, type) => {
  const res = await resolver.lookup(domain, type)
  return res
}

////////////////////////////
///////// MULTI DNS ////////
////////////////////////////

/// Auth DNS Server for the TLD
const server = new MultiZone({
  tcp: true,
  edns: true,
  dnssec: true
})

server.on('query', (req, res, rinfo) => {})

// Start DNS server
const open = port => {
  console.log('Starting DNS server')
  try {
    server.bind(port ? port : 53, '0.0.0.0')
  } catch (e) {
    console.log(e)
  }
}

// Add a zone to the MultiDNS
const addZone = name => {
  console.log('Adding:', name)
  return server.addOrigin(name)
}

// Add a record to a Zone
const addRecord = (zone, record) => {
  console.log('Adding Record:', record)
  return server.addRecord(zone, record)
}

// Clear a whole zone
const clearZone = zone => {
  console.log('Clearing Zone:', zone)
  return server.clearZone(zone)
}

// Clear a whole zone
const removeZone = zone => {
  console.log('Clearing Zone:', zone)
  return server.removeZone(zone)
}

module.exports = {
  open,
  addZone,
  addRecord,
  clearZone,
  removeZone,
  resolve
}

const bns = require('bns')
const { Zone, DNSServer, wire } = bns

class MultiZone extends DNSServer {
  constructor(options) {
    super(options)
    this.zone = []
    this.ra = false
    this.initOptions(options)
  }
  // Add a new Zone into the server
  addOrigin(name) {
    const key = name.split('.')[0]
    if (this.zone[key])
      throw 'This zone already exists on the server. Please try adding a record.'
    this.zone[key] = new Zone()
    this.zone[key].setOrigin(key + '.')
    return this
  }

  // Add new record to Zone
  // Accepts zonefile strings
  addRecord(zone, string) {
    if (!this.zone[zone])
      throw "This zone doesn't exist yet. Please add it first."
    const rr = new wire.Record()
    rr.fromString(string)
    return this.zone[zone].insert(rr)
  }

  // Clear zone of all records
  clearZone(zone) {
    return this.zone[zone].clearRecords()
  }

  removeZone(name) {
    const index = this.zone.indexOf(name)
    if (index > -1) {
      this.zone.splice(index, 1)
    }
    return
  }
  // Accept file to populate zone
  setFile(name, file) {
    this.zone[name].clearRecords()
    this.zone[name].fromFile(file)
    return this
  }

  // Resolve a record
  async resolve(req, rinfo) {
    const [qs] = req.question
    const { name, type } = qs
    const zone = name.split('.').reverse()[1]
    return this.zone[zone].resolve(name, type)
  }
}

const getZone = string => {
  return string
    .split(' ')[0]
    .split('.')
    .reverse()[1]
}

module.exports = MultiZone

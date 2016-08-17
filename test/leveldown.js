'use strict'

const lab = exports.lab = require('lab').script()
const describe = lab.experiment
const before = lab.before
const after = lab.after
const it = lab.it
const expect = require('code').expect

const async = require('async')
const levelup = require('levelup')
const memdown = require('memdown')

const Node = require('../')

const A_BIT = 1000

describe('leveldown', () => {
  let follower, leader, leveldown
  const nodeAddresses = [
    '/ip4/127.0.0.1/tcp/9190',
    '/ip4/127.0.0.1/tcp/9191',
    '/ip4/127.0.0.1/tcp/9192'
  ]

  const nodes = nodeAddresses.map((address, index) =>
    new Node(address, { db: memdown }))

  before(done => {
    nodes.forEach(node => node.on('warning', err => { throw err }))
    done()
  })

  before(done => {
    async.each(nodes, (node, cb) => node.start(cb), done)
  })

  after(done => {
    async.each(nodes, (node, cb) => node.stop(cb), done)
  })

  before(done => {
    nodes.forEach((node, index) => {
      const selfAddress = nodeAddresses[index]
      const peers = nodeAddresses.filter(address => address !== selfAddress)
      peers.forEach(peer => node.join(peer))
    })
    done()
  })

  before(done => setTimeout(done, A_BIT))

  before(done => {
    leader = nodes.find(node => node.is('leader'))
    follower = nodes.find(node => node.is('follower'))
    expect(follower).to.not.be.undefined()
    expect(leader).to.not.be.undefined()
    expect(leader === follower).to.not.be.true()
    done()
  })

  it ('can be created', done => {
    leveldown = leader.leveldown()
    done()
  })

  it ('can set bunch of keys', done => {
    async.each(
      ['a', 'b', 'c'],
      (key, cb) => {
        leveldown.put(`key ${key}`, `value ${key}`, cb)
      },
      done)
  })

  it ('can get a key', done => {
    async.each(['a', 'b', 'c'], (key, cb) => {
      leveldown.get(`key ${key}`, (err, values) => {
        expect(err).to.be.null()
        expect(values).to.equal(`value ${key}`)
        cb()
      })
    }, done)
  })

  it('key is there', done => {
    leveldown.get('key c', done)
  })

  it('can del a key', done => {
    leveldown.del('key c', done)
  })

  it('deleted key is no longer found', done => {
    leveldown.get('key c', err => {
      expect(err.message).to.equal('Key not found in database')
      done()
    })
  })

  it('accepts batch commands', done => {
    const batch = [
      {type: 'put', key: 'key d', value: 'value d'},
      {type: 'put', key: 'key e', value: 'value e'},
      {type: 'del', key: 'key b'},
    ]
    leveldown.batch(batch, done)
  })

  it('batch puts were effective', done => {
    async.map(['key d', 'key e'], leveldown.get.bind(leveldown),
      (err, results) => {
        expect(err).to.be.null()
        expect(results).to.equal(['value d', 'value e'])
        done()
      })
  })

  it('batch dels were effective', done => {
    leveldown.get('key b', err => {
      expect(err.message).to.equal('Key not found in database')
      done()
    })
  })
})

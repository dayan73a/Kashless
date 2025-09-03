// Polyfills para React Native BLE
import { Buffer } from 'buffer'
import { EventEmitter } from 'events'

globalThis.Buffer = Buffer
globalThis.process = {
  env: {},
  version: '',
  nextTick: (callback) => setTimeout(callback, 0),
}
globalThis.EventEmitter = EventEmitter

// Polyfill para global
if (typeof global === 'undefined') {
  window.global = window
}
/**
 * @class
 * @description Implements Actor layer over WebWorker's postMessage
 * and onmessage to make messaging between parents and workers
 * look like regular method calls between objects.
 * @example
 *
 */

class Actor {
  constructor(context) {
    this._peerMethodAckCounters = {}; // methodName => int
    this._peerMethodAckPromises = {}; // methodName#counter => [resolve, reject]
    this.isInitialized = false;
    this.context = context;
    this.context.onmessage = this.receive.bind(this);
    // methods not accessible from our peer
    this.blacklist = ['send', 'receive', 'initPeerAcks', 'buildPeerProxy'];
    let initialMethods = ['initPeer'];
    this.peer = this.buildPeerProxy(initialMethods)
    this.initPeerAcks(initialMethods);
  }

  start() {
	return this.send('initPeer', this.getMyMethods());
  }

  /**
   * Wraps context's postMessage and returns a Promise to be resolved
   * with by the ack from our peer.
   */
  send(methodName, args) {
    // TODO validate methodName? not necessary if send is private?
    let counter = ++this._peerMethodAckCounters[methodName];
    let ackId = methodName + "#" + counter;
    args.unshift(ackId);
    args.unshift(methodName);
    let ackPromise = new Promise((resolve, reject) => {
      // this is UBER EW... Maybe a different future primitive?
      this._peerMethodAckPromises[ackId] = [resolve, reject];
    });

	if (methodName === 'initPeer') {
	  ackPromise.then((methodResponse) => {
		this.peer = this.buildPeerProxy(methodResponse);
		this.initPeerAcks(methodResponse);
	  }).catch((e) => {
		console.error("Failed to initialize peer-- ", e);
	  });
	}
    this.context.postMessage(args);
    return ackPromise;
  }
  /**
   * Handles the 'ack' reply from our peer and resolves send's Promise
   */
  ack(ackId, value) {
    let resolve = this._peerMethodAckPromises[ackId][0],
    reject = this._peerMethodAckPromises[ackId][1];

    if (value instanceof Error){
      reject(value);
    }
    else {
      resolve(value);
    }
    this._peerMethodAckPromises[ackId] = undefined;
  }
  /**
   * Handler for context's onmessage event, dispatches to the appropriate
   * method on this and ensures we reply with an ack to the peer.
   */
  receive(e) {
    if (!e || !Array.isArray(e.data)) {
      throw new TypeError("Received unknown message", e);
    }
    let methodName = e.data.shift();
    if (!this[methodName] || typeof this[methodName] !== 'function') {
      throw new TypeError(methodName + ' is not a function', e);
    }
	// if we're dispatching to ack we're done
    if (methodName == 'ack') {
	  return this[methodName].apply(this, e.data);
	}
    // otherwise we need to ack the sender
	let ackId = e.data.shift();
	let returnVal = this[methodName].apply(this, e.data);
    if (returnVal instanceof Promise) {
      returnVal.then(val => {
        this.context.postMessage(['ack', ackId, val]);
      })
    }
    else {
      this.context.postMessage(['ack', ackId, returnVal]);
    }
  }

  /**
   * returns a new peer object which proxies method accesses
   * to postMessage calls on the peer
   */
  buildPeerProxy(methods) {
    let peer = {}, self = this;
    let handlers = {
      get: (target, property, receiver) => {
        console.log("called " + property);
        if (methods.indexOf(property) !== -1) {
          return function() {
            let args = Array.prototype.slice.call(arguments);
            return self.send(property, args)
          }
        }
        return undefined;
      }
    }
    let proxy = new Proxy(peer, handlers);
    return proxy;
  }

  initPeerAcks(methods) {
    // init the peerMethodAck's
    methods.forEach(methodName => {
      this._peerMethodAckCounters[methodName] = 0;
      this._peerMethodAckPromises[methodName] = {};
    });
  }

  getMyMethods() {
	var methods = [],
	self = this;
	do {
	  methods = methods.concat(Object.getOwnPropertyNames(self));
	  self = Object.getPrototypeOf(self);
	} while (self instanceof Actor);
	methods = methods.filter(k => {
	  return this.blacklist.indexOf(k) === -1 && k.indexOf('_') !== 0;
    });
	console.log('getMyMethods ', methods);
	return methods;
  }

  /**
   * Receive the 'initPeer' message to setup our model of what we can call
   * @param methods {Array<string>} list of valid peer methods to call
   * @returns {Array<string>} list of valid callable methods on this
   */
  initPeer(methods) {
	console.log('initPeer');
    this.peer = this.buildPeerProxy(methods);
    // only one call to initPeer allowed.
    this.blacklist.push('initPeer');
    this.isInitialized = true;
    // return our methods to sender
    return this.getMyMethods();
  }
}

class WorkerActor extends Actor {
  constructor(script) {
    let worker = new Worker(script);
    super(worker)
    this.blacklist.concat(["terminate", "close"]);
  }
  terminate () {
    this.context.terminate();
  }
  close () {
    this.context.close()
  }
}


(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = global || self, global.jwp = factory());
}(this, (function () { 'use strict';

  /**
   * Phoenix Channels JavaScript client
   *
   * ## Socket Connection
   *
   * A single connection is established to the server and
   * channels are multiplexed over the connection.
   * Connect to the server using the `Socket` class:
   *
   * ```javascript
   * let socket = new Socket("/socket", {params: {userToken: "123"}})
   * socket.connect()
   * ```
   *
   * The `Socket` constructor takes the mount point of the socket,
   * the authentication params, as well as options that can be found in
   * the Socket docs, such as configuring the `LongPoll` transport, and
   * heartbeat.
   *
   * ## Channels
   *
   * Channels are isolated, concurrent processes on the server that
   * subscribe to topics and broker events between the client and server.
   * To join a channel, you must provide the topic, and channel params for
   * authorization. Here's an example chat room example where `"new_msg"`
   * events are listened for, messages are pushed to the server, and
   * the channel is joined with ok/error/timeout matches:
   *
   * ```javascript
   * let channel = socket.channel("room:123", {token: roomToken})
   * channel.on("new_msg", msg => console.log("Got message", msg) )
   * $input.onEnter( e => {
   *   channel.push("new_msg", {body: e.target.val}, 10000)
   *     .receive("ok", (msg) => console.log("created message", msg) )
   *     .receive("error", (reasons) => console.log("create failed", reasons) )
   *     .receive("timeout", () => console.log("Networking issue...") )
   * })
   *
   * channel.join()
   *   .receive("ok", ({messages}) => console.log("catching up", messages) )
   *   .receive("error", ({reason}) => console.log("failed join", reason) )
   *   .receive("timeout", () => console.log("Networking issue. Still waiting..."))
   *```
   *
   * ## Joining
   *
   * Creating a channel with `socket.channel(topic, params)`, binds the params to
   * `channel.params`, which are sent up on `channel.join()`.
   * Subsequent rejoins will send up the modified params for
   * updating authorization params, or passing up last_message_id information.
   * Successful joins receive an "ok" status, while unsuccessful joins
   * receive "error".
   *
   * ## Duplicate Join Subscriptions
   *
   * While the client may join any number of topics on any number of channels,
   * the client may only hold a single subscription for each unique topic at any
   * given time. When attempting to create a duplicate subscription,
   * the server will close the existing channel, log a warning, and
   * spawn a new channel for the topic. The client will have their
   * `channel.onClose` callbacks fired for the existing channel, and the new
   * channel join will have its receive hooks processed as normal.
   *
   * ## Pushing Messages
   *
   * From the previous example, we can see that pushing messages to the server
   * can be done with `channel.push(eventName, payload)` and we can optionally
   * receive responses from the push. Additionally, we can use
   * `receive("timeout", callback)` to abort waiting for our other `receive` hooks
   *  and take action after some period of waiting. The default timeout is 10000ms.
   *
   *
   * ## Socket Hooks
   *
   * Lifecycle events of the multiplexed connection can be hooked into via
   * `socket.onError()` and `socket.onClose()` events, ie:
   *
   * ```javascript
   * socket.onError( () => console.log("there was an error with the connection!") )
   * socket.onClose( () => console.log("the connection dropped") )
   * ```
   *
   *
   * ## Channel Hooks
   *
   * For each joined channel, you can bind to `onError` and `onClose` events
   * to monitor the channel lifecycle, ie:
   *
   * ```javascript
   * channel.onError( () => console.log("there was an error!") )
   * channel.onClose( () => console.log("the channel has gone away gracefully") )
   * ```
   *
   * ### onError hooks
   *
   * `onError` hooks are invoked if the socket connection drops, or the channel
   * crashes on the server. In either case, a channel rejoin is attempted
   * automatically in an exponential backoff manner.
   *
   * ### onClose hooks
   *
   * `onClose` hooks are invoked only in two cases. 1) the channel explicitly
   * closed on the server, or 2). The client explicitly closed, by calling
   * `channel.leave()`
   *
   *
   * ## Presence
   *
   * The `Presence` object provides features for syncing presence information
   * from the server with the client and handling presences joining and leaving.
   *
   * ### Syncing state from the server
   *
   * To sync presence state from the server, first instantiate an object and
   * pass your channel in to track lifecycle events:
   *
   * ```javascript
   * let channel = socket.channel("some:topic")
   * let presence = new Presence(channel)
   * ```
   *
   * Next, use the `presence.onSync` callback to react to state changes
   * from the server. For example, to render the list of users every time
   * the list changes, you could write:
   *
   * ```javascript
   * presence.onSync(() => {
   *   myRenderUsersFunction(presence.list())
   * })
   * ```
   *
   * ### Listing Presences
   *
   * `presence.list` is used to return a list of presence information
   * based on the local state of metadata. By default, all presence
   * metadata is returned, but a `listBy` function can be supplied to
   * allow the client to select which metadata to use for a given presence.
   * For example, you may have a user online from different devices with
   * a metadata status of "online", but they have set themselves to "away"
   * on another device. In this case, the app may choose to use the "away"
   * status for what appears on the UI. The example below defines a `listBy`
   * function which prioritizes the first metadata which was registered for
   * each user. This could be the first tab they opened, or the first device
   * they came online from:
   *
   * ```javascript
   * let listBy = (id, {metas: [first, ...rest]}) => {
   *   first.count = rest.length + 1 // count of this user's presences
   *   first.id = id
   *   return first
   * }
   * let onlineUsers = presence.list(listBy)
   * ```
   *
   * ### Handling individual presence join and leave events
   *
   * The `presence.onJoin` and `presence.onLeave` callbacks can be used to
   * react to individual presences joining and leaving the app. For example:
   *
   * ```javascript
   * let presence = new Presence(channel)
   *
   * // detect if user has joined for the 1st time or from another tab/device
   * presence.onJoin((id, current, newPres) => {
   *   if(!current){
   *     console.log("user has entered for the first time", newPres)
   *   } else {
   *     console.log("user additional presence", newPres)
   *   }
   * })
   *
   * // detect if user has left from all tabs/devices, or is still present
   * presence.onLeave((id, current, leftPres) => {
   *   if(current.metas.length === 0){
   *     console.log("user has left from all devices", leftPres)
   *   } else {
   *     console.log("user left from a device", leftPres)
   *   }
   * })
   * // receive presence data from server
   * presence.onSync(() => {
   *   displayUsers(presence.list())
   * })
   * ```
   * @module phoenix
   */

  var globalSelf = typeof self !== "undefined" ? self : null;
  var phxWindow = typeof window !== "undefined" ? window : null;
  var global = globalSelf || phxWindow || undefined;
  var DEFAULT_VSN = "2.0.0";
  var SOCKET_STATES = {connecting: 0, open: 1, closing: 2, closed: 3};
  var DEFAULT_TIMEOUT = 10000;
  var WS_CLOSE_NORMAL = 1000;
  var CHANNEL_STATES = {
    closed: "closed",
    errored: "errored",
    joined: "joined",
    joining: "joining",
    leaving: "leaving",
  };
  var CHANNEL_EVENTS = {
    close: "phx_close",
    error: "phx_error",
    join: "phx_join",
    reply: "phx_reply",
    leave: "phx_leave"
  };
  var CHANNEL_LIFECYCLE_EVENTS = [
    CHANNEL_EVENTS.close,
    CHANNEL_EVENTS.error,
    CHANNEL_EVENTS.join,
    CHANNEL_EVENTS.reply,
    CHANNEL_EVENTS.leave
  ];
  var TRANSPORTS = {
    longpoll: "longpoll",
    websocket: "websocket"
  };

  // wraps value in closure or returns closure
  var closure = function (value) {
    if(typeof value === "function"){
      return value
    } else {
      var closure = function(){ return value };
      return closure
    }
  };

  /**
   * Initializes the Push
   * @param {Channel} channel - The Channel
   * @param {string} event - The event, for example `"phx_join"`
   * @param {Object} payload - The payload, for example `{user_id: 123}`
   * @param {number} timeout - The push timeout in milliseconds
   */
  var Push = function Push(channel, event, payload, timeout){
    this.channel    = channel;
    this.event      = event;
    this.payload    = payload || function(){ return {} };
    this.receivedResp = null;
    this.timeout    = timeout;
    this.timeoutTimer = null;
    this.recHooks   = [];
    this.sent       = false;
  };

  /**
   *
   * @param {number} timeout
   */
  Push.prototype.resend = function resend (timeout){
    this.timeout = timeout;
    this.reset();
    this.send();
  };

  /**
   *
   */
  Push.prototype.send = function send (){ if(this.hasReceived("timeout")){ return }
    this.startTimeout();
    this.sent = true;
    this.channel.socket.push({
      topic: this.channel.topic,
      event: this.event,
      payload: this.payload(),
      ref: this.ref,
      join_ref: this.channel.joinRef()
    });
  };

  /**
   *
   * @param {*} status
   * @param {*} callback
   */
  Push.prototype.receive = function receive (status, callback){
    if(this.hasReceived(status)){
      callback(this.receivedResp.response);
    }

    this.recHooks.push({status: status, callback: callback});
    return this
  };

  /**
   * @private
   */
  Push.prototype.reset = function reset (){
    this.cancelRefEvent();
    this.ref        = null;
    this.refEvent   = null;
    this.receivedResp = null;
    this.sent       = false;
  };

  /**
   * @private
   */
  Push.prototype.matchReceive = function matchReceive (ref$1){
      var status = ref$1.status;
      var response = ref$1.response;
      var ref = ref$1.ref;

    this.recHooks.filter( function (h) { return h.status === status; } )
                 .forEach( function (h) { return h.callback(response); } );
  };

  /**
   * @private
   */
  Push.prototype.cancelRefEvent = function cancelRefEvent (){ if(!this.refEvent){ return }
    this.channel.off(this.refEvent);
  };

  /**
   * @private
   */
  Push.prototype.cancelTimeout = function cancelTimeout (){
    clearTimeout(this.timeoutTimer);
    this.timeoutTimer = null;
  };

  /**
   * @private
   */
  Push.prototype.startTimeout = function startTimeout (){
    var this$1 = this;
   if(this.timeoutTimer){ this.cancelTimeout(); }
    this.ref    = this.channel.socket.makeRef();
    this.refEvent = this.channel.replyEventName(this.ref);

    this.channel.on(this.refEvent, function (payload) {
      this$1.cancelRefEvent();
      this$1.cancelTimeout();
      this$1.receivedResp = payload;
      this$1.matchReceive(payload);
    });

    this.timeoutTimer = setTimeout(function () {
      this$1.trigger("timeout", {});
    }, this.timeout);
  };

  /**
   * @private
   */
  Push.prototype.hasReceived = function hasReceived (status){
    return this.receivedResp && this.receivedResp.status === status
  };

  /**
   * @private
   */
  Push.prototype.trigger = function trigger (status, response){
    this.channel.trigger(this.refEvent, {status: status, response: response});
  };

  /**
   *
   * @param {string} topic
   * @param {(Object|function)} params
   * @param {Socket} socket
   */
  var Channel = function Channel(topic, params, socket) {
    var this$1 = this;

    this.state     = CHANNEL_STATES.closed;
    this.topic     = topic;
    this.params    = closure(params || {});
    this.socket    = socket;
    this.bindings  = [];
    this.bindingRef= 0;
    this.timeout   = this.socket.timeout;
    this.joinedOnce= false;
    this.joinPush  = new Push(this, CHANNEL_EVENTS.join, this.params, this.timeout);
    this.pushBuffer= [];
    this.stateChangeRefs = [];

    this.rejoinTimer = new Timer(function () {
      if(this$1.socket.isConnected()){ this$1.rejoin(); }
    }, this.socket.rejoinAfterMs);
    this.stateChangeRefs.push(this.socket.onError(function () { return this$1.rejoinTimer.reset(); }));
    this.stateChangeRefs.push(this.socket.onOpen(function () {
        this$1.rejoinTimer.reset();
        if(this$1.isErrored()){ this$1.rejoin(); }
      })
    );
    this.joinPush.receive("ok", function () {
      this$1.state = CHANNEL_STATES.joined;
      this$1.rejoinTimer.reset();
      this$1.pushBuffer.forEach( function (pushEvent) { return pushEvent.send(); } );
      this$1.pushBuffer = [];
    });
    this.joinPush.receive("error", function () {
      this$1.state = CHANNEL_STATES.errored;
      if(this$1.socket.isConnected()){ this$1.rejoinTimer.scheduleTimeout(); }
    });
    this.onClose(function () {
      this$1.rejoinTimer.reset();
      if(this$1.socket.hasLogger()) { this$1.socket.log("channel", ("close " + (this$1.topic) + " " + (this$1.joinRef()))); }
      this$1.state = CHANNEL_STATES.closed;
      this$1.socket.remove(this$1);
    });
    this.onError(function (reason) {
      if(this$1.socket.hasLogger()) { this$1.socket.log("channel", ("error " + (this$1.topic)), reason); }
      if(this$1.isJoining()){ this$1.joinPush.reset(); }
      this$1.state = CHANNEL_STATES.errored;
      if(this$1.socket.isConnected()){ this$1.rejoinTimer.scheduleTimeout(); }
    });
    this.joinPush.receive("timeout", function () {
      if(this$1.socket.hasLogger()) { this$1.socket.log("channel", ("timeout " + (this$1.topic) + " (" + (this$1.joinRef()) + ")"), this$1.joinPush.timeout); }
      var leavePush = new Push(this$1, CHANNEL_EVENTS.leave, closure({}), this$1.timeout);
      leavePush.send();
      this$1.state = CHANNEL_STATES.errored;
      this$1.joinPush.reset();
      if(this$1.socket.isConnected()){ this$1.rejoinTimer.scheduleTimeout(); }
    });
    this.on(CHANNEL_EVENTS.reply, function (payload, ref) {
      this$1.trigger(this$1.replyEventName(ref), payload);
    });
  };

  /**
   * Join the channel
   * @param {integer} timeout
   * @returns {Push}
   */
  Channel.prototype.join = function join (timeout){
      if ( timeout === void 0 ) timeout = this.timeout;

    if(this.joinedOnce){
      throw new Error("tried to join multiple times. 'join' can only be called a single time per channel instance")
    } else {
      this.timeout = timeout;
      this.joinedOnce = true;
      this.rejoin();
      return this.joinPush
    }
  };

  /**
   * Hook into channel close
   * @param {Function} callback
   */
  Channel.prototype.onClose = function onClose (callback){
    this.on(CHANNEL_EVENTS.close, callback);
  };

  /**
   * Hook into channel errors
   * @param {Function} callback
   */
  Channel.prototype.onError = function onError (callback){
    return this.on(CHANNEL_EVENTS.error, function (reason) { return callback(reason); })
  };

  /**
   * Subscribes on channel events
   *
   * Subscription returns a ref counter, which can be used later to
   * unsubscribe the exact event listener
   *
   * @example
   * const ref1 = channel.on("event", do_stuff)
   * const ref2 = channel.on("event", do_other_stuff)
   * channel.off("event", ref1)
   * // Since unsubscription, do_stuff won't fire,
   * // while do_other_stuff will keep firing on the "event"
   *
   * @param {string} event
   * @param {Function} callback
   * @returns {integer} ref
   */
  Channel.prototype.on = function on (event, callback){
    var ref = this.bindingRef++;
    this.bindings.push({event: event, ref: ref, callback: callback});
    return ref
  };

  /**
   * Unsubscribes off of channel events
   *
   * Use the ref returned from a channel.on() to unsubscribe one
   * handler, or pass nothing for the ref to unsubscribe all
   * handlers for the given event.
   *
   * @example
   * // Unsubscribe the do_stuff handler
   * const ref1 = channel.on("event", do_stuff)
   * channel.off("event", ref1)
   *
   * // Unsubscribe all handlers from event
   * channel.off("event")
   *
   * @param {string} event
   * @param {integer} ref
   */
  Channel.prototype.off = function off (event, ref){
    this.bindings = this.bindings.filter(function (bind) {
      return !(bind.event === event && (typeof ref === "undefined" || ref === bind.ref))
    });
  };

  /**
   * @private
   */
  Channel.prototype.canPush = function canPush (){ return this.socket.isConnected() && this.isJoined() };

  /**
   * @param {string} event
   * @param {Object} payload
   * @param {number} [timeout]
   * @returns {Push}
   */
  Channel.prototype.push = function push (event, payload, timeout){
      if ( timeout === void 0 ) timeout = this.timeout;

    if(!this.joinedOnce){
      throw new Error(("tried to push '" + event + "' to '" + (this.topic) + "' before joining. Use channel.join() before pushing events"))
    }
    var pushEvent = new Push(this, event, function(){ return payload }, timeout);
    if(this.canPush()){
      pushEvent.send();
    } else {
      pushEvent.startTimeout();
      this.pushBuffer.push(pushEvent);
    }

    return pushEvent
  };

  /** Leaves the channel
   *
   * Unsubscribes from server events, and
   * instructs channel to terminate on server
   *
   * Triggers onClose() hooks
   *
   * To receive leave acknowledgements, use the a `receive`
   * hook to bind to the server ack, ie:
   *
   * @example
   * channel.leave().receive("ok", () => alert("left!") )
   *
   * @param {integer} timeout
   * @returns {Push}
   */
  Channel.prototype.leave = function leave (timeout){
      var this$1 = this;
      if ( timeout === void 0 ) timeout = this.timeout;

    this.rejoinTimer.reset();
    this.joinPush.cancelTimeout();

    this.state = CHANNEL_STATES.leaving;
    var onClose = function () {
      if(this$1.socket.hasLogger()) { this$1.socket.log("channel", ("leave " + (this$1.topic))); }
      this$1.trigger(CHANNEL_EVENTS.close, "leave");
    };
    var leavePush = new Push(this, CHANNEL_EVENTS.leave, closure({}), timeout);
    leavePush.receive("ok", function () { return onClose(); } )
             .receive("timeout", function () { return onClose(); } );
    leavePush.send();
    if(!this.canPush()){ leavePush.trigger("ok", {}); }

    return leavePush
  };

  /**
   * Overridable message hook
   *
   * Receives all events for specialized message handling
   * before dispatching to the channel callbacks.
   *
   * Must return the payload, modified or unmodified
   * @param {string} event
   * @param {Object} payload
   * @param {integer} ref
   * @returns {Object}
   */
  Channel.prototype.onMessage = function onMessage (event, payload, ref){ return payload };

  /**
   * @private
   */
  Channel.prototype.isLifecycleEvent = function isLifecycleEvent (event) { return CHANNEL_LIFECYCLE_EVENTS.indexOf(event) >= 0 };

  /**
   * @private
   */
  Channel.prototype.isMember = function isMember (topic, event, payload, joinRef){
    if(this.topic !== topic){ return false }

    if(joinRef && joinRef !== this.joinRef() && this.isLifecycleEvent(event)){
      if (this.socket.hasLogger()) { this.socket.log("channel", "dropping outdated message", {topic: topic, event: event, payload: payload, joinRef: joinRef}); }
      return false
    } else {
      return true
    }
  };

  /**
   * @private
   */
  Channel.prototype.joinRef = function joinRef (){ return this.joinPush.ref };

  /**
   * @private
   */
  Channel.prototype.sendJoin = function sendJoin (timeout){
    this.state = CHANNEL_STATES.joining;
    this.joinPush.resend(timeout);
  };

  /**
   * @private
   */
  Channel.prototype.rejoin = function rejoin (timeout){
    if ( timeout === void 0 ) timeout = this.timeout;
   if(this.isLeaving()){ return }
    this.sendJoin(timeout);
  };

  /**
   * @private
   */
  Channel.prototype.trigger = function trigger (event, payload, ref, joinRef){
    var handledPayload = this.onMessage(event, payload, ref, joinRef);
    if(payload && !handledPayload){ throw new Error("channel onMessage callbacks must return the payload, modified or unmodified") }

    for (var i = 0; i < this.bindings.length; i++) {
      var bind = this.bindings[i];
      if(bind.event !== event){ continue }
      bind.callback(handledPayload, ref, joinRef || this.joinRef());
    }
  };

  /**
   * @private
   */
  Channel.prototype.replyEventName = function replyEventName (ref){ return ("chan_reply_" + ref) };

  /**
   * @private
   */
  Channel.prototype.isClosed = function isClosed () { return this.state === CHANNEL_STATES.closed };

  /**
   * @private
   */
  Channel.prototype.isErrored = function isErrored (){ return this.state === CHANNEL_STATES.errored };

  /**
   * @private
   */
  Channel.prototype.isJoined = function isJoined () { return this.state === CHANNEL_STATES.joined };

  /**
   * @private
   */
  Channel.prototype.isJoining = function isJoining (){ return this.state === CHANNEL_STATES.joining };

  /**
   * @private
   */
  Channel.prototype.isLeaving = function isLeaving (){ return this.state === CHANNEL_STATES.leaving };

  /* The default serializer for encoding and decoding messages */
  var Serializer = {
    encode: function encode(msg, callback){
      var payload = [
        msg.join_ref, msg.ref, msg.topic, msg.event, msg.payload
      ];
      return callback(JSON.stringify(payload))
    },

    decode: function decode(rawPayload, callback){
      var ref$1 = JSON.parse(rawPayload);
      var join_ref = ref$1[0];
      var ref = ref$1[1];
      var topic = ref$1[2];
      var event = ref$1[3];
      var payload = ref$1[4];

      return callback({join_ref: join_ref, ref: ref, topic: topic, event: event, payload: payload})
    }
  };


  /** Initializes the Socket
   *
   *
   * For IE8 support use an ES5-shim (https://github.com/es-shims/es5-shim)
   *
   * @param {string} endPoint - The string WebSocket endpoint, ie, `"ws://example.com/socket"`,
   *                                               `"wss://example.com"`
   *                                               `"/socket"` (inherited host & protocol)
   * @param {Object} [opts] - Optional configuration
   * @param {string} [opts.transport] - The Websocket Transport, for example WebSocket or Phoenix.LongPoll.
   *
   * Defaults to WebSocket with automatic LongPoll fallback.
   * @param {Function} [opts.encode] - The function to encode outgoing messages.
   *
   * Defaults to JSON encoder.
   *
   * @param {Function} [opts.decode] - The function to decode incoming messages.
   *
   * Defaults to JSON:
   *
   * ```javascript
   * (payload, callback) => callback(JSON.parse(payload))
   * ```
   *
   * @param {number} [opts.timeout] - The default timeout in milliseconds to trigger push timeouts.
   *
   * Defaults `DEFAULT_TIMEOUT`
   * @param {number} [opts.heartbeatIntervalMs] - The millisec interval to send a heartbeat message
   * @param {number} [opts.reconnectAfterMs] - The optional function that returns the millsec
   * socket reconnect interval.
   *
   * Defaults to stepped backoff of:
   *
   * ```javascript
   * function(tries){
   *   return [10, 50, 100, 150, 200, 250, 500, 1000, 2000][tries - 1] || 5000
   * }
   * ````
   *
   * @param {number} [opts.rejoinAfterMs] - The optional function that returns the millsec
   * rejoin interval for individual channels.
   *
   * ```javascript
   * function(tries){
   *   return [1000, 2000, 5000][tries - 1] || 10000
   * }
   * ````
   *
   * @param {Function} [opts.logger] - The optional function for specialized logging, ie:
   *
   * ```javascript
   * function(kind, msg, data) {
   *   console.log(`${kind}: ${msg}`, data)
   * }
   * ```
   *
   * @param {number} [opts.longpollerTimeout] - The maximum timeout of a long poll AJAX request.
   *
   * Defaults to 20s (double the server long poll timer).
   *
   * @param {{Object|function)} [opts.params] - The optional params to pass when connecting
   * @param {string} [opts.binaryType] - The binary type to use for binary WebSocket frames.
   *
   * Defaults to "arraybuffer"
   *
   * @param {vsn} [opts.vsn] - The serializer's protocol version to send on connect.
   *
   * Defaults to DEFAULT_VSN.
  */
  var Socket = function Socket(endPoint, opts){
    var this$1 = this;
    if ( opts === void 0 ) opts = {};

    this.stateChangeCallbacks = {open: [], close: [], error: [], message: []};
    this.channels           = [];
    this.sendBuffer         = [];
    this.ref                = 0;
    this.timeout            = opts.timeout || DEFAULT_TIMEOUT;
    this.transport          = opts.transport || global.WebSocket || LongPoll;
    this.defaultEncoder     = Serializer.encode;
    this.defaultDecoder     = Serializer.decode;
    this.closeWasClean      = false;
    this.unloaded           = false;
    this.binaryType         = opts.binaryType || "arraybuffer";
    if(this.transport !== LongPoll){
      this.encode = opts.encode || this.defaultEncoder;
      this.decode = opts.decode || this.defaultDecoder;
    } else {
      this.encode = this.defaultEncoder;
      this.decode = this.defaultDecoder;
    }
    if(phxWindow && phxWindow.addEventListener){
      phxWindow.addEventListener("unload", function (e) {
        if(this$1.conn){
          this$1.unloaded = true;
          this$1.abnormalClose("unloaded");
        }
      });
    }
    this.heartbeatIntervalMs = opts.heartbeatIntervalMs || 30000;
    this.rejoinAfterMs = function (tries) {
      if(opts.rejoinAfterMs){
        return opts.rejoinAfterMs(tries)
      } else {
        return [1000, 2000, 5000][tries - 1] || 10000
      }
    };
    this.reconnectAfterMs = function (tries) {
      if(this$1.unloaded){ return 100 }
      if(opts.reconnectAfterMs){
        return opts.reconnectAfterMs(tries)
      } else {
        return [10, 50, 100, 150, 200, 250, 500, 1000, 2000][tries - 1] || 5000
      }
    };
    this.logger             = opts.logger || null;
    this.longpollerTimeout  = opts.longpollerTimeout || 20000;
    this.params             = closure(opts.params || {});
    this.endPoint           = endPoint + "/" + (TRANSPORTS.websocket);
    this.vsn                = opts.vsn || DEFAULT_VSN;
    this.heartbeatTimer     = null;
    this.pendingHeartbeatRef= null;
    this.reconnectTimer     = new Timer(function () {
      this$1.teardown(function () { return this$1.connect(); });
    }, this.reconnectAfterMs);
  };

  /**
   * Returns the socket protocol
   *
   * @returns {string}
   */
  Socket.prototype.protocol = function protocol (){ return location.protocol.match(/^https/) ? "wss" : "ws" };

  /**
   * The fully qualifed socket url
   *
   * @returns {string}
   */
  Socket.prototype.endPointURL = function endPointURL (){
    var uri = Ajax.appendParams(
      Ajax.appendParams(this.endPoint, this.params()), {vsn: this.vsn});
    if(uri.charAt(0) !== "/"){ return uri }
    if(uri.charAt(1) === "/"){ return ((this.protocol()) + ":" + uri) }

    return ((this.protocol()) + "://" + (location.host) + uri)
  };

  /**
   * Disconnects the socket
   *
   * See https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent#Status_codes for valid status codes.
   *
   * @param {Function} callback - Optional callback which is called after socket is disconnected.
   * @param {integer} code - A status code for disconnection (Optional).
   * @param {string} reason - A textual description of the reason to disconnect. (Optional)
   */
  Socket.prototype.disconnect = function disconnect (callback, code, reason){
    this.closeWasClean = true;
    this.reconnectTimer.reset();
    this.teardown(callback, code, reason);
  };

  /**
   *
   * @param {Object} params - The params to send when connecting, for example `{user_id: userToken}`
   *
   * Passing params to connect is deprecated; pass them in the Socket constructor instead:
   * `new Socket("/socket", {params: {user_id: userToken}})`.
   */
  Socket.prototype.connect = function connect (params){
      var this$1 = this;

    if(params){
      console && console.log("passing params to connect is deprecated. Instead pass :params to the Socket constructor");
      this.params = closure(params);
    }
    if(this.conn){ return }
    this.closeWasClean = false;
    this.conn = new this.transport(this.endPointURL());
    this.conn.binaryType = this.binaryType;
    this.conn.timeout  = this.longpollerTimeout;
    this.conn.onopen   = function () { return this$1.onConnOpen(); };
    this.conn.onerror  = function (error) { return this$1.onConnError(error); };
    this.conn.onmessage= function (event) { return this$1.onConnMessage(event); };
    this.conn.onclose  = function (event) { return this$1.onConnClose(event); };
  };

  /**
   * Logs the message. Override `this.logger` for specialized logging. noops by default
   * @param {string} kind
   * @param {string} msg
   * @param {Object} data
   */
  Socket.prototype.log = function log (kind, msg, data){ this.logger(kind, msg, data); };

  /**
   * Returns true if a logger has been set on this socket.
   */
  Socket.prototype.hasLogger = function hasLogger (){ return this.logger !== null };

  /**
   * Registers callbacks for connection open events
   *
   * @example socket.onOpen(function(){ console.info("the socket was opened") })
   *
   * @param {Function} callback
   */
  Socket.prototype.onOpen = function onOpen (callback){
    var ref = this.makeRef();
    this.stateChangeCallbacks.open.push([ref, callback]);
    return ref
  };

  /**
   * Registers callbacks for connection close events
   * @param {Function} callback
   */
  Socket.prototype.onClose = function onClose (callback){
    var ref = this.makeRef();
    this.stateChangeCallbacks.close.push([ref, callback]);
    return ref
  };

  /**
   * Registers callbacks for connection error events
   *
   * @example socket.onError(function(error){ alert("An error occurred") })
   *
   * @param {Function} callback
   */
  Socket.prototype.onError = function onError (callback){
    var ref = this.makeRef();
    this.stateChangeCallbacks.error.push([ref, callback]);
    return ref
  };

  /**
   * Registers callbacks for connection message events
   * @param {Function} callback
   */
  Socket.prototype.onMessage = function onMessage (callback){
    var ref = this.makeRef();
    this.stateChangeCallbacks.message.push([ref, callback]);
    return ref
  };

  /**
   * @private
   */
  Socket.prototype.onConnOpen = function onConnOpen (){
    if (this.hasLogger()) { this.log("transport", ("connected to " + (this.endPointURL()))); }
    this.unloaded = false;
    this.closeWasClean = false;
    this.flushSendBuffer();
    this.reconnectTimer.reset();
    this.resetHeartbeat();
    this.stateChangeCallbacks.open.forEach(function (ref) {
        var callback = ref[1];

        return callback();
      } );
  };

  /**
   * @private
   */

  Socket.prototype.resetHeartbeat = function resetHeartbeat (){
    var this$1 = this;
   if(this.conn && this.conn.skipHeartbeat){ return }
    this.pendingHeartbeatRef = null;
    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(function () { return this$1.sendHeartbeat(); }, this.heartbeatIntervalMs);
  };

  Socket.prototype.teardown = function teardown (callback, code, reason){
    if(this.conn){
      this.conn.onclose = function(){}; // noop
      if(code){ this.conn.close(code, reason || ""); } else { this.conn.close(); }
      this.conn = null;
    }
    callback && callback();
  };

  Socket.prototype.onConnClose = function onConnClose (event){
    if (this.hasLogger()) { this.log("transport", "close", event); }
    this.triggerChanError();
    clearInterval(this.heartbeatTimer);
    if(!this.closeWasClean){
      this.reconnectTimer.scheduleTimeout();
    }
    this.stateChangeCallbacks.close.forEach(function (ref) {
        var callback = ref[1];

        return callback(event);
      } );
  };

  /**
   * @private
   */
  Socket.prototype.onConnError = function onConnError (error){
    if (this.hasLogger()) { this.log("transport", error); }
    this.triggerChanError();
    this.stateChangeCallbacks.error.forEach(function (ref) {
        var callback = ref[1];

        return callback(error);
      } );
  };

  /**
   * @private
   */
  Socket.prototype.triggerChanError = function triggerChanError (){
    this.channels.forEach( function (channel) {
      if(!(channel.isErrored() || channel.isLeaving() || channel.isClosed())){
        channel.trigger(CHANNEL_EVENTS.error);
      }
    });
  };

  /**
   * @returns {string}
   */
  Socket.prototype.connectionState = function connectionState (){
    switch(this.conn && this.conn.readyState){
      case SOCKET_STATES.connecting: return "connecting"
      case SOCKET_STATES.open:     return "open"
      case SOCKET_STATES.closing:  return "closing"
      default:                     return "closed"
    }
  };

  /**
   * @returns {boolean}
   */
  Socket.prototype.isConnected = function isConnected (){ return this.connectionState() === "open" };

  /**
   * @private
   *
   * @param {Channel}
   */
  Socket.prototype.remove = function remove (channel){
    this.off(channel.stateChangeRefs);
    this.channels = this.channels.filter(function (c) { return c.joinRef() !== channel.joinRef(); });
  };

  /**
   * Removes `onOpen`, `onClose`, `onError,` and `onMessage` registrations.
   *
   * @param {refs} - list of refs returned by calls to
   *               `onOpen`, `onClose`, `onError,` and `onMessage`
   */
  Socket.prototype.off = function off (refs) {
    for(var key in this.stateChangeCallbacks){
      this.stateChangeCallbacks[key] = this.stateChangeCallbacks[key].filter(function (ref$1) {
          var ref = ref$1[0];

        return !refs.includes(ref)
      });
    }
  };

  /**
   * Initiates a new channel for the given topic
   *
   * @param {string} topic
   * @param {Object} chanParams - Parameters for the channel
   * @returns {Channel}
   */
  Socket.prototype.channel = function channel (topic, chanParams){
      if ( chanParams === void 0 ) chanParams = {};

    var chan = new Channel(topic, chanParams, this);
    this.channels.push(chan);
    return chan
  };

  /**
   * @param {Object} data
   */
  Socket.prototype.push = function push (data){
      var this$1 = this;

    if (this.hasLogger()) {
      var topic = data.topic;
        var event = data.event;
        var payload = data.payload;
        var ref = data.ref;
        var join_ref = data.join_ref;
      this.log("push", (topic + " " + event + " (" + join_ref + ", " + ref + ")"), payload);
    }

    if(this.isConnected()){
      this.encode(data, function (result) { return this$1.conn.send(result); });
    } else {
      this.sendBuffer.push(function () { return this$1.encode(data, function (result) { return this$1.conn.send(result); }); });
    }
  };

  /**
   * Return the next message ref, accounting for overflows
   * @returns {string}
   */
  Socket.prototype.makeRef = function makeRef (){
    var newRef = this.ref + 1;
    if(newRef === this.ref){ this.ref = 0; } else { this.ref = newRef; }

    return this.ref.toString()
  };

  Socket.prototype.sendHeartbeat = function sendHeartbeat (){ if(!this.isConnected()){ return }
    if(this.pendingHeartbeatRef){
      this.pendingHeartbeatRef = null;
      if (this.hasLogger()) { this.log("transport", "heartbeat timeout. Attempting to re-establish connection"); }
      this.abnormalClose("heartbeat timeout");
      return
    }
    this.pendingHeartbeatRef = this.makeRef();
    this.push({topic: "phoenix", event: "heartbeat", payload: {}, ref: this.pendingHeartbeatRef});
  };

  Socket.prototype.abnormalClose = function abnormalClose (reason){
    this.closeWasClean = false;
    this.conn.close(WS_CLOSE_NORMAL, reason);
  };

  Socket.prototype.flushSendBuffer = function flushSendBuffer (){
    if(this.isConnected() && this.sendBuffer.length > 0){
      this.sendBuffer.forEach( function (callback) { return callback(); } );
      this.sendBuffer = [];
    }
  };

  Socket.prototype.onConnMessage = function onConnMessage (rawMessage){
      var this$1 = this;

    this.decode(rawMessage.data, function (msg) {
      var topic = msg.topic;
        var event = msg.event;
        var payload = msg.payload;
        var ref = msg.ref;
        var join_ref = msg.join_ref;
      if(ref && ref === this$1.pendingHeartbeatRef){ this$1.pendingHeartbeatRef = null; }

      if (this$1.hasLogger()) { this$1.log("receive", ((payload.status || "") + " " + topic + " " + event + " " + (ref && "(" + ref + ")" || "")), payload); }

      for (var i = 0; i < this$1.channels.length; i++) {
        var channel = this$1.channels[i];
        if(!channel.isMember(topic, event, payload, join_ref)){ continue }
        channel.trigger(event, payload, ref, join_ref);
      }

      for (var i$1 = 0; i$1 < this$1.stateChangeCallbacks.message.length; i$1++) {
        var ref$1 = this$1.stateChangeCallbacks.message[i$1];
          var callback = ref$1[1];
        callback(msg);
      }
    });
  };


  var LongPoll = function LongPoll(endPoint){
    this.endPoint      = null;
    this.token         = null;
    this.skipHeartbeat = true;
    this.onopen        = function(){}; // noop
    this.onerror       = function(){}; // noop
    this.onmessage     = function(){}; // noop
    this.onclose       = function(){}; // noop
    this.pollEndpoint  = this.normalizeEndpoint(endPoint);
    this.readyState    = SOCKET_STATES.connecting;

    this.poll();
  };

  LongPoll.prototype.normalizeEndpoint = function normalizeEndpoint (endPoint){
    return(endPoint
      .replace("ws://", "http://")
      .replace("wss://", "https://")
      .replace(new RegExp("(.*)\/" + TRANSPORTS.websocket), "$1/" + TRANSPORTS.longpoll))
  };

  LongPoll.prototype.endpointURL = function endpointURL (){
    return Ajax.appendParams(this.pollEndpoint, {token: this.token})
  };

  LongPoll.prototype.closeAndRetry = function closeAndRetry (){
    this.close();
    this.readyState = SOCKET_STATES.connecting;
  };

  LongPoll.prototype.ontimeout = function ontimeout (){
    this.onerror("timeout");
    this.closeAndRetry();
  };

  LongPoll.prototype.poll = function poll (){
      var this$1 = this;

    if(!(this.readyState === SOCKET_STATES.open || this.readyState === SOCKET_STATES.connecting)){ return }

    Ajax.request("GET", this.endpointURL(), "application/json", null, this.timeout, this.ontimeout.bind(this), function (resp) {
      if(resp){
        var status = resp.status;
          var token = resp.token;
          var messages = resp.messages;
        this$1.token = token;
      } else {
        var status = 0;
      }

      switch(status){
        case 200:
          messages.forEach(function (msg) { return this$1.onmessage({data: msg}); });
          this$1.poll();
          break
        case 204:
          this$1.poll();
          break
        case 410:
          this$1.readyState = SOCKET_STATES.open;
          this$1.onopen();
          this$1.poll();
          break
        case 0:
        case 500:
          this$1.onerror();
          this$1.closeAndRetry();
          break
        default: throw new Error(("unhandled poll status " + status))
      }
    });
  };

  LongPoll.prototype.send = function send (body){
      var this$1 = this;

    Ajax.request("POST", this.endpointURL(), "application/json", body, this.timeout, this.onerror.bind(this, "timeout"), function (resp) {
      if(!resp || resp.status !== 200){
        this$1.onerror(resp && resp.status);
        this$1.closeAndRetry();
      }
    });
  };

  LongPoll.prototype.close = function close (code, reason){
    this.readyState = SOCKET_STATES.closed;
    this.onclose();
  };

  var Ajax = function Ajax () {};

  Ajax.request = function request (method, endPoint, accept, body, timeout, ontimeout, callback){
    if(global.XDomainRequest){
      var req = new XDomainRequest(); // IE8, IE9
      this.xdomainRequest(req, method, endPoint, body, timeout, ontimeout, callback);
    } else {
      var req$1 = global.XMLHttpRequest ?
                  new global.XMLHttpRequest() : // IE7+, Firefox, Chrome, Opera, Safari
                  new ActiveXObject("Microsoft.XMLHTTP"); // IE6, IE5
      this.xhrRequest(req$1, method, endPoint, accept, body, timeout, ontimeout, callback);
    }
  };

  Ajax.xdomainRequest = function xdomainRequest (req, method, endPoint, body, timeout, ontimeout, callback){
      var this$1 = this;

    req.timeout = timeout;
    req.open(method, endPoint);
    req.onload = function () {
      var response = this$1.parseJSON(req.responseText);
      callback && callback(response);
    };
    if(ontimeout){ req.ontimeout = ontimeout; }

    // Work around bug in IE9 that requires an attached onprogress handler
    req.onprogress = function () {};

    req.send(body);
  };

  Ajax.xhrRequest = function xhrRequest (req, method, endPoint, accept, body, timeout, ontimeout, callback){
      var this$1 = this;

    req.open(method, endPoint, true);
    req.timeout = timeout;
    req.setRequestHeader("Content-Type", accept);
    req.onerror = function () { callback && callback(null); };
    req.onreadystatechange = function () {
      if(req.readyState === this$1.states.complete && callback){
        var response = this$1.parseJSON(req.responseText);
        callback(response);
      }
    };
    if(ontimeout){ req.ontimeout = ontimeout; }

    req.send(body);
  };

  Ajax.parseJSON = function parseJSON (resp){
    if(!resp || resp === ""){ return null }

    try {
      return JSON.parse(resp)
    } catch(e) {
      console && console.log("failed to parse JSON response", resp);
      return null
    }
  };

  Ajax.serialize = function serialize (obj, parentKey){
    var queryStr = [];
    for(var key in obj){ if(!obj.hasOwnProperty(key)){ continue }
      var paramKey = parentKey ? (parentKey + "[" + key + "]") : key;
      var paramVal = obj[key];
      if(typeof paramVal === "object"){
        queryStr.push(this.serialize(paramVal, paramKey));
      } else {
        queryStr.push(encodeURIComponent(paramKey) + "=" + encodeURIComponent(paramVal));
      }
    }
    return queryStr.join("&")
  };

  Ajax.appendParams = function appendParams (url, params){
    if(Object.keys(params).length === 0){ return url }

    var prefix = url.match(/\?/) ? "&" : "?";
    return ("" + url + prefix + (this.serialize(params)))
  };

  Ajax.states = {complete: 4};

  /**
   * Initializes the Presence
   * @param {Channel} channel - The Channel
   * @param {Object} opts - The options,
   *        for example `{events: {state: "state", diff: "diff"}}`
   */
  var Presence = function Presence(channel, opts){
    var this$1 = this;
    if ( opts === void 0 ) opts = {};

    var events = opts.events || {state: "presence_state", diff: "presence_diff"};
    this.state = {};
    this.pendingDiffs = [];
    this.channel = channel;
    this.joinRef = null;
    this.caller = {
      onJoin: function(){},
      onLeave: function(){},
      onSync: function(){}
    };

    this.channel.on(events.state, function (newState) {
      var ref = this$1.caller;
      var onJoin = ref.onJoin;
      var onLeave = ref.onLeave;
      var onSync = ref.onSync;

      this$1.joinRef = this$1.channel.joinRef();
      this$1.state = Presence.syncState(this$1.state, newState, onJoin, onLeave);

      this$1.pendingDiffs.forEach(function (diff) {
        this$1.state = Presence.syncDiff(this$1.state, diff, onJoin, onLeave);
      });
      this$1.pendingDiffs = [];
      onSync();
    });

    this.channel.on(events.diff, function (diff) {
      var ref = this$1.caller;
      var onJoin = ref.onJoin;
      var onLeave = ref.onLeave;
      var onSync = ref.onSync;

      if(this$1.inPendingSyncState()){
        this$1.pendingDiffs.push(diff);
      } else {
        this$1.state = Presence.syncDiff(this$1.state, diff, onJoin, onLeave);
        onSync();
      }
    });
  };

  Presence.prototype.onJoin = function onJoin (callback){ this.caller.onJoin = callback; };

  Presence.prototype.onLeave = function onLeave (callback){ this.caller.onLeave = callback; };

  Presence.prototype.onSync = function onSync (callback){ this.caller.onSync = callback; };

  Presence.prototype.list = function list (by){ return Presence.list(this.state, by) };

  Presence.prototype.inPendingSyncState = function inPendingSyncState (){
    return !this.joinRef || (this.joinRef !== this.channel.joinRef())
  };

  // lower-level public static API

  /**
   * Used to sync the list of presences on the server
   * with the client's state. An optional `onJoin` and `onLeave` callback can
   * be provided to react to changes in the client's local presences across
   * disconnects and reconnects with the server.
   *
   * @returns {Presence}
   */
  Presence.syncState = function syncState (currentState, newState, onJoin, onLeave){
      var this$1 = this;

    var state = this.clone(currentState);
    var joins = {};
    var leaves = {};

    this.map(state, function (key, presence) {
      if(!newState[key]){
        leaves[key] = presence;
      }
    });
    this.map(newState, function (key, newPresence) {
      var currentPresence = state[key];
      if(currentPresence){
        var newRefs = newPresence.metas.map(function (m) { return m.phx_ref; });
        var curRefs = currentPresence.metas.map(function (m) { return m.phx_ref; });
        var joinedMetas = newPresence.metas.filter(function (m) { return curRefs.indexOf(m.phx_ref) < 0; });
        var leftMetas = currentPresence.metas.filter(function (m) { return newRefs.indexOf(m.phx_ref) < 0; });
        if(joinedMetas.length > 0){
          joins[key] = newPresence;
          joins[key].metas = joinedMetas;
        }
        if(leftMetas.length > 0){
          leaves[key] = this$1.clone(currentPresence);
          leaves[key].metas = leftMetas;
        }
      } else {
        joins[key] = newPresence;
      }
    });
    return this.syncDiff(state, {joins: joins, leaves: leaves}, onJoin, onLeave)
  };

  /**
   *
   * Used to sync a diff of presence join and leave
   * events from the server, as they happen. Like `syncState`, `syncDiff`
   * accepts optional `onJoin` and `onLeave` callbacks to react to a user
   * joining or leaving from a device.
   *
   * @returns {Presence}
   */
  Presence.syncDiff = function syncDiff (currentState, ref, onJoin, onLeave){
      var joins = ref.joins;
      var leaves = ref.leaves;

    var state = this.clone(currentState);
    if(!onJoin){ onJoin = function(){}; }
    if(!onLeave){ onLeave = function(){}; }

    this.map(joins, function (key, newPresence) {
        var ref;

      var currentPresence = state[key];
      state[key] = newPresence;
      if(currentPresence){
        var joinedRefs = state[key].metas.map(function (m) { return m.phx_ref; });
        var curMetas = currentPresence.metas.filter(function (m) { return joinedRefs.indexOf(m.phx_ref) < 0; })
        (ref = state[key].metas).unshift.apply(ref, curMetas);
      }
      onJoin(key, currentPresence, newPresence);
    });
    this.map(leaves, function (key, leftPresence) {
      var currentPresence = state[key];
      if(!currentPresence){ return }
      var refsToRemove = leftPresence.metas.map(function (m) { return m.phx_ref; });
      currentPresence.metas = currentPresence.metas.filter(function (p) {
        return refsToRemove.indexOf(p.phx_ref) < 0
      });
      onLeave(key, currentPresence, leftPresence);
      if(currentPresence.metas.length === 0){
        delete state[key];
      }
    });
    return state
  };

  /**
   * Returns the array of presences, with selected metadata.
   *
   * @param {Object} presences
   * @param {Function} chooser
   *
   * @returns {Presence}
   */
  Presence.list = function list (presences, chooser){
    if(!chooser){ chooser = function(key, pres){ return pres }; }

    return this.map(presences, function (key, presence) {
      return chooser(key, presence)
    })
  };

  // private

  Presence.map = function map (obj, func){
    return Object.getOwnPropertyNames(obj).map(function (key) { return func(key, obj[key]); })
  };

  Presence.clone = function clone (obj){ return JSON.parse(JSON.stringify(obj)) };


  /**
   *
   * Creates a timer that accepts a `timerCalc` function to perform
   * calculated timeout retries, such as exponential backoff.
   *
   * @example
   * let reconnectTimer = new Timer(() => this.connect(), function(tries){
   *   return [1000, 5000, 10000][tries - 1] || 10000
   * })
   * reconnectTimer.scheduleTimeout() // fires after 1000
   * reconnectTimer.scheduleTimeout() // fires after 5000
   * reconnectTimer.reset()
   * reconnectTimer.scheduleTimeout() // fires after 1000
   *
   * @param {Function} callback
   * @param {Function} timerCalc
   */
  var Timer = function Timer(callback, timerCalc){
    this.callback= callback;
    this.timerCalc = timerCalc;
    this.timer   = null;
    this.tries   = 0;
  };

  Timer.prototype.reset = function reset (){
    this.tries = 0;
    clearTimeout(this.timer);
  };

  /**
   * Cancels any previous scheduleTimeout and schedules callback
   */
  Timer.prototype.scheduleTimeout = function scheduleTimeout (){
      var this$1 = this;

    clearTimeout(this.timer);

    this.timer = setTimeout(function () {
      this$1.tries = this$1.tries + 1;
      this$1.callback();
    }, this.timerCalc(this.tries + 1));
  };

  function closure$1 (value) {
    if(typeof value === 'function'){
      return value
    } else {
      var closure = function(){ return value };
      return closure
    }
  }

  var storage;

  // @todo use sessionStorage in production
  if (window.localStorage) {
    storage = window.localStorage;
  } else {
    storage = {
      getItem: function getItem() { return null }, 
      setItem: function setItem() {} 
    };
  }

  function msgIDStorageKey(channel) {
    return  ("jsp_msgid__" + channel)
  }

  function getLastMsgID(channelName) {
    var key = msgIDStorageKey(channelName);
    var value = storage.getItem(key);
    console.log("value", value);
    var data = (null === value) ? null : JSON.parse(value);
    console.log('getLastMsgID %s =>',channelName, data);
    return data
  }

  function setLastMsgID(channelName, id) {
    console.log('setLastMsgID',channelName, id);
    var key = msgIDStorageKey(channelName);
    storage.setItem(key, JSON.stringify(id));
  }

  function connect(params) {
    var user_id = params.user_id;
    var socket = new Socket('ws://localhost:4000/socket', { params: params });
    socket.connect();
    var makeChannel = socket.channel.bind(socket);
    socket.channel = function(channelName, params) {
      
      params = closure$1(params || {});
      
      var paramsWithTimestamp = function() {
        var id = getLastMsgID(channelName); // maybe null
        return Object.assign({}, {last_message_id: id}, params())
      };

      var channel =  makeChannel(("jwp:" + user_id + ":" + channelName), paramsWithTimestamp);
      
      channel.onMessage = function(_event, payload, _ref) {
        if (payload && payload.tid) {
          setLastMsgID(channelName, payload.tid);
          return payload.data
        }
        return payload
      };
      
      return channel
    };
    
    return socket
  }

  var main = { connect: connect };

  return main;

})));

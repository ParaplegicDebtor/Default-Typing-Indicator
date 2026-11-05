(function () {
  "use strict";
  var plugin = vendetta.plugin;
  var storage = plugin.storage;
  var logger = vendetta.logger;
  var patcher = vendetta.patcher;
  var metro = vendetta.metro;
  var RN = metro.common.ReactNative;
  var React = metro.common.React;
  var useProxy = vendetta.storage.useProxy;

  var Flux = metro.common.FluxDispatcher || metro.findByProps("dispatch", "subscribe");
  var UserStore = metro.findByStoreName("UserStore");

  // Top-level keys on a TYPING_START event that look like custom-indicator
  // data (emoji / animation / status word). Real fields (channelId, userId,
  // guildId, timestamp, member) don't match.
  var CUSTOM_KEY = /emoji|status|verb|word|phrase|anim|custom|label|text|flair|style|indicator/i;

  var unpatch, loggedOnce = false;

  function toast(msg) {
    try { vendetta.ui.toasts.showToast(msg); } catch (e) {}
  }

  function Settings() {
    useProxy(storage);
    var h = React.createElement, V = RN.View, T = RN.Text, S = RN.Switch, P = RN.Pressable;
    function radio(label, sub, value) {
      var on = storage.mode === value;
      return h(P, { onPress: function () { storage.mode = value; }, style: { padding: 16, flexDirection: "row", alignItems: "center" } },
        h(T, { style: { fontSize: 20, marginRight: 12, color: "#888" } }, on ? "◉" : "○"),
        h(V, { style: { flex: 1 } },
          h(T, { style: { fontSize: 16, color: "#fff" } }, label),
          h(T, { style: { fontSize: 13, color: "#aaa" } }, sub)));
    }
    return h(V, null,
      radio("Default \"is typing...\" only", "Strips custom emoji, animation and status words", "default"),
      radio("Hide other people's typing", "Always works, but you won't see anyone typing", "hide"),
      h(V, { style: { padding: 16, flexDirection: "row", alignItems: "center" } },
        h(V, { style: { flex: 1 } },
          h(T, { style: { fontSize: 16, color: "#fff" } }, "Debug: show next typing event's fields"),
          h(T, { style: { fontSize: 13, color: "#aaa" } }, "If custom indicators still appear in Default mode, enable this, have someone type, and note the field names.")),
        h(S, { value: !!storage.debug, onValueChange: function (v) { storage.debug = v; } })));
  }

  return {
    default: {
      onLoad: function () {
        if (storage.mode == null) storage.mode = "default";
        if (storage.debug == null) storage.debug = false;

        unpatch = patcher.before("dispatch", Flux, function (args) {
          var p = args[0];
          if (!p || p.type !== "TYPING_START") return;

          if (storage.debug && !loggedOnce) {
            loggedOnce = true;
            try {
              var keys = Object.keys(p).join(", ");
              logger.log("TYPING_START keys: " + keys + " | " + JSON.stringify(p));
              toast("Typing event fields: " + keys);
            } catch (e) {}
          }

          if (storage.mode === "hide") {
            var me = UserStore && UserStore.getCurrentUser && UserStore.getCurrentUser();
            if (!me || p.userId !== me.id) args[0] = { type: "DEFAULT_TYPING_BLOCKED" };
            return args;
          }

          Object.keys(p).forEach(function (k) {
            if (k !== "type" && CUSTOM_KEY.test(k)) delete p[k];
          });
          return args;
        });
      },
      onUnload: function () {
        if (unpatch) unpatch();
        unpatch = undefined;
        loggedOnce = false;
      },
      settings: Settings
    }
  };
})()

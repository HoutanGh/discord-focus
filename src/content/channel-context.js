(function attachChannelContext(root) {
  "use strict";

  const namespace = root.DiscordFocus || {};

  const CHANNEL_KEY_PREFIX = "dfc_";
  const CHANNEL_KEY_PATTERN = /^dfc_[a-f0-9]{64}$/;
  const INSTALLATION_SALT_PATTERN = /^[a-f0-9]{64}$/;
  const SERVER_CHANNEL_PATH_PATTERN = /^\/channels\/[0-9]+\/([0-9]+)\/?$/;

  function bytesToHex(bytes) {
    return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
  }

  function channelSegmentFromPath(pathname) {
    if (typeof pathname !== "string") {
      return null;
    }

    const match = SERVER_CHANNEL_PATH_PATTERN.exec(pathname);
    return match ? match[1] : null;
  }

  function isSupportedServerChannelPath(pathname) {
    return channelSegmentFromPath(pathname) !== null;
  }

  function isOpaqueChannelKey(value) {
    return typeof value === "string" && CHANNEL_KEY_PATTERN.test(value);
  }

  function isValidInstallationSalt(value) {
    return typeof value === "string" && INSTALLATION_SALT_PATTERN.test(value);
  }

  function canDeriveOpaqueChannelKey(cryptoRef = root.crypto) {
    return Boolean(
      cryptoRef
      && typeof cryptoRef.getRandomValues === "function"
      && cryptoRef.subtle
      && typeof cryptoRef.subtle.digest === "function"
      && typeof root.TextEncoder === "function"
    );
  }

  function createInstallationSalt(cryptoRef = root.crypto) {
    if (!cryptoRef || typeof cryptoRef.getRandomValues !== "function") {
      throw new Error("Local channel key generation is unavailable.");
    }

    return bytesToHex(cryptoRef.getRandomValues(new Uint8Array(32)));
  }

  async function deriveOpaqueChannelKey(pathname, installationSalt, cryptoRef = root.crypto) {
    const channelSegment = channelSegmentFromPath(pathname);
    if (!channelSegment) {
      return null;
    }
    if (!isValidInstallationSalt(installationSalt)) {
      throw new Error("Local channel key material is invalid.");
    }
    if (!cryptoRef || !cryptoRef.subtle || typeof cryptoRef.subtle.digest !== "function") {
      throw new Error("Local channel key derivation is unavailable.");
    }

    const encoder = new root.TextEncoder();
    const input = encoder.encode(`discord-focus-channel\0${installationSalt}\0${channelSegment}`);
    const digest = await cryptoRef.subtle.digest("SHA-256", input);
    return `${CHANNEL_KEY_PREFIX}${bytesToHex(new Uint8Array(digest))}`;
  }

  const exported = {
    CHANNEL_KEY_PATTERN,
    INSTALLATION_SALT_PATTERN,
    canDeriveOpaqueChannelKey,
    createInstallationSalt,
    deriveOpaqueChannelKey,
    isOpaqueChannelKey,
    isSupportedServerChannelPath,
    isValidInstallationSalt
  };

  namespace.channelContext = exported;
  root.DiscordFocus = namespace;

  if (typeof module === "object" && module.exports) {
    module.exports = exported;
  }
})(typeof globalThis !== "undefined" ? globalThis : self);

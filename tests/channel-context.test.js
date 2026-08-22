const assert = require("node:assert/strict");
const { webcrypto } = require("node:crypto");
const test = require("node:test");
const channelContext = require("../src/content/channel-context.js");

test("recognizes only exact numeric server-channel routes", async () => {
  const salt = "a".repeat(64);

  assert.equal(channelContext.isSupportedServerChannelPath("/channels/123/456"), true);
  assert.equal(channelContext.isSupportedServerChannelPath("/channels/123/456/"), true);
  assert.equal(channelContext.isSupportedServerChannelPath("/channels/@me/456"), false);
  assert.equal(channelContext.isSupportedServerChannelPath("/channels/123"), false);
  assert.equal(channelContext.isSupportedServerChannelPath("/channels/123/456/789"), false);
  assert.equal(channelContext.isSupportedServerChannelPath("/login"), false);
  assert.equal(
    await channelContext.deriveOpaqueChannelKey("/channels/@me/456", salt, webcrypto),
    null
  );
});

test("derives a deterministic opaque key from only the channel segment", async () => {
  const pathname = "/channels/111111111111111111/999999999999999999";
  const salt = "b".repeat(64);
  const key = await channelContext.deriveOpaqueChannelKey(pathname, salt, webcrypto);
  const sameChannelElsewhere = await channelContext.deriveOpaqueChannelKey(
    "/channels/222222222222222222/999999999999999999",
    salt,
    webcrypto
  );

  assert.match(key, channelContext.CHANNEL_KEY_PATTERN);
  assert.equal(key, sameChannelElsewhere);
  assert.equal(key.includes("999999999999999999"), false);
  assert.equal(key.includes(pathname), false);
});

test("uses installation-specific salt when deriving channel keys", async () => {
  const pathname = "/channels/111/999";
  const first = await channelContext.deriveOpaqueChannelKey(
    pathname,
    "c".repeat(64),
    webcrypto
  );
  const second = await channelContext.deriveOpaqueChannelKey(
    pathname,
    "d".repeat(64),
    webcrypto
  );

  assert.notEqual(first, second);
});

test("creates valid random installation salts locally", () => {
  const first = channelContext.createInstallationSalt(webcrypto);
  const second = channelContext.createInstallationSalt(webcrypto);

  assert.match(first, channelContext.INSTALLATION_SALT_PATTERN);
  assert.match(second, channelContext.INSTALLATION_SALT_PATTERN);
  assert.notEqual(first, second);
  assert.equal(channelContext.canDeriveOpaqueChannelKey(webcrypto), true);
  assert.equal(channelContext.canDeriveOpaqueChannelKey({}), false);
});

const { JSDOM } = require("jsdom");

function discordFixture({ includeServerRail = true, includeSidebar = true, includeMemberPanel = true } = {}) {
  return new JSDOM(`
    <!doctype html>
    <html>
      <body>
        <div id="app-mount">
          ${includeServerRail ? '<nav class="guilds_a"><ul data-list-id="guildsnav"></ul></nav>' : ""}
          <div class="base_a">
            ${includeSidebar ? `
              <aside class="sidebar_a">
                <div class="sidebarList_a">
                  <section class="panels_a"></section>
                </div>
              </aside>
            ` : ""}
            <main class="chat_a">
              <header class="container_a">
                <div class="toolbar_a"></div>
              </header>
              <section class="chatContent_a">
                <ol data-list-id="chat-messages"></ol>
                <form class="channelTextArea_a">
                  <div role="textbox" contenteditable="true" data-slate-editor="true"></div>
                </form>
              </section>
              ${includeMemberPanel ? '<aside class="membersWrap_a"></aside>' : ""}
            </main>
            <div role="dialog" class="layer_a"></div>
          </div>
        </div>
      </body>
    </html>
  `, {
    url: "https://discord.com/channels/1/2"
  });
}

function unsupportedFixture() {
  return new JSDOM(`
    <!doctype html>
    <html>
      <body>
        <div id="app-mount">
          <main class="friends_a">
            <header></header>
          </main>
        </div>
      </body>
    </html>
  `, {
    url: "https://discord.com/channels/@me"
  });
}

function createMemoryApi(initialSettings = { version: 1, focusEnabled: true }) {
  const listeners = [];
  const store = {
    discordFocusSettings: initialSettings
  };
  const api = {
    storage: {
      local: {
        async get(key) {
          return {
            [key]: store[key]
          };
        },
        async set(items) {
          const changes = {};
          Object.entries(items).forEach(([key, value]) => {
            changes[key] = {
              oldValue: store[key],
              newValue: value
            };
            store[key] = value;
          });
          listeners.forEach((listener) => listener(changes, "local"));
        }
      },
      onChanged: {
        addListener(listener) {
          listeners.push(listener);
        }
      }
    },
    runtime: {
      messageListener: null,
      onMessage: {
        addListener(listener) {
          api.runtime.messageListener = listener;
        }
      }
    },
    tabs: {
      async query() {
        return [{ id: 1 }];
      },
      async sendMessage(_tabId, message) {
        return api.runtime.messageListener(message);
      }
    }
  };

  return api;
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

module.exports = {
  createMemoryApi,
  discordFixture,
  unsupportedFixture,
  wait
};

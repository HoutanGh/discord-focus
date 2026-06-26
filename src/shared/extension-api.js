(function attachExtensionApi(root) {
  "use strict";

  const namespace = root.DiscordFocus || {};

  function runtimeLastError(rawApi) {
    return rawApi && rawApi.runtime && rawApi.runtime.lastError
      ? new Error(rawApi.runtime.lastError.message)
      : null;
  }

  function callbackCall(rawApi, target, method, args) {
    return new Promise((resolve, reject) => {
      target[method](...args, (result) => {
        const error = runtimeLastError(rawApi);
        if (error) {
          reject(error);
          return;
        }
        resolve(result);
      });
    });
  }

  function apiCall(rawApi, target, method, args) {
    if (!rawApi) {
      return Promise.reject(new Error("Extension API is unavailable."));
    }

    if (rawApi === root.chrome && !root.browser) {
      return callbackCall(rawApi, target, method, args);
    }

    const result = target[method](...args);
    return result && typeof result.then === "function" ? result : Promise.resolve(result);
  }

  function createApi(rawApi) {
    return {
      storage: {
        local: {
          get(keys) {
            return apiCall(rawApi, rawApi.storage.local, "get", [keys]);
          },
          set(items) {
            return apiCall(rawApi, rawApi.storage.local, "set", [items]);
          }
        },
        onChanged: {
          addListener(listener) {
            rawApi.storage.onChanged.addListener(listener);
          }
        }
      },
      runtime: {
        sendMessage(message) {
          return apiCall(rawApi, rawApi.runtime, "sendMessage", [message]);
        },
        onMessage: {
          addListener(listener) {
            rawApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
              const response = listener(message, sender);

              if (response && typeof response.then === "function") {
                response.then(sendResponse, (error) => {
                  sendResponse({
                    ok: false,
                    error: error instanceof Error ? error.message : "Extension message failed."
                  });
                });
                return true;
              }

              if (response !== undefined) {
                sendResponse(response);
              }

              return false;
            });
          }
        }
      },
      tabs: {
        query(queryInfo) {
          return apiCall(rawApi, rawApi.tabs, "query", [queryInfo]);
        },
        sendMessage(tabId, message) {
          return apiCall(rawApi, rawApi.tabs, "sendMessage", [tabId, message]);
        }
      }
    };
  }

  function getExtensionApi() {
    const rawApi = root.browser || root.chrome;
    return rawApi ? createApi(rawApi) : null;
  }

  const exported = {
    createApi,
    getExtensionApi
  };

  namespace.extensionApi = exported;
  namespace.api = getExtensionApi();
  root.DiscordFocus = namespace;

  if (typeof module === "object" && module.exports) {
    module.exports = exported;
  }
})(typeof globalThis !== "undefined" ? globalThis : self);

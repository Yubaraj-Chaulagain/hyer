/*******************************************************
 * ZIP STORAGE - GOOGLE APPS SCRIPT BACKEND
 * NO LOGIN / NO ADMIN PIN
 * GitHub Token is stored only in Script Properties.
 *******************************************************/

const OWNER  = "Yubaraj-Chaulagain";
const REPO   = "Zip-Stroge";
const FOLDER = "files";

/* Run setupToken() once from Apps Script editor. */
function setupToken() {
  const ui = SpreadsheetApp.getUi();

  const r = ui.prompt(
    "GitHub Token",
    "Paste your NEW GitHub fine-grained token:",
    ui.ButtonSet.OK_CANCEL
  );

  if (r.getSelectedButton() !== ui.Button.OK) return;

  const token = r.getResponseText().trim();

  if (!token) {
    ui.alert("Token à¤–à¤¾à¤²à¥€ à¤›à¥¤");
    return;
  }

  PropertiesService.getScriptProperties()
    .setProperty("GITHUB_TOKEN", token);

  ui.alert("âœ… GitHub token saved securely.");
}

function doGet() {
  return json_({
    ok: true,
    message: "ZIP Storage API is running."
  });
}

function doPost(e) {
  try {
    const data = JSON.parse((e && e.postData && e.postData.contents) || "{}");

    let result;

    switch (data.action) {
      case "list":
        result = listFiles_();
        break;

      case "upload":
        result = upload_(data.name, data.base64);
        break;

      case "update":
        result = update_(
          data.oldPath,
          data.oldSha,
          data.name,
          data.base64
        );
        break;

      case "delete":
        result = delete_(data.path, data.sha);
        break;

      default:
        throw new Error("Unknown action: " + data.action);
    }

    return json_({
      ok: true,
      ...result
    });

  } catch (err) {
    return json_({
      ok: false,
      message: String(err.message || err)
    });
  }
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function token_() {
  const token = PropertiesService
    .getScriptProperties()
    .getProperty("GITHUB_TOKEN");

  if (!token) {
    throw new Error(
      "GitHub token setup à¤­à¤à¤•à¥‹ à¤›à¥ˆà¤¨à¥¤ Apps Script à¤®à¤¾ setupToken() à¤à¤• à¤ªà¤Ÿà¤• Run à¤—à¤°à¥à¤¨à¥à¤¹à¥‹à¤¸à¥à¥¤"
    );
  }

  return token;
}

function github_(method, path, body) {
  const options = {
    method: method,
    muteHttpExceptions: true,
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": "Bearer " + token_(),
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "Zip-Stroge-Google-Apps-Script"
    }
  };

  if (body !== undefined) {
    options.contentType = "application/json";
    options.payload = JSON.stringify(body);
  }

  const response = UrlFetchApp.fetch(
    "https://api.github.com/repos/" +
    OWNER + "/" + REPO + path,
    options
  );

  const code = response.getResponseCode();
  const text = response.getContentText();

  let data = {};
  try {
    data = JSON.parse(text);
  } catch (_) {}

  if (code < 200 || code >= 300) {
    throw new Error(
      "GitHub " + code + ": " + (data.message || text)
    );
  }

  return data;
}

function encodePath_(path) {
  return path
    .split("/")
    .map(encodeURIComponent)
    .join("/");
}

function safeName_(name) {
  name = String(name || "")
    .split("/")
    .pop()
    .split("\\")
    .pop();

  if (!/^[A-Za-z0-9._-]+\.zip$/i.test(name)) {
    throw new Error("Invalid ZIP filename.");
  }

  return name;
}

function listFiles_() {
  try {
    const data = github_(
      "get",
      "/contents/" + encodeURIComponent(FOLDER)
    );

    return {
      files: data
        .filter(x =>
          x.type === "file" &&
          /\.zip$/i.test(x.name || "")
        )
        .map(x => ({
          name: x.name,
          path: x.path,
          size: x.size || 0,
          sha: x.sha || "",
          download_url: x.download_url || ""
        }))
    };

  } catch (err) {
    if (String(err.message).indexOf("GitHub 404") >= 0) {
      return { files: [] };
    }
    throw err;
  }
}

function upload_(name, base64) {
  name = safeName_(name);

  if (!base64) {
    throw new Error("ZIP data à¤ªà¥à¤°à¤¾à¤ªà¥à¤¤ à¤­à¤à¤¨à¥¤");
  }

  const path = FOLDER + "/" + name;

  try {
    github_("get", "/contents/" + encodePath_(path));
    throw new Error(
      "à¤¯à¤¹à¥€ à¤¨à¤¾à¤®à¤•à¥‹ ZIP à¤ªà¤¹à¤¿à¤²à¥‡ à¤¨à¥ˆ à¤›à¥¤ Update à¤ªà¥à¤°à¤¯à¥‹à¤— à¤—à¤°à¥à¤¨à¥à¤¹à¥‹à¤¸à¥à¥¤"
    );
  } catch (err) {
    if (String(err.message).indexOf("GitHub 404") < 0) {
      throw err;
    }
  }

  github_("put", "/contents/" + encodePath_(path), {
    message: "Add " + name,
    content: base64
  });

  return { message: "Upload à¤¸à¤«à¤² à¤­à¤¯à¥‹à¥¤" };
}

function update_(oldPath, oldSha, name, base64) {
  name = safeName_(name);

  if (!base64) {
    throw new Error("ZIP data à¤ªà¥à¤°à¤¾à¤ªà¥à¤¤ à¤­à¤à¤¨à¥¤");
  }

  const newPath = FOLDER + "/" + name;

  if (newPath === oldPath) {
    github_("put", "/contents/" + encodePath_(newPath), {
      message: "Update " + name,
      content: base64,
      sha: oldSha
    });

    return { message: "Update à¤¸à¤«à¤² à¤­à¤¯à¥‹à¥¤" };
  }

  let existing = null;

  try {
    existing = github_(
      "get",
      "/contents/" + encodePath_(newPath)
    );
  } catch (err) {
    if (String(err.message).indexOf("GitHub 404") < 0) {
      throw err;
    }
  }

  const body = {
    message: "Add " + name,
    content: base64
  };

  if (existing) {
    body.sha = existing.sha;
  }

  github_("put", "/contents/" + encodePath_(newPath), body);

  github_("delete", "/contents/" + encodePath_(oldPath), {
    message: "Delete old ZIP " + oldPath.split("/").pop(),
    sha: oldSha
  });

  return { message: "Update à¤¸à¤«à¤² à¤­à¤¯à¥‹à¥¤" };
}

function delete_(path, sha) {
  if (
    !path.startsWith(FOLDER + "/") ||
    !/\.zip$/i.test(path)
  ) {
    throw new Error("Invalid ZIP path.");
  }

  github_("delete", "/contents/" + encodePath_(path), {
    message: "Delete ZIP " + path.split("/").pop(),
    sha: sha
  });

  return { message: "Delete à¤¸à¤«à¤² à¤­à¤¯à¥‹à¥¤" };
}

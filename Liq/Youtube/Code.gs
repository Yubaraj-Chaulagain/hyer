/**
 * Chaulagain Family Official - YouTube + Sheets backend
 * First run setupSystem() in the Apps Script editor.
 *
 * Script Properties required:
 *   YOUTUBE_API_KEY = your YouTube Data API v3 key
 * SPREADSHEET_ID is created automatically by setupSystem().
 */

const CHANNEL_HANDLE = "@chaulagainfamilyofficialma2717";
const PROP_SPREADSHEET_ID = "SPREADSHEET_ID";
const PROP_API_KEY = "YOUTUBE_API_KEY";
const MAX_PAGES_PER_SYNC = 4; // Up to ~200 latest uploads per sync.
const SHEET_HEADERS = [
  "Title", "URL", "Description", "Thumbnail", "PublishedAt",
  "Duration", "VideoID", "Category"
];

function setupSystem() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty(PROP_SPREADSHEET_ID);
  let ss;

  if (id) {
    try { ss = SpreadsheetApp.openById(id); } catch (err) { ss = null; }
  }
  if (!ss) {
    ss = SpreadsheetApp.create("Chaulagain Family Official - Video Library");
    props.setProperty(PROP_SPREADSHEET_ID, ss.getId());
  }

  ensureSheet_(ss, "Videos");
  ensureSheet_(ss, "Shorts");
  ensureSheet_(ss, "TikTok", ["Title", "URL", "Description", "Thumbnail", "AddedAt"]);
  ensureSheet_(ss, "Config", ["Setting", "Value"]);

  // Save channel details in Config for reference.
  const config = ss.getSheetByName("Config");
  config.getRange(2, 1, 2, 2).setValues([
    ["Channel handle", CHANNEL_HANDLE],
    ["Last sync", "Not synced yet"]
  ]);

  // Avoid duplicate hourly triggers.
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === "syncChannelVideos") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("syncChannelVideos").timeBased().everyHours(1).create();

  Logger.log("Spreadsheet: " + ss.getUrl());
  Logger.log("Next: set Script Property YOUTUBE_API_KEY, then run syncChannelVideos().");
  return ss.getUrl();
}

function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  const row = headers || SHEET_HEADERS;
  sh.getRange(1, 1, 1, row.length).setValues([row]);
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, row.length).setFontWeight("bold");
  return sh;
}

function syncChannelVideos() {
  const apiKey = PropertiesService.getScriptProperties().getProperty(PROP_API_KEY);
  if (!apiKey) throw new Error("Missing YOUTUBE_API_KEY. Add it under Project Settings > Script Properties.");

  const ssId = PropertiesService.getScriptProperties().getProperty(PROP_SPREADSHEET_ID);
  if (!ssId) throw new Error("Run setupSystem() first.");
  const ss = SpreadsheetApp.openById(ssId);

  const channel = youtubeApi_(
    "https://www.googleapis.com/youtube/v3/channels",
    { part: "contentDetails,snippet", forHandle: CHANNEL_HANDLE.replace(/^@/, ""), key: apiKey }
  );
  if (!channel.items || !channel.items.length) {
    throw new Error("Channel not found. Check CHANNEL_HANDLE and the API key.");
  }
  const uploadsId = channel.items[0].contentDetails.relatedPlaylists.uploads;
  const videosById = {};
  let pageToken = "";

  for (let page = 0; page < MAX_PAGES_PER_SYNC; page++) {
    const params = { part: "snippet,contentDetails", playlistId: uploadsId, maxResults: 50, key: apiKey };
    if (pageToken) params.pageToken = pageToken;
    const playlist = youtubeApi_("https://www.googleapis.com/youtube/v3/playlistItems", params);
    (playlist.items || []).forEach(item => {
      const id = item.contentDetails && item.contentDetails.videoId;
      if (id) videosById[id] = item.snippet;
    });
    pageToken = playlist.nextPageToken || "";
    if (!pageToken) break;
  }

  const ids = Object.keys(videosById);
  const records = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const detail = youtubeApi_("https://www.googleapis.com/youtube/v3/videos", {
      part: "snippet,contentDetails", id: batch.join(","), key: apiKey
    });
    (detail.items || []).forEach(v => {
      const sn = v.snippet || {};
      const duration = v.contentDetails ? v.contentDetails.duration || "" : "";
      const seconds = durationToSeconds_(duration);
      const category = seconds > 0 && seconds <= 180 ? "Shorts" : "Videos";
      const thumbs = sn.thumbnails || {};
      const thumb = (thumbs.maxres && thumbs.maxres.url) ||
                    (thumbs.high && thumbs.high.url) ||
                    (thumbs.medium && thumbs.medium.url) ||
                    (thumbs.default && thumbs.default.url) || "";
      records.push([
        sn.title || "",
        "https://www.youtube.com/watch?v=" + v.id,
        sn.description || "",
        thumb,
        sn.publishedAt || "",
        duration,
        v.id,
        category
      ]);
    });
  }

  records.sort((a, b) => String(b[4]).localeCompare(String(a[4])));
  writeVideoSheet_(ss.getSheetByName("Videos"), records.filter(r => r[7] === "Videos"));
  writeVideoSheet_(ss.getSheetByName("Shorts"), records.filter(r => r[7] === "Shorts"));

  const config = ss.getSheetByName("Config");
  config.getRange(3, 2).setValue(new Date());
  Logger.log("Synced " + records.length + " latest channel videos.");
}

function writeVideoSheet_(sheet, rows) {
  sheet.clearContents();
  sheet.getRange(1, 1, 1, SHEET_HEADERS.length).setValues([SHEET_HEADERS]);
  if (rows.length) sheet.getRange(2, 1, rows.length, SHEET_HEADERS.length).setValues(rows);
  sheet.setFrozenRows(1);
}

function youtubeApi_(base, params) {
  const query = Object.keys(params).map(k =>
    encodeURIComponent(k) + "=" + encodeURIComponent(params[k])
  ).join("&");
  const response = UrlFetchApp.fetch(base + "?" + query, { muteHttpExceptions: true });
  const status = response.getResponseCode();
  const body = response.getContentText();
  const json = JSON.parse(body);
  if (status < 200 || status >= 300) {
    const msg = json.error && json.error.message ? json.error.message : body;
    throw new Error("YouTube API error (" + status + "): " + msg);
  }
  return json;
}

function durationToSeconds_(duration) {
  const match = String(duration).match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  return Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
}

/**
 * Public read-only JSON/JSONP endpoint for the website.
 * Deploy as Web app: Execute as Me; Who has access: Anyone.
 * URLs: ?action=videos and ?action=spreadsheet
 */
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || "videos";
  const props = PropertiesService.getScriptProperties();
  const ssId = props.getProperty(PROP_SPREADSHEET_ID);
  let payload;

  if (action === "spreadsheet") {
    payload = { ok: !!ssId, spreadsheetUrl: ssId ? SpreadsheetApp.openById(ssId).getUrl() : "" };
  } else if (action === "videos") {
    if (!ssId) {
      payload = { ok: false, error: "Setup not completed. Run setupSystem() first.", videos: [] };
    } else {
      const ss = SpreadsheetApp.openById(ssId);
      payload = {
        ok: true,
        spreadsheetUrl: ss.getUrl(),
        videos: readRows_(ss.getSheetByName("Videos"), "youtube"),
        shorts: readRows_(ss.getSheetByName("Shorts"), "shorts"),
        tiktok: readRows_(ss.getSheetByName("TikTok"), "tiktok")
      };
    }
  } else {
    payload = { ok: false, error: "Unknown action" };
  }

  const callback = e && e.parameter ? e.parameter.callback : "";
  if (callback && /^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(callback)) {
    return ContentService.createTextOutput(callback + "(" + JSON.stringify(payload) + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function readRows_(sheet, type) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, SHEET_HEADERS.length).getValues();
  return values.filter(r => r[0] && r[1]).map(r => ({
    title: String(r[0] || ""),
    url: String(r[1] || ""),
    description: String(r[2] || ""),
    thumbnail: String(r[3] || ""),
    publishedAt: r[4] instanceof Date ? r[4].toISOString() : String(r[4] || ""),
    duration: String(r[5] || ""),
    videoId: String(r[6] || ""),
    category: String(r[7] || type),
    type: type
  }));
}

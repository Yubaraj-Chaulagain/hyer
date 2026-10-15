// =============================================
// CHAULAGAIN FAMILY OFFICIAL
// GOOGLE SHEETS + YOUTUBE VIDEO LIBRARY
// =============================================

const CHANNEL_ID = "UCLbpxkvazaQThtiNjcf5vJw";

const PROP_ID = "SPREADSHEET_ID";

const HEADERS = [
  "VideoID",
  "Title",
  "URL",
  "Description",
  "Thumbnail",
  "PublishedAt",
  "Type"
];


// =============================================
// 1. GOOGLE SPREADSHEET CREATE / OPEN
// =============================================

function getSpreadsheet() {
  const props = PropertiesService.getScriptProperties();

  let id = props.getProperty(PROP_ID);
  let ss = null;

  if (id) {
    try {
      ss = SpreadsheetApp.openById(id);
    } catch (error) {
      console.log("Existing spreadsheet खोल्न सकिएन: " + error);
    }
  }

  if (!ss) {
    ss = SpreadsheetApp.create(
      "Chaulagain Family Official Video Library"
    );

    props.setProperty(PROP_ID, ss.getId());
  }

  const sheetNames = ["Videos", "Shorts", "TikTok"];

  sheetNames.forEach(function(name) {
    let sheet = ss.getSheetByName(name);

    if (!sheet) {
      sheet = ss.insertSheet(name);
    }

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
      sheet.setFrozenRows(1);
    }
  });

  return ss;
}


// =============================================
// 2. INITIAL SETUP
// =============================================

function setupSystem() {
  const ss = getSpreadsheet();

  console.log("Spreadsheet URL: " + ss.getUrl());
  console.log("Spreadsheet ID: " + ss.getId());

  return ss.getUrl();
}


// =============================================
// 3. CHECK YOUTUBE RSS FEED
// =============================================

function checkYouTubeFeed() {
  const url =
    "https://www.youtube.com/feeds/videos.xml?channel_id=" +
    encodeURIComponent(CHANNEL_ID);

  const response = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    followRedirects: true
  });

  const status = response.getResponseCode();
  const content = response.getContentText();

  console.log("HTTP Status: " + status);
  console.log("Feed Response: " + content.substring(0, 3000));

  if (status !== 200) {
    throw new Error(
      "YouTube RSS Feed असफल भयो। HTTP Status: " + status
    );
  }

  const xml = XmlService.parse(content);
  const root = xml.getRootElement();

  const atom = XmlService.getNamespace(
    "http://www.w3.org/2005/Atom"
  );

  const entries = root.getChildren("entry", atom);

  console.log("Feed मा भेटिएका भिडियो: " + entries.length);

  return entries.length;
}


// =============================================
// 4. SYNC YOUTUBE VIDEOS INTO GOOGLE SHEETS
// =============================================

function syncVideos() {
  const lock = LockService.getScriptLock();

  if (!lock.tryLock(20000)) {
    throw new Error(
      "अर्को Sync चलिरहेको छ। केही बेरपछि फेरि प्रयास गर्नुहोस्।"
    );
  }

  try {
    const ss = getSpreadsheet();

    const videoSheet = ss.getSheetByName("Videos");
    const shortsSheet = ss.getSheetByName("Shorts");

    const feedUrl =
      "https://www.youtube.com/feeds/videos.xml?channel_id=" +
      encodeURIComponent(CHANNEL_ID);

    const response = UrlFetchApp.fetch(feedUrl, {
      muteHttpExceptions: true,
      followRedirects: true
    });

    const httpCode = response.getResponseCode();

    if (httpCode !== 200) {
      throw new Error(
        "YouTube Feed उपलब्ध भएन। HTTP Status: " + httpCode
      );
    }

    const xml = XmlService.parse(response.getContentText());
    const root = xml.getRootElement();

    const atom = XmlService.getNamespace(
      "http://www.w3.org/2005/Atom"
    );

    const yt = XmlService.getNamespace(
      "yt",
      "http://www.youtube.com/xml/schemas/2015"
    );

    const media = XmlService.getNamespace(
      "media",
      "http://search.yahoo.com/mrss/"
    );

    // पहिले नै Google Sheets मा भएका Video IDs
    const existing = new Set();

    [videoSheet, shortsSheet].forEach(function(sheet) {
      const lastRow = sheet.getLastRow();

      if (lastRow > 1) {
        const ids = sheet
          .getRange(2, 1, lastRow - 1, 1)
          .getDisplayValues()
          .flat();

        ids.forEach(function(id) {
          if (id) existing.add(String(id).trim());
        });
      }
    });

    const videos = [];
    const shorts = [];

    const entries = root.getChildren("entry", atom);

    entries.forEach(function(entry) {
      const idElement = entry.getChild("videoId", yt);

      if (!idElement) return;

      const id = idElement.getText().trim();

      if (!id || existing.has(id)) return;

      const titleElement = entry.getChild("title", atom);
      const publishedElement = entry.getChild("published", atom);
      const group = entry.getChild("group", media);

      const title = titleElement
        ? titleElement.getText()
        : "Untitled video";

      const publishedAt = publishedElement
        ? publishedElement.getText()
        : "";

      let thumbnail =
        "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg";

      if (group) {
        const thumbElement = group.getChild("thumbnail", media);

        if (thumbElement) {
          const attr = thumbElement.getAttribute("url");

          if (attr) {
            thumbnail = attr.getValue();
          }
        }
      }

      const isShort = /#shorts\b/i.test(title);

      const row = [
        id,
        title,
        "https://www.youtube.com/watch?v=" + id,
        "",
        thumbnail,
        publishedAt,
        isShort ? "Shorts" : "YouTube"
      ];

      if (isShort) {
        shorts.push(row);
      } else {
        videos.push(row);
      }

      existing.add(id);
    });

    // नयाँ भिडियोहरू पहिलो पङ्क्तिमा राख्ने
    if (videos.length > 0) {
      videoSheet.insertRowsBefore(2, videos.length);

      videoSheet
        .getRange(2, 1, videos.length, HEADERS.length)
        .setValues(videos);
    }

    if (shorts.length > 0) {
      shortsSheet.insertRowsBefore(2, shorts.length);

      shortsSheet
        .getRange(2, 1, shorts.length, HEADERS.length)
        .setValues(shorts);
    }

    SpreadsheetApp.flush();

    const result = {
      success: true,
      videosAdded: videos.length,
      shortsAdded: shorts.length,
      spreadsheetUrl: ss.getUrl(),
      message:
        videos.length + " वटा YouTube भिडियो र " +
        shorts.length + " वटा Shorts थपिए।"
    };

    console.log(JSON.stringify(result));

    return result;

  } finally {
    lock.releaseLock();
  }
}


// =============================================
// 5. READ SHEET DATA
// =============================================

function readSheet(sheet) {
  if (!sheet || sheet.getLastRow() < 2) {
    return [];
  }

  const values = sheet.getDataRange().getDisplayValues();

  return values
    .slice(1)
    .filter(function(row) {
      return row[0] && row[2];
    })
    .map(function(row) {
      return {
        videoId: row[0],
        title: row[1],
        url: row[2],
        description: row[3],
        thumbnail: row[4],
        publishedAt: row[5],
        type: row[6]
      };
    });
}


// =============================================
// 6. JSON / JSONP OUTPUT FOR HTML
// =============================================

function jsonOutput(data, callback) {
  const json = JSON.stringify(data);

  if (
    callback &&
    /^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(callback)
  ) {
    return ContentService
      .createTextOutput(callback + "(" + json + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}


// =============================================
// 7. WEB APP API
// =============================================

function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};

  const action = params.action || "videos";
  const callback = params.callback || "";

  try {
    let result;

    if (action === "sync") {
      result = syncVideos();

    } else if (action === "setup") {
      const ss = getSpreadsheet();

      result = {
        success: true,
        message: "Google Sheets तयार भयो।",
        spreadsheetUrl: ss.getUrl()
      };

    } else if (action === "videos") {
      const ss = getSpreadsheet();

      result = {
        success: true,
        spreadsheetUrl: ss.getUrl(),
        videos: readSheet(ss.getSheetByName("Videos")),
        shorts: readSheet(ss.getSheetByName("Shorts")),
        tiktok: readSheet(ss.getSheetByName("TikTok"))
      };

    } else if (action === "csv") {
      return csvOutput(
        getSpreadsheet().getSheetByName("Videos")
      );

    } else {
      result = {
        success: false,
        error: "अज्ञात action: " + action
      };
    }

    return jsonOutput(result, callback);

  } catch (error) {
    return jsonOutput({
      success: false,
      error: String(error.message || error)
    }, callback);
  }
}


// =============================================
// 8. CSV EXPORT
// =============================================

function csvOutput(sheet) {
  const data = sheet.getDataRange().getDisplayValues();

  const csv = data.map(function(row) {
    return row.map(function(value) {
      return '"' + String(value).replace(/"/g, '""') + '"';
    }).join(",");
  }).join("\r\n");

  return ContentService
    .createTextOutput(csv)
    .setMimeType(ContentService.MimeType.CSV);
}


// =============================================
// 9. MANUAL TEST
// =============================================

function testSync() {
  const result = syncVideos();

  console.log("SYNC RESULT:");
  console.log(JSON.stringify(result, null, 2));

  console.log("SHEET URL:");
  console.log(result.spreadsheetUrl);

  return result;
}

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

function getSpreadsheet() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty(PROP_ID);
  let ss;

  if (id) {
    try {
      ss = SpreadsheetApp.openById(id);
    } catch (e) {}
  }

  if (!ss) {
    ss = SpreadsheetApp.create(
      "Chaulagain Family Official Video Library"
    );
    props.setProperty(PROP_ID, ss.getId());
  }

  ["Videos", "Shorts", "TikTok"].forEach(name => {
    let sh = ss.getSheetByName(name);

    if (!sh) sh = ss.insertSheet(name);

    if (sh.getLastRow() === 0) {
      sh.appendRow(
        name === "TikTok"
          ? ["VideoID", "Title", "URL", "Description", "Thumbnail", "PublishedAt", "Type"]
          : HEADERS
      );
      sh.setFrozenRows(1);
    }
  });

  return ss;
}

function setupSystem() {
  const ss = getSpreadsheet();
  Logger.log("Spreadsheet URL: " + ss.getUrl());
  return ss.getUrl();
}

function syncVideos() {
  const ss = getSpreadsheet();
  const videoSheet = ss.getSheetByName("Videos");
  const shortsSheet = ss.getSheetByName("Shorts");

  const response = UrlFetchApp.fetch(
    "https://www.youtube.com/feeds/videos.xml?channel_id=" +
    encodeURIComponent(CHANNEL_ID),
    { muteHttpExceptions: true }
  );

  if (response.getResponseCode() !== 200) {
    throw new Error("YouTube RSS Feed उपलब्ध भएन।");
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

  const existing = new Set();

  [videoSheet, shortsSheet].forEach(sheet => {
    if (sheet.getLastRow() > 1) {
      sheet.getRange(
        2, 1, sheet.getLastRow() - 1, 1
      ).getDisplayValues().flat().forEach(id => {
        if (id) existing.add(id);
      });
    }
  });

  const videos = [];
  const shorts = [];

  root.getChildren("entry", atom).forEach(entry => {
    const idElement = entry.getChild("videoId", yt);
    if (!idElement) return;

    const id = idElement.getText().trim();

    if (!id || existing.has(id)) return;

    const titleElement = entry.getChild("title", atom);
    const publishedElement = entry.getChild("published", atom);
    const group = entry.getChild("group", media);

    const thumbnailElement = group
      ? group.getChild("thumbnail", media)
      : null;

    const title = titleElement
      ? titleElement.getText()
      : "";

    const published = publishedElement
      ? publishedElement.getText()
      : "";

    const thumbnail = thumbnailElement
      ? thumbnailElement.getAttribute("url").getValue()
      : "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg";

    const row = [
      id,
      title,
      "https://www.youtube.com/watch?v=" + id,
      "",
      thumbnail,
      published,
      ""
    ];

    // RSS ले Shorts हो कि होइन भनेर स्पष्ट दिँदैन।
    // त्यसैले शीर्षकमा #Shorts भए मात्र Shorts मा राख्ने।
    if (/#shorts\b/i.test(title)) {
      row[6] = "Shorts";
      shorts.push(row);
    } else {
      row[6] = "YouTube";
      videos.push(row);
    }

    existing.add(id);
  });

  if (videos.length) {
    videoSheet.insertRowsAfter(1, videos.length);
    videoSheet.getRange(
      2, 1, videos.length, HEADERS.length
    ).setValues(videos);
  }

  if (shorts.length) {
    shortsSheet.insertRowsAfter(1, shorts.length);
    shortsSheet.getRange(
      2, 1, shorts.length, HEADERS.length
    ).setValues(shorts);
  }

  return {
    success: true,
    videosAdded: videos.length,
    shortsAdded: shorts.length,
    spreadsheetUrl: ss.getUrl(),
    message:
      videos.length + " वटा भिडियो र " +
      shorts.length + " वटा Shorts थपिए।"
  };
}

function doGet(e) {
  const action = e && e.parameter
    ? e.parameter.action || "videos"
    : "videos";

  try {
    if (action === "sync") {
      return jsonOutput(syncVideos());
    }

    const ss = getSpreadsheet();

    const result = {
      success: true,
      spreadsheetUrl: ss.getUrl(),
      videos: readSheet(ss.getSheetByName("Videos")),
      shorts: readSheet(ss.getSheetByName("Shorts")),
      tiktok: readSheet(ss.getSheetByName("TikTok"))
    };

    if (action === "csv") {
      return csvOutput(ss.getSheetByName("Videos"));
    }

    return jsonOutput(result);

  } catch (err) {
    return jsonOutput({
      success: false,
      error: String(err.message || err)
    });
  }
}

function readSheet(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];

  const values = sheet.getDataRange().getDisplayValues();

  return values.slice(1)
    .filter(row => row[0] && row[2])
    .map(row => ({
      videoId: row[0],
      title: row[1],
      url: row[2],
      description: row[3],
      thumbnail: row[4],
      publishedAt: row[5],
      type: row[6]
    }));
}

function jsonOutput(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function csvOutput(sheet) {
  const data = sheet.getDataRange().getDisplayValues();

  const csv = data.map(row =>
    row.map(value =>
      '"' + String(value).replace(/"/g, '""') + '"'
    ).join(",")
  ).join("\r\n");

  return ContentService
    .createTextOutput(csv)
    .setMimeType(ContentService.MimeType.CSV);
}

// preprocess
// 
const https = require('https');
const http = require('http');
var JSSoup = require('jssoup').default;
const XLSX = require("xlsx");
var fs = require('fs');
XLSX.set_fs(fs);
var tasks = [];
require('dotenv').config();
/* defining some constants */
const CAS_HOST = process.env.CAS_HOST;
const CAS_PORT = process.env.CAS_PORT;
const API_KEY = process.env.API_KEY;
const DO_POST = process.env.POST;
const FETCH = process.env.FETCH;
const SAVE = process.env.SAVE;
const SOURCE_DOCUMENT = "cos/cos-spotlight.xlsx";
const PAYLOAD_DOCUMENT = fs.readFileSync("json/cos-news-link.json");
const POST_URI = "/api/v1/create";
const SHEET_NAME = "faculty";
const OUTPUT_DOCUMENT = "cos/cos-spotlight-" + SHEET_NAME + ".xlsx";

var protocol = https;

var tasks = [];
var workbook = XLSX.readFile(SOURCE_DOCUMENT, {cellDates:true});
console.dir(workbook.SheetNames);
var dataSheet = workbook.Sheets[SHEET_NAME];
const sheetRange = XLSX.utils.decode_range(dataSheet['!ref']);
const maxRow = sheetRange.e.r;

console.log(maxRow);
for (let i = 2; i < (maxRow + 2); i++) {
  console.log(i);
  var newTask = {}
  try {
    var newTask = {
      "row": i,
      "title": dataSheet['A'+i].v,
      "year": dataSheet['B'+i].v,
      "url": dataSheet['D'+i].v.trim(),
      "type": dataSheet['G'+i].v.trim(),
      "class": dataSheet['H'+i].v.trim(),
      "image": dataSheet['K'+i].v.trim()
    }
    var parts = newTask.title.split('–');
    // console.log("last part:" + parts[parts.length - 1]);
    newTask.title = parts[parts.length - 1].trim();
    tasks.push(newTask);
    // console.dir(newTask);
  } catch(pe) {
    console.log(pe);
    console.log("unable to parse: " + i + " skipping row");
  }
}
// console.dir(testSheet.Workbook.Names);
// console.log(testSheet);
completeTasks(dataSheet);

async function completeTasks(dataSheet) {
  var currentTask = {}
  try {
    for (let t of tasks) {
      currentTask = t;
      // generate cascade URI
      // update URI cell
      const uri = updatePaths(t, dataSheet);
      // fetch HTML from task.url
      if (FETCH == "YES") {
        console.log("fetching ", t.url);
        // HTML Soup the main content snippet
        let htmlSource = await fetchURL(t.url);
        // console.log(htmlSource.prettify());
        var updatedSource = patchImage(htmlSource, t.image);
        updatedSource = patchMonth(htmlSource, t, dataSheet);
        // HTML Soup <img> from main content
        // save snippet to URI path locally
        // save img src to image cell
        let refactoredSource = refactorContent(updatedSource);
        let localPath = "." + t.parentFolderPath + "/" + t.uri + ".html";
        t.localPath = localPath;
        console.dir(t);
        saveSnippet(refactoredSource, t);        
      }
    }

    // SAVE workbook
    if (SAVE == "YES") {
      // workbook.Sheets[SHEET_NAME] = dataSheet;
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, dataSheet, SHEET_NAME);
      console.log("attempting to save dataSheet");
      XLSX.writeFileXLSX(wb, OUTPUT_DOCUMENT);
    }
  } catch (e) {
    console.log("Error while running tasks");
    console.log(e);
    console.dir(currentTask);
  }
}

function updatePaths(t) {
  //set origins
  nOrigin = "N" + t.row;
  eOrigin = "E" + t.row;
  kOrigin = "K" + t.row;
  t.uri = strToSlug(t.title);
  t.image = t.image.replace('sciences/spotlights', '/images/spotlights');
  t.image = t.image + ".jpg";
  t.parentFolderPath = "/spotlights/" + t.class + "/" + t.year;
  //update spreadsheet
  //update image cell
  XLSX.utils.sheet_add_aoa(dataSheet, [
    [t.image]
  ], { origin: kOrigin });
  //update parentFolderPath cell
  XLSX.utils.sheet_add_aoa(dataSheet, [
    [t.parentFolderPath]
  ], { origin: nOrigin });
  //update uri cell
  XLSX.utils.sheet_add_aoa(dataSheet, [
    [t.uri]
  ], { origin: eOrigin });
  // console.log("update paths result:");
  // console.dir(t);
}

function strToSlug(str) {
  var slug = clean(str);
  slug = slug.toLowerCase();
  slug = slug.replaceAll(' ', '-');
  return slug;
}

function parseTags(str) {
  var strArray = str.split(',');
  var tags = [];
  strArray.map(function(t) {
    tags.push({"name":t});
  });
  return tags;
}

function clean(str) {
  var cleanStr = str;
  cleanStr = str.replaceAll('í', 'i');
  cleanStr = cleanStr.replaceAll('é', 'e');
  cleanStr = cleanStr.replaceAll('á', 'a');
  cleanStr = cleanStr.replaceAll('–', '-');
  cleanStr = cleanStr.replaceAll("’", "'");
  console.log(cleanStr);
  return cleanStr;
}

function parseParentFolderPath(d) {
  var monthNum = d.getMonth() + 1;
  if (monthNum < 10) {
    monthNum = "0" + monthNum;
  }
  var yearNum = d.getFullYear();
  var path = "news/"+ yearNum + "/" + monthNum;
  return path;
}

async function fetchURL(url) {
  //do GET
  var html = "";
  let p = new Promise((resolve, reject) => {
    const req = protocol.request(url, (response) => {
			response.on('data', (fragments) => {
        // console.log("\t pushing data");
        html = html + fragments;
			});

			response.on('end', () => {
				let responseBody = html;
        var soup = new JSSoup(html, false);
        var content = soup.find('div', { 'class' : 'content'});
        resolve(content);
        // //Buffer.concat(chunks_of_data);
        // //let responseString = responseBody.toString();
        // resolve(responseBody);
			});

			response.on('error', (error) => {
				reject(error);
			});
    });
    req.end();
  });
  return await p;
}

function refactorContent(soupSnippet) {
  var scr = soupSnippet.find('script');
  scr.extract();
  var backA = soupSnippet.find('a', {'id' : 'back-to-top'});
  backA.extract();
  var firstRow = soupSnippet.find('div', {'class' : 'row'})
  firstRow.extract();
  var hr = soupSnippet.find('hr', { 'class' : 'mt-4'});
  hr.extract();
  var pa = soupSnippet.findAll('p', {'align' : 'right'});
  pa.map(e => {
    e.extract();
  });
  return soupSnippet;
}

function patchImage(soupSnippet, updatedSrc) {
  var images = soupSnippet.findAll('img');
  if (images.length > 0) {
    var firstImg = images[0];
    console.log(firstImg.attrs.src);
    firstImg.attrs.src = updatedSrc;
  }
  return soupSnippet;
}

function patchMonth(soupSnippet, task, sheet) {
  var small = soupSnippet.findAll('small');
  if (SHEET_NAME == "alumni") {
    if (small.length > 0) {
      var firstSmall = small[0];
      console.log("small text is: parsing for month");
      console.log(firstSmall.text);
      task.month = firstSmall.text.split(' ')[0];
    } else {
      task.month = "February ";
    }
  } else {
    task.month = "February ";
  }
  let cOrigin = "C" + task.row;
  XLSX.utils.sheet_add_aoa(sheet, [
    [task.month]
  ], { origin: cOrigin });
  return soupSnippet;
}

function saveSnippet(content, task) {
  let fpath = task.localPath;
  let oOrigin = "O" + task.row;
  XLSX.utils.sheet_add_aoa(dataSheet, [
    [fpath]
  ], { origin: oOrigin });
  var articleStream = fs.createWriteStream(fpath);
  articleStream.write(content.prettify());
  articleStream.end();
}
/**
 * Graduate School News Page Post
 * ## Goals:
 * - convert older Blog v1.2 cascade pages into new DLS blog page
 * - utilize CMS API GET to grab exisiting page data
 * - populate blank blog JSON with old blog data
 * - CMS API POST to create new DLS blog post
 * - assuming all images are in news-old/YYYY/images
 * - assuming no html data need to be updated (left for content owners)
 * 
 * ## Input:
 * - list of CMS page paths in .xls format
 * 
 * ## Output:
 * - updated .xls of exported/created page paths (relative) and created cascade IDs
 * **/
const https = require('https');
const http = require('http');
const XLSX = require("xlsx");
var moment = require('moment'); // require
moment().format(); 
const {execSync} = require('child_process');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
var fs = require('fs');
XLSX.set_fs(fs);
var tasks = [];
require('dotenv').config();
/* defining some constants */
const POST = process.env.POST;
const CAS_HOST = process.env.CAS_HOST;
const CAS_PORT = process.env.CAS_PORT;
const API_KEY = process.env.API_KEY;
const DO_POST = process.env.POST;
const FETCH = process.env.FETCH;
const SAVE = process.env.SAVE;
const PAYLOAD_DOCUMENT = fs.readFileSync("json/generated-gs-news.json");
const TARGET_SITE = "GRADUATESCHOOL-VPAA-ASC-HALSTORE";
const POST_URI = "/api/v1/create";
const GET_URI = "/api/v1/read/page/GRADUATESCHOOL-VPAA-ASC-HALSTORE/"
const PATH_FORMAT = "YYYY/MM";
const DAY_FORMAT = "DD-";
const TARGET_YEAR = 2024;
const SOURCE_DOCUMENT = "gs/gs-old-news.xlsx";
const SHEET_NAME = "gs-sitemap-cms";

var protocol = http;
if (CAS_PORT == 443) {
  protocol = https;
}

//read in a target year json file
//map over each post
//create a task for each one
var tasks = [];
var workbook = XLSX.readFile(SOURCE_DOCUMENT, { cellDates: true });
console.dir(workbook.SheetNames);
var dataSheet = workbook.Sheets[SHEET_NAME];
const sheetRange = XLSX.utils.decode_range(dataSheet['!ref']);
const maxRow = sheetRange.e.r;


console.log(maxRow);
for (let i = 2; i < (maxRow + 2); i++) {
  // console.log(i);
  var newTask = {}
  try {
    var newTask = {
      "row": i,
      "uri": dataSheet['A' + i].v.trim()
    };
    if (newTask.uri.includes(TARGET_YEAR)) {
      tasks.push(newTask);
    }
    // console.dir(newTask);
  } catch (pe) {
    console.log(pe);
    console.log("unable to parse: " + i + " skipping row");
  }
}
console.log("generated: " + tasks.length + " tasks");
executeTasksConcurrently(tasks);

async function executeTasksConcurrently(list) {
  let activeTasks = [];
  let concurrencyLimit = 3;

  for (const item of list) {
    if (activeTasks.length >= concurrencyLimit) {
      await Promise.race(activeTasks);
    }
    // console.log(`Start task: ${item}`);
    // console.dir(item);
    // wait 0.25 secs between launching new async task b/c Cascade chokes, otherwise...
    await delay(50);
    const activeTask = completeTask(item)
      .then(() => {
        activeTasks.splice(activeTasks.indexOf(activeTask), 1);
        // console.log(`End task: ${item}`);
      })
      .catch(() => {
        activeTasks.splice(activeTasks.indexOf(activeTask), 1);
        // console.log(`End task: ${item}`);
      });
    activeTasks.push(activeTask);
  }
}

async function completeTask(t) {
  var oldAsset = {};
  try {
    if (FETCH == "YES") {
      console.log("FETCH: " + t.uri);
      t.oldAsset = await getAsset(encodeURI(t.uri));
      // console.dir(t.oldAsset);
    }
    //given a task (post):
    // preparePayload(t)
    // POST payload
    const payload = preparePayload(t);
    let stringPayload = JSON.stringify(payload);
    // console.log(stringPayload);
    if (POST == "YES") {
      let postedAsset = await postAsset(POST_URI, stringPayload);
      try {
        let respj = JSON.parse(postedAsset);
        if (respj.success == true) {
          console.log(respj);
          // console.log("created: " + respj.success + "\t" + respj.createdAssetId);
        } else {
          console.log("****ERROR****");
          console.log(postedAsset);
          console.dir(t);
          console.log("******PAYLOAD******");
          console.log(stringPayload);
          console.log("******END******");
          // console.dir(payload);
        }
      } catch (e) {
        console.log("POST failed to return a JSON response");
        console.log(e);
      } 
    }    
  } catch (e) {
    console.log(e);
    console.log("Error while running tasks:");
    console.dir(t);
  }
  return t;
}

function preparePayload(task) {
  //reconcile two blog posts, old Blog v1.2 and new DLS Blog
  //metadata: headline, teaser, source, author, startDate
  // generated properties:
  // - parentFolderPath (required)
  // - asset name (required):  convert old asset name to DD-headline-with-hyphens-all-lowercase format
  //content:
  // - html content
  // - image1, if it exists
  // - image1 alt text, if it exists
  // - image2, if it exists
  // - image2 alt text, if it exists
  // - article content: old content row collapse into single text wysiwyg
  let oldAsset = task.oldAsset;
  var page = JSON.parse(PAYLOAD_DOCUMENT);

  var assetMeta = page.asset.page.metadata;
  var structData = page.asset.page.structuredData.structuredDataNodes;
  let oldMeta = oldAsset.asset.page.metadata;
  let oldData = oldAsset.asset.page.structuredData.structuredDataNodes;
  
  // update computed properties
  let startDate = oldMeta.startDate;
  let startMoment = moment(startDate);
  let namePrefix = startMoment.format(DAY_FORMAT);
  console.log("parsed startDate: " + startDate);
  let parentPagePath = "/news/" + startMoment.format(PATH_FORMAT);
  console.log("new parentPath: " + parentPagePath);
  page.asset.page.parentFolderPath = parentPagePath;
  let newAssetName = oldAsset.asset.page.name.replaceAll(' ', '-').toLowerCase();
  var assetName = "";
  if (newAssetName.startsWith(namePrefix)) {
    assetName = newAssetName;
  } else {
    assetName = namePrefix + newAssetName;
  }
  console.log("new assetName: " + assetName);
  page.asset.page.name = assetName;

  // update metadata on new asset
  assetMeta.displayName = oldMeta.displayName;
  assetMeta.title = oldMeta.title;
  assetMeta.teaser = "";
  assetMeta.author = "The Graduate School";
  assetMeta.startDate = oldMeta.startDate;

  // generate new structured data nodes

  // grab article content
  var contentRowCols = [];
  var articleContent = "";
  var imageNode = {};
  var captionNode = {};

  oldData.map(function(d) {
    if (d.identifier == "ContentRow") {
      contentRowCols = d.structuredDataNodes[0].structuredDataNodes;
      contentRowCols.map(function(c){
        if (c.identifier == "editor") {
          articleContent = c.text;
        }

        if (c.identifer == "image1") {
          imageNode = c;
        }

        if (c.identifier == "caption") {
          captionNode = c;
        }
      });
    }
  });
  // console.log(articleContent);

  // update structured data
  structData.map(function(s){
    if (s.identifier == "wysiwyg") {
      s.text = articleContent;
    }

    if (s.identifier == "image1") {
      s = imageNode;
    }

    if (s.identifier == "caption") {
      s = captionNode;
    }
  });


  // var postData = task.post;
  // var sdns = page.asset.page.structuredData.structuredDataNodes;
  // var meta = page.asset.page.metadata;
  // //easy stuff - metadata
  // meta.displayName = postData.title.rendered;
  // meta.title = postData.title.rendered;
  // meta.startDate = postData.date + ".000Z"
  // meta.summary = postData.excerpt.clean;
  // meta.author = postData.author_name.name;
  // //easy stuff - uri, name, location
  // page.asset.page.parentFolderPath = postData.parentFolderPath;
  // page.asset.page.tags = postData.tags_generated;
  // page.asset.page.name = postData.slug;
  // //annoying stuff - content, images
  // sdns.map(function(d) {
  //   // console.log(d.identifier);
  //   if ((d.identifier == "image1") && (postData.featured_image != undefined)) {
  //     d.structuredDataNodes = [
  //       {
  //           "type": "asset",
  //           "identifier": "file",
  //           "filePath": postData.featured_image.uri,
  //           "assetType": "file"
  //       },
  //       {
  //           "type": "text",
  //           "identifier": "alt",
  //           "text": postData.featured_image.alt
  //       }
  //     ];
  //   }
  //   if ((d.identifier == "caption") && (postData.featured_image)) {
  //     d.text = postData.featured_image.alt
  //   }
  //   if (d.identifier == "wysiwyg") {
  //     d.text = postData.content.clean
  //   }
  // });

  return page;
}

async function postAsset(uri, payload) {
  //do GET
  let postOptions = {
    hostname: CAS_HOST,
    port: CAS_PORT,
    path: uri,
    method: 'POST',
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': payload.length,
        Authorization: ' Bearer ' + API_KEY
    }
  };
  if (CAS_PORT == 443) {
    postOptions.requestCert = false;
    postOptions.rejectUnauthorized = false;
  }
  // console.log(payload);
  let p = new Promise((resolve, reject) => {
		const req = protocol.request(postOptions, (response) => {
      // console.log(postOptions);
      // console.log(postOptions.headers['Content-Length']);
      // console.log(payload);
      // console.log(payload.length);
			let chunks_of_data = [];
			response.on('data', (fragments) => {
				chunks_of_data.push(fragments);
			});

			response.on('end', () => {
				let responseBody = Buffer.concat(chunks_of_data);
        let responseString = responseBody.toString();
        resolve(responseString);
			});

			response.on('error', (error) => {
				reject(error);
			});
		});
    req.write(payload);
    req.end();
	});

  return await p;
}

async function getAsset(uri) {
  //do GET
  let getOptions = {
    hostname: CAS_HOST,
    port: CAS_PORT,
    path: GET_URI + uri,
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      // 'Content-Length': postData.length,
      Authorization: ' Bearer ' + API_KEY
    }
  };
  if (CAS_PORT == 443) {
    getOptions.requestCert = false;
    getOptions.rejectUnauthorized = false;
  }
  let p = new Promise((resolve, reject) => {
    const req = protocol.request(getOptions, (response) => {
      // console.log(getOptions);
			let chunks_of_data = [];

			response.on('data', (fragments) => {
        // console.log("\t pushing data");
				chunks_of_data.push(fragments);
			});

			response.on('end', () => {
        var responeObj = {};
        try {
          let responseBody = Buffer.concat(chunks_of_data);
          let responseString = responseBody.toString();
          responseObj = JSON.parse(responseString);  
        } catch (jsonE) {
          responseObj = { status: false, error: "unable to parse JSON as response"};
        }
				resolve(responseObj);
			});

			response.on('error', (error) => {
				reject(error);
			});
    });
    req.end();
  });
  return await p;
}


// image asset json
// {
//   "type": "asset",
//   "identifier": "file",
//   "filePath": "images/news-blog-1.jpg",
//   "assetType": "file"
// },
// {
//   "type": "text",
//   "identifier": "alt",
//   "text": "UTSA Main Campus"
// }
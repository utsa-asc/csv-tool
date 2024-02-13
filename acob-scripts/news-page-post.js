const https = require('https');
const http = require('http');
const {execSync} = require('child_process');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
var fs = require('fs');
var tasks = [];
require('dotenv').config();
/* defining some constants */
const POST = process.env.POST;
const CAS_HOST = process.env.CAS_HOST;
const CAS_PORT = process.env.CAS_PORT;
const API_KEY = process.env.API_KEY;
const PAYLOAD_DOCUMENT = fs.readFileSync("json/test-post.json");
const TARGET_SITE = "ACOB-VPAA-ASC-HALSTORE";
const POST_URI = "/api/v1/create";
const START_YEAR = 2012;
const END_YEAR = 2013;
const TYPE = "edited"

var protocol = http;
if (CAS_PORT == 443) {
  protocol = https;
}
const DEFAULT_SOURCE = "Alvarez College of Business";

//read in a target year json file
//map over each post
//create a task for each one
var tasks = [];
var targetYear = START_YEAR;
while (targetYear < END_YEAR) {
    let JSON_FILE = "acob/news-" + targetYear + "-" + TYPE + ".json";
    let POST_FILE = fs.readFileSync(JSON_FILE);
    let posts = JSON.parse(POST_FILE);
    posts.map(function(p) {
        console.log("adding post: " + p.id + "\t" + p.date + "\t" + p.slug);
        let newTask = {
            post: p,
            year: targetYear
        };
        tasks.push(newTask);
    })
    targetYear = targetYear + 1;
}

console.log("generated: " + tasks.length + " tasks");
executeTasksConcurrently(tasks);

async function executeTasksConcurrently(list) {
  let activeTasks = [];
  let concurrencyLimit = 25;

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
  try {
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
  var page = JSON.parse(PAYLOAD_DOCUMENT);
  var postData = task.post;
  var sdns = page.asset.page.structuredData.structuredDataNodes;
  var meta = page.asset.page.metadata;
  //easy stuff - metadata
  meta.displayName = postData.title.rendered;
  meta.title = postData.title.rendered;
  meta.startDate = postData.date + ".000Z"
  meta.summary = postData.excerpt.clean;
  meta.author = postData.author_name.name;
  //easy stuff - uri, name, location
  page.asset.page.parentFolderPath = postData.parentFolderPath;
  page.asset.page.tags = postData.tags_generated;
  page.asset.page.name = postData.slug;
  //annoying stuff - content, images
  sdns.map(function(d) {
    // console.log(d.identifier);
    if ((d.identifier == "image1") && (postData.featured_image != undefined)) {
      d.structuredDataNodes = [
        {
            "type": "asset",
            "identifier": "file",
            "filePath": postData.featured_image.uri,
            "assetType": "file"
        },
        {
            "type": "text",
            "identifier": "alt",
            "text": postData.featured_image.alt
        }
      ];
    }
    if ((d.identifier == "caption") && (postData.featured_image)) {
      d.text = postData.featured_image.alt
    }
    if (d.identifier == "wysiwyg") {
      d.text = postData.content.clean
    }
  });

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

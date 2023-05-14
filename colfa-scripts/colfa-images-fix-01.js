/* Image Process Tasks:
    // refinement from HCAP tasks, only focusing on image download and content rewriting of <img> src attributes
    // we save html entity and category fixing for other steps
  0) read incoming CSV
  1) read snippet html from local disk
  2) find any <img> in snippet content
  3) download any image src references to local disk
  4) rewrite img src attributes with new upload location "/<yyyy>/images/<image-file-name>"
  5) save updated snippet content
  */
  //"Apr 18, 2022, 8:09:58 PM", we will need to parse our target date based on the current article's post date
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const https = require('https');
const http = require('http');
var fs = require('fs');
var JSSoup = require('jssoup').default;
var Stream = require('stream').Transform;
var YEAR = "2023";
const SNIPPET_HTML = "colfa/scratch-images.html";
require('dotenv').config();

const CAS_HOST = process.env.CAS_HOST;
const CAS_PORT = process.env.CAS_PORT;
const API_KEY = process.env.API_KEY;
const PAYLOAD_DOCUMENT = fs.readFileSync("json/faculty-page-minimum.json");
const GET_URI = "/api/v1/read/page/COLFA-VPAA-ASC-HALSTORE";
const POST_URI = "/api/v1/edit";
var protocol = http;
if (CAS_PORT == 443) {
  protocol = https;
}
var snippetHtml = fs.readFileSync(SNIPPET_HTML);
var soup = new JSSoup(snippetHtml, true);
var divs = soup.findAll('div');
var tasks = [];
if (divs.length > 0) {
  console.log("found: " + divs.length + " divs");
  // console.log("\tfound: " + articleImages.length + " images");
  for (let i = 0; i < divs.length; i++) {
    var delimiter = "========================";
    var item = divs[i];
    // console.log(item);
    var articleAsset = item.contents[0];
    var articleImage = item.contents[1];
    // console.log(articleImage);
    // console.log(articleImage);
    var articleImgSrc = articleImage.attrs.src;
    if (articleImgSrc.indexOf('music.utsa.edu') > 0) {
      console.log("\t\tdownload and save image: " + articleImgSrc);
      var imageName = articleImgSrc.split('/');
      // console.log(imageName.length);
      var fileName = imageName[imageName.length - 1];
      fileName = sanitizeImageName(fileName);
      var imagePath = "events/2023/images/" + fileName;
      console.log("computed image path: " + imagePath);

      if (articleImgSrc) {
          let taskData = {
            "articleImgSrc": articleImgSrc,
            "imagePath": imagePath,
            "articleAsset": articleAsset
          };
          tasks.push(taskData);
          // await grabImage(articleImgSrc, imagePath);
          // let assetObject = await updateAsset(articleAsset.string, imagePath);
          // await sendAsset(articleAsset.string, assetObject);
        // let dResult = grabImage(articleImgSrc, imagePath, articleAsset);
      }
    }
  }
}
completeTasks();

async function completeTasks() {
  for (let t of tasks) {
    await grabImage(t.articleImgSrc, t.imagePath);
    let assetObject = await updateAsset(t.articleAsset.string, t.imagePath);
    await sendAsset(t.articleAsset.string, assetObject);
  }
}

async function sendAsset(assetUrl, asset) {
  try {
    console.log("POST updated asset");
    let jsonPayload = JSON.stringify({asset: asset.asset});
    let post_promise = postAsset(assetUrl, jsonPayload);
    let postResponse = await post_promise;
    console.log("POST RESULTS");
    console.log(postResponse);
	} catch(error) {
		// Promise rejected
		console.log(error);
	}
}

async function updateAsset(assetUrl, fpath) {
  try {
    console.log("update asset now: " + assetUrl);
    console.log("attempting to GET asset: " + assetUrl);
    let asset_promise = getAsset(assetUrl);
		let asset = await asset_promise;
    console.log("asset from GET response:" + asset.success);
    asset = updateAssetData(asset, fpath);
    return asset;
	} catch(error) {
		// Promise rejected
		console.log(error);
	}
}


async function grabImage(url, fpath) {
  try {
    if (!fs.existsSync(fpath)) {
      let image_promise = getPromise(url, fpath);
      let image = await image_promise;
      console.log("attempting to save to disk:" + fpath);
      // fs.writeFileSync( fpath, image );
    } else {
      console.log("image already cached! " + fpath);
    }

    return true
  } catch (error) {
    console.log(error);
    console.log(url);
    return false
  }
}

function getPromise(url, fpath) {
  return new Promise((resolve, reject) => {
    https.get(url, function(response) {
      response.pipe(fs.createWriteStream(fpath))
      .on('error', function(e) {
        reject(e);
      })
      .once('close', function() {
        resolve(fpath);
      })
    }.end());
  });
}

async function postAsset(uri, payload) {
  //do GET
  let postOptions = {
    hostname: CAS_HOST,
    port: CAS_PORT,
    path: POST_URI,
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
  console.log(payload);
  let p = new Promise((resolve, reject) => {
		const req = protocol.request(postOptions, (response) => {
      console.log(postOptions);
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

function getAsset(uri) {
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
  return new Promise((resolve, reject) => {
		protocol.get(getOptions, (response) => {
      console.log(getOptions);
			let chunks_of_data = [];

			response.on('data', (fragments) => {
				chunks_of_data.push(fragments);
			});

			response.on('end', () => {
				let responseBody = Buffer.concat(chunks_of_data);
        let responseString = responseBody.toString();
        let responseObj = JSON.parse(responseString);
				resolve(responseObj);
			});

			response.on('error', (error) => {
				reject(error);
			});
		});
	});
}
  
function updateAssetData(obj, fpath) {
  let sdnodes = obj.asset.page.structuredData.structuredDataNodes;
  var dIdx = -1;
  for (let i = 0; i < sdnodes.length; i++) {
    if (sdnodes[i].identifier == "details") {
      dIdx = i
    }
  }
  var details = obj.asset.page.structuredData.structuredDataNodes[dIdx].text;
  details = sanitizeTextHTML(details);
  console.log("old details");
  console.log(details);
  var detailsSoup = new JSSoup(details, true);
  detailsSoup.findAll('img').map(image => {
    console.log('found image!');
    let imageSrc = image.attrs.src;
    if (imageSrc.indexOf('filedir_1') > 0) {
      image.attrs.src = "/" + fpath;
      console.log('updating image with: ' + fpath);
    }
    delete image.attrs.style;
    delete image.attrs.alt;
  });
  let newDetails = sanitizeTextHTML(detailsSoup.prettify());
  obj.asset.page.structuredData.structuredDataNodes[dIdx].text = newDetails;
  console.log("new details");
  console.log(newDetails);
  return obj;
}

function sanitizeTextHTML(inputText) {
  var contentStr = inputText.replaceAll('&euml;', '&#235;');
  contentStr = contentStr.replaceAll('<p>&#160;</p>', '');
  contentStr = contentStr.replaceAll('&rdquo;', '"');
  contentStr = contentStr.replaceAll('&ldquo;', '"');
  contentStr = contentStr.replaceAll('&nbsp;', ' ');
  contentStr = contentStr.replaceAll(/\u00a0/g, " ");
  contentStr = contentStr.replaceAll('&mdash;', '&#8212;');
  contentStr = contentStr.replaceAll('<br>', '<br/>');
  contentStr = contentStr.replaceAll('\n', '');
  return contentStr;
}

function sanitizeImageName(fileName) {
  fileName = fileName.toLowerCase()
  fileName = fileName.replaceAll('(', '');
  fileName = fileName.replaceAll(')', '');
  fileName = fileName.replaceAll('_', '-');
  fileName = fileName.replaceAll('-.', '.');
  return fileName;
}

function contentClean(content) {
  var contentStr = content.replace('&nbsp;', '&#160;');
  contentStr = contentStr.replace(/\u00a0/g, " ");
  contentStr = contentStr.replace('&mdash;', '&#8212;');
  contentStr = contentStr.replace('<br>', '<br/>');
  return contentStr;
}
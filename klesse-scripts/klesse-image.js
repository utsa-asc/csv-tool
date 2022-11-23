/* Process Tasks:
  0) read incoming CSV
  1) map authors and categories to authors and catHash hash objects (manual)
  2) parse and reformat date object (it's given to us as epoch)
  3) read snippet html from local disk
  4) find any <img> in snippet content
  5) download any image src references to local disk
  6) rewrite img src attributes with new upload location "/<yyyy>/images/<image-file-name>"
  7) save updated snippet content
  8) output new csv data with updated image URI and upload location
  9) save snippet is also trying to cleanup html entities
  */
var csv = require('fast-csv');
const {execSync} = require('child_process');
var moment = require('moment');
moment().format();
//"Apr 18, 2022, 8:09:58 PM"
const dateFormat = "MMM D, yyyy, h:mm:ss A";
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const https = require('https');
var fs = require('fs');
var JSSoup = require('jssoup').default;
var tasks = [];
var authors = {};
var categories = {};
var writableStream = fs.createWriteStream("curated.csv");
//var stream = fs.createReadStream("input.csv");
const stream = csv.format();
stream.pipe(writableStream);
headerOutput = ["id", "title", "author", "epoch", "date", "url", "categories", "slug", "image", "parentFolderPath", "snippet"];
stream.write(headerOutput);
var authors = {
  'utsaengineer': 'Klesse College',
  'rorydew': 'Rory Dew',
  'seangarnsey': 'Sean Garnsey'
};
var catHash = {
  'CACP': 'architecture-planning',
  'Civil and Environmental Engineering': 'civil-environmental-construction-management',
  'COE Announcements': ['announcement', 'klesse-college'],
  'UTSA COE': 'klesse-college',
  'Electrical and Computer Engineering': 'electrical-computer',
  'Mechanical Engineering': 'mechanical',
  'Mechanical Announcements': ['mechanical', 'announcement'],
  'Biomedical Engineering': 'biomedical-chemical'
};

writableStream.on("finish", function(){ console.log("DONE!"); });

fs.createReadStream('text-only.csv')
  .pipe(csv.parse({ headers: true }))
  .on('data', function(obj) {
    // console.log("parsing row: " + obj.id);

    var parsedData = obj;
    tasks.push(parsedData);
    // processEachTask(parsedData);
    // execSync('sleep 1'); // block process for 1 second.
  }).on("end", function() {
  /*
  Promise.all(tasks.map(processEachTask)).then(afterAllTasks);
  // async/await notation:
  // you must be in an "async" environement to use "await"
  */
  async function wrapper () {
    console.log("task count: " + tasks.length);

    for(let t of tasks) {
      await processEachTask(t);
    }
  }
  // async function return a promise transparently
  wrapper();

  console.log("waiting for tasks");

  function processEachTask(task, callback) {
    //id,title,author,epoch,date,url,categories,slug,image,snippet
    var snippetHtml = fs.readFileSync(task.snippet);
    var soup = new JSSoup(snippetHtml, false);
    //compute correct cascade paths (parentFolderPath)
    var date = moment(task.date, dateFormat);
    var year = date.year();
    var month = date.month() + 1;
    if (month < 10) {
      month = '0' + month;
    }
    task.parentFolderPath = "/news/" + year + "/" + month;

    var articleImageAnchor = soup.find('a', {'class': 'kl-blog-post-img'});
    if (articleImageAnchor) {
      var articleImage = articleImageAnchor.find('img')
      var imageSrc = articleImage.attrs.src;
      if (imageSrc) {
        console.log("download and save image: " + imageSrc);
        var imageName = imageSrc.split('/');
        // console.log(imageName.length);
        var imagePath = "images/" + imageName[imageName.length - 3] + "/" + imageName[imageName.length - 1];
        var newImageSrc = "/news/" + imageName[imageName.length - 3] + "/images/" + imageName[imageName.length - 1];
        newImageSrc = newImageSrc.toLowerCase();
        downloadImage(imageSrc, imagePath);
        articleImage.attrs.src = newImageSrc;
        articleImage.attrs.class = 'article-image';
        // console.log(articleContent.prettify());
        articleImageAnchor.replaceWith('');
        task.image = newImageSrc;
      } else {
        console.log("image not found for article: " + task.id);
      }
    } else {
      //no images
    }

    //fix image
    var articleImages = soup.findAll('img');
    if (articleImages) {
      articleImages.map(articleImage => {
        // execSync('sleep 2');
        var articleImgSrc = articleImage.attrs.src;
        var articleImgClass = articleImage.attrs.class;              
        if (articleImgSrc && !articleImgClass) {
          console.log("\t\tdownload and save image: " + articleImgSrc);
          var imageName = articleImgSrc.split('/');
          // console.log(imageName.length);
          var imagePath = "images/" + imageName[imageName.length - 3] + "/" + imageName[imageName.length - 1];
          var newImageSrc = "/news" + imageName[imageName.length - 3]  + "/images/" + imageName[imageName.length - 1];
          newImageSrc = newImageSrc.toLowerCase();
          if (articleImgSrc) {
            downloadImage(articleImgSrc, imagePath);
            console.log("setting new image src: " + newImageSrc);
            articleImage.attrs.src = newImageSrc;
          }
        }
      })
    }
    var contentPath = "curated/" + task.snippet;
    task.content = contentPath
    //fix author
    task.author = authors[task.author];

    var categories = []
    var rawCats = task.categories.split('|');
    rawCats.map(cat => {
      var newCats = catHash[cat.trim()];
      if (Array.isArray(newCats)) {
        // console.log("attempting to add new cats: " + newCats);
        newCats.map(innerCat => {
          categories.push(innerCat);
        });
      } else {
        if (typeof(newCats) != 'undefined') {
          // console.log("attempting to add new cats: " + newCats);
          categories.push(newCats);
          }
      }
    });
    if (categories.length > 0) {
      var newCats = ""
      task.categories = categories.join('|');
    } else {
      task.categories = ""
    }

    saveSnippet(soup, contentPath);

    // console.log(articleHeader.prettify());
    // console.log(articleBody.prettify())
    outputResult = [task.id, task.title, task.author, task.epoch, task.date, task.url, task.categories, task.slug, task.image, task.parentFolderPath, task.snippet];
    console.dir(outputResult);
    stream.write(outputResult);
    // console.log("authors");
    // console.log(authors);
    // console.log("categories");
    // console.log(categories);
  }
  
  function downloadImage(url, fpath) {
    if (!fs.existsSync(fpath)) {
      if (url.startsWith('https')) {
        execSync('sleep 1');
        const imgReq = https.get(url, (res) => {
          res.pipe(fs.createWriteStream(fpath));
        });
        imgReq.on('error', function(e) {
          console.error('error while fetching: ' + url + ' to path: ' + fpath);
          // console.error(e);
        });
        imgReq.end();  
      }
    } else {
      // console.log("exists!");
    }
  }
  
  function saveSnippet(content, fpath) {
    var articleStream = fs.createWriteStream(fpath);
    var contentStr = content.prettify();
    contentStr = contentStr.replace('&nbsp;', '&#160;');
    contentStr = contentStr.replace(/\u00a0/g, " ");
    contentStr = contentStr.replace('&mdash;', '&#8212;');
    contentStr = contentStr.replace('<br>', '<br/>');
    articleStream.write(contentStr);
    articleStream.end();
  }

  function afterAllTasks(err) {
    console.log("all promises complete");
  }
});

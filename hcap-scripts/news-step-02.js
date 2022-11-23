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
  var csv = require('fast-csv');
  const {execSync} = require('child_process');
  var moment = require('moment');
  moment().format();
  //"Apr 18, 2022, 8:09:58 PM", we will need to parse our target date based on the current article's post date
  const dateFormat = "M/D/YY";
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const https = require('https');
  var fs = require('fs');
  var JSSoup = require('jssoup').default;
  var tasks = [];
  var authors = {};
  var categories = {};
  var writableStream = fs.createWriteStream("hcap/hcap-news-2022-step-02.csv");
  //var stream = fs.createReadStream("input.csv");
  const stream = csv.format();
  stream.pipe(writableStream);
  // outgoing header csv (should be the same, only making modifications to snippet content and maybe imageURL)
  headerOutput = ["id", "title", "date", "permalink", "imageURL", "imageTitle", "imageAltText", "categories", "department", "status", "author", "authorEmail", "slug", "snippetURI", "contentURI"];
  stream.write(headerOutput);
  writableStream.on("finish", function(){ console.log("DONE!"); });
  
  fs.createReadStream('hcap/hcap-news-2022-step-01.csv')
    .pipe(csv.parse({ headers: true }))
    .on('data', function(obj) {
      // console.log("parsing row: " + obj.id);
      // incoming header csv:
      // id,title,date,permalink,imageURL,imageTitle,imageAltText,categories,department,status,author,authorEmail,slug,snippetURI
      // no need to remap, all our headers should be well formed
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
      console.log("attempting to read task.snippet at: " + task.snippetURI)
      // console.dir(task);
      var snippetHtml = fs.readFileSync(task.snippetURI);
      var soup = new JSSoup(snippetHtml, false);
      //compute correct cascade paths (parentFolderPath)
      // console.log("csv date: " + task.date);
      var date = moment(task.date, dateFormat);
      // console.log("parsed date: " + date);
      var year = date.year();
      var month = date.month() + 1;
      if (month < 10) {
        month = '0' + month;
      }
      task.parentFolderPath = "/news/" + year + "/" + month;
      // console.log("computed parentFolderPath:" + task.parentFolderPath);
  
      //download all images, update <img> to new upload target location
      var articleImages = soup.findAll('img');
      if (articleImages) {
        console.log("\tfound: " + articleImages.length + " images");
        articleImages.map(articleImage => {
          // execSync('sleep 2');
          var articleImgSrc = articleImage.attrs.src;
          var articleImgSrcSet = articleImage.attrs.srcset;
          var articleImgClass = articleImage.attrs.class;              
          if (articleImgSrcSet) {
            articleImgSrc = computeOriginalImageSrc(articleImgSrc);
          }
          // console.log("\t\tdownload and save image: " + articleImgSrc);
          var imageName = articleImgSrc.split('/');
          // console.log(imageName.length);
          var imagePath = "images/" + imageName[imageName.length - 3] + "/" + imageName[imageName.length - 1];
          var newImageSrc = "/news/" + imageName[imageName.length - 3]  + "/images/" + imageName[imageName.length - 1];
          newImageSrc = newImageSrc.toLowerCase();
          if (articleImgSrc) {
            downloadImage(articleImgSrc, imagePath);
            // execSync('sleep 1');
            console.log("setting new image src: " + newImageSrc);
            articleImage.attrs.src = newImageSrc;
            delete articleImage.attrs.sizes;
            delete articleImage.attrs.class;
            delete articleImage.attrs.srcset;
            delete articleImage.attrs.loading;
          }
        })
      }
      var contentPath = "curated/" + task.snippetURI;
      task.content = contentPath

      saveSnippet(soup, contentPath);
      outputResult = [task.id, task.title, task.author, task.epoch, task.date, task.url, task.categories, task.slug, task.image, task.parentFolderPath, task.snippet, task.content];
      // console.dir(outputResult);
      stream.write(outputResult);
    }
    
    function computeOriginalImageSrc(srcset) {
      console.log("\t given srcset:" + srcset);
      var result = ""
      //example srcSet: 
      //<img loading="lazy" class="alignleft size-medium wp-image-12116" 
      //  src="https://hcap.utsa.edu/wp-content/uploads/2022/03/Tori-Dickensheets-300x225.jpg" 
      //  alt="Tori Dickensheets" width="300" height="225" 
      //  srcset="https://hcap.utsa.edu/wp-content/uploads/2022/03/Tori-Dickensheets-300x225.jpg 300w, https://hcap.utsa.edu/wp-content/uploads/2022/03/Tori-Dickensheets-768x576.jpg 768w, https://hcap.utsa.edu/wp-content/uploads/2022/03/Tori-Dickensheets.jpg 800w" 
      //  sizes="(max-width: 300px) 100vw, 300px" />
      // with WordPress we can take the src attribute and remove the postfix -NNNxNNN and request the original asset that was uploaded
      // Tori-Dickensheets-300x225.jpg >> Tori-Dickensheets.jpg
      var imageNameArray = srcset.split('/');
      let imageASize = imageNameArray.length;
      var filename = imageNameArray[imageASize - 1];
      var filenameParts = filename.split('-');
      var postfix = filenameParts[filenameParts.length - 1];
      console.log("\t\t postfix: " + postfix);
      if (postfix.includes('x')) {
        if (postfix.includes('jpeg')) {
          postfix = '.jpeg';
        }
        if (postfix.includes('jpg')) {
          postfix = '.jpg';
        }
        if (postfix.includes('png')) {
          postfix = '.png';
        }
        if (postfix.includes('gif')) {
          postfix = '.gif';
        }
      } else {
        postfix = "-" + postfix;
      }
      filenameParts.splice(filenameParts.length - 1, 1);
      var originalFilename = filenameParts.join('-') + postfix;
      imageNameArray[imageASize - 1] = originalFilename;
      let newImageSrc = imageNameArray.join('/');
      return newImageSrc;
    }

    function downloadImage(url, fpath) {
      console.log("\t download: " + url);
      // console.log("saving to local path: " + fpath);
      if (!fs.existsSync(fpath)) {
        if (url.startsWith('https')) {
          const imgReq = https.get(url, (res) => {
            res.pipe(fs.createWriteStream(fpath));
          });
          imgReq.on('error', function(e) {
            console.error('error while fetching: ' + url + ' to path: ' + fpath);
            console.error(e);
          });
          imgReq.end();  
        }
      } else {
        // console.log("exists!");
      }
    }
    
    function saveSnippet(content, fpath) {
      console.log("\t\t: SAVE SNIPPET:");
      console.log("\t" + fpath);
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
  
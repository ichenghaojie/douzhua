
var exp = require('express');
var fs = require('fs');
var url = require('url');

var originRequest = require('request');

var session = require('express-session');

var cheerio = require('cheerio');

var path = require('path');

var app = exp();

function request(url, callback) {
  originRequest({
    url: url,
    method: 'GET',
    headers: {
       'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.11 Safari/537.36'
      // 'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; rv:11.0) like Gecko'
    }
  }, callback);
}

var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());


// 判断是不是请求的 zip 
app.all('*', function(req, res, next){

    var reg = /^\/download\/(.+?)\/(.+?)\/(.+?).zip/;

    if (reg.test(req.originalUrl)) {
        res.sendFile(path.join(__dirname, '../public/' + req.originalUrl), null, function (err) {

            if (err) {
                res.status(404).send('文件已经不存在, 请重新抓取。');
                return;
            } else {
                // 删除 zip 所在目录
                rmdirSync(path.join(__dirname, '../public/' + req.originalUrl.split('/').slice(0, 4).join('/')));
            }
        });
    } else {
        next();
    }
});

app.use(exp.static(path.join(__dirname, '../public')));

/*
Inline compressed javascript and css for Express on node.js.
https://github.com/ktmud/istatic
*/
var istatic = require('express-istatic');
app.locals = {
    istatic: istatic.serve({
        compress: true,
        debug: process.env.DEBUG,
        js: {
            filter: function(str) {
              return str.replace(/console.log(.+?)/, '');
            }
        }
    })
};

// var opencc = new OpenCC('t2s.json');
// opencc.setConversionMode(OpenCC.CONVERSION_FAST);

var archiver = require('archiver');

var downloadDir = path.join(__dirname, '../public/download');
var imgDir = path.join(__dirname, 'client/img/download');
var files = [];
var images = [];
var imgs = []; //页面需要的图片
var dirHost;
var dirPath;
var searchTarget;

//记录图片数量
var count = 0;
//记录页面需要的图片数量
var imgNum = 0;
// 处理请求
// app.get('/', function (req, res) {
//     res.render('index.html');
// });
app.use('/', exp.static(__dirname + '/client'));

app.post('/parse', function (req, res) {

    //在此抓取时，删掉之前的 images 目录
    if(dirPath!=null){
        rmdirSync(imgDir + '/' + dirHost + '/' + dirPath + '/images/', function (e) {
         //console.log('删除目录以及子目录成功');
        });
    }        
    
    searchTarget=req.body.target;
    count = 0;
    
    //function reqMovie(movieUrl){
    if (searchTarget === '1') {

        // console.log('抓取豆瓣相册');
        // dirPath = url.parse(req.body.url).search.split('/');
        if(req.body.url.indexOf('?')){
            reqUrl=req.body.url.split('?')[0];
        }else{
            reqUrl=req.body.url;
        }
        request(reqUrl, function (error, response, body) {
            if(error) {
                res.json({'err': true,'message': error + ''});
                return;
            }
            dirHost = url.parse(req.body.url).host;
            
            var $ = cheerio.load(body, {
            decodeEntities: false,
            xmlMode: false,
            normalizeWhitespace: false
            });
            //记录抓到了第几张图片

            // 根据网址生成图片存放目录名称
            var array = url.parse(req.body.url).path.split('/');
            
            dirPath = array[array.length - 2];
            
            if(!dirPath){
                res.json({'err': true, 'message': '请检查URL是否有误 '});
                return;
            } ;

            //删除上次打包的图片
            (images.length!=0)&&(images.length=0);

            $('.photo_wrap .photolst_photo').each(function (i, ele){
                images.push($(ele).find('img').attr('src'));
            });
            var albumTitle = $('#db-usr-profile h1').html();
            
            var sumPage = $('div.paginator>a').eq(-1).html();
            
            var sumPic = $('.paginator .count').html();
            sumPic = sumPic.substring(2,sumPic.length).substring(0,sumPic.length-1);
            sumPic = sumPic.substring(0,sumPic.length-2);
           
        
            for(var i = 1; i<sumPage; i++){
                //clearInterval(timer);
                
                var nextUrl = reqUrl + '?start=' + i*18 ;
                // var timer = setInterval(function(){
                    request(nextUrl, function(error, response, body) {
                        if(error) {
                            res.json({'err': true,'message': error + ''});
                            return;
                        }
                        var $ = cheerio.load(body, {
                            decodeEntities: false,
                            xmlMode: false,
                            normalizeWhitespace: false
                        });
                        
                        var elem = $('.photo_wrap .photolst_photo');
                        for(var j=0; j<elem.length; j++){
                            images.push($(elem[j]).find('img').attr('src'));
                            
                            // if((j == elem.length-1)&&(i == sumPage)){
                            //     downloadImg(images);
                            //     sumPage = 0;
                            // }
                            (images.length == sumPic) && (downloadImg(images), sumPage = 0) ;
                        }
                    });
                // },2000)    
            }

            function downloadImg(imgs){
                
                // console.log(imgs);
               $(imgs).each(function (i, e) {
                    var name = (i + 1) + e.substr(-4, 4);

                    autoDownloadImages(e, downloadDir, null, name, function (cb) {

                        if (cb.compelete) {
                            
                            // console.log(count, images.length);

                            
                                // console.log('下载完成, 去打包');
                                count=0;
                                zipImages( imgs, function (zipRes) {
                                    // 回调，返回前端
                                    if (zipRes.error) {
                                        res.json({'err': true, 'message': '图片打包失败'});
                                        files.length=0;
                                        return;
                                    } else {
                                        res.json({'message': albumTitle, 'downloadUrl': '/download/' + dirHost + '/' + dirPath + '/' + dirPath + '.zip'});
                                        files.length=0;
                                        count=0;
                                        return;
                                    }
                                });
                            
                        }
                    });

                });
            }   
        })

    } else if (searchTarget === '2') {
        //生成查询的URL
        reqUrl = 'http://movie.douban.com/subject_search?search_text='+req.body.url+'&cat=1002';
        

        request(reqUrl, function (error, response, body) {
            if (error) {
                // console.log(error);
                res.json({'err': true, 'message': error + ''});
                return;
            }
            var jq = cheerio.load(body, {
            // var $ = cheerio.load(opencc.convertSync(body), {
                decodeEntities: false,
                xmlMode: false,
                normalizeWhitespace: false
            });
            
            movieUrl=jq('.item .nbg').attr('href');

            //reqMovie(movieUrl);

            request(movieUrl, function (error, response, body) {
                // console.log('response', response);
                // console.log('=========');

                if (error) {
                    // console.log(error);
                    res.json({'err': true, 'message': error + ''});
                    return;
                }

                dirHost = url.parse(movieUrl).host;
                
                var cont;
                var score;
                var infoTitle;
                var infoCont;
                var picTitle;
                var picCont;
                var picPath;
                
                var $ = cheerio.load(body, {
                // var $ = cheerio.load(opencc.convertSync(body), {
                    decodeEntities: false,
                    xmlMode: false,
                    normalizeWhitespace: false
                });

            
                // console.log('抓取 playpcesor');
                // console.log(url.parse(req.body.url).path);

                // 根据网址生成图片存放目录名称
                var array = url.parse(movieUrl).path.split('/');
                dirPath = array[array.length - 2];
               
                // 根据 dirPath 以及 google-site-verification 判断所抓取的页面是否正确

                // if (!dirPath || $('meta[name="google-site-verification"]').attr('content') !== '1vxfohyVWAzpUaLYFkCircT6ybxFHttHVnr5qMhX5UQ') {
                if (!dirPath) {
                    res.json({'err': true, 'message': 'url 写错了吗?'});
                    return;
                }

                // 更改页面内容
                // $('img').removeAttr('style').removeAttr('height');
                // $('span').removeAttr('style');
                // $('.separator').addClass('image-box').removeClass('separator').removeAttr('style').find('a').removeAttr('style');
                (images.length!=0)&&(images.length=0);
                $('.related-pic-bd a').each(function (i, ele) {
                    $(ele).find('img').attr('src')&&images.push($(ele).find('img').attr('src'));
                });
                // $('.image-box').empty();
                
                score = $('#interest_sectl .rating_num').html().replace(/<br>\n<br>\n/g, '<br>').replace(/\n/g, '').replace(/\"/g, '\'');
                infoTitle = $('.related-info').find('h2').first().html().replace(/<br>\n<br>\n/g, '<br>').replace(/\n/g, '').replace(/\"/g, '\'');
                infoCont = $('#link-report').find('span').first().html().replace(/<br>\n<br>\n/g, '<br>').replace(/\n/g, '').replace(/\"/g, '\'');
                picTitle = $('.related-pic').find('h2').find('i').html().replace(/<br>\n<br>\n/g, '<br>').replace(/\n/g, '').replace(/\"/g, '\'');
                picCont = $('ul.related-pic-bd').html();
                picPath = '/' + dirHost + '/' + dirPath + '/images/';
            
                $(images).each(function (i, e) {
                    e=e.trim();
                    // if(e.substring(e.length-1,e.length)=='?'){ 
                    //     e=e.substring(0,e.length-1);
                    // }
                    if(e.indexOf('?')>-1){
                        
                        e=e.substring(0,e.indexOf('?'));
                    }
                    
                    var name = (i + 1) + e.substr(-4, 4);

                    autoDownloadImages(e, downloadDir, imgDir, name, function (cb) {

                        if (cb.compelete) {
                            // count++;
                            //  console.log(count, images.length);

                            if ((count === images.length) && (imgNum === images.length)) {
                                console.log('下载完成, 去打包');
                                count=0;
                                imgNum=0;

                                zipImages(images, function (zipRes) {
                                    // 回调，返回前端
                                    console.log('回调，返回前端');
                                    if (zipRes.error) {
                                        res.json({'err': true, 'message': '图片打包失败'});
                                        return;
                                    } else {
                                        res.json({'score':score , 'infoTitle':infoTitle,'infoCont': infoCont, 'picTitle':picTitle,'picCont':picCont, 'picPath':picPath, 'downloadUrl': '/download/' + dirHost + '/' + dirPath + '/' + dirPath + '.zip'});
                                        files.length=0;
                                        return;

                                    }
                                });
                            }
                        }
                    });

                });
            });
        });
    }
}); 


// 自动下载图片
function autoDownloadImages(url, dir, dirImg, name, callback) {
    
    
    var filePath = downloadDir + '/' + dirHost + '/' + dirPath + '/images/'  + name;

    // 创建图片目录
    mkdirs(downloadDir + '/' + dirHost + '/' + dirPath + '/images', 0, function (e) {
        // if (!e) {
        //     console.log('创建成功');
        // } else {
        //     console.log('已经创建过');
        // }
    });
    if(searchTarget==2){
        var imgPath = imgDir + '/' + dirHost + '/' + dirPath + '/images/'  + name;
        mkdirs(imgDir + '/' + dirHost + '/' + dirPath + '/images', 0, function (e) {
            // if (!e) {
            //     console.log('创建成功');
            // } else {
            //     console.log('已经创建过');
            // }
        });
    }
    

    // 抓取图片
    originRequest.head(url, function(err, res, body){
        if(searchTarget==2){
            //下载页面需要的图片
            var imgStream = fs.createWriteStream(imgPath);
            
            originRequest(url, function (error, response, body) {
                if(imgPath!=null){
                    imgs.push(imgPath);
                }
                

            }).pipe(imgStream);

            imgStream.on('close', function() {
                
                // callback({'imgCompelete': true});
                imgNum++;
                
                if ((count === images.length) && (imgNum === images.length)){
                    callback({'compelete': true});
                }
            });
        }
        //下载需要打包的图片
        var picStream = fs.createWriteStream(filePath);
        picStream.on('error', function() {
            console.log('file done');
            // images.splice(count,1);
            // filePath=null;
            return;
        });
        
        originRequest(url, function (error, response, body) {
            if(filePath!=null){
                files.push(filePath);
            }
            

        }).pipe(picStream);

        picStream.on('close', function() {
            // console.log('file done');
            count++;
            //console.log(count, images.length);
            if ((searchTarget==2) && (count === images.length) && (imgNum === images.length)){
                
                callback({'compelete': true});
            };
            if((searchTarget==1) && (count === images.length)){
                
                callback({'compelete': true});
            }
            
        });

        
    });
    

}


// 打包图片
function zipImages(images, callback) {

    // var now = new Date();

    // var year = now.getFullYear() + '';
    // var month = (now.getMonth() + 1) < 10 ? '0' + (now.getMonth() + 1) : (now.getMonth() + 1);
    // var date = now.getDate() < 10 ? '0' + now.getDate() : now.getDate();

    // // var hour = Math.floor((now / 3600) % 24);
    // console.log(year, month, date);

    var output = fs.createWriteStream(downloadDir + '/' + dirHost + '/' + dirPath + '/' + dirPath + '.zip');
    var archive = archiver('zip');
    // 打包完成
    output.on('close', function() {
        // console.log(archive.pointer() + ' total bytes');
        // console.log('archiver has been finalized and the output file descriptor has closed.');
        files.length=0;
        // 执行回调，（这里是返回前端）
        callback({'error': false});

        //打包完了之后，删掉之前的 images 目录        
        rmdirSync(downloadDir + '/' + dirHost + '/' + dirPath + '/images', function (e) {
            // console.log('删除目录以及子目录成功');
        });
    });

    archive.on('error', function(err) {
        console.log('打包错');
        callback({'error': true});
        throw err;
    });

    archive.pipe(output);

    files = files.reverse();
    for (var i = files.length - 1; i >= 0; i--) {
        //console.log(files[i]);
        if(typeof(files[i])!='string'){
            return;
        };
        archive.append(fs.createReadStream(files[i]), { name: path.basename(files[i]) });
        if(i==0){
            files.length=0;
            (images.length!=0)&&(images.length=0);
            (count!=0)&&(count=0);
        }
        
    }

    archive.finalize();
}



// 解析 url
function parseQueryString (obj) {
    var str = obj.search;
    var objURL = {};
    str.replace(
        new RegExp('([^?=&]+)(=([^&]*))?', 'g'),
        function ($0, $1, $2, $3) {
            objURL[$1] = $3;
        }
    );
    return objURL;
}


// 创建目录
function mkdirs (dirpath, mode, callback) {
    mode = mode || 0755;
    fs.exists(dirpath, function(exists) {
        if(exists) {
            callback(dirpath);
        } else {
            mkdirs(path.dirname(dirpath), mode, function(){
                fs.mkdir(dirpath, mode, callback);
            });
        }
    });
}

// 删除目录
var rmdirSync = (function () {
    function iterator(url,dirs){
        var stat = fs.statSync(url);
        if(stat.isDirectory()){
            dirs.unshift(url);//收集目录
            inner(url,dirs);
        }else if(stat.isFile()){
            fs.unlinkSync(url);//直接删除文件
        }
    }
    function inner(path,dirs){
        var arr = fs.readdirSync(path);
        for (var i = arr.length - 1; i >= 0; i--) {
            iterator(path + '/' + arr[i], dirs);
        }
        // for (var i = 0, el; el = arr[i++];) {
        //     iterator(path + '/' + el, dirs);
        // }
    }

    return function (dir, cb) {
        cb = cb || function(){};
        var dirs = [];
 
        try{
            iterator(dir,dirs);
            for (var i = dirs.length - 1; i >= 0; i--) {
                fs.rmdirSync(dirs[i]);
            }
            // for (var i = 0, el ; el = dirs[i++];) {
            //     fs.rmdirSync(el);//一次性删除所有收集到的目录
            // }
            cb();
        }catch(e) {//如果文件或目录本来就不存在，fs.statSync会报错，不过我们还是当成没有异常发生
            if (e.code === 'ENOENT') {
                cb();
            } else {
                cb(e);
            }
        }
    };
})();

app.listen(process.env.PORT || 3000);


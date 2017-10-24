    var http = require('https');
    var cheerio = require('cheerio');
    var Promise = require('bluebird');
    var url = 'https://developer.teamwork.com/';
    var fs = require('fs');

    function replaceSpecialCharscter(words) {
        //replace charscters in a readable way.
        var space = /\s+/g;
        var doubleQuotes = /&quot;/g;
        var singleQuote = /&#39;/g;
        return  words.replace(space, ' ').replace(doubleQuotes, '"').replace(singleQuote, "'").trim();
    }
    function filterData(html) {
        //get the html code of page, and extract the title.
        var $ = cheerio.load(html);
        var title = $('h2').text();
        // var test = apiMain.find('h3');
        var apiTitles = [];
        $('h3').each(function (i, elem) {
            apiTitles[i] = replaceSpecialCharscter($(this).text());
        });

        if (apiTitles) {
            return apiTitles;
        } else {
            console.log('error......');
        }
    }
    function filterModules(html) {
        //get the html of first page, extract the url of api pages.
        var $ = cheerio.load(html);
        var modules = $('.api--main').find('.lev1');
        // [{
        //     moduleTitle: '',
        //     moduleURL: ''
        // }]
        var modulesData = [];
        var module = '', moduleTitle = '', Url = '';
        modules.each(function (item) {
            module = $(this).find('a');
            moduleTitle = module.text();
            Url = module.attr('href');
            //if it is an absolute url or relative url.
            if (!Url.match('//')){
                moduleUrl = url + Url;
            } else {
                moduleUrl = Url;
            }
            modulesData.push({
                moduleTitle: moduleTitle,
                moduleUrl: moduleUrl
            });
        });

        return modulesData;
    }

    function printModuleInfo(data) {
        //out put the information, used for debug.
        var moduleTitle;
        var moduleUrl;
        var printResults = '';
        data.forEach(function (item) {
            moduleTitle = item.moduleTitle;
            moduleUrl = item.moduleUrl;
            printResults = printResults + '<' + moduleTitle + '>\n' + '  URL: ' + moduleUrl + '\n';
        });
        return printResults;
    }

    function getContents(url,title) {
        // Get the web html async by Promise, the result will be added into an array.
        return new Promise(function(resolve, reject) {
            http.get(url, function(res) {
                console.log('crawling:'+url);
                var html = '';

                res.on('data', function(data) {
                    html += data;
                });

                res.on('end', function() {
                    var finishFlag = html.match(/<\/html>/);
                    // Problem is in this block, the event 'end' could be triggered when the html if not fully got. A if statement is used to detect if it's finished.
                    if (finishFlag) {
                        console.log(title+' is finished.');
                        resolve({
                            title: title,
                            html: html
                        });
                    } else {
                        console.log(title+' is not compeleted, retrying');
                        var retry = getContents(url, title);
                        retry.then(function (data) {
                            resolve({
                                title: data.title,
                                html: data.html
                            });
                        })
                    }

                });
            }).on('error', function(e) {
                reject(e);
            });

        });
    }
    function output(path,file) {
        fs.writeFile(path, file, function (err) {
            if (err) {
                return console.log(err);
            } else {}
        });
        console.log('File is saved at: ' + path);
    }

    http.get(url, function (res) {
        var html = '';
        res.on('data', function (data) {
            html += data;
        });

        res.on('end', function () {
            // console.log(html);
            var allOriContents = [];
            var modulesData = filterModules(html);
            modulesData.forEach(function (item) {
                // console.log(item.moduleTitle);
                // No api information in introduction nor another.
                if (!(item.moduleTitle === 'Introduction' || item.moduleTitle === '3rd Party Apps')) {
                    allOriContents.push(getContents(item.moduleUrl,item.moduleTitle));
                    // console.log(allOriContents[0]);
                } else {} //else{} is essential. Otherwise the promise Objects will pending forever.
            });
            // promise need to stay inside this listener cause http is an async function.
            Promise
                .all(allOriContents)
                .then(function (obj) {
                    console.log(obj.length);
                    var modulesData = [];
                    var module;
                    var moduleData;
                    obj.forEach(function (item) {
                        module = filterData(item.html);
                        moduleData = {
                            title: item.title,
                            data: module
                        };
                        modulesData.push(moduleData);
                    });
                    // modulesData.sort(function(a, b) {
                    //     return a.title > b.title;
                    // });
                    output('./apiData.txt', JSON.stringify(modulesData, null, 2));
                })
                .catch(function (err) {
                    console.log(err);
                });
        });
    }).on('error', function () {
        console.log('There are errors when getting urls.');
    });

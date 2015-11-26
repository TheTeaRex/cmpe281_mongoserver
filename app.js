var fs = require('fs');
var https = require('https');
var express = require('express');
var bodyParser = require('body-parser');
var MongoClient = require('mongodb').MongoClient;

var app = express();
//app.use(express.bodyParser());
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

var ipUrl = "http://169.254.169.254/latest/meta-data/public-ipv4";

// getting the keys
var options = {
    key : fs.readFileSync('trendserver.key'),
    cert : fs.readFileSync('trendserver.crt')
}

var config = JSON.parse(fs.readFileSync("mongoconfig.json"));
var login = 'mongodb://'+config.host+':'+config.port+'/'+config.database
console.log(login);

var db;
var mycollection = config.collection;

MongoClient.connect(login, function(err, database){
    if (err) throw err;

    db = database;

    //app.listen(process.env.PORT || 80);
    https.createServer(options, app).listen(process.env.PORT || 443);
    console.log("MongoDB Server Started!");
});

var checkExist = function(shorturl, callback){
    var cursor = db.collection(mycollection).findOne({shorturl:shorturl}, function(err,doc){
        if (doc != null){
            callback(doc);
        } else {
            callback(null);
        }
    });
};

var insertInfo = function(data, callback){ 
    //checking to see if shorturl exist already
    input = {shorturl:data.shorturl, 
             longurl:data.longurl, 
             totalcount:1,
             users:[{IP:data.user, count:1}]}
    db.collection(mycollection).insertOne(input, function(err, data){
        if (!err){
            console.log("Inserted a new entry.");
            callback("success");
        }else{
            console.log("Error: Not able to insert!");
            callback("fail");
        }
    });
};

var updateInfo = function(data, callback) {
    //update total count
    db.collection(mycollection).update( 
        {shorturl:data.shorturl},
        {
            $inc: {
                   totalcount : 1
            }
        }, function(err, result){
            if (!err) {
                console.log("Update complete!");
                callback("success");
            } else {
                console.log("Error: Not able to update!");
                callback("fail");
            }
        }
    );
    //update user count
    db.collection(mycollection).update(
    {shorturl:data.shorturl, "users.IP":data.user},
    {
        $inc :{"users.$.count": 1}
    },function(err, result){
        result = JSON.parse(result);
        if (!err) {
            // no IP found
            if (result.nModified == '0'){
                db.collection(mycollection).update(
                    {shorturl : data.shorturl},
                    {$addToSet : {users: {IP:data.user, count:1} }},
                    function(err1, result1){
                        if (err1) {console.log("Error: Not able to update user!")};
                    });
            }
            console.log("Updated user count");
        }
        else{
            console.log("Error: Not able to update user!");
            console.log(err);
        }
    }
    );
};

var handle_post = function (req, res) {
    console.log("Post: ..." );
    console.log(req.body);
    var data = req.body;
    checkExist(req.body.shorturl,function(result){
        //no result found, so insert
        if (result == null){
            data.count = 1;
            insertInfo(data, function(state){
                res.setHeader('Content-Type', 'application/json');
                res.json({status:state});
            });
        }
        //found result, so update the count and source
        else{
            data.count = 1;
            updateInfo(data, function(state){
                res.setHeader('Content-Type', 'application/json');
                res.json({status:state});
            });
        }
    });
}

app.post("*", handle_post );
//app.listen(process.env.PORT || 80);
//https.createServer(options, app).listen(process.env.PORT || 443);

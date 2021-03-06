var express = require('express');
var app = express();
var server = require('http').createServer(app).listen(3000);
var io = require('socket.io').listen(server);
var fs = require('fs');
var request = require("request");
var path = require('path');
var async = require('async');
var parsedJSON = require('./city.json');		//városok és ID-k vannak benne
var JSONstring;									//a kiválasztott városról lekérdezett adatok vannak benne
var clients = [];
var is_client = 0;
var temperatures = [];
var dashboards = {};
var dash_id;
var AppId = "d79cb29e34ec57ae4501267d02aac6a9";
var currentDashElements = {};
var allCitiesData = {}
var currentUsedCities = {};


// Using the .html extension instead of
// having to name the views as *.ejs
app.engine('.html', require('ejs').__express);
app.use(express.static(path.join(__dirname, 'public')));


// Set the folder where the pages are kept
app.set('views', __dirname + '/views');

// This avoids having to provide the 
// extension to res.render()
app.set('view engine', 'html');


var city_id;
var ujvaltozo;  //

app.get('/', function (req, res) {
    dash_id = Math.floor((Math.random() * 100000000) + 1);
//	res.send({dashboardid: dash_id});
    app.use('/img', express.static(path.join(__dirname, 'public/assets/img')));
    res.redirect('/dash/' + dash_id);

});

app.get('/assets/img/:file', function (req, res) {

//	res.send({dashboardid: dash_id});
    app.use(express.static(path.join(__dirname, 'public/assets/img')));

});

app.get('/dash/:id', function (req, res) {
    console.log("dash" + req.params.id);

    app.use(express.static(path.join(__dirname, 'public')));


    if (dashboards[req.params.id]) {
        var choice = dashboards[req.params.id];
//		console.log(req.params.id);
    } else {
        dashboards[req.params.id] = new Array();
        choice = dashboards[req.params.id];
    }

    var showData = []
    dashboards[req.params.id].forEach(function(elem){
        console.log('elem');
        showData.push(allCitiesData[elem.cityname]);
    });
    console.log(showData);

    res.render("socket", {
        dashboardid: req.params.id,
        mydashboard: JSON.stringify(choice),
        currentDashElements: JSON.stringify(dashboards[req.params.id]),
        weatherData:JSON.stringify(showData)
    });
    // res.sendfile(__dirname + '/views/socket.html');;
});

function sleep(milliseconds) {
    var start = new Date().getTime();
    for (var i = 0; i < 1e7; i++) {
        if ((new Date().getTime() - start) > milliseconds) {
            break;
        }
    }
}

/**********************************************
 *                                            ***
 ********** FUNCTION DEFINITIONS **************
 *                                            ***
 **********************************************/

function checkUpdate(elem, cb){
    //megvizsgaljuk hogy egyaltalan lekerdeztuk-e mar az elemet
    if ( allCitiesData[elem.city.name]){
        //a valaszt osszehasonlitjuk a tarolt valtozattal
        if (JSON.stringify(allCitiesData[elem.city.name].list) == JSON.stringify(elem.list)){
            cb(false);
        } else {
            cb(true)
        }
    } else {
        cb(true)
    }

}



/*function getDataFromServer(socket, param) {

    //search city ID in city.json
    console.log('fut')
    if (typeof param.cityname === 'undefined') {
        for (var i = 0; i < parsedJSON.length; i++) {
            if (parsedJSON[i].name == param) {
//					console.log(parsedJSON[i]._id);
                city_id = parsedJSON[i]._id
            }
//				else 	console.log("nincs");
        }
    }
    else {
        for (var i = 0; i < parsedJSON.length; i++) {
            if (parsedJSON[i].name == param.cityname) {
//					console.log(parsedJSON[i]._id);
                city_id = parsedJSON[i]._id
            }
//				else 	console.log("nincs");
        }

    }
//		dashboards[data.dashboardid]=data;

    //-------------végignézi a tárolt városok listáját, és a megfelelő város id mezőjét kiválasztja-----------

    var url = "http://api.openweathermap.org/data/2.5/forecast/daily?id=" + city_id + "&appid=" + AppId;

    console.log(url);


    request({
        url: url,
        json: true
    }, function (error, response, body) {


        if (!error && response.statusCode === 200) {


            var t = new Date(body.list[0].dt * 1000);
//			var formatted = t.format("dd.mm.yyyy hh:MM:ss");


            // Print the json response
            JSONstring = JSON.stringify(body);

            //console.log(JSONstring);

            socket.emit("buildchart", JSONstring);
        }

    })
    return;
}*/

/***
 *
 * Get ALL data from server
 * periodically
 *
 ***/


function getData() {
    async.eachSeries(parsedJSON, function (city, nextCity) {
            async.series([
                function (next) {
                    city_id = city._id;
                    next();
                },
                function (next) {
                    var url = "http://api.openweathermap.org/data/2.5/forecast/daily?id=" + city_id + "&appid=" + AppId;

                    console.log(url);


                    request({
                        url: url,
                        json: true
                    }, function (error, response, body) {


                        if (!error && response.statusCode === 200) {


                            var t = new Date(body.list[0].dt * 1000);
                            //			var formatted = t.format("dd.mm.yyyy hh:MM:ss");




                            /*
                             ** EZ KÜLDI KI A KLIENSNEK AZ ADATOKAT
                             */
							 
                            //socket.emit("buildchart", JSONstring);

                            //ellenorizzuk hogy valtioztak-e az adatok az utolso lekerdezes ota
                            if(body.city.name == "Budapest I. keruelet"){
                                body.list[0].temp.day = Math.random()*100+272;
                                console.log(body.list[0].temp.day);
                            }
                            
                            // Print the json response
                            JSONstring = JSON.stringify(body);
							console.log("response")


                            checkUpdate(body, function (){
                                allCitiesData[city.name] = body;
                                //if the callback function returns true
                                if (arguments[0]){
                                   // console.log(arguments[0]);
                                   // console.log("juhuuuu");
                                   // console.log(city.name)
                                    io.to(city.name).emit('newdata', JSONstring);
                                }
                            });


                            /*
                            Itt minden egyes lekérdezéskor beküldjük az adatot (jelenleg ugyanabba) a szobába.
                             */
                            //console.log(body.list);
                            //console.log(body);




                            next();
                        }
                    })
                }
            ], nextCity);
        }, function (err) {
            if (err) {
                console.log(err);
            } else {
                console.log (allCitiesData)
            }
        }
    );
}

getData();
//setInterval(getData, 60000);

/**********************************************
 *                                            ***
 ********** MANAGE WEBSOCKETS     **************
 *                                            ***
 **********************************************/


io.sockets.on('connection', function (socket) {

    clients.push(socket);
    //---------------aktív kapcsolatok karbantartásához--------------
    console.log('Connected user is:', clients.length);
    io.sockets.emit('info', parsedJSON);  //------------ezzel tudom az összes socketnek ugyanazt kiküldeni------------


    /****** ha csak az adott socketnek szeretnem:
     socket.emit('info', { msg: Math.floor((Math.random() * 100) + 1 )});
     *******/

    socket.on("joinrequest", function(data){
        socket.join(data);
    })


        //when user pushed the "küld" button
    socket.on('newcity', function (data)			//egy ugyanilyennel nyomon lehet követni a a dashboardokat   ______
    {
        console.log("newcity")

        //Hozzáadjuk a városhoz tartozó szobához a klienst

        console.log(data);
        if(socket.rooms.includes(data)==false){
            socket.join(data);
            console.log("csatlakozott")
        }

        //!!! nodemon --harmony_array_includes app.js
        console.log(socket.rooms.includes(data));
        socket.emit("buildchart", JSON.stringify(allCitiesData[data]));
    });

    socket.on('subscribeStoredelementChanges', function(data){
        console.log("subscribe:")
        //kivalogatjuk a kulonbozo varosokat, mindet csak egyszer!
        var elements = []
        dashboards[data].forEach(function(elem){
            if(elements.includes(elem.cityname)==false){
                console.log(elem.cityname)
                elements.push(elem.cityname);
            }
        });
        console.log(elements)
        //elements tarolja a varosok neveit
        elements.forEach(function(elem){
            socket.join(elem);
        })



    })

    //when the dashboard reload

/*   socket.on('getcitynewdata', function (data)			//egy ugyanilyennel nyomon lehet követni a a dashboardokat   ______
    {

        //socket.emit('torefresh', { msg: "reggeli"});
        //console.log(data);
        //console.log("get");
        socket.emit("buildchart", JSON.stringify(allCitiesData[data]));
    });*/

    socket.on('dash', function (data) {

        var obj = {};
        obj.cityname = data.cityname;
        obj.elemid = data.elemid;
        obj.top = data.top;
        obj.left = data.left;
        obj.wrapper_height = 0;
        obj.sizestring = data.size;

        dashboards[data.id].push(obj);
        console.log('dash');

        console.log(dashboards);

        //console.log(dashboards[data.id].length);

    });

    socket.on("positions", function (data) {


            //console.log(pos.elemid);
            console.log("elemek:");
            console.log(data);
            console.log(dashboards[data[0].id].length);
            console.log(dashboards[data[0].id]);


            for (i = 0; i < dashboards[data[0].id].length; i++) {
                if (dashboards[data[0].id][i].elemid == data[i].elemid) {
                    dashboards[data[0].id][i].top = data[i].top;
                    dashboards[data[0].id][i].left = data[i].left;
                    dashboards[data[0].id][i].wrapper_height = data[i].charts;

                }
            }
        //amikor frissitettuk a poziciokat, kikuldjuk a frissitett adatokat a klienseknek
            io.to(data[0].id).emit("newPositions", JSON.stringify(dashboards[data[0].id]));

        }
    )

    socket.on("delete", function (data) {

            //console.log(data[0].id);
            //console.log(data.length);
            //console.log(dashboards[data.id].length);


            //console.log(pos.elemid);
            console.log("delete:");
            console.log(data);
            for (i = 0; i < dashboards[data.id].length; i++) {
                console.log("szaml:" + i);
                if (dashboards[data.id][i].elemid == data.elemid) {
                    console.log(dashboards[data.id][i].elemid);
                    console.log(dashboards[data.id][i]);
                    dashboards[data.id].splice([i], 1);
                    //console.log(dashboards[data.id][i]);

                }

            }
        }
    )

    socket.on('disconnect', function () {
        for (i = 0; i < clients.length; i++) {
            if (clients[i].id == socket.id) {
                clients.splice(i, 1);				//-----------------kapcsolatot bontott socket törlése a listából--------------------
            }
        }
        io.emit('user disconnected');
        console.log("disc")

    });


});

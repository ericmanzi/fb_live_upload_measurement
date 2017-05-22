// Make sure we got a filename on the command line.
if (process.argv.length < 4) {
    console.log('Usage: node ' + process.argv[1] + ' SCREENSHOTS_TIMESTAMP_FILE RTT_FILE LOG_NUM');
    // console.log('Usage: node ' + process.argv[1] + ' SCREENSHOTS_TIMESTAMP_FILE LOG_NUM');
    process.exit(1);
}

var plotter = require('./plot_metrics.js');

// Read the file and parse its contents.
var fs = require('fs');
var screenshots_filename = process.argv[2];
var rtt_filename = process.argv[3];
var log_num = process.argv[4];


var MAX_DELAY_ALLOWED = 3600; // ~1 hour
var time_played_regex = new RegExp("^(.*)_", "ig");

matchMap = {};
mismatchMap = {};
rttMap = {};
rttMap_temp = {};
rttList = [];

play_start = play_end = up_start = up_end = session_start_time = 0;

fs.readFile(screenshots_filename, 'utf8', function(err, screenshot_data) {
    if (err) throw err;
    // console.log(screenshot_data);
    parseEpochTime(screenshot_data);
    // console.log(matchMap);
    fs.readFile(rtt_filename, 'utf8', function(err, rtt_data) {
        if (err) throw err;
        parseRTTs(rtt_data);
        // console.log(rttMap)
        var streamMetrics = getStreamMetrics();
        var streamMetricsJSON = JSON.stringify(streamMetrics, null, 4);
    
        // console.log(streamMetrics);
        fs.appendFile('metrics/br_1000/cell2/all_stream_metrics_'+log_num+'.json', streamMetricsJSON, (err) => {
            if (err) throw err;
            // plot rtts
            // console.log(rttMap);
            // plotter.plotRTTs(rttMap, 'metrics/rtt_plot_'+log_num+'.png');
            // plot delay
            // plotter.plotE2Edelay(streamMetrics, 'metrics/delay_'+log_num+'.png');
            // plot upload time to download time
            // plotter.plotTimePlayedvsUploaded(streamMetrics, 'metrics/uploadVdownload_'+log_num+'.png');
        });
    }); 
});


function parseEpochTime(input) {
    var timeStampPairsList = input.split('==========');
    for (var i=0; i<timeStampPairsList.length; i++) {
        var timeStampPair = timeStampPairsList[i];
        var pairList = timeStampPair.split("@@@");
        if (pairList.length == 2) processTimestamp(pairList);
    }
    removeOutliers();
}


// download_timestamp in milliseconds, upload_timestamp in seconds
function processTimestamp(timestamps) {
    // console.log("processing timestamps:"+timestamps);
    var upload_timestamp = timestamps[0].replace(/[\n\s]/ig, "").trim();
    var play_timestamp_path = timestamps[1].replace(/[\n\s]/ig, "").trim();
    // console.log(play_timestamp_path);

    var play_timestamp_path_list = play_timestamp_path.split("/");
    // console.log(play_timestamp_path_list);

    var play_timestamp = play_timestamp_path_list[play_timestamp_path_list.length-1];
    // console.log(play_timestamp);
    var matches=[];
    while (m = time_played_regex.exec(play_timestamp)) {
        matches.push(m[1]);
    }
    // console.log(matches);
    if (matches.length === 1 && /^[0-9]{13}$/g.test(matches[matches.length-1])) { // exactly 13 digits 
        var time_played = matches[0];
        if (/^[0-9]{10}$/g.test(upload_timestamp)) { // exactly 10 digits
            matchMap[time_played] = parseInt(upload_timestamp);
        } else {
            mismatchMap[time_played] = upload_timestamp;
        }
    }
}

// remove matched timestamps where upload time is out of start-end range by more than MAX_DELAY_ALLOWED
function removeOutliers() {
    var allTimestampsMap = Object.assign(matchMap, mismatchMap);
    var played_time_sequence = Object.keys(allTimestampsMap).map((k)=>parseInt(k)).sort((a,b)=>a-b);
    var play_start_millis = played_time_sequence[0];
    var play_end_millis = played_time_sequence[played_time_sequence.length-1];
    play_start = Math.floor(play_start_millis/1000);
    play_end = Math.ceil(play_end_millis/1000);
    // up_start = matchMap.hasOwnProperty(play_start_millis) ? matchMap[play_start_millis] : getFirstMatch('forward', played_time_sequence);
    // up_end = matchMap.hasOwnProperty(play_end_millis) ? matchMap[play_end_millis] : getFirstMatch('backward', played_time_sequence);
    up_start = getFirstMatch('forward', played_time_sequence);
    up_end = getFirstMatch('backward', played_time_sequence);

    Object.keys(matchMap).forEach((time_played) => {
        var up_time = parseInt(matchMap[time_played]);
        if (play_start - up_time > MAX_DELAY_ALLOWED || up_time - play_end > MAX_DELAY_ALLOWED ||
            up_time < up_start || up_time > up_end || typeof up_time !== 'number' || !/^[0-9]{10}$/g.test(up_time+"")) {
            console.log("Deleting upload time "+up_time+" outside of accepted range. play_start:"+play_start+", play_end:"+play_end+" | up_start:"+up_start+", up_end:"+up_end+" | time_played:"+time_played);
            console.log("played_time_sequence[0]:"+played_time_sequence[0]+" | "+"played_time_sequence[played_time_sequence.length-1]:"+played_time_sequence[played_time_sequence.length-1]);
            delete matchMap[time_played];
        }
    });
}

function to3SF(somefloat) { return Math.round( somefloat * 1e3 ) / 1e3; }

function getFirstMatch(search_direction, played_time_sequence) {
    if (search_direction === 'forward') {
        for (var i=1; i<played_time_sequence.length; i++) {
            var up_time = matchMap[played_time_sequence[i]];
            if (up_time && typeof up_time === 'number') {
                return matchMap[played_time_sequence[i]];
            }
        }
    } else {
        for (var i=played_time_sequence.length-1; i>=0; i--) {
            var up_time = matchMap[played_time_sequence[i]];
            if (up_time && typeof up_time === 'number') {
                return matchMap[played_time_sequence[i]];
            }
        }
    }
}

function parseRTTs(rtt_data) {
    var rttDataList = rtt_data.split('\n').filter((l)=>l.substring(0,6)!=="Loaded");
    // console.log(rttDataList)
    for (var i=0; i<rttDataList.length; i++) {
        var rttDatum = rttDataList[i];
        var rttDatumAttributes = rttDatum.split(',');
        // if (rttDatumAttributes.length == 3) {
        var timestamp = rttDatumAttributes[1];
        var rtt = rttDatumAttributes[3];
        rttMap_temp[timestamp] = to3SF(Number(rtt));
        // }
    }
    var rttTimeStamps = Object.keys(rttMap_temp).map((k)=>parseInt(k)).sort((a,b)=>a-b);
    var firstTimeStamp = rttTimeStamps[0];
    Object.keys(rttMap_temp).forEach((timestamp) => {
        var time = Math.round((parseInt(timestamp) - firstTimeStamp)/1000);
        rttMap[time]=rttMap_temp[timestamp];
    });
    xhr_timestamp_list = Object.keys(rttMap_temp).map((time)=>parseInt(time)).sort((a,b)=>a-b);
    session_start_time = (xhr_timestamp_list[0]/1000) - rttMap_temp[xhr_timestamp_list[0]+""];

}

function getStreamMetrics() {
    var streamMetrics = {
        upload_start_time: up_start,    // time when first frame watched was uploaded
        upload_end_time: up_end,        // time when last frame watched was uploaded
        upload_duration: up_end - up_start,
        play_start_time: play_start,  // time when stream started playing on viewer's end
        play_end_time: play_end,      // time when last frame was played on viewer's end
        play_duration: play_end - play_start,
        session_start_time: session_start_time, // time when request for first video segment was issued
        startup_delay: to3SF(play_start - session_start_time), // time since the user starts the session until the video starts playing (initial buffer time)
    };

    var frameMetrics = [];

    Object.keys(matchMap).forEach(function(time_played_millis) {

        var time_played = Math.round(parseInt(time_played_millis)/1000);
        var time_uploaded = parseInt(matchMap[time_played_millis]);

        var E2Edelay = time_played - time_uploaded; // time since frame was uploaded until it is played
        var playOffset = time_played - play_start; // time since first frame was played until current frame was played
        var uploadOffset = time_uploaded - up_start; // time since first frame was uploaded until current frame was uploaded
        // A rebuffering event happens when a video segment is downloaded after it was supposed to play
        // In that case, bufferTime will be negative
        // var bufferTime = playOffset - uploadOffset;

        frameMetrics.push({
            time_played: time_played,
            time_uploaded: time_uploaded,
            e2e_delay: E2Edelay,
            play_offset: playOffset,
            uploader_offset: uploadOffset,
            // buffer_time: bufferTime,
        });
    });

    var delayList = frameMetrics.map((f)=>f.e2e_delay);

    // streamMetrics.rebuffer_rate = to3SF(frameMetrics.filter((f)=>f.buffer_time < 0).length / delayList.length);
    streamMetrics.E2E_delay = {};
    streamMetrics.E2E_delay.max= delayList.reduce((a,b)=>a>b ? a : b);
    streamMetrics.E2E_delay.min= delayList.reduce((a,b)=>a<b ? a : b);
    streamMetrics.E2E_delay.average= to3SF(delayList.reduce((a,b)=>a+b) / delayList.length);
    streamMetrics.E2E_delay.median= delayList.sort((a,b)=>a-b)[delayList.length/2];
    streamMetrics.E2E_delay.variance= to3SF(delayList.reduce((pre, cur)=>pre+Math.pow((cur-streamMetrics.E2E_delay.average), 2)) / delayList.length);
    streamMetrics.E2E_delay.std_dev= to3SF(Math.sqrt(streamMetrics.E2E_delay.variance));

    // rttList = Object.keys(rttMap).map((k)=>rttMap[k]);
    // streamMetrics.average_RTT= to3SF(rttList.reduce((a,b)=>a+b) / rttList.length);

    // streamMetrics.RTT = {};
    // streamMetrics.RTT.max= rttList.reduce((a,b)=>a>b ? a : b);
    // streamMetrics.RTT.min= rttList.reduce((a,b)=>a<b ? a : b);
    // streamMetrics.RTT.median= rttList.sort((a,b)=>a-b)[rttList.length/2];
    // streamMetrics.RTT.variance= to3SF(rttList.reduce((pre, cur)=>pre+Math.pow((cur-streamMetrics.RTT.average), 2)) / rttList.length);
    // streamMetrics.RTT.std_dev= to3SF(Math.sqrt(streamMetrics.E2E_delay.variance));


    streamMetrics.frameMetrics = frameMetrics;

    return streamMetrics;
}




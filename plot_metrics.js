/* Plotter
* https://www.npmjs.com/package/plotter
*
* dependencies: 
* brew install gnuplot
* npm install plotter
* 
*/

var plot = require('plotter').plot;

var Plotter = {

    plotRTTs: (rttMap, outputFile) => {
        plot({
            data: { 'RTT': rttMap }, //Object.keys(rttMap).map((k)=>rttMap[k]),
            filename: outputFile,
            format: 'png',
            style: 'linespoints', // lines, points, linespoints
            title: 'RTT vs download timestamp',
            xlabel: 'Frame',
            ylabel: 'rtt (milliseconds)',
            decimalsign: ',',
            hideSeriesTitle: true,
            yRange: {
                min: 0,
                max: 1000,
            },
            // yFormat: '%.2f s',
            // time: '%H:%M:%S',
            // logscale: true,
        });
    },

    plotE2Edelay: (streamMetrics, outputFile) => {
        var delayList = streamMetrics.frameMetrics.map((f)=>f.e2e_delay);
        plot({
            data: delayList,
            filename: outputFile,
            format: 'png',
            style: 'points', // lines, points, linespoints
            title: 'E2E Delay',
            xlabel: 'Time',
            ylabel: 'E2E delay (seconds)',
            xRange: {
                min: parseInt(streamMetrics.E2E_delay.min),
                max: parseInt(streamMetrics.E2E_delay.max),
            },
            yRange: {
                min: 0,
                max: 1000,
            },
            decimalsign: '.',
            hideSeriesTitle: true,
        });
    },

    plotTimePlayedvsUploaded: (streamMetrics, outputFile) => {
        var frameMetrics = streamMetrics.frameMetrics.map(function(f) {
            var time_played = (f.time_played+"").substring(6);
            var time_uploaded = (f.time_uploaded+"").substring(6);

            console.log({time_played: time_uploaded});
            return time_uploaded;
        });
        plot({
            data: frameMetrics,
            filename: outputFile,
            format: 'png',
            style: 'points', // lines, points, linespoints
            title: 'Time played vs Time uploaded',
            xlabel: 'upload time (seconds)',
            ylabel: 'time played (seconds)',
            // xRange: {
            //     min: parseInt(streamMetrics.E2E_delay.min),
            //     max: parseInt(streamMetrics.E2E_delay.max),
            // },
            // yRange: {
            //     min: 0,
            //     max: 1000,
            // },
            // decimalsign: '.',
            // hideSeriesTitle: true,
        });
    },
    

};

module.exports = Plotter;
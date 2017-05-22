#!/usr/bin/env python

# Script to plot metrics from parse_upload_timestamps.js
# usage:
# - $input_dir with stream metrics in json

import matplotlib.pyplot as plt
import numpy as np
import json
import sys
import os

input_dir = sys.argv[1]


def plot_metrics(metrics_file):
    metrics_file_name = os.path.join(input_dir, metrics_file)
    filename_split = metrics_file.split("_")
    bandwidth_temp = filename_split[len(filename_split)-1].replace(".json", "");
    bandwidth = "{0:.0f}".format(float(bandwidth_temp.replace("-", ".")))
    bitrate = filename_split[len(filename_split)-2]


    # bandwidth = "{0:.2f}".format(float(12.0/file_num))
    # plot_file = os.path.join(input_dir, "plot_wifi_%d.png" % file_num)

    plot_file = "delay_plots/plot2_br_1000_bwf_%s.png" % (bandwidth_temp.replace(".", "-"))
    f = open(metrics_file_name)
    metrics = json.load(f)
    f.close()

    frameMetrics = sorted(metrics["frameMetrics"], key=lambda k: k['time_played'])
    play_offsets = [int(frame["play_offset"]) for frame in frameMetrics]
    e2e_delays = [int(frame["e2e_delay"]) for frame in frameMetrics]
    avg_delay = "{0:.2f}".format(float(metrics["E2E_delay"]["average"]))

    startup_delay = metrics["startup_delay"]

    plt.plot(play_offsets, e2e_delays, '-bo',ms=3)
    plt.xlabel('Play offset (seconds)')
    plt.ylabel('Delay (seconds)')
    plt.title('End-to-end delay \n\n Bandwidth = %s MBps, Bitrate = %s KBps' % ('0.75', bitrate))
    # plt.title('End-to-end delay \n\n Bandwidth scale-down factor = %s , Bitrate = %s KBps' % (bandwidth, '1000'))

    plt.grid(True)

    plt.text(3, 50, " Startup delay=%d ms \n Average E2E delay=%s s" % (startup_delay, avg_delay), bbox=dict(facecolor='none', edgecolor='black'))
    plt.axis([min(play_offsets), max(play_offsets), 0, 100])
    # plt.show()
    plt.savefig(plot_file, bbox_inches='tight', dpi=300)
    # plt.savefig(plot_file)
    plt.close()



for metrics_file in os.listdir(input_dir):
    if metrics_file.endswith(".json"):
        plot_metrics(metrics_file)



# plt.legend(loc='upper center', numpoints=1, bbox_to_anchor=(0.5, -0.05), ncol=2, fancybox=True, shadow=True)

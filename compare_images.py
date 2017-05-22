#!/usr/bin/env python

# Script to find duplicate images, and use the timestamps to determine how long each frame was shown
# into jpgs. Input:
# -input_dir for jpgs.

import json
import base64
import sys
import os 


#Possible use of matplotlib from http://http://matplotlib.sourceforge.net/
from pylab import * 
import matplotlib.pyplot as plt

#More imports
from PIL import Image, ImageOps
import numpy
# import ImageOps

#ssim.py to compute SSIM
import ssim


input_dir = sys.argv[1]
timestamp_to_bytearray = {}


'''
Get 2D matrix from an image file, possibly displayed with matplotlib 
@param path: Image file path on HD
@return A 2D matrix
''' 
def build_mat_from_grayscale_image(path):
    img=Image.open(str(path))
    img=ImageOps.grayscale(img)
    imgData=img.getdata()
    imgTab=numpy.array(imgData)
    w,h=img.size
    imgMat=numpy.reshape(imgTab,(h,w))
    
    return imgMat




for file in os.listdir(input_dir):
    if file.endswith(".jpg"):
        filename = os.path.join(input_dir, file)
        timestamp = file[:13]
        imgRefMat=build_mat_from_grayscale_image(filename)
        # with open(filename, "rb") as imgFile:
            # f = imgFile.read()
            # b = base64.b64encode(f)
            # b = bytearray(f)
        timestamp_to_bytearray[timestamp] = imgRefMat




seen_frames = {}
frame_duration = {}

unsorted_timestamps = [long(timestamp) for timestamp in timestamp_to_bytearray];
sorted_timestamps = sorted(unsorted_timestamps)

last_unique_frame_index = 0

for i in xrange(len(sorted_timestamps)):
    timestamp = sorted_timestamps[i]
    prevTimestamp = sorted_timestamps[i-1]
    frame = timestamp_to_bytearray[str(timestamp)]
    prevFrame = timestamp_to_bytearray[str(prevTimestamp)]
    frame_duration[i] = max(timestamp - prevTimestamp, 0)

    cSSIM=ssim.compute_ssim(frame, prevFrame)
    if cSSIM == 1.0:
        # seen_frames[frame] = seen_frames[frame] + 1
        frame_duration[last_unique_frame_index] = sorted_timestamps[i] - sorted_timestamps[last_unique_frame_index]
    else:
        # seen_frames[frame] = 1
        last_unique_frame_index = i
        # frame_duration[i] = max(sorted_timestamps[i] - sorted_timestamps[i-1], 0)

all_durations_temp = [value for poop, value in frame_duration.iteritems()]
all_durations = all_durations_temp[2:] # ignore first two
if len(all_durations) > 1:
    average_duration = sum(all_durations)/len(all_durations)
    max_duration = max(all_durations)
    min_duration = min(all_durations)

    print all_durations
    print "average_duration"
    print average_duration
    print "max_duration"
    print max_duration
    print "min_duration"
    print min_duration

print frame_duration
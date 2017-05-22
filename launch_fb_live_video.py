import requests
import sys
import subprocess
import signal
from argparse import ArgumentParser
import time
import os
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
import platform
from pyvirtualdisplay.smartdisplay import SmartDisplay
# For debugging only
import pdb

def_chrome_bin = "/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome" if platform.system() == "Darwin" else "google-chrome" 
chromedriver_bin = os.path.join(os.getcwd(), "chromedriver-mac" if platform.system() == "Darwin" else "chromedriver-linux")
def_chrome_data_dir = os.path.join(os.getcwd(), 'chrome_data_%s/default' % ("mac" if platform.system() == "Darwin" else "linux"))

parser = ArgumentParser()
parser.add_argument("--access_token",
			help="Page access token with manage and publish pages permissions. See https://developers.facebook.com/tools/explorer and your custom app",
			default="")

parser.add_argument("--page_id",
			help="FB graph ID of the page being used",
			default="1707349429592579")

parser.add_argument("--video",
			help="Path of the video to upload",
			default="")

parser.add_argument("--chrome_bin",
			help="Path to Google Chrome binary",
			default=def_chrome_bin)

parser.add_argument("--chrome_data_dir_default",
			help="Path to the user data dir. This dir should be the result of starting chrome"
			"on an empty dir and responding to the startup dialogs. This dir is copied and not modified",
			default=def_chrome_data_dir)

parser.add_argument("--num_viewers",
			type = int,
			help="Number of viewers to spawn",
			default = 1)

parser.add_argument("--log_base",
			help="Base for logfile that each viewer writes to",
			default="logs")

parser.add_argument("--stream_bin",
			help="Location of sender binary or script",
			default="./stream.sh")

parser.add_argument("--instructions",
			help="Show instructions you need to finish before running this script",
			type=bool,
			default=False)

args = parser.parse_args()

if args.instructions:
	helpstr = ['Follow the steps below before running this script:',
			'\t1. Make sure you have a Facebook Page for which you are the admin.',
			'\t2. Make a test Facebook app as a developer and make sure you are the admin on the app.',
			'\t3. Go to \'https://developers.facebook.com/tools/explorer\', choose your app and get a page access token for your page.',
			'\t4. Request publish_pages permission for your page access token. Use the resulting access token for the access_token flag.',
			'\t5. Find your chrome binary, and from the command line execute:\n\t\t> <chrome> --user_data_dir=/tmp/my_new_dir --enable-devtools-experiments',
			'\t   where /tmp/my_new_dir is empty.',
                        '\t6. Go to Devtools > ... > Settings > Check the "Timeline recording perspectives UI" box',
			'\t7. Navigate to facebook.com and login. After successfully logging in, you can quit Chrome.',
			'\t8. Use /tmp/my_new_dir as the chrome_data_dir_default flag to this script.']
	print '\n'.join(helpstr)
	sys.exit(0)

if len(args.access_token) == 0 or len(args.video) == 0:
	print 'Incorrect usage: Both --access_token and --video are required. Use -h for usage information'
	sys.exit(1)

def startViewer(index, watchURL):
	user_data_dir = args.chrome_data_dir_default  + "_tmp" + str(index)
	rtt_file = os.path.join(args.log_base, "rtt_%d" % index)
	snapshot_file = os.path.join(args.log_base, "snapshot_%d" % index)
	debug_port = 9222 + index
	# Open a chrome window attached to a debugging port.
	os.system('rm -r %s; cp -r %s %s' % (user_data_dir, args.chrome_data_dir_default, user_data_dir))
        cmd = ' '.join(['%s' % args.chrome_bin,
                '--remote-debugging-port=%d' % debug_port,
                '--user-data-dir=%s' % user_data_dir,
                '--enable-devtools-experiments'])
        disp = SmartDisplay(visible=0,bgcolor='black')
        disp.start()
        chrome = subprocess.Popen('%s %s' % (cmd, watchURL), shell=True)
        print 'Launched chrome with: %s' % cmd
	options = Options()
        options.add_experimental_option("debuggerAddress", '127.0.0.1:%d' % debug_port)
	driver = webdriver.Chrome(chromedriver_bin, chrome_options=options)
    	print '%d Launched chromedriver' % index
	print '%d Loaded %s' % (index, watchURL)
	time.sleep(5)
	# Click the video to begin playing.
	js = "document.getElementsByTagName('video')[0].click(); document.querySelector('button[data-testid=fullscreen_control]').click()"
        driver.execute_script(js)
	# Only one client can be attached to the remote debugging port at a time.
        driver.quit()
	# Remove the driver and start a viewer to record the downloaded video.
	print '%d Quit chrome driver' % index
	time.sleep(2)
	viewer = subprocess.Popen("node record_latency.js %d %d %s %s" % (debug_port, 20, rtt_file, snapshot_file), shell=True)
        screenshot_dir = '%s/screenshots' % args.log_base
        if not os.path.exists(screenshot_dir):
	    os.makedirs(screenshot_dir)
        count = 0
        while True:
            im = disp.grab()
            count = count + 1
            #print 'c-%d' % count
            im.save('%s/%d_%d.jpg' % (screenshot_dir, long(time.time() * 1000), count))
        disp.stop()
        return [chrome, viewer]

params = {"access_token": args.access_token}
r = requests.post("https://graph.facebook.com/" + args.page_id + "/live_videos", params=params)
resp = r.json()

if r.status_code != 200:
    print 'Got status code %d: Video creation failed. Try refreshing the access token' % r.status_code
    print resp
    print r
    sys.exit(1)
if resp is None:
	print 'JSON decoding failed. Probably a bad response'
	sys.exit(1)
videoId = resp['id']
streamURL = resp['secure_stream_url']
print 'Created live broadcast %s' % videoId

r = requests.get("https://graph.facebook.com/%s" % videoId, params=params)
videoData = r.json()
if r.status_code != 200:
	print 'Video info request failed. Perhaps a bad access token'
	sys.exit(1)
if videoData is None:
	print 'JSON decoding of video data failed. Probably a bad response'
	sys.exit(1)

# Get the embedURL
embedHTML = videoData['embed_html']
embedURL = embedHTML.split('\"')[1]
print 'Got live broadcast embed info: %s' % embedURL

print 'Starting to stream: %s %s "%s"' % (args.stream_bin, args.video, streamURL) 
# Start streaming to the given URL
sender = subprocess.Popen('%s %s "%s" > /dev/null 2> /dev/null' % (args.stream_bin, args.video, streamURL), shell=True)
procs = [sender]
time.sleep(5)

def killall(procs_list):
	for x in procs_list:
		x.kill()

# Make sure that if the program is terminated, all child processes are too.
def sighandle(signal, frame):
	print 'Killing children processes...'
	killall(procs)
	sys.exit(1)
signal.signal(signal.SIGINT, sighandle)

if not os.path.exists(args.log_base):
	os.makedirs(args.log_base)
for i in xrange(args.num_viewers):
	print 'Spawning viewer %d' % i
	viewer_procs = startViewer(i, embedURL)
	time.sleep(10)
	procs.extend(viewer_procs)

sender.wait()
killall(procs[1:])

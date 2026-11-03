#!/usr/bin/env python3
"""Build manifest.json for a release: python3 make-manifest.py <raw-base-url>
e.g. https://raw.githubusercontent.com/mattygorms/shorts-recorder/main"""
import hashlib,json,re,sys,os
base=sys.argv[1].rstrip('/');here=os.path.dirname(os.path.abspath(__file__))
v=re.search(r"APP_VERSION='([^']+)'",open(os.path.join(here,'app/index.html')).read()).group(1)
files=[{'path':p,'url':f'{base}/{p}','sha256':hashlib.sha256(open(os.path.join(here,p),'rb').read()).hexdigest()} for p in ['app/index.html','server.ps1']]
json.dump({'version':v,'files':files},open(os.path.join(here,'manifest.json'),'w'),indent=2);print('manifest.json for',v)

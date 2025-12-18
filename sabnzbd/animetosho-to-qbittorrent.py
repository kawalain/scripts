"""
SABnzbd Post-Processing Script: AnimeTosho to qBittorrent Bridge

Author:
    Sangha Lee <totoriato@gmail.com>

License:
    MIT License

Description:
    This script enables cross-seeding for content downloaded via SABnzbd. 
    It is specifically designed for NZB files sourced from 'animetosho.org'.
    When a download completes, the script retrieves the original torrent file
    and adds it to qBittorrent. This allows the files downloaded from Usenet
    to be immediately seeded via BitTorrent without redownloading.

Features:
    - Automatic Detection: Identifies if an NZB originated from AnimeTosho.
    - Cross-Seeding Automation: Adds the torrent to qBittorrent pointing to the downloaded data.
    - Category Mapping: Preserves the category from SABnzbd or uses a custom override.

Environment Variables:
    [Required]
    - QBITTORRENT_USERNAME  : Username for qBittorrent Web UI.
    - QBITTORRENT_PASSWORD  : Password for qBittorrent Web UI.

    [Optional]
    - QBITTORRENT_ENDPOINT  : URL of the qBittorrent Web UI (default: http://localhost:8080).
    - QBITTORRENT_CATEGORY  : Specific category to assign in qBittorrent.
                              If unset, it defaults to the category used in SABnzbd.
    - ATQBRIDGE_LOG_LEVEL   : Python logging level (DEBUG, INFO, WARNING, ERROR).
                              (default: INFO)
    - ATQBRIDGE_UA          : Custom User-Agent string for HTTP requests.
                              (default: ATQBridge/0.1.0 SABnzbd/{SAB_VERSION})

SABnzbd Setup:
    1. Place this script in your SABnzbd 'scripts' directory.
    2. Ensure the script has executable permissions (chmod +x on Linux/macOS).
    3. In SABnzbd (Config -> Categories), assign this script to the desired category.
"""
import re
import gzip
import html
import logging
from os import environ
from sys import exit
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import build_opener, Request, HTTPCookieProcessor
from http.client import HTTPResponse
from http.cookiejar import LWPCookieJar
from xml.etree import ElementTree

script_path = Path(__file__).resolve()

logging_levels = logging.getLevelNamesMapping()
logging_level = logging_levels.get(environ.get('ATQBRIDGE_LOG_LEVEL', ''), logging.INFO)
logging.basicConfig(level=logging_level)
log = logging.getLogger(name=script_path.stem)

cookies = LWPCookieJar(script_path.with_suffix('.lwp'))
opener = build_opener(HTTPCookieProcessor(cookiejar=cookies))

default_ua = f'ATQBridge/0.1.0 SABnzbd/{environ.get('SAB_VERSION', 'unknown')}'
opener.addheaders = [('User-Agent', environ.get('ATQBRIDGE_UA', default_ua))]

try:
    cookies.load(ignore_discard=True)
except Exception:
    pass

class NZB:
    def __init__(self) -> None:
        self.id = environ.get('SAB_NZO_ID', 'nzb_no_id')
        self.path = Path(environ.get('SAB_ORIG_NZB_GZ', '')).resolve()

        with gzip.open(self.path) as f:
            self.nzb = ElementTree.fromstring(f.read())

        self.name = self.find('{*}head/{*}meta[@type="title"]').text or self.path.name
        self.url = self.find('{*}head/{*}meta[@type="x-info-url"]').text

    def find(self, path: str):
        element = self.nzb.find(path)
        if element is None:
            raise KeyError(f'Unable to find {path}')
        return element

class QBittorrent:
    # https://github.com/qbittorrent/qBittorrent/wiki/WebUI-API-(qBittorrent-5.0)

    def __init__(self) -> None:
        self.endpoint = environ.get('QBITTORRENT_ENDPOINT', 'http://localhost:8080') + '/api/v2'

    def login(self):
        url = f'{self.endpoint}/auth/login'
        data = urlencode({
            'username': environ.get('QBITTORRENT_USERNAME', ''),
            'password': environ.get('QBITTORRENT_PASSWORD', '')
        })

        request = Request(url, method='POST', data=data.encode())
        request.add_header('Content-Type', 'application/x-www-form-urlencoded')
        
        try:
            response = opener.open(request)
            if not isinstance(response, HTTPResponse):
                raise TypeError(f'Unexpected response type: {type(response)}')
        except HTTPError as e:
            if e.code == 403:
                raise RuntimeError('IP banned') from e
            raise

        body = response.read().decode()
        if not body.startswith('Ok'):
            raise RuntimeError(f'Unexpected response body: {body}')

        try:
            cookies.save(ignore_discard=True)
        except Exception:
            log.exception('Failed to save cookie file')

    def add_torrent(self, data: dict, can_retry = True):
        url = f'{self.endpoint}/torrents/add'

        request = Request(url, method='POST', data=urlencode(data).encode())
        request.add_header('Content-Type', 'application/x-www-form-urlencoded')

        try:
            response = opener.open(request)
            if not isinstance(response, HTTPResponse):
                raise TypeError(f'Unexpected response type: {type(response)}')
        except HTTPError as e:
            if e.code == 403:
                if can_retry:
                    self.login()
                    self.add_torrent(data, False)
                    return
            raise

        body = response.read().decode()
        if not body.startswith('Ok'):
            raise RuntimeError(f'Unexpected response body: {body}')

match environ.get('SAB_STATUS', '').lower():
    case 'completed' | 'running':
        pass
    case 'failed':
        log.debug('Ignoring failed nzb')
        exit(0)
    case _ as status:
        log.error(f'Unexpected job status: {status}')
        exit(1)

try:
    nzb = NZB()
except Exception:
    log.exception('Failed to initialize NZB')
    exit(1)

if not nzb.url or not nzb.url.startswith('https://animetosho.org'):
    log.debug(f'Unsupported URL: {nzb.url}')
    exit(0)

log.info(f'Parsed NZB from {nzb.path}')
log.info(f'\turl = {nzb.url}')
log.info(f'\tname = {nzb.name}')

try:
    qb: QBittorrent = QBittorrent()
except Exception:
    log.exception('Failed to initialize qBittorrent API')
    exit(1)

try:
    response = opener.open(nzb.url)
    if not isinstance(response, HTTPResponse):
        raise TypeError(f'Unexpected response type: {type(response)}')

    if not (200 <= response.status < 300):
        raise RuntimeError(f'Unexpected status code: {response.status}')

    body = response.read().decode()
    match = re.search(r'"(https://animetosho\.org/storage/torrent/.+?\.torrent)"', body)
    if not match:
        raise RuntimeError(f'unexpected response: {response.url}')

    torrent_url = html.unescape(match[1])
    log.info(msg=f'\t{torrent_url}')
except Exception:
    log.exception('Failed to retrieve torrent URL')
    exit(1)

try:
    data = {
        'urls': torrent_url,
        'category': environ.get('QBITTORRENT_CATEGORY', environ.get('SAB_CAT'))
    }

    if not data['category']:
        del data['category']
    
    if 'SAB_COMPLETE_DIR' in environ:
        complete_dir = Path(environ['SAB_COMPLETE_DIR'])
        files = [*complete_dir.glob('*')]
        if len(files) == 1:
            log.info(f'Single file found; setting save path to {complete_dir.name}')
            if files[0].stem != complete_dir.name:
                log.warning(f'Filename mismatch: {files[0].name}')
            data['savepath'] = complete_dir.name

    qb.add_torrent(data)
except Exception:
    log.exception('Failed to add torrent to qBittorrent')
    exit(1)

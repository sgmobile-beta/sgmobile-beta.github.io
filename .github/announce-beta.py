"""Post the latest verified public Beta changelog in one Discord message."""

import argparse
from hashlib import sha256
import json
import os
from pathlib import Path
import re
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

SITE = Path(__file__).resolve().parent.parent / 'site'
ORIGIN = 'https://sgmobile-beta.github.io'
PLAY_URL = ORIGIN + '/golf.html?hd=0&mobile=1'


def live_file(name):
    request = Request(f'{ORIGIN}/{name}', headers={'Cache-Control': 'no-cache'})
    with urlopen(request, timeout=20) as response:
        return response.read()


def make_announcement(reviewed_sha, *, mention_everyone=False):
    manifest = (SITE / 'release.json').read_bytes()
    if sha256(manifest).hexdigest() != reviewed_sha or live_file('release.json') != manifest:
        raise ValueError('The requested manifest is not the package currently served by Beta.')

    installer = live_file('local-install.js')
    manifest_entry, = [entry for entry in json.loads(manifest)['files']
                       if entry['path'] == 'local-install.js']
    if len(installer) != manifest_entry['bytes'] or sha256(installer).hexdigest() != manifest_entry['sha256']:
        raise ValueError('The live changelog does not match the verified manifest.')

    match, = re.findall(rb'^  const publicChangelog = (\{[^\r\n]+\});$', installer, re.M)
    changelog = json.loads(match)
    release = changelog['release']
    section = changelog['sections'][0]
    if not re.fullmatch(r'Beta [0-9]+\.[0-9]+\.[0-9]+', release) or section['title'] != f'{release} update':
        raise ValueError('The latest changelog section does not match its Beta release label.')

    blocks = []
    for kind, text in section['blocks']:
        if kind in ('ul', 'ol'):
            lines = [
                f'{i}. {item}' if kind == 'ol' else f'- {item}'
                for i, item in enumerate(text, start=1)
            ]
            blocks.append('\n'.join(lines))
        elif kind in ('p', 'h2', 'h3'):
            blocks.append(text)
        else:
            raise ValueError(f'Unsupported changelog section block: {kind}')
    description = '\n\n'.join(blocks)
    if not description or len(description.encode('utf-16-le')) // 2 > 4096:
        raise ValueError('The rendered changelog must fit in one Discord embed.')

    return {
        'content': ('@everyone\n' if mention_everyone else '') +
                   f'**SGMobile {release} is live!**\n[Play SGMobile Beta]({PLAY_URL})',
        'allowed_mentions': {'parse': ['everyone'] if mention_everyone else []},
        'embeds': [{'title': section['title'], 'description': description}],
    }


def discord_json(request, failure):
    try:
        with urlopen(request, timeout=20) as response:
            return json.load(response)
    except HTTPError as error:
        raise SystemExit(f'{failure} Discord returned HTTP {error.code}.') from None
    except (URLError, TimeoutError, ValueError):
        raise SystemExit(failure) from None


def post(announcement):
    allowed = announcement.get('allowed_mentions')
    if allowed not in ({'parse': []}, {'parse': ['everyone']}):
        raise ValueError('Expected an explicit, bounded mention policy.')
    expected_mention = allowed == {'parse': ['everyone']}
    webhook = os.environ.get('DISCORD_BETA_WEBHOOK_URL', '')
    if not re.fullmatch(r'https://discord\.com/api/(?:v10/)?webhooks/[0-9]+/[A-Za-z0-9_\-]+', webhook):
        raise ValueError('DISCORD_BETA_WEBHOOK_URL must be a Discord channel webhook URL.')

    headers = {'User-Agent': 'SGMobile-Beta-Release/1.0'}
    target = discord_json(Request(webhook, headers=headers), 'Could not verify the Discord webhook channel.')
    guild, channel = (target.get(key, '') for key in ('guild_id', 'channel_id'))
    if target.get('type') != 1 or not all(isinstance(value, str) and value.isdecimal() for value in (guild, channel)):
        raise ValueError('Expected an incoming webhook for a Discord server channel.')

    request = Request(
        webhook + '?wait=true',
        data=json.dumps(announcement, ensure_ascii=False).encode(),
        headers={**headers, 'Content-Type': 'application/json'},
        method='POST',
    )
    message = discord_json(request, 'Discord did not confirm delivery. Check the channel before retrying.')
    message_id = message.get('id', '')
    if message.get('channel_id') != channel or not isinstance(message_id, str) or not message_id.isdecimal():
        raise SystemExit('Discord returned an incomplete receipt. Check the channel before retrying.')
    print(f'Discord message https://discord.com/channels/{guild}/{channel}/{message_id}')
    if message.get('mention_everyone') is not expected_mention or message.get('mentions') or message.get('mention_roles'):
        raise SystemExit('The post was sent, but Discord did not confirm the requested mention policy. Check the channel before retrying.')
    print('Discord confirmed the @everyone mention.' if expected_mention else
          'Discord confirmed delivery with no everyone, user or role mentions.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--preview', action='store_true', help='Render the verified post locally without sending it.')
    args = parser.parse_args()
    try:
        mention_setting = os.environ.get('DISCORD_MENTION_EVERYONE', 'false')
        if mention_setting not in ('true', 'false'):
            raise ValueError('DISCORD_MENTION_EVERYONE must be true or false.')
        announcement = make_announcement(os.environ.get('REVIEWED_MANIFEST_SHA256'),
                                         mention_everyone=mention_setting == 'true')
        if args.preview:
            print(json.dumps(announcement, ensure_ascii=False, indent=2))
        else:
            post(announcement)
    except (ValueError, URLError) as error:
        raise SystemExit(str(error)) from None


if __name__ == '__main__':
    main()

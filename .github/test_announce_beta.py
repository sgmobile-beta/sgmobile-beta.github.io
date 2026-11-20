"""No network or real credential is used by these announcement policy tests."""
import contextlib
from hashlib import sha256
import importlib.util
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('announce_beta', Path(__file__).with_name('announce-beta.py'))
a = importlib.util.module_from_spec(spec)
spec.loader.exec_module(a)


class AnnouncementPolicy(unittest.TestCase):
    def make(self, **kwargs):
        notes = {'release': 'Beta 1.0.55', 'sections': [{'title': 'Beta 1.0.55 update',
                 'blocks': [['ul', ['Native bench search repair', 'Zoom allocation reduction; phone retest pending']]]}]}
        installer = ('  const publicChangelog = ' + json.dumps(notes) + ';\n').encode()
        manifest = json.dumps({'files': [{'path': 'local-install.js', 'bytes': len(installer),
                                         'sha256': sha256(installer).hexdigest()}]}).encode()
        with tempfile.TemporaryDirectory() as folder:
            Path(folder, 'release.json').write_bytes(manifest)
            with patch.object(a, 'SITE', Path(folder)), patch.object(a, 'live_file',
                    side_effect=lambda name: {'release.json': manifest, 'local-install.js': installer}[name]):
                return a.make_announcement(sha256(manifest).hexdigest(), **kwargs)

    def test_default_cannot_ping(self):
        message = self.make()
        self.assertEqual(message['allowed_mentions'], {'parse': []})
        self.assertNotIn('@everyone', message['content'])
        self.assertNotIn('@here', message['content'])
        self.assertIn('phone retest pending', message['embeds'][0]['description'])

    def test_ping_requires_explicit_option(self):
        message = self.make(mention_everyone=True)
        self.assertEqual(message['allowed_mentions'], {'parse': ['everyone']})
        self.assertEqual(message['content'].count('@everyone'), 1)

    def send(self, mention=False, mentions=None, roles=None):
        message = self.make()
        receipt = {'id': '30', 'channel_id': '20', 'mention_everyone': mention,
                   'mentions': mentions or [], 'mention_roles': roles or []}
        with patch.dict(os.environ, {'DISCORD_BETA_WEBHOOK_URL': 'https://discord.com/api/webhooks/10/unit-test-token'}), \
             patch.object(a, 'discord_json', side_effect=[{'type': 1, 'guild_id': '15', 'channel_id': '20'}, receipt]) as send, \
             contextlib.redirect_stdout(io.StringIO()) as output:
            a.post(message)
            self.assertEqual(json.loads(send.call_args_list[1].args[0].data)['allowed_mentions'], {'parse': []})
            return output.getvalue()

    def test_receipt_confirms_no_mentions(self):
        self.assertIn('no everyone, user or role mentions', self.send())

    def test_unexpected_mass_mention_is_not_reported_as_success(self):
        with self.assertRaises(SystemExit):
            self.send(mention=True)

    def test_unexpected_user_or_role_mention_is_not_reported_as_success(self):
        for kwargs in ({'mentions': [{'id': '5'}]}, {'roles': ['8']}):
            with self.subTest(kwargs=kwargs), self.assertRaises(SystemExit):
                self.send(**kwargs)

    def test_invalid_policy_stops_before_network(self):
        with patch.object(a, 'discord_json') as send, self.assertRaises(ValueError):
            a.post({'content': 'hello', 'allowed_mentions': {'parse': ['users']}})
        send.assert_not_called()

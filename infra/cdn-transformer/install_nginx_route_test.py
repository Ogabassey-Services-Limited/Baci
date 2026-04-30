import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch


def load_module():
    module_path = Path(__file__).with_name('install-nginx-route.py')
    if not module_path.exists():
        raise FileNotFoundError(f'Missing install-nginx-route.py at {module_path}')

    spec = importlib.util.spec_from_file_location('install_nginx_route', module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f'Unable to load install-nginx-route.py from {module_path}')

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class InstallNginxRouteTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.module = load_module()

    def test_find_marker_index_ignores_indentation(self):
        config = 'server {\n    # Images - auto-serve WebP if supported\n}\n'

        self.assertEqual(self.module.find_marker_index(config), len('server {\n'))

    def test_configure_paths_updates_symlink_target_without_replacing_link(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            available = root / 'sites-available'
            enabled = root / 'sites-enabled'
            backup = root / 'backup'
            available.mkdir()
            enabled.mkdir()

            target = available / 'cdn.ogabassey.com'
            link = enabled / 'cdn.ogabassey.com'
            target.write_text(
                'server {\n'
                '    listen 443 ssl;\n'
                '    # Images - auto-serve WebP if supported\n'
                '}\n',
                encoding='utf-8',
            )
            link.symlink_to(target)

            with patch.object(self.module, 'validate_nginx_or_restore'):
                self.module.configure_paths([link], backup)

            self.assertTrue(link.is_symlink())
            self.assertTrue(backup.exists())
            updated_text = target.read_text(encoding='utf-8')
            self.assertIn('location ^~ /image/', updated_text)
            self.assertIn('# Images - auto-serve WebP if supported', updated_text)
            self.assertEqual(len(list(backup.iterdir())), 1)

    def test_validate_nginx_or_restore_restores_original_config_on_timeout(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            config = Path(temp_dir) / 'cdn.ogabassey.com'
            original_text = 'server {\n    # Images - auto-serve WebP if supported\n}\n'
            config.write_text('server {\n    location ^~ /image/ {}\n}\n', encoding='utf-8')
            file_stat = config.stat()
            timeout = subprocess.TimeoutExpired(
                cmd=['nginx', '-t'],
                timeout=self.module.nginx_test_timeout_seconds,
                output='partial stdout',
                stderr='partial stderr',
            )

            with patch.object(self.module.subprocess, 'run', side_effect=timeout):
                with self.assertRaises(SystemExit) as raised:
                    self.module.validate_nginx_or_restore(
                        config,
                        original_text,
                        file_stat,
                    )

            message = str(raised.exception)
            self.assertIn('nginx -t timed out', message)
            self.assertIn('partial stdout', message)
            self.assertIn('partial stderr', message)
            self.assertEqual(config.read_text(encoding='utf-8'), original_text)


if __name__ == '__main__':
    unittest.main()

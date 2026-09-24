"""Source integrity tests; no external services or production data are mutated."""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('seed', Path(__file__).resolve().parents[1] / 'scripts/chile-seed-independencia.py')
seed = importlib.util.module_from_spec(spec)
spec.loader.exec_module(seed)


class IndependenciaSourceTests(unittest.TestCase):
    def test_failed_refresh_keeps_old_timestamp_and_payload(self):
        previous = {'sources': {'weather': {'status': 'ok', 'fetchedAt': '2026-01-01T08:00:00Z', 'observedAt': '2026-01-01T07:45:00Z', 'data': {'temperature': 19}, 'url': 'https://example.org'}}}
        def fail():
            raise TimeoutError('private upstream diagnostic should not be published')
        result = seed.collect_source('weather', fail, previous)
        self.assertEqual(result['status'], 'error')
        self.assertEqual(result['fetchedAt'], previous['sources']['weather']['fetchedAt'])
        self.assertEqual(result['observedAt'], previous['sources']['weather']['observedAt'])
        self.assertEqual(result['data'], {'temperature': 19})
        self.assertEqual(result['error'], 'TimeoutError')

    def test_first_failure_does_not_invent_zero(self):
        def fail():
            raise ValueError('missing data')
        result = seed.collect_source('weather', fail, {})
        self.assertIsNone(result['data'])
        self.assertIsNone(result['fetchedAt'])

    def test_commune_match_does_not_confuse_street_names(self):
        self.assertTrue(seed.matches_commune('Recoleta, Independencia'))
        self.assertFalse(seed.matches_commune('Avenida Independencia'))
        self.assertFalse(seed.matches_commune('Santiago'))

    def test_cut_alias_does_not_double_count_or_include_regional_totals(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            row = {'comuna': 'Independencia', 'n_exp': 55, 'n_obs': 51, 'n_exp_pac': 2, 'region_n_obs': 126019}
            (path/'ficha-comuna.json').write_text(json.dumps({'by_comuna': {'13108': row, 'independencia': row}}))
            (path/'brief-territorial.json').write_text(json.dumps({'hechos': [{'comuna': 'Santiago', 'proyecto': 'Obra vecina'}, {'comuna': 'Independencia', 'proyecto': 'Obra comunal', 'fecha': '2026-01-01'}]}))
            result = seed.territory(path)['data']
            self.assertEqual(result['expedientes'], 55)
            self.assertEqual(result['observations'], 51)
            self.assertEqual([f['title'] for f in result['facts']], ['Obra comunal'])
            self.assertIsNone(result['projectsObservedAt'])

    def test_wrong_commune_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            (path/'ficha-comuna.json').write_text(json.dumps({'by_comuna': {'13108': {'comuna': 'Recoleta'}}}))
            with self.assertRaises(ValueError):
                seed.territory(path)

    def test_atomic_output_is_valid_and_readable(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/'independencia.json'
            seed.write_atomic(path, {'commune': 'Independencia', 'data': None})
            self.assertEqual(json.loads(path.read_text())['data'], None)
            self.assertEqual(path.stat().st_mode & 0o777, 0o644)
            self.assertEqual(len(list(Path(directory).iterdir())), 1)

    def test_missing_weather_value_is_not_zero(self):
        for invalid in [None, float('nan'), float('inf'), '0', True]:
            with self.assertRaises(ValueError):
                seed.finite(invalid)


if __name__ == '__main__':
    unittest.main()

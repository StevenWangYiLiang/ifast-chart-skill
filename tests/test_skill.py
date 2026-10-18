import copy
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT/'skills/ifast-charts'
EXAMPLE = json.loads((SKILL/'examples/mock-data.json').read_text(encoding='utf-8'))


class PortableSkillTests(unittest.TestCase):
    def run_example(self, spec, size='medium', palette=None):
        work = Path(self.addCleanup_directory())
        source = work/'input.json'
        source.write_text(json.dumps(spec, ensure_ascii=False), encoding='utf-8')
        out = work/'out'
        args = [shutil.which('node'), str(SKILL/'scripts/render.mjs'), '--spec', str(source), '--out', str(out), '--size', size, '--python', sys.executable]
        if palette:
            theme_path = work/'other-theme.json'
            theme_path.write_text(json.dumps(palette), encoding='utf-8')
            args.extend(['--theme', str(theme_path)])
        result = subprocess.run(args, capture_output=True, text=True, encoding='utf-8')
        return result, out

    def addCleanup_directory(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        return directory.name

    def assert_valid(self, result, out):
        self.assertEqual(result.returncode, 0, result.stdout+result.stderr)
        checked = subprocess.run([sys.executable, str(SKILL/'scripts/verify.py'), str(out)], capture_output=True, text=True, encoding='utf-8')
        self.assertEqual(checked.returncode, 0, checked.stdout+checked.stderr)

    def test_three_chart_types_and_physical_sizes(self):
        for size, dimensions in [('large', (19, 9)), ('medium', (13, 9)), ('small', (9, 6))]:
            result, out = self.run_example(EXAMPLE, size)
            self.assert_valid(result, out)
            spec = json.loads((out/'normalized.json').read_text(encoding='utf-8'))
            self.assertEqual((spec['charts'][0]['size']['width'], spec['charts'][0]['size']['height']), dimensions)

    def test_large_units_null_gap_and_zero_series(self):
        spec = copy.deepcopy(EXAMPLE)
        chart = spec['charts'][0]
        chart['axes'] = [{'unit': '点'}]
        chart['series'] = [{'name': 'large', 'values': [120000, 190000, None, 220000, 200000, 180000]}, {'name': 'zero', 'values': [0]*6}]
        spec['charts'] = [chart]
        result, out = self.run_example(spec)
        self.assert_valid(result, out)
        data = json.loads((out/'normalized.json').read_text(encoding='utf-8'))['charts'][0]
        self.assertEqual(data['axisDisplays'][0]['unit'], '万点')
        self.assertIsNone(data['values'][0][2])

    def test_unknown_units_and_invalid_data(self):
        spec = copy.deepcopy(EXAMPLE)
        spec['charts'][0]['axes'][1]['unit'] = None
        result, out = self.run_example(spec)
        self.assert_valid(result, out)
        self.assertIn('未注明', (out/'trend.svg').read_text(encoding='utf-8'))
        spec['charts'][0]['series'][0]['values'] = [1]
        result, _ = self.run_example(spec)
        self.assertNotEqual(result.returncode, 0)

    def test_new_theme_and_all_zero_data(self):
        spec = copy.deepcopy(EXAMPLE)
        chart = spec['charts'][0]
        chart['axes'] = [{'unit': '点'}]
        chart['series'] = [{'name': 'zero', 'values': [0]*6}]
        spec['charts'] = [chart]
        palette = json.loads((SKILL/'assets/themes/ifast.json').read_text(encoding='utf-8'))
        palette.update(id='other', name='Other')
        palette['categorical'][0] = '#224466'
        result, out = self.run_example(spec, palette=palette)
        self.assert_valid(result, out)
        data = json.loads((out/'normalized.json').read_text(encoding='utf-8'))
        self.assertEqual(data['theme']['name'], 'Other')
        self.assertEqual(data['charts'][0]['colors'][0], '#224466')
        self.assertEqual(data['charts'][0]['size']['width'], 13)


if __name__ == '__main__':
    unittest.main()

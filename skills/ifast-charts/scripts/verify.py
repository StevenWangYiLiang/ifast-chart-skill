"""Validate package outputs and native chart/data references, not visual appearance."""
import hashlib
import json
import math
import sys
import zipfile
import xml.etree.ElementTree as E
from pathlib import Path


def verify(directory):
    root = Path(directory)
    manifest = json.loads((root/'manifest.json').read_text(encoding='utf-8-sig'))
    spec = json.loads((root/'normalized.json').read_text(encoding='utf-8'))
    for name, digest in manifest['artifacts'].items():
        assert Path(name).name == name, 'Artifact paths must stay within the output directory.'
        assert hashlib.sha256((root/name).read_bytes()).hexdigest() == digest, f'Hash mismatch: {name}'
    s = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main', 'c': 'http://schemas.openxmlformats.org/drawingml/2006/chart', 'd': 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing'}
    if 'xlsx' in spec['formats']:
        with zipfile.ZipFile(root/'charts.xlsx') as z:
            workbook = E.fromstring(z.read('xl/workbook.xml'))
            assert [v.get('name') for v in workbook.findall('s:sheets/s:sheet', s)] == [c['sheet'] for c in spec['charts']]
            native = sorted((n for n in z.namelist() if n.startswith('xl/charts/chart') and n.endswith('.xml')), key=lambda n: int(Path(n).stem[5:]))
            assert len(native) == len(spec['charts'])
            assert not any(n.startswith('xl/externalLinks/') for n in z.namelist())
            a = {'a': 'http://schemas.openxmlformats.org/drawingml/2006/main', **s}
            for index, (name, expected) in enumerate(zip(native, spec['charts']), 1):
                chart = E.fromstring(z.read(name))
                title = ''.join(chart.find('c:chart/c:title', s).itertext())
                assert title == expected['title']
                worksheet = E.fromstring(z.read(f'xl/worksheets/sheet{index}.xml'))
                cells = {c.get('r'): c for c in worksheet.findall('s:sheetData/s:row/s:c', s)}
                data_start = math.ceil((expected['size']['heightPx']+20)/20)+3
                for j, values in enumerate(expected['values']):
                    for i, value in enumerate(values):
                        cell = cells.get(f'{chr(67+j)}{data_start+i+2}')
                        stored = None if cell is None else cell.find('s:v', s)
                        if value is None:
                            assert stored is None, 'Missing source values must remain blank, not zero.'
                        else:
                            assert stored is not None and math.isclose(float(stored.text), value, rel_tol=1e-12, abs_tol=1e-12)
                assert chart.find('c:chart/c:legend/c:legendPos', s).get('val') == 'b'
                series = chart.findall('.//c:ser', s)
                assert len(series) == len(expected['names'])
                for node, values in zip(series, expected['values']):
                    cached = {int(pt.get('idx')): float(pt.find('c:v', s).text) for pt in node.findall('c:val/c:numRef/c:numCache/c:pt', s)}
                    for i, value in enumerate(values):
                        if value is not None:
                            assert i in cached and math.isclose(cached[i], value, rel_tol=1e-12, abs_tol=1e-12)
                    formula = node.find('c:val/c:numRef/c:f', s).text
                    assert expected['sheet'].replace("'", "''") in formula and '[' not in formula
                if expected.get('dates'):
                    axes = chart.findall('c:chart/c:plotArea/c:dateAx', s)
                    assert axes and axes[0].find('c:majorTimeUnit', s).get('val') == 'years'
                for axis in chart.findall('c:chart/c:plotArea/c:valAx', s):
                    lo = float(axis.find('c:scaling/c:min', s).get('val'))
                    hi = float(axis.find('c:scaling/c:max', s).get('val'))
                    step = float(axis.find('c:majorUnit', s).get('val'))
                    assert lo <= 0 <= hi and 4 <= round((hi-lo)/step)+1 <= 7
    if 'svg' in spec['formats']:
        for c in spec['charts']:
            svg = E.parse(root/(c['id']+'.svg')).getroot()
            assert svg.get('width') == f"{c['size']['width']}cm" and svg.get('height') == f"{c['size']['height']}cm"
            ticks = svg.findall('.//*[@data-date]')
            if c.get('dates'):
                assert len(ticks) == len(c['yearTicks']) and all(t.get('data-date').endswith('-01-01') for t in ticks)
    return f"PASS: {len(spec['charts'])} chart(s), hashes, chart-only sheets, native source bindings, cached numeric values and structural format checks. Visual rendering remains a separate check."


if __name__ == '__main__':
    print(verify(sys.argv[1]))

"""Portable native XLSX chart exporter; no platform-private runtime required."""
import json
import math
import sys
from datetime import datetime
from pathlib import Path

import xlsxwriter


def export(spec_path, output_path):
    spec = json.loads(Path(spec_path).read_text(encoding='utf-8'))
    theme = spec['theme']
    family = theme['typography']['cjk']
    colors = theme['colors']
    workbook = xlsxwriter.Workbook(output_path)
    font = {'name': family, 'size': 9, 'color': colors['mutedText']}
    base = workbook.add_format({'font_name': family, 'font_size': 9, 'font_color': colors['text']})
    number = workbook.add_format({'font_name': family, 'font_size': 9, 'num_format': '0.0000'})
    date_format = workbook.add_format({'font_name': family, 'font_size': 9, 'num_format': 'yyyy-mm-dd'})
    header = workbook.add_format({'font_name': family, 'font_size': 9, 'bold': True, 'bg_color': colors['primary'], 'font_color': '#FFFFFF', 'text_wrap': True, 'valign': 'vcenter'})
    note = workbook.add_format({'font_name': family, 'font_size': 9, 'text_wrap': True, 'valign': 'vcenter'})
    display_units = {10000: 'ten_thousands', 1000000: 'millions', 100000000: 'hundred_millions', 1000000000000: 'trillions'}
    for chart in spec['charts']:
        sheet = workbook.add_worksheet(chart['sheet'])
        sheet.hide_gridlines(2)
        sheet.set_default_row(15)
        sheet.set_column(0, 0, 2, base)
        sheet.set_column(1, 1, 17, base)
        sheet.set_column(2, len(chart['names']) + 1, 22, number)
        size = chart['size']
        start = math.ceil((size['heightPx'] + 20) / 20) + 3
        source = chart['source']
        last_column = len(chart['names']) + 1
        sheet.merge_range(start-2, 1, start-2, max(3, last_column), f"来源：{source['label']}；截止时点：{source['as_of']}", note)
        sheet.set_row(start-2, 28)
        if chart.get('note'):
            sheet.merge_range(start-1, 1, start-1, max(3, last_column), chart['note'], note)
            sheet.set_row(start-1, 28)
        sheet.write_string(start, 1, '日期 / 类别', header)
        for j, name in enumerate(chart['names'], 2):
            sheet.write_string(start, j, name, header)
        sheet.set_row(start, 30)
        for i, label in enumerate(chart['labels'], start+1):
            if chart.get('dates'):
                sheet.write_datetime(i, 1, datetime.strptime(label, '%Y-%m-%d'), date_format)
            else:
                sheet.write_string(i, 1, label, base)
            for j, values in enumerate(chart['values'], 2):
                if values[i-start-1] is None:
                    sheet.write_blank(i, j, None, number)
                else:
                    sheet.write_number(i, j, values[i-start-1], number)
        chart_type = 'line' if chart['type'] == 'line' else 'column'
        options = {'type': chart_type}
        if chart['type'] == 'stack':
            options['subtype'] = 'stacked'
        native = workbook.add_chart(options)
        for j, name in enumerate(chart['names']):
            series = {'name': [chart['sheet'], start, j+2], 'categories': [chart['sheet'], start+1, 1, start+len(chart['labels']), 1], 'values': [chart['sheet'], start+1, j+2, start+len(chart['labels']), j+2], 'y2_axis': chart['axes'][j] == 1}
            color = chart['colors'][j]
            if chart_type == 'line':
                series.update(line={'color': color, 'width': 1.5}, marker={'type': 'none'})
            else:
                series.update(fill={'color': color}, border={'none': True}, gap=100)
                if chart['type'] == 'stack':
                    series['overlap'] = 100
                    series['data_labels'] = {'value': True, 'position': 'center', 'num_format': '0%' if chart['axisDisplays'][0]['percentFraction'] else chart['axisDisplays'][0]['numberFormat'], 'font': {'name': family, 'size': 9, 'color': colors['text'] if color.lower() == colors['accent'].lower() else '#FFFFFF'}}
            native.add_series(series)
        native.set_title({'name': chart['title'], 'name_font': {'name': family, 'size': 12, 'bold': True, 'color': colors['text']}})
        native.set_legend({'position': 'bottom', 'font': {**font, 'color': colors['text']}})
        native.set_chartarea({'border': {'none': True}, 'fill': {'color': '#FFFFFF'}})
        native.set_plotarea({'border': {'none': True}, 'fill': {'color': '#FFFFFF'}})
        native.show_blanks_as('gap')
        x_axis = {'num_font': font, 'major_tick_mark': 'outside', 'line': {'color': colors['mutedText']}, 'label_position': 'low'}
        if chart.get('dates'):
            first = datetime.strptime(chart['dates'][0], '%Y-%m-%d')
            x_axis.update(date_axis=True, min=datetime(first.year, 1, 1), max=datetime.strptime(chart['dates'][-1], '%Y-%m-%d'), major_unit=1, major_unit_type='years', num_format='yy' if size['name'] == 'small' else 'yyyy')
        native.set_x_axis(x_axis)
        if len(chart['scales']) == 2:
            native.set_x2_axis({**x_axis, 'visible': False})
        for a, scale in enumerate(chart['scales']):
            display = chart['axisDisplays'][a]
            axis = {'min': scale['min'], 'max': scale['max'], 'major_unit': scale['step'], 'num_font': font, 'num_format': display['numberFormat'], 'line': {'none': True}, 'major_tick_mark': 'none', 'name': display['unit'], 'name_font': {**font, 'rotation': 0}, 'name_layout': {'x': .04 if a == 0 else .88, 'y': .10}, 'major_gridlines': {'visible': a == 0, 'line': {'color': colors['grid'], 'width': .5}}}
            if display['factor'] > 1:
                axis.update(display_units=display_units[display['factor']], display_units_visible=False)
            (native.set_y_axis if a == 0 else native.set_y2_axis)(axis)
        native.set_size({'width': size['widthPx'], 'height': size['heightPx']})
        sheet.insert_chart('B2', native, {'object_position': 3})
    workbook.close()


if __name__ == '__main__':
    export(sys.argv[1], sys.argv[2])

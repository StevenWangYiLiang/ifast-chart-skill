# Repository rules

- Keep the skill portable. No machine-specific paths, proprietary runtime imports, credentials, original research workbooks or bundled fonts.
- `skills/ifast-charts/assets/standards.json` owns common formatting; theme files own colors only.
- Preserve numeric data, explicit units and missing values. Do not silently infer units or market conventions.
- Native XLSX charts must reference plotting cells on their own chart worksheet.
- Run `python -m unittest discover -s tests -v` after changes. Windows Excel visual checks are additional and must not be implied by structural tests.
- Use only clearly marked simulated data in examples and public previews.

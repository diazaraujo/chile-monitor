import csv
import importlib.util
import tempfile
import unittest
from pathlib import Path
spec = importlib.util.spec_from_file_location('validator', Path(__file__).parents[1] / 'scripts/chile-validate-operational.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class OperationalTest(unittest.TestCase):
    def validate(self, kind, values, duplicate=False, extra=False):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'synthetic.csv'
            fields = m.COMMON + m.FIELDS[kind] + (['nombre_persona'] if extra else [])
            base = ['sintetico-1','unidad-demo','2026-01-01','2026-01-01T12:00:00Z','fuente-demo']
            with path.open('w', newline='') as stream:
                writer=csv.writer(stream); writer.writerow(fields);writer.writerow(base+values)
                if duplicate:writer.writerow(base+values)
            return m.validate(kind,path)
    def test_valid_aggregate_and_duplicate_rejection(self):
        self.assertTrue(self.validate('turnos',['vehiculo','horas','10','8'])['valid'])
        self.assertFalse(self.validate('turnos',['vehiculo','horas','10','8'],duplicate=True)['valid'])
    def test_extra_fields_rejected(self):
        with self.assertRaises(ValueError):self.validate('turnos',['vehiculo','horas','10','8','persona'],extra=True)
    def test_nonfinite_and_inconsistent_assets_rejected(self):
        self.assertFalse(self.validate('suministros',['producto-demo','unidad','nan','2'])['valid'])
        self.assertFalse(self.validate('activos',['camara','10','9','2'])['valid'])
    def test_close_requires_evidence(self):
        self.assertFalse(self.validate('compromisos',['compromiso-demo','cerrado','unidad-demo','2026-01-02','pendiente'])['valid'])
        self.assertTrue(self.validate('compromisos',['compromiso-demo','cerrado','unidad-demo','2026-01-02','acta-demo'])['valid'])

if __name__=='__main__':unittest.main()

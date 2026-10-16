"""Check the declared payment field/loader contract without installing Odoo."""
import importlib.util
import sys
import types
import unittest
from unittest.mock import patch

from test_client import ADDON


class TestPaymentIdentity(unittest.TestCase):
    def test_payment_identity_is_a_normal_unique_field_and_never_replaces_load_all_with_one_field(self):
        class LoadMixin:
            fields_to_load = []
            def _load_pos_data_fields(self, config):
                return self.fields_to_load

        fake = types.ModuleType("odoo")
        fake.api = types.SimpleNamespace(model=lambda function: function)
        fake.fields = types.SimpleNamespace(Char=lambda **kwargs: kwargs)
        fake.models = types.SimpleNamespace(Model=LoadMixin, Constraint=lambda sql, message: sql)
        spec = importlib.util.spec_from_file_location("almond_payment_identity_test", ADDON / "models/pos_payment.py")
        module = importlib.util.module_from_spec(spec)
        with patch.dict(sys.modules, {"odoo": fake}):
            spec.loader.exec_module(module)
        Payment = module.PosPayment
        self.assertFalse(Payment.almond_redemption_id["copy"])
        self.assertEqual(Payment._uniq_almond_redemption_id, "UNIQUE(almond_redemption_id)")
        payment = Payment()
        self.assertEqual(payment._load_pos_data_fields(None), [])
        payment.fields_to_load = ["amount", "payment_method_id"]
        self.assertEqual(payment._load_pos_data_fields(None), ["amount", "payment_method_id", "almond_redemption_id"])

# Scheduled Actions (Cron Jobs)

Source: `addons/mail/data/ir_cron_data.xml`, `addons/odoo` branch `19.0`.

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <data noupdate="1">
        <record forcecreate="True" id="ir_cron_mail_scheduler_action" model="ir.cron">
            <field name="name">Mail: Email Queue Manager</field>
            <field name="model_id" ref="model_mail_mail"/>
            <field name="state">code</field>
            <field name="code">model.process_email_queue(batch_size=1000)</field>
            <field name="user_id" ref="base.user_root"/>
            <field name="interval_number">1</field>
            <field name="interval_type">hours</field>
            <field name="priority">6</field>
        </record>

        <record id="ir_cron_module_update_notification" model="ir.cron">
            <field name="name">Publisher: Update Notification</field>
            <field name="model_id" ref="model_publisher_warranty_contract"/>
            <field name="state">code</field>
            <field name="code">model.update_notification(None)</field>
            <field name="user_id" ref="base.user_root" />
            <field name="interval_number">1</field>
            <field name="interval_type">weeks</field>
            <field name="nextcall" eval="(DateTime.now() + timedelta(days=7)).strftime('%Y-%m-%d %H:%M:%S')" />
            <field name="priority">1000</field>
        </record>

        <record id="ir_cron_mail_gateway_action" model="ir.cron">
            <field name="name">Mail: Fetchmail Service</field>
            <field name="model_id" ref="model_fetchmail_server"/>
            <field name="state">code</field>
            <field name="code">model._fetch_mails()</field>
            <field name="interval_number">5</field>
            <field name="interval_type">minutes</field>
            <!-- Active flag is set on fetchmail_server.create/write -->
            <field name="active" eval="False"/>
        </record>
    </data>
</odoo>
```

Source: `addons/project/data/ir_cron_data.xml`.

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo noupdate="1">
    <record id="ir_cron_rating_project" model="ir.cron">
        <field name="name">Project Stage: Send rating</field>
        <field name="model_id" ref="project.model_project_task_type"/>
        <field name="state">code</field>
        <field name="code">model._send_rating_all()</field>
        <field name="interval_type">days</field>
    </record>
</odoo>
```

The model method this cron actually calls (`addons/project/models/project_task_type.py`):

```python
def _send_rating_all(self):
    stages = self.search([
        ('rating_active', '=', True),
        ('rating_status', '=', 'periodic'),
        ('rating_request_deadline', '<=', fields.Datetime.now())
    ])
    for stage in stages:
        stage.project_ids.task_ids._send_task_rating_mail()
        stage._compute_rating_request_deadline()
        self.env.cr.commit()
```

## Key takeaways

- `state` is always `'code'` for a Python-executing cron; the `code` field
  runs with `model` and `env` already in scope — no import needed.
- `model_id` uses `ref="model_<technical_name>"` (Odoo auto-generates one
  `ir.model` external id per model, dots replaced by underscores; add the
  `module.` prefix only when referencing a model defined in another module).
- `interval_number` / `interval_type` — always set both explicitly in new
  code, even though core itself sometimes omits `interval_number` (defaults
  to `1`).
- `active eval="False"` ships a cron disabled by default — use this when the
  cron shouldn't run unconditionally (e.g. only relevant once a feature is
  configured).
- `noupdate="1"` on the `<odoo>`/`<data>` wrapper means the record's field
  values won't be overwritten on module upgrade if the user already edited
  them from the UI — standard for cron/data records the user is expected to
  be able to reconfigure.
- `self.env.cr.commit()` inside the loop is a deliberate pattern for
  long-running batch jobs so a crash partway through doesn't roll back
  everything already processed. Only acceptable inside cron/batch code.

## Template for a new cron

```xml
<record id="ir_cron_process_pending" model="ir.cron">
    <field name="name">My Module: Process Pending Records</field>
    <field name="model_id" ref="model_my_module_my_model"/>
    <field name="state">code</field>
    <field name="code">model._process_pending()</field>
    <field name="interval_number">1</field>
    <field name="interval_type">hours</field>
    <field name="user_id" ref="base.user_root"/>
</record>
```

```python
def _process_pending(self):
    """Called by ir_cron_process_pending. Batches and commits per record
    so a mid-run failure doesn't lose already-processed work."""
    pending = self.search([('state', '=', 'pending')])
    for record in pending:
        record._do_process()
        self.env.cr.commit()
```

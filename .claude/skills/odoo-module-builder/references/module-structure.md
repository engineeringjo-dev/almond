# Module Structure & Manifest

Source: `addons/utm/__manifest__.py` in `github.com/odoo/odoo`, branch `19.0`.
A small, self-contained core module — good skeleton to copy for a new addon.

```python
# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'UTM Trackers',
    'category': 'Marketing',
    'description': """
Enable management of UTM trackers: campaign, medium, source.
""",
    'version': '1.1',
    'depends': ['base', 'web'],
    'data': [
        'data/utm_medium_data.xml',
        'data/utm_source_data.xml',
        'data/utm_stage_data.xml',
        'data/utm_tag_data.xml',
        'views/utm_campaign_views.xml',
        'views/utm_medium_views.xml',
        'views/utm_source_views.xml',
        'views/utm_stage_views.xml',
        'views/utm_tag_views.xml',
        'views/utm_menus.xml',
        'security/ir.model.access.csv',
    ],
    'demo': [
        'data/utm_campaign_demo.xml',
        'data/utm_stage_demo.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'utm/static/src/**/*',
        ],
    },
    'author': 'Odoo S.A.',
    'license': 'LGPL-3',
}
```

## Directory layout that matches this manifest

```
utm/
├── __init__.py
├── __manifest__.py
├── models/
│   ├── __init__.py
│   └── utm_tag.py
├── security/
│   └── ir.model.access.csv
├── views/
│   ├── utm_tag_views.xml
│   └── utm_menus.xml
├── data/
│   └── utm_tag_data.xml
└── static/
    └── src/
```

## Recommended `data` load order (matches core convention)

Odoo loads `data` files strictly top-to-bottom, so anything a later file
references (an XML id, a model, a group) must be defined earlier in the list.

```python
'data': [
    'security/<module>_groups.xml',      # res.groups / res.groups.privilege first
    'security/ir.model.access.csv',      # then ACLs (needs groups to exist)
    'security/ir_rule.xml',              # then record rules
    'data/ir_cron_data.xml',             # scheduled actions
    'data/ir_action_data.xml',           # server actions
    'views/<model>_views.xml',           # form/list/search/kanban + act_window
    'views/menus.xml',                   # menuitems (needs actions to exist)
],
```

## Manifest template for a brand-new module

```python
# -*- coding: utf-8 -*-
{
    'name': '{Module Title}',
    'version': '19.0.1.0.0',
    'category': '{Category}',
    'summary': '{One-line summary}',
    'description': """
{Longer description}
    """,
    'author': '{Author}',
    'website': '{Website}',
    'license': 'LGPL-3',
    'depends': ['base'],
    'data': [
        'security/ir.model.access.csv',
        'views/{model_name}_views.xml',
        'views/menus.xml',
    ],
    'demo': [],
    'installable': True,
    'application': False,
    'auto_install': False,
}
```

`'version'` prefix must match the target Odoo series (`19.0.x.y.z`,
`18.0.x.y.z`, ...) — the platform reads only the first two numbers to decide
compatibility.

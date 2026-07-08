{
    'name': "Almond Branch (multi-POS dimension)",
    'version': '19.0.1.0.0',
    'category': 'Point of Sale',
    'summary': "Group multiple POS shops into one Branch dimension for dashboard filtering",
    'description': """
Almond Branch
=============
Adds an ``almond.branch`` dimension that groups several ``pos.config`` shops
(e.g. "Mecca Street" + "Mecca Street 2") into one physical branch, so a single
dashboard **Global Filter (Relation)** can span all POS of a branch in one click.

The branch is propagated to ``pos.order`` as a **stored + indexed** related field
and injected into the ``report.pos.order`` SQL view, which also removes the
per-row hop through ``pos.config`` that slowed the dashboards.

Nothing here connects to an external service. Read the design at
``docs/odoo/branch-filter-design.md``.
""",
    'author': "Almond",
    'license': 'LGPL-3',
    'depends': ['point_of_sale'],
    'data': [
        'security/almond_branch_security.xml',
        'security/ir.model.access.csv',
        'views/almond_branch_views.xml',
        'views/pos_config_views.xml',
    ],
    'post_init_hook': 'post_init_map_branches',
    'application': False,
    'installable': True,
    'auto_install': False,
}

import logging

_logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Single source of truth: which POS shop belongs to which physical branch.
#
# Keys   = the EXACT pos.config.name as it appears in Odoo (case sensitive).
# Values = a stable branch key; two shops sharing a key are merged into ONE branch
#          (e.g. "Mecca Street" + "Mecca Street 2" -> one "Mecca Street" branch).
#
# Confirmed from the live fleet (read-only introspection): 14 POS shops across
# 4 companies collapse into 9 branches; every "…2" pair is within one company.
# Unmapped configs are SKIPPED, never guessed.
# ---------------------------------------------------------------------------
POS_TO_BRANCH = {
    # Evora food and beverage co
    'Mecca Street':     'mecca_street',
    'Mecca Street 2':   'mecca_street',
    'Madinah street':   'madinah_street',
    'Madinah street 2': 'madinah_street',
    'event':            'event',
    # Leria for Food and Beverages CO
    'Al-Rabieh':        'al_rabieh',
    'Al-Rabieh 2':      'al_rabieh',
    'Khalda':           'khalda',
    # Almond coffee restaurant
    '8th Circle':       '8th_circle',
    '8th Circle 2':     '8th_circle',
    # Italian Corner Company
    'City Mall':        'city_mall',
    'AL-Jamah Street':  'al_jamah_street',
    'shafa badran':     'shafa_badran',
    'shafa badran 2':   'shafa_badran',
}

# Human-readable branch names (branch key -> display name).
BRANCH_NAMES = {
    'mecca_street':   'Mecca Street',
    'madinah_street': 'Madinah Street',
    'event':          'Event',
    'al_rabieh':      'Al-Rabieh',
    'khalda':         'Khalda',
    '8th_circle':     '8th Circle',
    'city_mall':      'City Mall',
    'al_jamah_street': 'Al-Jamah Street',
    'shafa_badran':   'Shafa Badran',
}


def post_init_map_branches(env):
    """Create branches from POS_TO_BRANCH and link each pos.config to its branch.

    Idempotent: a branch is matched by (name, company) and reused if it exists.
    Setting pos.config.branch_id triggers the stored related recompute on
    pos.order, so existing orders inherit their branch automatically.
    """
    Branch = env['almond.branch'].sudo()
    Config = env['pos.config'].sudo()

    mapped, skipped = 0, []
    branch_cache = {}          # (branch_key, company_id) -> almond.branch record
    configs_by_branch = {}     # branch.id -> [config ids]

    for pos_name, branch_key in POS_TO_BRANCH.items():
        configs = Config.search([('name', '=', pos_name)])
        if not configs:
            skipped.append(pos_name)
            continue

        # A shop name could in theory exist in more than one company; each match
        # is mapped to a branch scoped to its own company.
        for config in configs:
            company = config.company_id
            cache_key = (branch_key, company.id)
            branch = branch_cache.get(cache_key)
            if not branch:
                branch_name = BRANCH_NAMES.get(branch_key, branch_key)
                branch = Branch.search([
                    ('name', '=', branch_name),
                    ('company_id', '=', company.id),
                ], limit=1)
                if not branch:
                    branch = Branch.create({
                        'name': branch_name,
                        'company_id': company.id,
                    })
                branch_cache[cache_key] = branch
            configs_by_branch.setdefault(branch.id, []).append(config.id)
            mapped += 1

    # One write per branch (not per config) -> fewer stored-related recompute passes.
    for branch_id, config_ids in configs_by_branch.items():
        Config.browse(config_ids).write({'branch_id': branch_id})

    # Fast, single-statement backfill of the stored pos.order.branch_id column.
    # The stored-related recompute above already covers this, but on a large fleet
    # (~10^5 pos.order rows) one SQL UPDATE is the cheap, authoritative finaliser;
    # it is idempotent (IS DISTINCT FROM guard) and a no-op once already consistent.
    env.cr.execute("""
        UPDATE pos_order o
           SET branch_id = c.branch_id
          FROM pos_config c
         WHERE c.id = o.config_id
           AND o.branch_id IS DISTINCT FROM c.branch_id
    """)
    env['pos.order'].invalidate_model(['branch_id'])

    _logger.info(
        "almond_branch: mapped %s POS shop(s) into %s branch(es); skipped (not found): %s",
        mapped, len(branch_cache), skipped or "none",
    )

import logging

_logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Single source of truth: which POS shop belongs to which physical branch.
#
# Keys   = the EXACT pos.config.name as it appears in Odoo (case sensitive).
# Values = a stable branch key; two shops sharing a key are merged into ONE branch
#          (e.g. "Mecca Street" + "Mecca Street 2" -> one "Mecca Street" branch).
#
# ⚠️ TO CONFIRM on dev-almond before deploy: these names are our best guess from
#    prior discussion. Run tuanle /odoo (read-only) to list the real pos.config
#    names, then correct this map. Unmapped configs are SKIPPED, never guessed.
# ---------------------------------------------------------------------------
POS_TO_BRANCH = {
    'Mecca Street':     'mecca_street',
    'Mecca Street 2':   'mecca_street',
    '8th Circle':       '8th_circle',
    '8th Circle 2':     '8th_circle',
    # ... add the remaining shops here once confirmed on dev ...
    'event':            'event',
}

# Human-readable branch names (branch key -> display name).
BRANCH_NAMES = {
    'mecca_street': 'Mecca Street',
    '8th_circle':   '8th Circle',
    'event':        'Event',
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
    branch_cache = {}  # (branch_key, company_id) -> almond.branch record

    for pos_name, branch_key in POS_TO_BRANCH.items():
        config = Config.search([('name', '=', pos_name)], limit=1)
        if not config:
            skipped.append(pos_name)
            continue

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

        if config.branch_id != branch:
            config.branch_id = branch.id
        mapped += 1

    _logger.info(
        "almond_branch: mapped %s POS shop(s) into %s branch(es); skipped (not found): %s",
        mapped, len(branch_cache), skipped or "none",
    )

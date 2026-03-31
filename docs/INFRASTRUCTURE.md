# Multi-Tenant Infrastructure (Self-Hosted Supabase on Azure VM)

**Supabase** runs self-hosted on Azure VM (`104.214.186.142`) via Docker Compose at `~/supabase/docker`.

## PostgREST Schema Exposure (Automatic)

PostgREST 13.0.7 is configured with **in-database config** — new company schemas are automatically exposed to the API when a company is created. No manual VM access needed.

**How it works:**
1. Company created in admin portal → `createCompanySchema()` runs
2. Schema created in PostgreSQL (tables, indexes, RLS) ✓
3. Schema name inserted into `pgrst_config.db_schemas` table ✓
4. `NOTIFY pgrst, 'reload config'` sent → PostgREST picks up new schema instantly ✓

**VM `.env` config (one-time, already set):**
```
PGRST_DB_SCHEMAS=${PGRST_DB_SCHEMAS}        # base list (fallback)
PGRST_DB_PRE_CONFIG=pgrst_config.pre_config  # enables in-database config
```

**Database objects (already created):**
- `pgrst_config.db_schemas` table — stores all exposed schema names
- `pgrst_config.pre_config()` function — called by PostgREST on startup + config reload

**Verify schemas exposed:**
```sql
SELECT string_agg(schema_name, ', ' ORDER BY schema_name) FROM pgrst_config.db_schemas;
```

**If PostgREST needs manual restart** (e.g. after VM reboot):
```bash
ssh -i supabase-vm-key.pem azureuser@104.214.186.142
cd ~/supabase/docker
docker compose restart rest
```

**Setup reference:** `backend/config/pgrst-config-setup.sql` — run this if rebuilding VM from scratch.

## SSH Access to Azure VM

- Key file: `supabase-vm-key.pem` (in local `azurevm/` folder)
- NSG rule: SSH port 22 restricted to specific source IP — update NSG if your IP changes
- Default user: `azureuser`

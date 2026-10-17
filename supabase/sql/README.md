# Supabase SQL — Green Wonderland

This directory contains **historical database setup scripts, migrations, and follow-up patches** for the deployed POS. It is not a complete, ordered, idempotent migration chain.

## Folders

- **`history/`** — early one-off setup, fixes, and audit scripts that were formerly scattered across the repository root. Their original names and contents were preserved.
- **`*.sql` in this directory** — dated later patches for employee management, sales, loyalty, permissions, receipt persistence, and offers.

## Before applying SQL

1. Take a backup and review the current database schema/functions.
2. Identify whether the target changes were **already applied** in the live Supabase project.
3. Inspect the actual SQL and the permissions of `SECURITY DEFINER` functions. Never run the entire directory as a batch.
4. Prefer a fresh, reviewed migration for any new change instead of editing an already-applied script.

**Caution:** Some entries have `-FIXED` counterparts or may not reflect the latest production stored function definitions. Preserve them as historical references; do not assume that their filename indicates whether they are safe to run.

The October 17 multi-product special and POS deals updates were deployed to Supabase directly and may not appear as a standalone SQL file here. Consult the deployed database and migration history before replaying older offer scripts.

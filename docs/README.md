# JCN Financial Dashboard – Documentation Index

**Version:** 1.2.0  
**Last Updated:** February 18, 2026  
**Status:** Production-ready

Use this index so another AI or developer can onboard and find every procedure and reference.

---

## Quick links

| Document | Purpose | Audience |
|----------|---------|----------|
| [../CHECKPOINT_v1.2.0.md](../CHECKPOINT_v1.2.0.md) | Current release snapshot; rollback point | All |
| [../CHECKPOINTS.md](../CHECKPOINTS.md) | All checkpoint tags and rollback commands | All |
| [../README.md](../README.md) | Repo entry point, quick start, API list | All |
| [../ARCHITECTURE.md](../ARCHITECTURE.md) | High-level structure, config, endpoints | Devs |
| [../TECH_STACK.md](../TECH_STACK.md) | Stack breakdown, versions, data sources | Devs |
| [../DATA_FLOW.md](../DATA_FLOW.md) | How data moves through the system | Devs |
| [../BUILDING_GUIDE.md](../BUILDING_GUIDE.md) | How to add pages and API endpoints | Devs |
| [PROCEDURES.md](./PROCEDURES.md) | Deploy, rollback, env, DB helpers | DevOps, Devs |
| [MOTHERDUCK_INTEGRATION.md](./MOTHERDUCK_INTEGRATION.md) | DB connection, schema, .US handling, caching | Devs |
| [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) | Vercel deploy, monitoring, rollback | DevOps |
| [STREAMLIT_REFERENCE_REBUILD.md](./STREAMLIT_REFERENCE_REBUILD.md) | Streamlit → Vercel rebuild rules | Devs |

---

## By topic

### Database and backend

- **Connection and schema:** [MOTHERDUCK_INTEGRATION.md](./MOTHERDUCK_INTEGRATION.md) – PROD_EODHD tables (including PROD_OBQ_Scores, PROD_OBQ_Momentum_Scores), symbol format, connection pattern, caching.
- **API surface:** [../ARCHITECTURE.md](../ARCHITECTURE.md) – Endpoints and request/response behavior.
- **Procedures:** [PROCEDURES.md](./PROCEDURES.md) – Env vars, DB helper scripts (`scripts/describe_score_tables.py`, `scripts/check_fundamentals_data.py`).

### Frontend and product

- **Page order and modules:** [../CHECKPOINT_v1.2.0.md](../CHECKPOINT_v1.2.0.md) – Persistent Value page section order and what each module does.
- **Adding features:** [../BUILDING_GUIDE.md](../BUILDING_GUIDE.md).

### Deployment and operations

- **Deploy and rollback:** [PROCEDURES.md](./PROCEDURES.md), [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md).
- **Checkpoints:** [../CHECKPOINTS.md](../CHECKPOINTS.md) – Tags and how to revert.

### Reference

- **Streamlit parity:** [STREAMLIT_REFERENCE_REBUILD.md](./STREAMLIT_REFERENCE_REBUILD.md).
- **Portfolio Performance table:** [PORTFOLIO_PERFORMANCE_TABLE.md](./PORTFOLIO_PERFORMANCE_TABLE.md).
- **Portfolio Allocation:** [PORTFOLIO_ALLOCATION.md](./PORTFOLIO_ALLOCATION.md).
- **Caching:** [CACHING_STRATEGY.md](./CACHING_STRATEGY.md), [CACHING_SYSTEM_DEEP_EXPLANATION.md](./CACHING_SYSTEM_DEEP_EXPLANATION.md).
- **SWR:** [SWR_IMPLEMENTATION_GUIDE.md](./SWR_IMPLEMENTATION_GUIDE.md).

---

## External links

- **Production:** https://jcn-tremor.vercel.app
- **API health:** https://jcn-tremor.vercel.app/api/health
- **GitHub:** https://github.com/alexbernal0/JCN_Vercel_Dashboard
- **Vercel project:** https://vercel.com/obsidianquantitative/jcn-tremor

---

## For another AI or new developer

1. Read [../README.md](../README.md) and [../CHECKPOINT_v1.2.0.md](../CHECKPOINT_v1.2.0.md) for current scope and layout.
2. Read [../ARCHITECTURE.md](../ARCHITECTURE.md) and [../TECH_STACK.md](../TECH_STACK.md) for structure and stack.
3. Read [MOTHERDUCK_INTEGRATION.md](./MOTHERDUCK_INTEGRATION.md) for DB access and symbol rules.
4. Use [PROCEDURES.md](./PROCEDURES.md) for deploy, rollback, and scripts.
5. Use [../CHECKPOINTS.md](../CHECKPOINTS.md) to revert to a known good state.

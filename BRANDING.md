# REEKOD WHITE-LABEL BRANDING SPECIFICATION

REEKOD is a white-label platform designed to support multiple tenants (companies) dynamically. All brand names, colors, logos, support emails, phone numbers, and portals are configurable through environment variables or configuration files.

---

## 1. Company Configuration Schema

The platform configuration resides in the isomorphic file [config/company.js](file:///c:/_MT%20Sistem%20Com/config/company.js). It acts as the single source of truth for both browser-based clients and Express server-side engines.

### Configurable Fields
- `companyName`: The official name of the tenant (e.g. `REEKOD`).
- `companyLogo`: The filename or link to the corporate branding image (e.g. `assets/images/branding/logo.png`).
- `companyColor`: Theme primary color. In the backend PDF generator, this defines the vector logo color stream (`0.5 0 0` for Maroon, `0.77 0.63 0.35` for Gold).
- `supportEmail`: Tenant support contact address (`support@reekod.com`).
- `supportPhone`: Tenant support hotline number (`+60123456789`).
- `portalName`: The visual title of the search app (`REEKOD Semak`).
- `appUrl`: The production host URL (`https://semak.reekod.com`).

---

## 2. Environment Variables Mapping

In production VPS deployments, the brand values are loaded from the backend `.env` variables:
- `COMPANY_NAME` (maps to `companyName`)
- `COMPANY_LOGO` (maps to `companyLogo`)
- `COMPANY_COLOR` (maps to `companyColor`)
- `SUPPORT_EMAIL` (maps to `supportEmail`)
- `SUPPORT_PHONE` (maps to `supportPhone`)
- `APP_NAME` (maps to `portalName`)
- `APP_URL` (maps to `appUrl`)

If these variables are omitted on startup, the system defaults to the global **REEKOD Semak** values.

---

## 3. Future-Ready Multi-Tenant Architecture

To scale the platform to support multiple tenants simultaneously without modifying the source code, follow this plan:

```text
       [ Incoming HTTP Request ]
                  │
                  ▼
         [ Nginx / Cloudflare ]
  (Detects host domain, e.g. client.reekod.com)
                  │
                  ▼
      [ Express Tenant Middleware ]
  (Queries tenant parameters from config database)
                  │
                  ▼
   [ Dynamic Context Construction ]
   ├── Resolves logo path & email SMTP details
   ├── Applies CSS themes to response structures
   └── Generates PDFs using custom color streams
```

### Steps for Deployment:
1. **Tenant Middleware**: Add a middleware that inspects the request header `req.headers.host` and loads the correct company record from a database table `tenants`.
2. **Dynamic CSS Themes**: Deliver theme configurations to the client frontend via a dedicated `GET /api/v1/config/branding` endpoint, allowing the browser to render custom colors on the fly.
3. **Database Separation**: Separate uploaded batches using a `tenant_id` foreign key column across all tables.

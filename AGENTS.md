# AGENT.md

## Overview

This project is a small web application built with:

* Cloudflare Workers
* D1 (SQLite-based serverless database)
* Hono (HTTP framework)
* htmx (HTML-driven UI updates)

The application is a **reading log system** centered around ISBN input.

---

## Development Environment

* `wrangler` and `tsc` are available as global CLI commands in this project environment.
* You may run `wrangler ...` / `tsc ...` directly without `npx`.
* If needed for portability, `npx wrangler ...` and `npx tsc ...` are still acceptable alternatives.

---

## Core Concept

### Primary Input

* The system is **ISBN-first**
* Users manually input ISBN

### Barcode Handling

* Barcode scanning is **not a primary feature**

* It is treated as:

  > "Automatic ISBN input"

* The system must always function without barcode scanning

---

## Architecture

### Request Flow

1. User inputs ISBN (or uploads image)
2. Server resolves ISBN → book metadata
3. Data is stored in D1
4. HTML partial is returned
5. htmx updates UI

---

## UI Design (htmx-first)

* No SPA framework
* Server returns HTML fragments
* htmx handles updates

### Example Patterns

* `hx-post` → submit ISBN
* `hx-get` → fetch book list
* `hx-trigger="every 2s"` → polling job status

---

## Data Model (D1)

### books

* id
* isbn (unique)
* title
* author
* publisher
* cover_url
* created_at

### scan_jobs

* id
* status (`queued`, `processing`, `done`, `failed`)
* image_key (R2 path)
* isbn (nullable)
* result_json (optional)
* created_at
* updated_at

---

## External APIs

### Priority Order

1. openBD (primary)
2. Google Books API (fallback)

### Rules

* Try openBD first
* If not found → fallback to Google Books
* If still not found → allow manual entry

---

## Barcode Strategy

### Input Method

* `<input type="file" accept="image/*">`
* Optional: `capture="environment"`

### Processing

* Image → barcode → ISBN

### Design Principle

* Barcode is optional
* Always fallback to manual ISBN input

---

## Async Processing Model

### DO NOT use WebSockets

### Use polling instead

Flow:

1. Upload image
2. Create job in D1
3. Return "loading" HTML
4. htmx polls `/jobs/:id/status`
5. Replace UI when done

---

## Background Execution

### Simple Mode

* Use `ctx.waitUntil()`

### Scalable Mode

* Use Cloudflare Queues / Workflows

---

## Storage

### Images

* Stored in R2

### Metadata

* Stored in D1

---

## Implementation Phases

### Phase 1 (MVP)

* ISBN input form
* openBD integration
* Save to D1
* List view

### Phase 2

* Google Books fallback
* Better UI (htmx partials)

### Phase 3

* Image upload
* Barcode extraction
* Async job system

### Phase 4 (Optional)

* UX improvements
* Cover image handling
* History / logs

---

## Non-Goals

* No SPA framework
* No WebSocket-based real-time UI
* No complex frontend state management

---

## Design Philosophy

* Server-driven UI
* HTML as API
* Progressive enhancement
* Keep JavaScript minimal
* Prefer simple, composable flows over real-time complexity

---


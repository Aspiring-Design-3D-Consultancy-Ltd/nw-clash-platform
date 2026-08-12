# Architecture Overview

## Purpose

This document provides a high-level overview of the BIM Coordination / Clash Management application architecture.

It is intended to help future developers, investigators, and AI assistants understand the application structure before making changes.

---

# Application Overview

Current implementation:

- Single-page HTML application
- JavaScript-based
- Client-side data persistence
- No dedicated backend service
- Playwright automated testing

Primary file:

working.html

---

# High-Level Architecture

Application Layers:

```text
User Interface
        ↓
Application Logic
        ↓
State Management
        ↓
Persistence Layer
        ↓
localStorage / IndexedDB
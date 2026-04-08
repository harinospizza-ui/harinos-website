# Harino's Backend Scaffold

This folder is a starter backend for the next phase of the project.

What is included:
- Express server entry point
- MySQL connection helper
- `POST /orders` route
- Portable SSD snapshot writer
- `.env.example` for MySQL and SSD settings

Before running it later:
1. Install dependencies inside `backend/`
2. Copy `.env.example` to `.env`
3. Create the MySQL tables `orders` and `order_items`
4. Point `PORTABLE_SSD_ROOT` to your mounted SSD path

The frontend is already prepared to send orders to this backend when `VITE_ORDER_API_BASE_URL` is configured.

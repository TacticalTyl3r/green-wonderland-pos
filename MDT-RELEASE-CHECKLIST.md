# Green Wonderland MDT — release checks

## Scope
No employee scheduling, inventory, stock deduction, or restocking.

## Verified by code review
- Sales & Earnings links to financial reports, transaction history, employee leaderboards, and interactive analytics.
- Employee profiles show time, sales, recognition, and private notes when authorized.
- Dashboard renders announcements, working staff, top performers, recognition, and activity access.
- Sales charts expose dates and daily sales/order details on pointer, click, and keyboard focus.
- Transaction history, financial employee reports, and management activity support CSV exports.
- UI uses permission-gated RPCs for sensitive management operations.
- Frontend JavaScript modules pass syntax checks.

## Still requires live verification
- Boss and employee PIN logins, including role-based navigation and access denial.
- Supabase function permissions and data shapes against production tables.
- Chart hover/touch/keyboard interaction in browser, particularly mobile.
- CSV content opens correctly in spreadsheet software.
- Employee weekly hours match shifts, including overnight shifts and time adjustments.
- Activity history actor attribution and filters.
- Announcement creation/deletion and employee recognition.
- GitHub Pages deployment and browser caching.

## Smoke test
1. Sign in as Boss. Verify Dashboard loads and shows recent announcements.
2. Open Employees, select a worker, verify weekly hours, sales trend, notes and recognition.
3. Open Sales & Earnings, check all four submenu pages and CSV downloads.
4. Test date filtering and chart detail interactions.
5. Test announcement creation and removal.
6. Test recognition creation and reload.
7. Test activity search and CSV download.
8. Sign in as a low-privilege employee and confirm restricted pages and RPCs are inaccessible.

A successful Supabase SQL migration does not verify the browser UI.

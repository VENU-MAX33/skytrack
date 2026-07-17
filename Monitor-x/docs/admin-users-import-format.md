# MonitorX admin Excel import format

The admin panel supports bulk creation from the Driver Management and Employee Management pages.

1. Download the **Format guide** button in either page, or use [`admin-users-import-template.xlsx`](../frontend-vite/public/templates/admin-users-import-template.xlsx).
2. Keep the header row unchanged and remove the example rows.
3. Add one driver per row in `Drivers` or one employee per row in `Employees`.
4. Save as `.xlsx`, upload on the matching admin page, and correct any highlighted rows in the preview.
5. Click **Save rows** only when every row shows **Ready**.

Required fields:

- Drivers: `Name`, `DL Number`, `Contact`.
- Employees: `Employee ID`, `Name`, `Contact`; `Lat/Long` is also required for `Office Transport`.

Use `YYYY-MM-DD` for dates, `HH:MM` for times, and `latitude,longitude` for coordinates. Duplicate IDs, DL numbers, and contacts are rejected as one all-or-nothing import.

The workbook includes example data for both sheets. The sample contacts, IDs, license numbers, and routes are for testing only; replace them before importing real records.

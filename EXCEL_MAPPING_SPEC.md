# EXCEL MAPPING SPECIFICATION

This document details the official structure, mapping rules, and database schemas aligned with the client's official spreadsheet template (`templat_commission_mawar_teraju.xlsx` and `templat_deduction_mawar_teraju.xlsx`) as the single source of truth.

---

## 1. Sheets & Columns Specification

All calculations are parsed from two main sheets. Column configurations are as follows:

### A. Commission Sheet (Sheet Name: `"Commission"` or `"Komisen"`)
*   **Purpose**: Generates the primary Commission Report and PDF layout.
*   **Columns**:
    1.  `Delivery Dispatcher IC No.` (Col A) - `String` (Contains the NRIC directly, e.g. `070614-10-1708`)
    2.  `Delivery Dispatcher ID` (Col B) - `String` (Dispatcher station ID)
    3.  `Delivery Dispatcher Name` (Col C) - `String` (Full dispatcher name)
    4.  `Parcel Quantity` (Col D) - `Number` (Total parcels)
    5.  `Parcel Commission` (Col E) - `Number` (Base commission rate, e.g. RM1.15/parcel)
    6.  `Extra Weight Commission` (Col F) - `Number` (Extra weight commission)
    7.  `Total Commission` (Col G) - `Number` (Total gross commission)
    8.  `ADD: REFUND PENALTY` (Col H) - `Number` (Refund additions)
    9.  `ADD: PICKUP COMMISSION` (Col I) - `Number` (Pickup commission additions)
    10. `ADD: OTHERS` (Col J) - `Number` (Other additions)
    11. `ADD: SORTER` (Col K) - `Number` (Sorter additions)
    12. `NETT COMMISSION` (Col L) - `Number` (Net commission payout)

### B. Deduction Sheet (Sheet Name: `"Deduction"` or `"Potongan"`)
*   **Purpose**: Generates the Deduction Details Report.
*   **Columns**:
    1.  `Delivery Dispatcher IC No.` (Col A) - `String` (Contains the NRIC directly)
    2.  `Delivery Dispatcher ID` (Col B) - `String` (Dispatcher ID)
    3.  `Delivery Dispatcher Name` (Col C) - `String` (Full dispatcher name)
    4.  `DEDUCTION: ADVANCE` (Col D) - `Number` (Cash advance deduction)
    5.  `DEDUCTION: PENDING COD` (Col E) - `Number` (Pending COD deduction)
    6.  `DEDUCTION: HQ PENALTY` (Col F) - `Number` (HQ penalty deduction)
    7.  `DEDUCTION: DUITNOW PENALTY` (Col G) - `Number` (DuitNow payment penalty)
    8.  `DEDUCTION: LATE COD PENALTY` (Col H) - `Number` (Late COD submission penalty)
    9.  `DEDUCTION: LOST INDIVIDUAL` (Col I) - `Number` (Lost parcel individual penalty)
    10. `DEDUCTION: LOST PARCEL HUB` (Col J) - `Number` (Lost parcel shared hub penalty)

---

## 2. NRIC and Dispatcher ID Resolution

1.  **Direct NRIC snapshot**: The NRIC is read directly from Column A (`Delivery Dispatcher IC No.`) of both the Commission and Deduction sheets.
2.  **1-to-Many Profile Mapping Support**: A single NRIC (IC number) can correspond to multiple Dispatcher IDs (e.g. for riders who migrated across stations or hubs).
3.  **2-Step Carian UI**: When searching by NRIC:
    - If multiple Dispatcher IDs are found for that NRIC, the system displays a selection card allowing the user to select the appropriate ID.
    - If multiple batch periods exist, the user is then prompted to choose the report period before the final PDF is generated.

---

## 3. Reference Test Cases

To verify calculations and mapping accuracy, the client's official templates are verified against these test records:

### Case 1: Mohamad Azlan Bin Jaapar
*   **Input NRIC**: `070614-10-1708` (mapped to Dispatcher ID `NSN3052004`)
*   **Calculated Values**:
    *   `Parcel Quantity` = `150`
    *   `Total Commission` = `181.00`
    *   `Total Deductions` = `60.00`
    *   `Nett Commission` = `161.00`

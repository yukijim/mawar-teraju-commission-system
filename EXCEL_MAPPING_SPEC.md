# EXCEL MAPPING SPECIFICATION

This document details the official structure, formulas, data mapping rules, and database schemas aligned with the client's actual spreadsheet templates (`templat_commission_mawar_teraju.xlsx` and `templat_deduction_mawar_teraju.xlsx`) as the Single Source of Truth.

---

## 1. Sheets & Columns Specification

All calculations are parsed from two main sheets. Column configurations are as follows:

### A. Commission Sheet (Sheet Name: `"Commission"`, `"Komisen"`, or `"Dispatcher Comm"`)
*   **Purpose**: Generates the primary Commission Report and PDF layout.
*   **Columns & Data Types**:
    1.  `Delivery Dispatcher ID` (Col A) - `String` (Contains NRIC, e.g. `900101-14-1234`)
    2.  `Delivery Dispatcher Name` (Col B) - `String` (Full dispatcher name)
    3.  `Parcel Quantity` (Col C) - `Number` (Total parcels)
    4.  `Parcel YOYI` (Col D) - `Number` (YOYI exceptions)
    5.  `Net Parcel` (Col E) - `Number` (Net parcel quantity)
    6.  `RM1.15/Parcel Commission` (Col F) - `Number` (Base commission rate, e.g. RM1.15)
    7.  `Exclude Extra Weight YOYI` (Col G) - `Number` (Parcel for extra weight weight exclusions)
    8.  `Extra Weight Commission` (Col H) - `Number` (Extra weight commission)
    9.  `Total Commission` (Col I) - `Number` (Total gross commission)
    10. `ADDITION: REFUND 15JUNE26` (Col J) - `Number` (Addition refund, stored in others/allowance)
    11. `ADDITION: PICKUP COMMISSION` (Col K) - `Number` (Addition pickup commission)
    12. `NETT COMMISSION` (Col L) - `Number` (Net commission before rounding)
    13. `FINAL AMOUNT TO PAY` (Col M) - `Number` (Final rounded amount paid)

### B. Deduction Sheet (Sheet Name: `"Deduction"`, `"Potongan"`, or `"Details Penalty"`)
*   **Purpose**: Generates the Deduction Details Report and PDF layout.
*   **Columns & Data Types**:
    1.  `Delivery Dispatcher ID` (Col A) - `String` (Contains ID or NRIC snapshot)
    2.  `Delivery Dispatcher Name` (Col B) - `String` (Full name snapshot)
    3.  `DEDUCTION: ADVANCE` (Col C) - `Number` (Cash advance deductions)
    4.  `DEDUCTION: PENDING COD` (Col D) - `Number` (Pending COD deductions)
    5.  `DEDUCTION: HQ PENALTY` (Col E) - `Number` (HQ penalty deductions)
    6.  `DEDUCTION: DUITNOW PENALTY` (Col F) - `Number` (DuitNow payment penalty)
    7.  `DEDUCTION: LATE COD PENALTY` (Col G) - `Number` (Late COD submission penalty)
    8.  `DEDUCTION: LOST INDIVIDUAL` (Col H) - `Number` (Lost parcel individual penalty)
    9.  `DEDUCTION: LOST PARCEL HUB` (Col I) - `Number` (Lost parcel shared hub penalty)

---

## 2. NRIC and Dispatcher ID Resolution

1.  **Direct NRIC snapshot**: The NRIC is read directly from Column A (`Delivery Dispatcher ID`) of the Commission sheet, removing any external VLOOKUP file dependency.
2.  **1-to-Many Profile Mapping Support**: A single NRIC (IC number) can correspond to multiple Dispatcher IDs (e.g. for riders who migrated across stations or hubs).
3.  **2-Step Carian UI**: When searching by NRIC:
    - If multiple Dispatcher IDs are found for that NRIC, the system displays a selection card allowing the user to select the appropriate ID.
    - If multiple batch periods exist, the user is then prompted to choose the report period before the final PDF is generated.

---

## 3. Reference Test Cases

To verify calculations and mapping accuracy, the client's official templates are verified against these test records:

### Case 1: Ahmad Bin Ali
*   **Input NRIC**: `900101-14-1234`
*   **Calculated Values**:
    *   `Parcel Quantity` = `150`
    *   `Net Parcel` = `140`
    *   `Total Commission` = `181.00` (Gross commission including Extra Weight)
    *   `Total Deductions` = `60.00` (Advance `20.00` + HQ Penalty `20.00` + Lost `20.00`)
    *   `Final Amount to Pay` = `161.00`

### Case 2: Chong Wei Kang
*   **Input NRIC**: `850202-08-5678`
*   **Calculated Values**:
    *   `Parcel Quantity` = `200`
    *   `Total Commission` = `247.75`
    *   `Total Deductions` = `15.00` (HQ Penalty `15.00`)
    *   `Final Amount to Pay` = `282.75` (including additions)

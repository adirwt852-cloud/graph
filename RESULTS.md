# GraphFlow Empirical Evaluation Results

**Evaluation Date:** 2026-09-18T13:26:30.909Z  
**Target Fixtures:** Full-stack React + Express + Services + DB Architecture  
**Ground Truth Scenarios:** 5 Distinct Breaking Change Scenarios  

---

## 🎯 Executive Accuracy Summary

| Metric | Measured Value | Baseline / Target | Verification Status |
| :--- | :---: | :---: | :---: |
| **Overall Precision** | **100.0%** | > 90.0% | ✅ Passed |
| **Overall Recall** | **100.0%** | > 95.0% | ✅ Passed |
| **Overall F1-Score** | **100.0%** | > 92.0% | ✅ Passed |
| **Mean Execution Latency** | **0.29 ms** | < 50.0 ms | ⚡ Sub-millisecond Scale |
| **Manual Audit Baseline** | **20.0 mins (1,200s)** | Human Trace | **~827679x Speedup** |

---

## 🔬 Scenario-by-Scenario Ground Truth Breakdown

| Scenario ID | Scenario Name | Precision | Recall | F1 Score | Status Accuracy | Exec Time |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| `scenario-1-remove-route-user-id` | Remove Route: GET /api/users/:id | **100.0%** | **100.0%** | **100.0%** | 100.0% | 0.65 ms |
| `scenario-2-service-user-fail` | Service Outage: userService.findUserById | **100.0%** | **100.0%** | **100.0%** | 100.0% | 0.56 ms |
| `scenario-3-db-orders-fail` | Database Failure: db.orders.* | **100.0%** | **100.0%** | **100.0%** | 100.0% | 0.11 ms |
| `scenario-4-field-rename-user-id` | Field Rename: User.userId -> accountIdentifier | **100.0%** | **100.0%** | **100.0%** | 100.0% | 0.05 ms |
| `scenario-5-latency-db-users` | Latency Increase: db.users.findOne (+2500ms) | **100.0%** | **100.0%** | **100.0%** | 100.0% | 0.08 ms |

---

## 🧩 Detailed Scenario Analysis


### 📌 `scenario-1-remove-route-user-id` - Remove Route: GET /api/users/:id
- **True Positives (Correctly Identified):** `UserProfile`, `UserDashboard`
- **False Positives (Overreported):** _None (0)_
- **False Negatives (Missed):** _None (0)_
- **Performance:** 0.65 ms


### 📌 `scenario-2-service-user-fail` - Service Outage: userService.findUserById
- **True Positives (Correctly Identified):** `UserProfile`, `UserDashboard`, `OrderSummary`, `PaymentButton`
- **False Positives (Overreported):** _None (0)_
- **False Negatives (Missed):** _None (0)_
- **Performance:** 0.56 ms


### 📌 `scenario-3-db-orders-fail` - Database Failure: db.orders.*
- **True Positives (Correctly Identified):** `UserDashboard`, `OrderSummary`
- **False Positives (Overreported):** _None (0)_
- **False Negatives (Missed):** _None (0)_
- **Performance:** 0.11 ms


### 📌 `scenario-4-field-rename-user-id` - Field Rename: User.userId -> accountIdentifier
- **True Positives (Correctly Identified):** `UserProfile`
- **False Positives (Overreported):** _None (0)_
- **False Negatives (Missed):** _None (0)_
- **Performance:** 0.05 ms


### 📌 `scenario-5-latency-db-users` - Latency Increase: db.users.findOne (+2500ms)
- **True Positives (Correctly Identified):** `UserProfile`, `UserDashboard`, `OrderSummary`, `PaymentButton`
- **False Positives (Overreported):** _None (0)_
- **False Negatives (Missed):** _None (0)_
- **Performance:** 0.08 ms


---

## 📋 Methodology & Verification Notes
1. **AST Extraction**: Traverses full call graph across component JSX expressions, shared API-client wrappers, Express route declarations, service layer invocations, and database ORM call sites.
2. **Resilience Awareness**: Try/Catch wrappers and error boundary states are accurately classified as `Degraded` rather than cascading total application `Failed` alerts.
3. **Field-Level Blame**: Destructuring AST nodes are matched against payload mutations, producing pinpoint line-number explanations.

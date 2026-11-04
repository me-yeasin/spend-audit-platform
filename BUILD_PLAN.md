# Spend Audit — Build Plan
This file lists exactly what will be included in the application. It is written in plain language so anyone can read it and understand what the product does and what we build.
---
## What the application does
The application helps a user see what they are quietly paying for every month. They upload a bank statement file, and the app shows them a clean list of their recurring charges, flags any charge nobody has named an owner for, and shows a single total monthly cost at the top.
---
## Exact features included
### 1. File upload
The user can open the application and import a bank statement file in CSV format.
- The user can drag and drop a file onto the application.
- The user can also click a button to browse their computer and select a file.
- Once the file is imported, the user can see their transactions listed clearly.
### 2. Transaction list
The application shows every transaction from the uploaded file in a clean, readable list.
- Each transaction shows the date, description, and amount.
- The list is ordered by date, newest first.
- The user can see all their transactions at a glance.
### 3. Recurring charge detection
The application automatically finds charges that repeat every month.
- It looks for transactions that happen again and again, such as subscriptions, memberships, or service fees.
- It groups them together so the user can see them as a category instead of individual rows.
- It counts how many times each charge appears and shows the total amount for each.
### 4. Owner flagging
One of the most important features of the application.
- The application checks each recurring charge.
- If the charge has no owner attached to it, the application flags it clearly.
- Charges with no owner are shown in a separate, highlighted list at the top.
- Each flagged charge shows the description and amount, so the user knows exactly what to chase.
- Charges with a named owner are shown normally, without the special flag.
### 5. Total monthly recurring cost
One clear number at the top of the screen.
- The application adds up all the recurring charges and shows a single "Total monthly recurring cost" number.
- The total updates automatically when a new file is uploaded.
- Below the total, a detailed itemized list shows each group of charges with its own sub-total.
- Currency is shown so the user understands what the number means.
### 6. Monthly re-run
The user can come back and run the application again on a new month's file.
- They upload the next month's file.
- The application re-analyzes everything from scratch.
- The total and the flagged charges update to show the current month.
- The user can compare one month to the next and see what changed.
### 7. No owner list
A dedicated screen that shows every charge the user has not assigned an owner to.
- This is a separate, clearly visible section.
- Each item shows the description and amount.
- The user can use this list to decide who should own each charge and follow up accordingly.
- Items in this section stay in the list until the user resolves them or removes them.
### 8. Clean, simple interface
The application is designed to be easy to understand and quick to use.
- The "Total monthly recurring cost" is the biggest number on the screen.
- Flagged charges are clearly marked and easy to notice.
- The user never needs to read a manual. Everything is visible and intuitive.
- The user can complete their goal in under five minutes.
---
## What is intentionally not included
To keep the application focused and useful, the following are intentionally excluded from the first version:
- No account creation or login.
- No cloud storage or sync.
- No internet connection required.
- No bank account linking — the user uploads a file manually.
- No multi-currency conversion.
- No complex reporting or dashboards.
- No backend or database.
- No AI features in the first version. AI can be added later as an optional extra.
---
## Build order
We build the features in this order:
1. **File upload** — get a CSV into the application.
2. **Transaction list** — show the raw data in a clean list.
3. **Recurring charge detection** — find what repeats and group it.
4. **Owner flagging** — flag charges with no owner.
5. **Total monthly recurring cost** — show the one clear number.
6. **No owner list** — a dedicated, easy-to-read list of unassigned charges.
7. **Monthly re-run** — let the user bring in the next month's file and see it all update.
8. **Clean, simple interface** — make sure the whole experience feels calm, clear, and intuitive.
---
## How the features work together
The user opens the application, uploads their bank statement file, and the app reads it. The transactions appear in a list. The app then highlights what repeats every month and points out which of those recurring charges still have no owner. At the top, a single number shows the total monthly recurring cost.
That is the core loop: upload → see the total → see what needs an owner → re-run next month.
---
## Summary
The application is a simple, free, local tool. It shows a user what they are paying for every month, and it points out the charges they have not assigned to anyone. It is designed to be used once a month, requiring less than five minutes of a user's time.
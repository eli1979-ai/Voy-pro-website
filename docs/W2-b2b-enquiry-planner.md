# W2.4 — Groups and Corporate enquiry planner

The six localized Budapest group / corporate landing pages now have a compact, editable planner that prepares a WhatsApp message. It collects only the user-requested event details in browser memory until the guest chooses to open WhatsApp. The guest must explicitly send the message there; **no CRM lead is created or acknowledged**, and no booking or payment is initiated.

The planner:
- is available in EN/HE/HU;
- includes date, group size, time window, guide-language preference, whether English also works, private intent, organizer name, optional company on corporate pages and notes;
- retains the existing direct WhatsApp links;
- tracks only non-PII interaction metadata if analytics are allowed;
- never writes the form's personal text to the staging API or analytics;
- does not invent a CRM endpoint or claim receipt.

Future work is blocked by `FBM-DEP-006` in `docs/W1-FBM-DEPENDENCIES.md`: a production-safe canonical commercial enquiry write contract with consent/privacy, attribution, CRM id, idempotency and response semantics, then integration and approval. Do not silently upgrade the WhatsApp planner to a fake CRM submission.

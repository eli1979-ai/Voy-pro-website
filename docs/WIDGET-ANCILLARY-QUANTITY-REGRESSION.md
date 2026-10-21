# Native affiliate widget — invalid ancillary quantity

In the current widget, an invalid optional-extra quantity resets the visible field to zero even when the previously accepted quote still contains a positive quantity. This can mislead a customer about the extras being purchased.

Acceptance: after an accepted quantity of 1, entering a value above the offer maximum, a negative number, a fraction, or invalid text must restore the field to the previously accepted quantity of 1. No new quote or booking request should be made for invalid input. The existing valid-quantity, private-hold re-quote, partner attribution and checkout tests must continue to pass.

This document records the issue only; it does not change production behavior or pricing.

Status: regression identified on main; runtime fix pending.

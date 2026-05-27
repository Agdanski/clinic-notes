# Compliance Considerations For Later Production Work

This prototype intentionally stays close to the existing repeat-visit paper note. It is not a compliance certification and should not be used as the final live patient-record system without a production review.

Current CCO materials reviewed on May 26, 2026:

- CCO Standards of Practice page lists `S-002: Record Keeping` and `S-022: Ownership, Storage, Security and Destruction of Records of Personal Health Information`.
- S-002 says CCO does not endorse one particular note-taking template, but records should be consistent, comprehensive, accurate, and legible.
- S-002 allows electronic record keeping if the system is designed and operated in accordance with the standard, including PHIPA compliance, cyber security protections, breach protocols, printable hard copies, encryption for personal health information on mobile devices, and individualized entries.
- S-002 states each entry should be dated and clearly identify the person who made the entry.
- S-002 states records should be retained for at least seven years after the last visit, or for minors, at least seven years after the patient became or would have become 18.

Production backlog items:

- User authentication and role-based access.
- Encrypted storage on tablets and in any server/cloud database.
- Audit log for creation, printing, export, corrections, and amendments.
- Patient identifiers and treating chiropractor header/footer on printed pages.
- Abbreviation legend/key for all clinic shorthand.
- Printable export that can be produced within the required access window.
- Backup and restore procedure.
- Privacy-breach response workflow.
- Data-retention and secure-destruction workflow.
- Review with the clinic's regulatory/privacy advisor before live PHI use.

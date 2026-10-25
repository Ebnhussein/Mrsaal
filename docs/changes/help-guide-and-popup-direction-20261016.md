# Current product guidance and popup direction

The bilingual product guide is the shared source for support assistant retrieval, ready-made support answers, help-centre search answers, and workspace walkthroughs. Its version is exposed by the support topic catalogue and help-search catalogue. Updating this guide updates those surfaces on the next deployment; it does not automatically learn new product behavior from code.

This update documents MrsaalWA experimental pairing, the Baileys alternative, Google identity confirmation, multiple Gmail senders, explicit AI generation, schedule cancellation when editing, and rejection of elapsed scheduled times. New searchable topics cover these changes. Existing WhatsApp and Gmail instructions have been corrected.

Popup roots now follow the active workspace language, including reused dialogs and overlays. Walkthrough controls have explicit English labels. Message content retains automatic direction, and technical inputs retain their own direction.

## Manual checks after deployment

- Open an AI-provider manual, preview, confirmation dialog, support chat and walkthrough in English. Check left-to-right text, readable lists and control labels. Switch to Arabic and back with a dialog open; reopen any dismissed walkthrough.
- Search help for “scheduled time passed”, “MrsaalWA” and their Arabic equivalents. Check the answers describe the current interface and do not promise automatic AI writing.
- Ask the support assistant about an expired schedule and MrsaalWA. It should use the current guide, without claiming to perform linking or sending itself.
- Verify that Arabic text in a user-authored message stays readable when the workspace is English.

Automated coverage checks bilingual guide completeness, latest help-search results, support fallback retrieval, walkthrough direction and labels, and popup direction when changing languages. Real-device visual checks remain manual.

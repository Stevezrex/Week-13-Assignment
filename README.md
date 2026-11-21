# Week 13 simulation: Cloud files and collaborative work

A static site (`public/`) with Netlify Functions (`netlify/functions/`) and Netlify Blobs. Build settings, headers and Node version are in `netlify.toml`. There is no build command.

Needs one environment variable, scope Functions: `ASSESSOR_PASSWORD`. Without it the assessor page answers with a setup message.

Learners open `/`. The assessor opens `/assessor.html`. Learners whose email ends `@test.example` stay hidden on the assessor page until Show test accounts is ticked.

// Test helper for the shim argv-fidelity test: prints its argv (past the
// script name) as JSON so the test can assert byte-identical delivery.
process.stdout.write(JSON.stringify(process.argv.slice(2)))

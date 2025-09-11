#!/usr/bin/env ts-node

/**
 * Migration CLI entry point
 * This replaces the old migrate.ts and provides a more robust migration system
 */

import { MigrationCLI } from '../src/libs/database';

async function main() {
  const cli = new MigrationCLI();
  const program = cli.setupCommands();
  
  // Parse command line arguments
  program.parse(process.argv);
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled promise rejection:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

// Run the CLI
if (require.main === module) {
  main().catch((error) => {
    console.error('Migration CLI failed:', error);
    process.exit(1);
  });
}
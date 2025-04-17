# Data Directory

This directory stores the SQLite database file for the Scorecard application.

By default, the application will create a file named `scorecard.db` in this directory.

The location of the database can be configured using environment variables. See the main README.md for details.

## Notes

- This directory is created automatically if it doesn't exist
- The database file is not tracked by git (.gitignore)
- Database backups will also be stored in this directory
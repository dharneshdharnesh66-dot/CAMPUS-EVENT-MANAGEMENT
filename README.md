# Campus Event Management

CampusConnect is a project built with React, Vite, Express and MongoDB. It currently runs on one computer. Uploading this code to GitHub does not deploy the working app.

## Features

- Student signup, login and logout with server-side sessions and password hashing.
- Saved profiles and generated student IDs.
- Admin event creation and cancellation.
- Event browsing, category filters, registrations and registration removal.
- Admin lists of registered students.
- In-app new-event notifications and reminders for registered events starting within one hour, with saved read status.
- Student messages to a shared admin-team inbox, with saved replies and unread counts.
- QR entry tickets with printing and PNG download; admin camera, image-upload or code validation and confirmed check-in. Duplicate entry is rejected.
- A shared top navigation, responsive layouts and compact laptop typography.
- Simulated checkout success, failure and cancellation for testing. No real money is collected.

## Run locally on Windows

Install Node.js 22.12 or newer and MongoDB Community Server. Make sure the MongoDB Windows service is running.

Open PowerShell in the project folder:

```powershell
npm.cmd ci
npm.cmd run build
cd server
npm.cmd ci
npm.cmd start
```

Keep that terminal open. Visit http://127.0.0.1:3001 in your browser. The server serves the built frontend and API from the same address. After changing frontend files, run `npm.cmd run build` again from the project root, then refresh the browser.

The default local database is `campus_event_management` at `mongodb://127.0.0.1:27017`. No accounts, passwords, event records, sessions or database backups are included in this repository. Create your own accounts in the app.

### Create an admin

Sign up normally first. Stop the server with Ctrl+C. In the `server` folder, run the following with the email of your own existing account:

```powershell
npm.cmd start -- --make-admin your-account@example.com
npm.cmd start
```

Sign out and sign in again. Only someone with access to the local computer should run this command. There is no preset admin password.

## Limits and safety

- This is a local classroom project, not a production deployment. The server accepts localhost requests only. Hosting needs a separate configuration and security review, HTTPS, secure session settings and database access controls.
- Restarting the server requires signing in again.
- Notifications appear inside the app while it is open. They are not email, SMS or closed-app push notifications.
- Checkout is a simulation, not a payment gateway. Its reference QR is not a bank or UPI payment request. Only the simulation controls change test checkout status.
- Messages are in-app text only, with manual refresh. All campus admins share the inbox. No attachments or external message alerts.
- Entry QR codes can be copied. Admins should check identity before confirming entry. Camera access depends on browser permission and a supported secure context, such as localhost.
- The frontend stylesheet loads fonts from Google Fonts. Font availability depends on internet access.
- Review dependencies before deployment. On November 19, 2026, npm audit reported no known vulnerabilities for either lockfile. This is a point-in-time dependency check, not a full security audit. Test dependency updates before using them.
- Never commit `.env` files, credentials, real student information, database exports or session data. Ignore rules are a precaution, not a substitute for checking staged files.


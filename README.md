# TLS Tec

### Business Management & Documentation App for TLS Technology

A mobile business utility designed to help TLS Technology manage its
product catalogue, quotations, invoices, customer payments, and business
records in one place.

**Developed by Rushiru Karunarathna**\
**Contact:** <rushiru.dev@gmaill.com>

[![React
Native](https://img.shields.io/badge/React_Native-0.87.1-20232A?logo=react)](https://reactnative.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.x-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Platform](https://img.shields.io/badge/Platform-Android%20%7C%20iOS-brightgreen)](#)
:::

------------------------------------------------------------------------

## About the Project

**TLS Tec** is a mobile application created for **TLS Technology**, a
business providing CCTV and security solutions. It helps organize
day-to-day business tasks by bringing product management, quotation
preparation, invoicing, payment tracking, PDF document generation, and
data backups into a single app.

Instead of preparing business documents separately and keeping product
and payment details in different places, TLS Tec provides a central
mobile workspace to create and manage these records.

The app is built with a local-first approach. Business records are
stored in a SQLite database inside the app's private storage on the
device. Google Drive backup is available as an optional way to back up
and restore that database.

## What Can You Do With TLS Tec?

### 1. Product & Category Management

-   Create product categories.
-   Add products with model names, descriptions, and unit prices.
-   Browse products in card or table view.
-   Search and filter products by name, category, or description.
-   Update or delete saved products.
-   Use the saved product catalogue when preparing invoices and
    quotations.

### 2. Quotations

-   Prepare quotations for customers.
-   Add products or manually entered items.
-   Enter customer contact details and address.
-   Set item quantities, unit prices, and discounts.
-   Save quotations and view quotation history.
-   Edit saved quotations.
-   Generate quotation PDFs and share them.

### 3. Invoices

-   Create and update customer invoices.
-   Add products, quantities, prices, and discounts.
-   Record customer details, including name, phone number, and
    installation address.
-   Add serial-number and warranty information where applicable.
-   Record payments against invoices.
-   Track outstanding balances and payment status.
-   Generate invoice PDFs and share them.

### 4. Invoice & Payment Overview

The home screen provides quick business information, including: - Total
number of invoices. - Number of invoices with pending payments. - Number
of products in the catalogue.

Invoice history can be searched using an invoice number, customer name,
or mobile number. Payment status is shown as **Paid**, **Partially
Paid**, or **Unpaid**, based on the recorded balance.

### 5. Business Settings

-   Configure business information used in documents.
-   Manage invoice-related settings and options.
-   Save app preferences locally.

### 6. Backup & Restore

-   Create a database backup on the device.
-   Connect a Google account for Google Drive backups.
-   Back up the app database to the app-specific Google Drive data area.
-   Restore a database backup from Google Drive or a device backup.
-   Configure automatic backup frequency (daily or weekly).
-   View backup progress and backup status.

### 7. App Experience

-   Light and dark themes.
-   Theme preference saved on the device.
-   A branded splash screen and home dashboard.
-   A responsive interface built with React Native.

------------------------------------------------------------------------

## Screens & Main Areas

  Area                Purpose
  ------------------- --------------------------------------------------------
  Home                Dashboard, quick statistics, and shortcuts
  Products            Browse, search, filter, edit, and delete products
  Add Product         Add products and create categories
  New Invoice         Prepare invoices and record payments
  Invoices            Search and manage invoice history
  New Quotation       Prepare and save customer quotations
  Quotation History   Review and edit saved quotations
  Settings            Business details, app preferences, and backup controls

------------------------------------------------------------------------

## Technology Stack

  Technology / Library                     Usage
  ---------------------------------------- ---------------------------------------------
  React Native                             Cross-platform mobile application
  TypeScript                               Application development with static typing
  SQLite (`react-native-sqlite-storage`)   Local business database
  AsyncStorage                             Persistent app preferences, including theme
  Google Sign-In                           Google account connection
  Google Drive API                         Optional database backup and restore
  React Native FS                          Local file and backup handling
  React Native HTML to PDF                 PDF document generation
  React Native Share                       Sharing generated documents and files
  React Native SVG                         Icons and vector assets
  React Native Community Blur              Blur effects in the interface
  React Native Safe Area Context           Safe-area layout support

------------------------------------------------------------------------

## Data Storage & Privacy

TLS Tec is designed around local storage:

-   Product, customer, quotation, invoice, payment, and business records
    are stored in the app's local SQLite database.
-   The app does not use an application server to receive or store these
    business records.
-   Google Drive access is optional and is used for the backup and
    restore features selected by the user.
-   The app requests the Google Drive `drive.appdata` scope for its
    app-specific backup files.
-   PDFs and backup files are shared only when the user chooses to share
    them through another app or recipient.

**Important:** Local records may be lost if app storage is cleared or
the app is uninstalled. Create a backup before removing the app or
clearing its data.

Read the [Privacy Policy](./privacy-policy.html) for more information.

------------------------------------------------------------------------

## Getting Started

### Prerequisites

-   **Node.js:** `>= 22.11.0`
-   npm (included with Node.js)
-   **Android Studio** with the Android SDK and an Android emulator, or
    a physical Android device
-   **Java Development Kit (JDK)** compatible with the installed React
    Native / Android Gradle setup
-   **Git**

For iOS development, you also need a Mac with Xcode, Ruby, and
CocoaPods.

Complete the official React Native environment setup for your operating
system:

https://reactnative.dev/docs/set-up-your-environment

### 1. Clone the Repository

``` bash
git clone https://github.com/Rushiru-Dev/tls_tec.git
```

### 2. Open the Project

``` bash
cd tls_tec
```

### 3. Install Dependencies

``` bash
npm install
```

The project uses `patch-package` through its post-install script to
apply required dependency patches.

### 4. Configure Google Drive (Optional)

Google Drive backup requires a Google OAuth **Web application Client
ID**.

1.  Open `src/config/googleDrive.ts`.
2.  Set `GOOGLE_WEB_CLIENT_ID` to the Web application OAuth client ID
    configured for your own application.
3.  Do not add a Google client secret to the mobile app.
4.  Configure the matching Android OAuth setup and package/signing
    details in Google Cloud Console.

The project uses the Google Drive `drive.appdata` scope for app-specific
backup storage. Google Drive backup will not work until the OAuth
configuration is valid.

### 5. Start Metro

``` bash
npm start
```

Keep this terminal running while building the app.

### 6. Run on Android

Open another terminal in the project folder and run:

``` bash
npm run android
```

Make sure an Android emulator is running or an Android device is
connected with USB debugging enabled.

### 7. Run on iOS (macOS only)

``` bash
bundle install
cd ios
pod install
cd ..
npm run ios
```

------------------------------------------------------------------------

## Useful Commands

  Command             Description
  ------------------- ------------------------------------
  `npm install`       Install project dependencies
  `npm start`         Start the Metro development server
  `npm run android`   Build and run the Android app
  `npm run ios`       Build and run the iOS app
  `npm test`          Run the Jest test suite
  `npm run lint`      Run ESLint

------------------------------------------------------------------------

## Project Structure

``` text
tls_tec/
├── android/                 # Native Android project
├── ios/                     # Native iOS project
├── src/
│   ├── config/              # App configuration (including Google Drive)
│   ├── database/            # SQLite database and repositories
│   ├── img/                 # Images, logos, and icons
│   ├── screens/             # App screens and user interface
│   └── services/            # Invoice, quotation, PDF, settings, and backup logic
├── scripts/                 # Project scripts
├── patches/                 # Dependency patches
├── App.tsx                  # Main application entry component
├── package.json             # Dependencies and scripts
├── privacy-policy.html      # App privacy policy
└── README.md
```

------------------------------------------------------------------------

## Project Information

-   **Application:** TLS Tec
-   **Business:** TLS Technology
-   **Developer:** Rushiru Karunarathna
-   **Email:** rushiru.dev@gmaill.com
-   **Repository:** https://github.com/Rushiru-Dev/tls_tec
-   **Primary purpose:** Product, quotation, invoice, payment, and
    business-record management for TLS Technology.

## License

This repository is intended for the TLS Tec project developed for TLS
Technology. It is not presented as an open-source project. Copying,
redistribution, modification, or commercial use should be done only with
permission from the relevant rights holder.

------------------------------------------------------------------------

:::
**TLS Tec**\
*Manage products. Prepare quotations. Create invoices. Keep business
records organized.*

Developed by **Rushiru Karunarathna**\
<rushiru.dev@gmaill.com>\
Made with ❤️ in Sri Lanka 🇱🇰\
:::

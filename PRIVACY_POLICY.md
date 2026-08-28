# Vegam Privacy Policy

**Effective Date:** July 23, 2026

Vegam ("we", "us", "our") operates the open-source software and the hosted service at vegam.io. We believe in minimal data collection and maximum transparency.

This Privacy Policy explains what data we collect, how it is used, and how it is protected.

## 1. What Data We Collect

**When using the Hosted Service:**
- **Connection Details:** We process the broker connection details you provide (e.g., hostnames, port numbers, usernames, and passwords) solely for the purpose of establishing a temporary connection to your broker during an active simulation.
- **Server Telemetry:** We collect ephemeral server-side metrics (e.g., event counts, throughput, anomaly scores) during your simulation runs.

**What We Do NOT Collect:**
- We **do not** collect personal identifiable information (PII) such as your name or email unless you explicitly provide it (e.g., via a support request).
- We **do not** store any connection credentials (passwords, API keys) on our servers.

## 2. Where Data is Stored

- **Local Storage:** Your broker configurations and scenarios are saved locally in your browser's `localStorage`. Vegam does not transmit these saved configurations to our servers. Any passwords or API keys you input are kept in-memory for the duration of the session and are **never** persisted to `localStorage` or sent to our databases.
- **Ephemeral Server Memory:** Telemetry and metrics generated during a simulation are stored in memory on our servers for a limited time (typically less than a few hours) and are reset whenever the server restarts.

## 3. How We Use Your Data

We use the data we collect solely to:
- Provide and maintain the Vegam simulation service.
- Prevent abuse and enforce our [Terms of Use](./TERMS_OF_USE.md) and governor quotas.

## 4. Data Sharing

We do not sell, rent, or trade your data. We do not share your data with any third parties, except as required by law.

## 5. Security

We take reasonable measures to protect your data. All communication between your browser and our servers is encrypted via HTTPS. Our API endpoints are protected by SSRF (Server-Side Request Forgery) guards and IP rate-limiting. 

## 6. Your Rights

Because we do not store your data on our servers (other than ephemeral telemetry), you have full control over your data. You can clear your browser's local storage at any time to remove your saved connections and scenarios.

## 7. Governing Law

This Privacy Policy is governed by and construed in accordance with the laws of the State of Delaware, without regard to its conflict of law principles.

## 8. Changes to This Policy

We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page.

## 9. Contact Us

If you have any questions about this Privacy Policy, please contact us by creating an issue on our [GitHub repository](https://github.com/vegam-io/vegam).
